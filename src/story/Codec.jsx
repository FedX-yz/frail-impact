import { memo, useEffect, useState } from 'react';
import { CODEC, useTypewriter } from './codecStyle';
import { CAST } from './cast';
import { asset } from './story';
import { thumb } from '../utils/assets';
import FocusImg from '../components/FocusImg';

// A cast member's face. No art yet → a placeholder with their initial.
export const Portrait = memo(function Portrait({ who, size, border = CODEC.yellow }) {
  const c = CAST[who] ?? { name: who, color: '#888' };
  const [broken, setBroken] = useState(false);
  const src = c.portrait && !broken ? thumb(asset(c.portrait)) : null;
  return (
    <div style={{ width: size, height: size, flexShrink: 0, border: `3px solid ${border}`, background: '#f3ea78', overflow: 'hidden', position: 'relative', boxShadow: '0 3px 10px rgba(0,0,0,0.45)' }}>
      {src && c.focus ? (
        // full art with a face position → zoom onto the face
        <FocusImg src={src} alt={c.name} focus={c.focus} style={{ filter: 'sepia(0.35) saturate(1.2)' }} />
      ) : src ? (
        <img src={src} alt={c.name} draggable={false} onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block', filter: 'sepia(0.35) saturate(1.2)' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `radial-gradient(circle at 50% 38%, ${c.color}cc 0 22%, transparent 23%), radial-gradient(ellipse at 50% 105%, ${c.color}cc 0 45%, transparent 46%), #f3ea78` }}>
          <span style={{ position: 'absolute', bottom: 2, right: 4, fontFamily: CODEC.font, fontWeight: 900, fontSize: size * 0.2, color: '#123' }}>{(c.name || '?')[0]}</span>
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
  const [shown, finish] = useTypewriter(line.text, 46);
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
        {c.name && <div style={{ fontFamily: CODEC.font, fontSize: mobile ? 10 : 12, fontWeight: 900, color: c.color ?? CODEC.yellow, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{c.name}</div>}
        <div style={{ fontFamily: CODEC.font, fontWeight: 700, fontStyle: 'italic', fontSize: mobile ? 13 : 18, lineHeight: 1.3, color: CODEC.text, textShadow: '0 1px 0 #0a2a1c', wordBreak: 'break-word' }}>
          {line.text.slice(0, shown)}<span style={{ opacity: 0 }}>{line.text.slice(shown)}</span>
        </div>
        {line.pause && done && <div className="codec-next" style={{ position: 'absolute', right: 8, bottom: 4, fontFamily: CODEC.font, fontSize: 11, fontWeight: 900, color: CODEC.yellow }}>TAP ▶</div>}
      </div>
    </div>
    </>
  );
}
