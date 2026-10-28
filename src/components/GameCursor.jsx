// ─────────────────────────────────────────────────────────────────────────────
// The battle cursor. The game draws it (instead of the system arrow) so it can:
//   · flash for a split second when you're hit (red) or healed, showing how much
//     HP that was as a band inside the arrow
//   · carry your skill (big cyan ring) and ult (small pink ring) charge next to it
// Shapes follow the cursor sheet. Units: the arrow is 100 tall with its tip at
// (0, 0) = the pointer; everything else is placed around that.
// Settings (utils/settings.js): cursor = 'cyan' | 'yellow' | 'system',
// cursorSize = 's' | 'm' | 'l' | 'xl', cursorRings = true / false.
// ─────────────────────────────────────────────────────────────────────────────
import { useId } from 'react';
import { CURSOR_THEMES } from '../utils/cursor';

const clamp01 = v => Math.max(0, Math.min(1, v));

const FILL = '#1c2021', HIT = '#f90126';
const ARROW = 'M0,0 L0,100 L29.3,69.8 L68.8,68.8 Z';
const DOT = { x: 35.5, y: 87 };
const SKILL = { x: 124, y: 126.5, r: 43.2, fill: 37.7, color: '#00feff', ring: '#ffffff', glow: '#22d3ee', text: '#003238' };
const ULT = { x: 124, y: 39, r: 23.6, fill: 17.8, color: '#eb47fe', ring: '#ffc2fe', glow: '#e879f9', text: '#3b0040' };
const PAD = 12, BOX = 186;   // the drawing's extent around the tip (units)

// One of the two charge rings. data: { fill 0..1, ready, dim, n (a count to show) }
function Ring({ R, data, now, id }) {
  if (!data) return null;
  const f = clamp01(data.fill), level = R.y + R.fill - 2 * R.fill * f;
  const beat = data.ready ? 0.5 + 0.5 * Math.sin(now * 7) : 0;
  return (
    <g opacity={data.dim ? 0.45 : 1}>
      <defs><clipPath id={id}><rect x={R.x - R.fill - 1} y={level} width={R.fill * 2 + 2} height={R.y + R.fill - level + 1} /></clipPath></defs>
      <circle cx={R.x} cy={R.y} r={R.r} fill="rgba(0,0,0,0.5)" stroke={R.ring} strokeWidth={7.5} style={{ filter: `drop-shadow(0 0 ${3 + beat * 4}px ${R.glow})` }} />
      {f > 0 && <circle cx={R.x} cy={R.y} r={R.fill} fill={R.color} clipPath={`url(#${id})`} opacity={data.ready ? 1 : 0.8} />}
      {data.active && <circle cx={R.x} cy={R.y} r={R.r + 6} fill="none" stroke={R.color} strokeWidth={3} strokeDasharray="6 5" transform={`rotate(${now * 120} ${R.x} ${R.y})`} />}
      {data.n != null && (
        <text x={R.x} y={R.y + R.fill * 0.36} textAnchor="middle" fontSize={R.fill * 1.05} fontWeight={900} fill={f >= 0.55 ? R.text : '#fff'}
          style={{ fontFamily: 'var(--font-ui, monospace)' }}>{data.n}</text>
      )}
    </g>
  );
}

// The drawing itself (the battle and the Settings preview both use it)
export function CursorArt({ theme = 'cyan', size = 30, skill = null, ult = null, flash = null, click = -9, now = 0 }) {
  const uid = useId().replace(/:/g, '');
  const T = CURSOR_THEMES[theme] ?? CURSOR_THEMES.cyan;
  const sc = size / 100;
  // hit / heal: a full flash of colour, then the band of HP that was lost or gained
  let fx = null;
  if (flash && now - flash.last < 0.6) {
    const col = flash.kind === 'hit' ? HIT : T.heal, age = now - flash.t0, tail = now - flash.last;
    if (age < 0.18) fx = <path d={ARROW} fill={col} opacity={0.95} />;
    else {
      const lvl = v => 100 * (1 - clamp01(v));
      let y0 = Math.min(lvl(flash.from), lvl(flash.to)), y1 = Math.max(lvl(flash.from), lvl(flash.to));
      if (y1 - y0 < 7) { if (flash.kind === 'hit') y0 = y1 - 7; else y1 = y0 + 7; }   // a sliver you can still see
      fx = (
        <g clipPath={`url(#${uid}a)`} opacity={1 - clamp01((tail - 0.1) / 0.5)}>
          <rect x={-2} y={lvl(flash.to)} width={74} height={102} fill={col} opacity={0.25} />
          <rect x={-2} y={y0} width={74} height={y1 - y0} fill={col} />
        </g>
      );
    }
  }
  const pop = now - click < 0.18 ? 1 + 0.45 * (1 - (now - click) / 0.18) : 1;   // the dot pops on a click
  return (
    <svg width={BOX * sc} height={BOX * sc} viewBox={`${-PAD} ${-PAD} ${BOX} ${BOX}`}
      style={{ position: 'absolute', left: -PAD * sc, top: -PAD * sc, overflow: 'visible', pointerEvents: 'none' }}>
      <defs><clipPath id={`${uid}a`}><path d={ARROW} /></clipPath></defs>
      <Ring R={ULT} data={ult} now={now} id={`${uid}u`} />
      <Ring R={SKILL} data={skill} now={now} id={`${uid}s`} />
      <g style={{ filter: `drop-shadow(0 0 3px ${T.glow})` }}>
        <path d={ARROW} fill="none" stroke={T.glow} strokeWidth={10} strokeLinejoin="miter" />
        <path d={ARROW} fill={FILL} />
        {fx}
        <path d={ARROW} fill="none" stroke={T.rim} strokeWidth={4.5} strokeLinejoin="miter" />
        <g transform={`translate(${DOT.x} ${DOT.y}) scale(${pop})`}>
          <circle r={9.2} fill={FILL} stroke={T.glow} strokeWidth={5.5} />
          <circle r={9.2} fill="none" stroke={T.rim} strokeWidth={2.6} />
          <circle r={4.6} fill={T.accent} />
        </g>
      </g>
    </svg>
  );
}
