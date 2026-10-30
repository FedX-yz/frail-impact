// ─────────────────────────────────────────────────────────────────────────────
// A 6★'s own ult bubble, in place of the round orb on the status frame (like HSR's
// character ult buttons). The card picks its shape with `ultBubble` in characters.js:
//   'gauntlet'  6★ Ice: his gauntlet, filling with ice
//   'bleedeye'  HOX: an eye, filling with blood
// The shape fills from the bottom as the ult charges; when it's ready it lights up in
// its own way; on cooldown it greys out. Drawn on the status frame's own 919×677 grid
// (the orb sat at centre 679, 347), so the frame art without the ring goes under it.
// Shapes: game-icons.net (mailed-fist, bleeding-eye), CC BY 3.0 — see data/gameIcons.js.
// ─────────────────────────────────────────────────────────────────────────────
import { useId } from 'react';
import { GAME_ICONS } from '../data/gameIcons';

const LOOK = {
  gauntlet: {
    icon: 'gauntlet', size: 450, cx: 679, cy: 336,
    back: 'rgba(2,6,23,0.72)', line: '#f0f9ff', glow: '#38bdf8', lineW: 15,
    fill: [['0%', '#f8fafc'], ['30%', '#bae6fd'], ['70%', '#38bdf8'], ['100%', '#0c4a6e']], wave: '#e0f2fe',
  },
  bleedeye: {
    icon: 'bleedeye', size: 470, cx: 679, cy: 352,
    back: 'rgba(12,2,2,0.78)', line: '#fbbf24', glow: '#dc2626', lineW: 14,
    fill: [['0%', '#fca5a5'], ['30%', '#dc2626'], ['75%', '#7f1d1d'], ['100%', '#450a0a']], wave: '#fecaca',
  },
};

export default function UltBubble({ kind, charge = 0, ready = false, cooling = false, active = false }) {
  const uid = useId().replace(/:/g, '');
  const L = LOOK[kind];
  if (!L) return null;
  const d = GAME_ICONS[L.icon][2];
  const sc = L.size / 512, x0 = L.cx - L.size / 2, y0 = L.cy - L.size / 2;
  const tf = `translate(${x0} ${y0}) scale(${sc})`;
  // the fill line, in the icon's own 512 units (a little margin top and bottom so 0% and 100% look it)
  const f = Math.max(0, Math.min(1, active ? 1 : charge));
  const level = 500 - 488 * f;
  return (
    <svg viewBox="0 0 919 677" className={`ub ub-${kind}${ready ? ' ready' : ''}${cooling ? ' cooling' : ''}${active ? ' active' : ''}`}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
      <style>{CSS}</style>
      <defs>
        <clipPath id={`${uid}c`}><path d={d} transform={tf} /></clipPath>
        <linearGradient id={`${uid}g`} x1="0" y1="0" x2="0" y2="1">
          {L.fill.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
        </linearGradient>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".85" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="ub-body" style={{ '--glow': L.glow, transformOrigin: `${L.cx}px ${L.cy}px` }}>
        {/* the empty shape */}
        <path d={d} transform={tf} fill={L.back} />
        {/* what's charged, rising inside it, with a wave on top */}
        <g clipPath={`url(#${uid}c)`}>
          <g transform={tf}>
            <rect x={-20} y={level} width={560} height={540 - level} fill={`url(#${uid}g)`} className="ub-fill" />
            {f > 0.02 && f < 0.99 && (
              <path className="ub-wave" d={`M-512,${level} q32,-14 64,0 t64,0 t64,0 t64,0 t64,0 t64,0 t64,0 t64,0 t64,0 t64,0 t64,0 t64,0 t64,0 t64,0 t64,0 t64,0 v14 h-1024 z`}
                fill={L.wave} opacity={0.75} />
            )}
            {ready && <rect className="ub-shine" x={-200} y={0} width={140} height={512} fill={`url(#${uid}s)`} transform="skewX(-20)" />}
          </g>
        </g>
        {/* the outline */}
        <path d={d} transform={tf} fill="none" stroke="#020617" strokeWidth={(L.lineW + 10) / sc * 0.5} strokeLinejoin="round" />
        <path d={d} transform={tf} fill="none" stroke={L.line} strokeWidth={L.lineW / sc * 0.5} strokeLinejoin="round" className="ub-line" />
      </g>
      {/* ready: Ice's sparkles / HOX's blood dripping off */}
      {ready && kind === 'gauntlet' && [[470, 170, 0], [890, 230, 0.6], [520, 560, 1.1], [860, 520, 0.3], [700, 95, 0.9]].map(([x, y, dl], i) => (
        <path key={i} className="ub-spark" d={`M${x},${y - 26} L${x + 7},${y - 7} L${x + 26},${y} L${x + 7},${y + 7} L${x},${y + 26} L${x - 7},${y + 7} L${x - 26},${y} L${x - 7},${y - 7} Z`}
          fill="#f0f9ff" style={{ animationDelay: `${dl}s`, transformOrigin: `${x}px ${y}px` }} />
      ))}
      {ready && kind === 'bleedeye' && [[565, 0], [640, 0.7], [745, 0.35], [805, 1.1]].map(([x, dl], i) => (
        <ellipse key={i} className="ub-drop" cx={x} cy={L.cy + 175} rx={11} ry={16} fill="#dc2626" style={{ animationDelay: `${dl}s` }} />
      ))}
    </svg>
  );
}

const CSS = `
  .ub .ub-body { filter: drop-shadow(0 0 6px rgba(0,0,0,.8)); transition: filter .3s; }
  .ub.ready .ub-body { animation: ubPulse 1s ease-in-out infinite; }
  .ub.cooling .ub-body { filter: grayscale(1) brightness(.6); }
  .ub.active .ub-body { filter: drop-shadow(0 0 22px var(--glow)) brightness(1.25); }
  .ub .ub-wave { animation: ubWave 1.6s linear infinite; }
  .ub .ub-shine { animation: ubShine 1.8s ease-in-out infinite; }
  .ub .ub-spark { animation: ubSpark 1.4s ease-in-out infinite; }
  .ub .ub-drop { animation: ubDrop 1.6s ease-in infinite; }
  .ub-bleedeye.ready .ub-body { animation: ubPulse 1s ease-in-out infinite, ubBlink 3.2s ease-in-out infinite; }
  @keyframes ubPulse { 0%,100% { filter: drop-shadow(0 0 8px var(--glow)); } 50% { filter: drop-shadow(0 0 26px var(--glow)) brightness(1.2); } }
  @keyframes ubWave { from { transform: translateX(0); } to { transform: translateX(128px); } }
  @keyframes ubShine { 0% { transform: translateX(0) skewX(-20deg); } 60%,100% { transform: translateX(760px) skewX(-20deg); } }
  @keyframes ubSpark { 0%,100% { transform: scale(0); opacity: 0; } 40% { transform: scale(1) rotate(45deg); opacity: 1; } 70% { transform: scale(.5) rotate(90deg); opacity: .6; } }
  @keyframes ubDrop { 0% { transform: translateY(0) scaleY(.6); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(150px) scaleY(1.3); opacity: 0; } }
  @keyframes ubBlink { 0%,90%,100% { transform: scaleY(1); } 94% { transform: scaleY(.08); } }
`;
