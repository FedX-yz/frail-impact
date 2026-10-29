// The interview test (the `{ test: true }` step in scenes.js). Two pages:
//   1. an impossible maths paper with a pen to scribble on — it counts for nothing,
//      it's only there to mess with you
//   2. the real test: three questions. Two or more wrong = you fail the interview
//      (the scene then jumps to ENDING 1).
// onDone(passed, rightAnswers) when they hand it in.
import { useEffect, useRef, useState } from 'react';
import { playPress, playStamp, penStart } from '../utils/sfx';

// Page 1: the joke. Edit freely.
const NONSENSE = [
  { n: '1', q: 'Evaluate, and show your work:', math: <>∮<sub>∂Ω</sub> e<sup>−x²</sup> · ζ(s) / Γ(½ + iπ) ∧ d(√−1) · lim<sub>n→∞</sub> Σ<sub>k=0</sub><sup>n</sup> (−1)<sup>k</sup> ∫<sub>0</sub><sup>∞</sup> sin(kx²) / ln(x!) dx</> },
  { n: '2', q: 'A Havoc runs at you at 340 km/h. Your coffee is 82°C. Find the eigenvalues of:', math: <>[ 3 &nbsp;∞ &nbsp;−i ; &nbsp;√2 &nbsp;0 &nbsp;e<sup>π</sup> ; &nbsp;ℵ<sub>0</sub> &nbsp;7 &nbsp;¾ ]</> },
  { n: '3', q: 'Prove or disprove. Use the space below.', math: <>∀ε&gt;0 ∃δ&gt;0 : &nbsp;P = NP &nbsp;⇔ &nbsp;Havoc(x) ≠ Havoc(x)</> },
];
// Page 2: the real questions (about the opening). Edit freely: `a` is the index of the right answer.
const QUESTIONS = [
  { q: 'What are the creatures that overran the world called?', options: ['Frails', 'Havoc', 'Hollows', 'Mutants'], a: 1 },
  { q: 'What are the territories they took from humans called?', options: ['Dead Zones', 'Red Zones', 'Frail Environments', 'Ground Zero'], a: 2 },
  { q: 'As a manager, where do you watch the battlefield from?', options: ['The front line', 'Drones above', 'A bunker', 'You don\'t'], a: 1 },
];
const INK = '#1d2a6b';

