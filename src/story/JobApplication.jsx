// The job application you sign at the start of the game (the `{ application: true }`
// step in scenes.js). You type your name and sign by hand with the mouse or a finger.
// onSigned({ name, signature }) gets the name and the signature as a PNG data URL;
// the game keeps both and shows the signature on every intake report (pull results).
import { useEffect, useRef, useState } from 'react';
import { playPress, playStamp, penStart } from '../utils/sfx';

// The fine print. Edit freely.
const APPLICATION_TERMS = [
  'The Initiative is not responsible for injury, death, or being eaten.',
  'The applicant agrees to manage, deploy and keep alive the agents assigned to them.',
  'Agents are not to be clicked on. Monsters are.',
  'Overtime is not paid. Ever.',
];
const POSITION = 'Field Manager (probationary)';
const DEPARTMENT = 'Anomaly Response';
const INK = '#1d2a6b';
const MIN_INK = 90;   // px of pen travel before a signature counts

export default function JobApplication({ onSigned, initialName = '' }) {
  const [name, setName] = useState(initialName);
  const [ink, setInk] = useState(0);
  const [stamped, setStamped] = useState(false);
  const canvasRef = useRef(null);
  const pen = useRef(null);       // the stroke being drawn: last points and width
  const scratch = useRef(null);   // the pen sound
  useEffect(() => () => scratch.current?.stop(), []);
  const inkRef = useRef(0);

  // size the canvas to its box (sharp on high-DPI screens)
  useEffect(() => {
    const c = canvasRef.current, r = c.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.fillStyle = INK;
  }, []);

  const local = e => { const r = canvasRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; };
  const down = e => {
    if (stamped) return;
    e.preventDefault(); e.stopPropagation();
    try { canvasRef.current.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    const p = local(e);
    pen.current = { pts: [p, p], w: 2.6 };
    scratch.current?.stop(); scratch.current = penStart();
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2); ctx.fill();   // a dot for a tap
  };
  const move = e => {
    const s = pen.current; if (!s) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const ctx = canvasRef.current.getContext('2d');
    for (const ev of evs.length ? evs : [e]) {
      const p = local(ev), [a, b] = s.pts.slice(-2);
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < 0.8) continue;
      // faster = thinner, like a real pen; eased so the line doesn't jump
      const speed = d / Math.max(1, p.t - b.t);
      scratch.current?.speed(speed);
      s.w += (Math.max(1.3, Math.min(3.4, 3.6 - speed * 1.1)) - s.w) * 0.35;
      // smooth curve through the midpoints
      const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, m2 = { x: (b.x + p.x) / 2, y: (b.y + p.y) / 2 };
      ctx.lineWidth = s.w;
      ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.quadraticCurveTo(b.x, b.y, m2.x, m2.y); ctx.stroke();
      s.pts.push(p);
      inkRef.current += d;
    }
    if (inkRef.current >= MIN_INK && ink < MIN_INK) setInk(inkRef.current);
  };
  const up = () => { pen.current = null; scratch.current?.stop(); scratch.current = null; setInk(inkRef.current); };

  const clear = () => {
    if (stamped) return;
    playPress();
    const c = canvasRef.current; c.getContext('2d').clearRect(0, 0, c.width, c.height);
    inkRef.current = 0; setInk(0);
  };

  // the signature, cropped to the ink and kept small
  const exportSignature = () => {
    const c = canvasRef.current, ctx = c.getContext('2d');
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return null;
    const pad = 6, w = x1 - x0 + 1 + pad * 2, h = y1 - y0 + 1 + pad * 2;
    const scale = Math.min(1, 140 / h, 520 / w);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(w * scale)); out.height = Math.max(1, Math.round(h * scale));
    out.getContext('2d').drawImage(c, x0 - pad, y0 - pad, w, h, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  };

  const ready = name.trim().length > 0 && ink >= MIN_INK && !stamped;
  const submit = () => {
    if (!ready) return;
    const signature = exportSignature();
    if (!signature) return;
    setStamped(true);
    setTimeout(() => playStamp(1.2), 220);   // when the stamp lands
    setTimeout(() => onSigned({ name: name.trim().slice(0, 20), signature, signedAt: new Date().toISOString() }), 1500);
  };

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <div className="ja-screen" onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      <style>{CSS}</style>
      <div className={`ja-paper${stamped ? ' done' : ''}`}>
        <div className="ja-top">
          <div>
            <div className="ja-org">FRAIL INITIATIVE</div>
            <div className="ja-form">FORM FI-01 · APPLICATION FOR EMPLOYMENT</div>
          </div>
          <div className="ja-conf">CONFIDENTIAL</div>
        </div>

        <div className="ja-grid">
          <span className="ja-k">POSITION</span><span className="ja-v">{POSITION}</span>
          <span className="ja-k">DEPARTMENT</span><span className="ja-v">{DEPARTMENT}</span>
          <span className="ja-k">START DATE</span><span className="ja-v">{today}</span>
          <label className="ja-k" htmlFor="ja-name">APPLICANT</label>
          <input id="ja-name" className="ja-input" value={name} maxLength={20} placeholder="your name" autoComplete="off" spellCheck={false}
            disabled={stamped} onChange={e => setName(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); }} />
        </div>

        <div className="ja-terms">
          <div className="ja-k">TERMS OF EMPLOYMENT</div>
          <ol>{APPLICATION_TERMS.map(t => <li key={t}>{t}</li>)}</ol>
        </div>

        <div className="ja-sign">
          <div className="ja-k">SIGNATURE OF APPLICANT</div>
          <div className="ja-pad">
            <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
            <span className="ja-x">✕</span>
            <span className="ja-base" />
            {ink === 0 && <span className="ja-hint">sign here with your mouse or finger</span>}
          </div>
        </div>

        <div className="ja-buttons">
          <button className="ja-btn ghost" onClick={clear} disabled={stamped || ink === 0}>Clear</button>
          <button className="ja-btn" onClick={submit} disabled={!ready}>Sign &amp; submit</button>
        </div>
        {!stamped && !ready && <div className="ja-need">{!name.trim() ? 'Type your name, then sign.' : ink < MIN_INK ? 'Sign in the box.' : ''}</div>}

        {stamped && <div className="ja-stamp">HIRED</div>}
      </div>
    </div>
  );
}

