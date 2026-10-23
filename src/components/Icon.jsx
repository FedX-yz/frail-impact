// <Icon name="lock" /> and <SvgIcon> (inside an <svg>). The switches are in data/icons.jsx:
//   ICON_STYLE 'detailed' = game-icons.net art (data/gameIcons.js) in its own colour,
//                           glossy shading, dark outline and a glow
//              'bold'     = my simple drawings, sticker style
//              'line'     = my simple drawings, thin lines
//   USE_EMOJI  true       = the original emoji everywhere
import { useId } from 'react';
import { ICONS, USE_EMOJI, ICON_STYLE } from '../data/icons';
import { GAME_ICONS } from '../data/gameIcons';

const BASE = import.meta.env.BASE_URL;
const INK = '#140a04';

// game-icons art: base colour, then a light-to-dark sheen over it
function Detailed({ name }) {
  const id = useId().replace(/:/g, '');
  const [, color, d] = GAME_ICONS[name];
  return (
    <>
      <defs>
        <linearGradient id={`gi${id}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path d={d} fill={color} stroke={INK} strokeWidth="34" strokeLinejoin="round" paintOrder="stroke" />
      <path d={d} fill={`url(#gi${id})`} />
    </>
  );
}

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

const detailed = name => ICON_STYLE === 'detailed' && GAME_ICONS[name];

// An icon in running text (scales with the font size)
export function Icon({ name, size = '1em', style, title }) {
  const ic = ICONS[name];
  if (!ic) return null;
  if (USE_EMOJI) return <span style={style} title={title}>{ic.emoji}</span>;
  if (ic.img) return <img src={`${BASE}${ic.img}`} alt="" title={title} style={{ width: size, height: size, objectFit: 'contain', verticalAlign: '-0.15em', ...style }} />;
  const base = { display: 'inline-block', verticalAlign: '-0.18em', overflow: 'visible' };
  if (detailed(name)) return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden={title ? undefined : true}
      style={{ ...base, filter: `drop-shadow(0 0 3px ${GAME_ICONS[name][1]}99)`, ...style }}>
      {title && <title>{title}</title>}
      <Detailed name={name} />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      style={{ ...base, filter: ICON_STYLE === 'bold' ? 'drop-shadow(0 0 2.5px currentColor)' : undefined, ...style }}>
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
  if (detailed(name)) return (
    <svg x={x - size / 2} y={y - size / 2} width={size} height={size} viewBox="0 0 512 512" opacity={opacity} overflow="visible"
      style={{ filter: `drop-shadow(0 0 4px ${GAME_ICONS[name][1]})` }}>
      <Detailed name={name} />
    </svg>
  );
  const s = size / 24;
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})`} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" opacity={opacity}
      style={{ color, filter: ICON_STYLE === 'bold' ? `drop-shadow(0 0 3px ${color})` : undefined }}>
      <Layers ic={ic} />
    </g>
  );
}