export default function InterviewTest({ onDone }) {
  const [page, setPage] = useState(0);
  const [picks, setPicks] = useState([]);
  const [handed, setHanded] = useState(false);
  const all = QUESTIONS.every((_, i) => picks[i] != null);
  const right = QUESTIONS.filter((q, i) => picks[i] === q.a).length;
  const hand = () => {
    if (!all || handed) return;
    playPress(); setHanded(true);
    setTimeout(() => playStamp(1), 250);
    setTimeout(() => onDone(right >= QUESTIONS.length - 1, right), 1600);
  };
  return (
    <div className="it-screen" onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      <style>{CSS}</style>
      <div key={page} className="it-paper">
        <div className="it-top">
          <div>
            <div className="it-org">FRAIL INITIATIVE</div>
            <div className="it-form">FORM FI-00 · MANAGERIAL APTITUDE EXAMINATION · PAGE {page + 1}/2</div>
          </div>
          <div className="it-conf">TIMED</div>
        </div>
        {page === 0 ? (
          <>
            <div className="it-note">Answer every question. Calculators are not permitted. Neither is crying.</div>
            {NONSENSE.map(p => (
              <div key={p.n} className="it-q">
                <div><b>{p.n}.</b> {p.q}</div>
                <div className="it-math">{p.math}</div>
              </div>
            ))}
            <Scratch />
            <div className="it-buttons"><button className="it-btn" onClick={() => { playPress(); setPage(1); }}>Turn the page ▸</button></div>
          </>
        ) : (
          <>
            <div className="it-note">Part B. Circle one answer for each question.</div>
            {QUESTIONS.map((q, i) => (
              <div key={i} className="it-q">
                <div><b>{i + 1}.</b> {q.q}</div>
                <div className="it-opts">
                  {q.options.map((o, j) => (
                    <button key={j} className={`it-opt${picks[i] === j ? ' on' : ''}`} disabled={handed}
                      onClick={() => { playPress(); setPicks(p => { const n = [...p]; n[i] = j; return n; }); }}>
                      <span className="it-letter">{'ABCD'[j]}</span>{o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="it-buttons">
              <button className="it-btn ghost" onClick={() => { playPress(); setPage(0); }} disabled={handed}>◂ Page 1</button>
              <button className="it-btn" onClick={hand} disabled={!all || handed}>Hand it in</button>
            </div>
            {handed && <div className={`it-grade${right >= QUESTIONS.length - 1 ? '' : ' fail'}`}>{right}/{QUESTIONS.length}</div>}
          </>
        )}
      </div>
    </div>
  );
}

// Scratch paper: draw with the mouse or a finger (it changes nothing)
function Scratch() {
  const ref = useRef(null), pen = useRef(null), scratch = useRef(null);
  useEffect(() => {
    const c = ref.current, r = c.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
    return () => scratch.current?.stop();
  }, []);
  const at = e => { const r = ref.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = e => {
    e.preventDefault();
    try { ref.current.setPointerCapture(e.pointerId); } catch { /* gone */ }
    pen.current = at(e); scratch.current?.stop(); scratch.current = penStart();
  };
  const move = e => {
    if (!pen.current) return;
    const ctx = ref.current.getContext('2d');
    for (const ev of e.getCoalescedEvents ? e.getCoalescedEvents() : [e]) {
      const p = at(ev), b = pen.current, d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < 0.8) continue;
      scratch.current?.speed(d / 8);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      pen.current = p;
    }
  };
  const up = () => { pen.current = null; scratch.current?.stop(); scratch.current = null; };
  return (
    <div className="it-pad">
      <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      <span className="it-hint">working space</span>
    </div>
  );
}

const CSS = `
  .it-screen { position:fixed; inset:0; z-index:200; display:flex; align-items:safe center; justify-content:center; overflow:auto; padding:18px 12px;
    background: radial-gradient(ellipse 60% 45% at 50% 0%, rgba(255,196,110,0.16), transparent 70%), linear-gradient(180deg,#1d1612,#0b0807); cursor:auto; animation: itFade .4s ease both; }
  .it-paper { position:relative; width:100%; max-width:600px; color:#211a12; font-family:var(--font-dialogue); padding:20px 24px 18px; border-radius:3px;
    background: radial-gradient(ellipse at 30% 15%, rgba(255,255,255,.45), transparent 60%), repeating-linear-gradient(0deg, rgba(120,95,60,.05) 0 1px, transparent 1px 3px), #ece2c9;
    box-shadow: 0 20px 50px rgba(0,0,0,.7), 0 2px 4px rgba(0,0,0,.5); transform: rotate(0.5deg); animation: itIn .5s cubic-bezier(.2,.8,.25,1.05) both; }
  .it-top { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; border-bottom:2px solid #211a12; padding-bottom:8px; margin-bottom:10px; }
  .it-org { font-size:20px; letter-spacing:4px; }
  .it-form { font-size:10px; letter-spacing:1px; color:#5e5140; }
  .it-conf { font-family:var(--font-hit); color:#a3151c; border:2px solid #a3151c; padding:0 6px; font-size:13px; transform:rotate(6deg); opacity:.8; }
  .it-note { font-size:12px; color:#5e5140; margin-bottom:8px; font-style:italic; }
  .it-q { margin:10px 0; font-size:14px; line-height:1.4; }
  .it-math { font-family:'Times New Roman', serif; font-style:italic; font-size:17px; margin:4px 0 0 18px; color:#120d08; word-break:break-word; letter-spacing:.5px; }
  .it-pad { position:relative; height:150px; margin-top:8px; background:rgba(255,255,255,.3); border:1px dashed rgba(40,30,20,.35); border-radius:3px; }
  .it-pad canvas { position:absolute; inset:0; width:100%; height:100%; touch-action:none; cursor:crosshair; z-index:2; }
  .it-hint { position:absolute; right:8px; bottom:6px; font-size:11px; color:rgba(33,26,18,.35); }
  .it-opts { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:6px 0 0 14px; }
  .it-opt { display:flex; align-items:center; gap:8px; text-align:left; font-family:inherit; font-size:14px; color:#211a12; background:rgba(255,255,255,.35);
    border:1.5px solid rgba(40,30,20,.35); border-radius:4px; padding:6px 8px; cursor:pointer; }
  .it-opt.on { border-color:${INK}; background:rgba(29,42,107,.12); }
  .it-opt.on .it-letter { border-color:${INK}; color:${INK}; box-shadow:0 0 0 2px ${INK}; }
  .it-letter { width:20px; height:20px; flex-shrink:0; border-radius:50%; border:1.5px solid #211a12; display:flex; align-items:center; justify-content:center; font-size:11px; }
  .it-buttons { display:flex; justify-content:flex-end; gap:10px; margin-top:14px; }
  .it-btn { font-family:var(--font-dialogue); font-size:15px; padding:9px 18px; border-radius:4px; cursor:pointer; color:#fff3e6; background:#a3151c;
    border:2px solid #211a12; box-shadow:3px 3px 0 #211a12; }
  .it-btn:disabled { opacity:.45; cursor:default; }
  .it-btn.ghost { background:transparent; color:#211a12; }
  .it-grade { position:absolute; right:36px; top:38%; font-family:var(--font-hand, cursive); font-size:72px; color:#1f7a2e; transform:rotate(-12deg);
    pointer-events:none; animation: itStamp .3s cubic-bezier(.3,1.5,.5,1) both; }
  .it-grade.fail { color:#b3121b; }
  @media (max-width: 520px) { .it-paper { padding:14px 12px; } .it-opts { grid-template-columns:1fr; } .it-math { font-size:15px; margin-left:6px; } }
  @keyframes itFade { from { opacity:0; } to { opacity:1; } }
  @keyframes itIn { from { opacity:0; transform: translateY(40px) rotate(3deg); } to { opacity:1; transform: rotate(0.5deg); } }
  @keyframes itStamp { from { opacity:0; transform: rotate(-12deg) scale(2.6); } to { opacity:1; transform: rotate(-12deg) scale(1); } }
`;
