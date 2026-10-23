// <Icon name="lock" /> and <SvgIcon> (inside an <svg>). The drawings, the emoji each
// one replaces and the USE_EMOJI / ICON_STYLE switches are in data/icons.jsx.
//
// 'bold' style = three passes of the same drawing, like a sticker:
//   1. a thick dark outline (and dark body) so it reads on the bright sky
//   2. the body tinted with the icon's colour
//   3. the coloured line on top, with a soft glow
import { ICONS, USE_EMOJI, ICON_STYLE } from '../data/icons';

const BASE = import.meta.env.BASE_URL;
const INK = '#140a04';

function Layers({ ic }) {
  if (ICON_STYLE !== 'bold') return ic.draw;
  return (
    <>
      <g stroke={INK} strokeWidth="5.2" fill={ic.noFill ? 'none' : INK}>{ic.draw}</g>
      {!ic.noFill && <g fill="currentColor" fillOpacity="0.32" stroke="none">{ic.draw}</g>}
      <g strokeWidth="2.3">{ic.draw}</g>
    </>
  );
}

// An icon in running text (scales with the font size)
export function Icon({ name, size = '1em', style, title }) {
  const ic = ICONS[name];
  if (!ic) return null;
  if (USE_EMOJI) return <span style={style} title={title}>{ic.emoji}</span>;
  if (ic.img) return <img src={`${BASE}${ic.img}`} alt="" title={title} style={{ width: size, height: size, objectFit: 'contain', verticalAlign: '-0.15em', ...style }} />;
  const bold = ICON_STYLE === 'bold';
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      style={{ display: 'inline-block', verticalAlign: '-0.15em', overflow: 'visible', filter: bold ? 'drop-shadow(0 0 2.5px currentColor)' : undefined, ...style }}>
      {title && <title>{title}</title>}
      <Layers ic={ic} />
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
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})`} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" opacity={opacity}
      style={{ color, filter: ICON_STYLE === 'bold' ? `drop-shadow(0 0 3px ${color})` : undefined }}>
      <Layers ic={ic} />
    </g>
  );
}
