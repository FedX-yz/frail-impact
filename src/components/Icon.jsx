// <Icon name="lock" /> and <SvgIcon> (inside an <svg>). The drawings, the emoji each
// one replaces and the USE_EMOJI switch are in data/icons.jsx.
import { ICONS, USE_EMOJI } from '../data/icons';

const BASE = import.meta.env.BASE_URL;

// An icon in running text (scales with the font size)
export function Icon({ name, size = '1em', style, title }) {
  const ic = ICONS[name];
  if (!ic) return null;
  if (USE_EMOJI) return <span style={style} title={title}>{ic.emoji}</span>;
  if (ic.img) return <img src={`${BASE}${ic.img}`} alt="" title={title} style={{ width: size, height: size, objectFit: 'contain', verticalAlign: '-0.15em', ...style }} />;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title ? undefined : true} style={{ display: 'inline-block', verticalAlign: '-0.15em', overflow: 'visible', ...style }}>
      {title && <title>{title}</title>}
      {ic.draw}
    </svg>
  );
}

// The same icon inside an <svg> (battle effects): centred on x, y
export function SvgIcon({ name, x, y, size, color, opacity }) {
  const ic = ICONS[name];
  if (!ic) return null;
  if (USE_EMOJI) return <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={size} opacity={opacity}>{ic.emoji}</text>;
  const s = size / 24;
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})`} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} style={{ color }}>
      {ic.draw}
    </g>
  );
}

