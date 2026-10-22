// Security-camera look for the battle (Settings → CCTV battle camera): you're the
// manager watching the field feed. Scanlines, grain, a rolling bar, viewfinder
// corners, REC, the camera number and a live timestamp; the picture breaks up
// for a moment when you get hit. Drawn on top of the arena, never blocks clicks.
import { memo, useEffect, useState } from 'react';

// a small tile of grain, made once
let grainUrl = null;
function grain() {
  if (grainUrl) return grainUrl;
  try {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const ctx = c.getContext('2d'), img = ctx.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 38; }
    ctx.putImageData(img, 0, 0);
    grainUrl = c.toDataURL();
  } catch { grainUrl = ''; }
  return grainUrl;
}

const pad = n => String(n).padStart(2, '0');
function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return <>{t.getFullYear()}-{pad(t.getMonth() + 1)}-{pad(t.getDate())}&nbsp;&nbsp;{pad(t.getHours())}:{pad(t.getMinutes())}:{pad(t.getSeconds())}</>;
}

export default memo(function CctvOverlay({ cam = 1, place, hurt = false, mobile = false }) {
  const camLabel = `CAM-${pad(cam)}`;
  return (
    <div className={`cctv${hurt ? ' hurt' : ''}${mobile ? ' small' : ''}`} aria-hidden="true">
      <style>{CSS}</style>
      <div className="cctv-tint" />
      <div className="cctv-lines" />
      <div className="cctv-grain" style={{ backgroundImage: `url(${grain()})` }} />
      <div className="cctv-roll" />
      <div className="cctv-vig" />
      <span className="cctv-c tl" /><span className="cctv-c tr" /><span className="cctv-c bl" /><span className="cctv-c br" />
      <div className="cctv-rec"><i />REC{!mobile && <span>&nbsp;&nbsp;{camLabel}</span>}</div>
      <div className="cctv-stamp">
        <div><Clock /></div>
        <div className="cctv-sub">{mobile ? camLabel : `FRAIL INITIATIVE · ${camLabel}`}{place ? ` · ${place}` : ''}</div>
      </div>
      {hurt && <div className="cctv-glitch"><span>SIGNAL INTERFERENCE</span></div>}
    </div>
  );
});

const CSS = `
  .cctv { position:absolute; inset:0; z-index:25; pointer-events:none; overflow:hidden; font-family: ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace; }
  .cctv-tint { position:absolute; inset:0; background: rgba(120,150,135,0.07); mix-blend-mode: multiply; }
  .cctv-lines { position:absolute; inset:0; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 3px); }
  .cctv-grain { position:absolute; inset:-96px; opacity:.55; animation: cctvGrain .5s steps(4) infinite; }
  .cctv-roll { position:absolute; left:0; right:0; height:18%; top:-20%; background: linear-gradient(180deg, transparent, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.05) 55%, transparent);
    animation: cctvRoll 7s linear infinite; }
  .cctv-vig { position:absolute; inset:0; box-shadow: inset 0 0 90px 20px rgba(0,0,0,0.55); }
  .cctv-c { position:absolute; width:22px; height:22px; border:2px solid rgba(235,240,235,0.75); }
  .cctv-c.tl { left:8px; top:8px; border-right:none; border-bottom:none; }
  .cctv-c.tr { right:8px; top:8px; border-left:none; border-bottom:none; }
  .cctv-c.bl { left:8px; bottom:8px; border-right:none; border-top:none; }
  .cctv-c.br { right:8px; bottom:8px; border-left:none; border-top:none; }
  .cctv-rec { position:absolute; left:18px; top:14px; display:flex; align-items:center; gap:6px; color:#f2f5f0; font-size:13px; font-weight:700; letter-spacing:2px; text-shadow:0 0 4px rgba(0,0,0,.9); }
  .cctv-rec i { width:9px; height:9px; border-radius:50%; background:#ff2a2a; box-shadow:0 0 6px #ff2a2a; animation: cctvBlink 1s steps(1) infinite; }
  .cctv-rec span { opacity:.85; font-weight:400; }
  .cctv-stamp { position:absolute; right:18px; bottom:14px; text-align:right; color:#f2f5f0; font-size:13px; letter-spacing:1px; text-shadow:0 0 4px rgba(0,0,0,.9); }
  .cctv-sub { font-size:10px; opacity:.75; letter-spacing:2px; margin-top:1px; }
  .cctv.small .cctv-rec { font-size:11px; left:14px; top:12px; }
  .cctv.small .cctv-stamp { font-size:10px; right:14px; bottom:10px; }
  .cctv.small .cctv-sub { font-size:8.5px; }
  .cctv.small .cctv-c { width:14px; height:14px; }
  .cctv-glitch { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    background: repeating-linear-gradient(0deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 9px), rgba(255,30,40,0.08); animation: cctvGlitch .35s steps(3) both; }
  .cctv-glitch span { color:#fff; background:rgba(0,0,0,.65); padding:2px 8px; font-size:12px; letter-spacing:3px; }
  .cctv.hurt .cctv-lines { background: repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0 2px, transparent 2px 4px); transform: translateX(3px); }
  @keyframes cctvGrain { 0% { transform: translate(0,0); } 25% { transform: translate(-31px,17px); } 50% { transform: translate(22px,-29px); } 75% { transform: translate(-13px,-41px); } }
  @keyframes cctvRoll { from { top:-20%; } to { top:110%; } }
  @keyframes cctvBlink { 0%, 50% { opacity:1; } 51%, 100% { opacity:0; } }
  @keyframes cctvGlitch { 0% { transform: translateX(-6px); opacity:1; } 50% { transform: translateX(5px); } 100% { transform: translateX(0); opacity:0; } }
  @media (prefers-reduced-motion: reduce) { .cctv-grain, .cctv-roll { animation:none; } }
`;