const CSS = `
  .ja-screen { position:fixed; inset:0; z-index:200; display:flex; align-items:safe center; justify-content:center; overflow:auto; padding:18px 12px;
    background: radial-gradient(ellipse 60% 45% at 50% 0%, rgba(255,196,110,0.18), transparent 70%), linear-gradient(180deg,#1d1612,#0b0807);
    cursor:auto; animation: jaFade .4s ease both; }
  .ja-paper { position:relative; width:100%; max-width:560px; color:#211a12; font-family:var(--font-dialogue); padding:22px 24px 20px; border-radius:3px;
    background: radial-gradient(ellipse at 30% 15%, rgba(255,255,255,.45), transparent 60%), repeating-linear-gradient(0deg, rgba(120,95,60,.05) 0 1px, transparent 1px 3px), #ece2c9;
    box-shadow: 0 20px 50px rgba(0,0,0,.7), 0 2px 4px rgba(0,0,0,.5); transform: rotate(-0.6deg); animation: jaIn .6s cubic-bezier(.2,.8,.25,1.05) both; }
  .ja-top { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; border-bottom:2px solid #211a12; padding-bottom:8px; margin-bottom:12px; }
  .ja-org { font-size:22px; letter-spacing:4px; }
  .ja-form { font-size:10.5px; letter-spacing:1px; color:#5e5140; }
  .ja-conf { font-family:var(--font-hit); color:#a3151c; border:2px solid #a3151c; padding:0 6px; font-size:13px; transform:rotate(6deg); opacity:.8; white-space:nowrap; }
  .ja-grid { display:grid; grid-template-columns:auto 1fr; gap:8px 14px; align-items:baseline; }
  .ja-k { font-size:10px; letter-spacing:1.5px; color:#6f6150; }
  .ja-v { font-size:15px; border-bottom:1px dotted rgba(40,30,20,.4); padding-bottom:2px; }
  .ja-input { font-family:var(--font-narration); font-size:24px; color:${INK}; background:transparent; border:none; border-bottom:1.5px solid #211a12; padding:0 2px 2px; outline:none; min-width:0; width:100%; }
  .ja-input::placeholder { color:rgba(33,26,18,.3); }
  .ja-terms { margin-top:14px; }
  .ja-terms ol { margin:4px 0 0; padding-left:20px; font-size:12px; line-height:1.5; color:#3a3024; }
  .ja-sign { margin-top:14px; }
  .ja-pad { position:relative; height:130px; margin-top:4px; background:rgba(255,255,255,.35); border:1px dashed rgba(40,30,20,.35); border-radius:3px; }
  .ja-pad canvas { position:absolute; inset:0; width:100%; height:100%; touch-action:none; cursor:crosshair; z-index:2; }
  .ja-x { position:absolute; left:10px; bottom:22px; font-size:16px; color:#6f6150; }
  .ja-base { position:absolute; left:30px; right:14px; bottom:26px; border-bottom:1.5px solid #211a12; }
  .ja-hint { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:12px; color:rgba(33,26,18,.4); pointer-events:none; }
  .ja-buttons { display:flex; justify-content:flex-end; gap:10px; margin-top:16px; }
  .ja-btn { font-family:var(--font-dialogue); font-size:15px; padding:9px 18px; border-radius:4px; cursor:pointer; color:#fff3e6; background:#a3151c;
    border:2px solid #211a12; box-shadow:3px 3px 0 #211a12; transition: transform .1s, box-shadow .1s; }
  .ja-btn:hover:not(:disabled) { transform:translate(-1px,-1px); box-shadow:4px 4px 0 #211a12; }
  .ja-btn:active:not(:disabled) { transform:translate(2px,2px); box-shadow:1px 1px 0 #211a12; }
  .ja-btn:disabled { opacity:.45; cursor:default; }
  .ja-btn.ghost { background:transparent; color:#211a12; }
  .ja-need { text-align:right; font-size:11px; color:#7a6a54; margin-top:6px; }
  .ja-stamp { position:absolute; right:40px; top:44%; font-family:var(--font-hit); font-size:64px; letter-spacing:4px; color:#b3121b; border:6px solid #b3121b;
    border-radius:10px; padding:0 18px; transform:rotate(-16deg); opacity:.85; mix-blend-mode:multiply; pointer-events:none;
    animation: jaStamp .3s cubic-bezier(.3,1.5,.5,1) both; }
  @media (max-width: 520px) { .ja-paper { padding:16px 14px; } .ja-org { font-size:17px; } .ja-stamp { font-size:44px; right:16px; } }
  @keyframes jaFade { from { opacity:0; } to { opacity:1; } }
  @keyframes jaIn { from { opacity:0; transform: translateY(40px) rotate(-3deg); } to { opacity:1; transform: rotate(-0.6deg); } }
  @keyframes jaStamp { from { opacity:0; transform: rotate(-16deg) scale(2.8); } to { opacity:.85; transform: rotate(-16deg) scale(1); } }
`;
