import { memo, useEffect, useState } from 'react';
import { CODEC, useTypewriter } from './codecStyle';
import { CAST } from './cast';
import { asset } from './story';
import { thumb } from '../utils/assets';
import FocusImg from '../components/FocusImg';

// A head-and-shoulders shape for faces without art (one person, or a few for a group)
const BUST = 'M50 14c-11 0-19 9-19 21 0 9 4 16 10 20-14 3-25 12-29 26-1 5-2 12-2 19h80c0-7-1-14-2-19-4-14-15-23-29-26 6-4 10-11 10-20 0-12-8-21-19-21z';
function Bust({ color, group }) {
  const ink = '#18241d';
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      {group ? (
        <>
          <path d={BUST} fill={ink} opacity=".55" transform="translate(-24 6) scale(.86)" />
          <path d={BUST} fill={ink} opacity=".55" transform="translate(38 6) scale(.86)" />
          <path d={BUST} fill={ink} stroke={color} strokeWidth="2.5" transform="translate(8 10) scale(.84)" />
        </>
      ) : <path d={BUST} fill={ink} stroke={color} strokeWidth="2.5" transform="translate(6 8) scale(.88)" />}
    </svg>
  );
}

// Someone on a call (cast.js → call): no face, just their voice moving
function CallFace({ color, size }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 45%, #18261f, #060a08 78%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: Math.max(2, size * 0.035) }}>
      {[0.35, 0.7, 1, 0.55, 0.9, 0.5, 0.3].map((h, i) => (
        <i key={i} className="vn-wave" style={{ width: Math.max(2, size * 0.06), height: size * 0.56 * h, background: color, animationDelay: `${-i * 0.17}s`, animationDuration: `${0.6 + (i % 3) * 0.17}s` }} />
      ))}
      <span className="vn-rec" style={{ position: 'absolute', top: size * 0.07, left: size * 0.08, width: Math.max(4, size * 0.07), height: Math.max(4, size * 0.07), borderRadius: '50%', background: '#ef4444' }} />
    </div>
  );
}

// A cast member's face. No art yet → a placeholder bust with their initial.
export const Portrait = memo(function Portrait({ who, size, border = CODEC.yellow }) {
  const c = CAST[who] ?? { name: who, color: '#888' };
  const [broken, setBroken] = useState(false);
  const src = c.portrait && !broken ? thumb(asset(c.portrait)) : null;
  return (
    <div style={{ width: size, height: size, flexShrink: 0, border: `3px solid ${border}`, background: '#f3ea78', overflow: 'hidden', position: 'relative', boxShadow: '0 3px 10px rgba(0,0,0,0.45)' }}>
      {c.call ? <CallFace color={c.color} size={size} /> : src && c.focus ? (
        // full art with a face position → zoom onto the face
        <FocusImg src={src} alt={c.name} focus={c.focus} style={{ filter: 'sepia(0.35) saturate(1.2)' }} />
      ) : src ? (
        <img src={src} alt={c.name} draggable={false} onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block', filter: 'sepia(0.35) saturate(1.2)' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, #fbf6b0, #e6dc62 80%)' }}>
          <Bust color={c.color} group={c.icon === 'group'} />
          {c.icon !== 'group' && size >= 40 && (
            <span style={{ position: 'absolute', bottom: 0, right: size * 0.06, fontFamily: 'var(--font-dramatic)', fontWeight: 800, fontSize: size * 0.24, lineHeight: 1.1, color: c.color, textShadow: '0 1px 0 #0a120d, 0 0 3px #0a120d' }}>{(c.name || '?')[0]}</span>
          )}
        </div>
      )}
      {/* light scanlines so photos and placeholders match the codec look */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0 1px, transparent 1px 3px)' }} />
    </div>
  );
});

// The panel that pops up during battle (top-left of the arena).
// `paused` lines wait for a tap; others close by themselves.
export function CodecPopup({ line, mobile, onDone }) {
  const [shown, finish] = useTypewriter(line.text, 46, false, false);
  const done = shown >= line.text.length;
  useEffect(() => {
    if (!done || line.pause) return;
    const id = setTimeout(onDone, 1800 + line.text.length * 45);
    return () => clearTimeout(id);
  }, [done, line, onDone]);
  const size = mobile ? 54 : 78;
  const c = CAST[line.who] ?? { name: line.who };
  // important lines: the fight is paused and a tap anywhere continues
  const tap = (e) => { e.stopPropagation(); if (!done) finish(); else onDone(); };
  return (
    <>
    {line.pause && <div style={{ position: 'absolute', inset: 0, zIndex: 19, cursor: 'pointer' }} onPointerDown={tap} />}
    <div className="codec-pop" style={{ position: 'absolute', top: 38, left: 8, zIndex: 20, display: 'flex', gap: mobile ? 6 : 10, alignItems: 'stretch',
      width: mobile ? 'calc(100% - 16px)' : 'min(62%, 520px)', pointerEvents: line.pause ? 'auto' : 'none' }}
      onPointerDown={e => { if (line.pause) tap(e); }}>
      <Portrait who={line.who} size={size} />
      <div style={{ flex: 1, minWidth: 0, minHeight: size, background: `radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1.2px) 0 0/4px 4px, linear-gradient(${CODEC.green}, ${CODEC.greenDark})`,
        border: `3px solid ${CODEC.yellow}`, padding: mobile ? '5px 8px' : '8px 14px', boxShadow: '0 3px 10px rgba(0,0,0,0.45)', position: 'relative' }}>
        {c.name && <div style={{ fontFamily: 'var(--font-dramatic)', fontSize: mobile ? 14 : 17, fontWeight: 700, lineHeight: 1.1, color: c.color ?? CODEC.yellow, letterSpacing: 0.5, marginBottom: 3, textShadow: '0 2px 0 rgba(6,32,21,.85)' }}>{c.name}</div>}
        <div style={{ fontFamily: CODEC.font, fontWeight: 700, fontStyle: 'italic', fontSize: mobile ? 13 : 18, lineHeight: 1.3, color: CODEC.text, textShadow: '0 1px 0 #0a2a1c', wordBreak: 'break-word' }}>
          {line.text.slice(0, shown)}<span style={{ opacity: 0 }}>{line.text.slice(shown)}</span>
        </div>
        {line.pause && done && <div className="codec-next" style={{ position: 'absolute', right: 8, bottom: 4, fontFamily: CODEC.font, fontSize: 11, fontWeight: 900, color: CODEC.yellow }}>TAP ▶</div>}
      </div>
    </div>
    </>
  );
}
