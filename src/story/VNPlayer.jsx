import { useCallback, useEffect, useRef, useState } from 'react';
import { SCENES } from './scenes';
import { CAST } from './cast';
import { asset, testFlag } from './story';
import { Portrait } from './Codec';
import { CODEC, useTypewriter } from './codecStyle';
import { playSFX, playPress } from '../utils/sfx';
import TapButton from '../components/TapButton';
import JobApplication from './JobApplication';

const BASE = import.meta.env.BASE_URL;
const NO_STEPS = [];
const POS = { left: 24, center: 50, right: 76, farleft: 10, farright: 90 };

// Plays steps from `i` until one needs the player (a line, a choice, a wait)
// and returns the new state. Nothing here touches the screen directly.
function run(steps, from, prev, signed = false) {
  const s = { ...prev, actors: [...prev.actors], flags: { ...prev.flags }, sfx: [], application: false };
  const labelAt = (name) => steps.findIndex(x => x?.label === name);
  let i = from;
  for (let guard = 0; i < steps.length && guard < 2000; guard++) {
    const step = steps[i];
    if (typeof step === 'string') return { ...s, i, line: { who: 'narrator', text: step }, choice: null, wait: 0 };
    if (Array.isArray(step)) return { ...s, i, line: { who: step[0], text: String(step[1] ?? '') }, choice: null, wait: 0 };
    if (!step || typeof step !== 'object') { i++; continue; }
    if (step.end) break;
    if (step.application && !signed) return { ...s, i, line: null, choice: null, wait: 0, application: true };   // the job application (JobApplication.jsx), once
    if (step.if !== undefined) {   // conditional jump
      if (testFlag(s.flags, step.if) && step.goto) { const j = labelAt(step.goto); if (j >= 0) { i = j; continue; } }
      i++; continue;
    }
    if (step.goto) { const j = labelAt(step.goto); i = j >= 0 ? j : steps.length; continue; }
    if (step.choice) {
      const options = step.choice.filter(c => testFlag(s.flags, c.if));
      if (options.length) return { ...s, i, choice: options, wait: 0 };
      i++; continue;
    }
    if ('bg' in step) s.bg = step.bg;
    if (step.show) {
      const at = step.at ?? 'center';
      // one person per spot: someone already standing there steps out
      s.actors = s.actors.filter(a => a.id !== step.show && a.at !== at);
      s.actors.push({ id: step.show, at, mood: step.mood ?? null });
    }
    if (step.hide) s.actors = step.hide === 'all' ? [] : s.actors.filter(a => a.id !== step.hide);
    if (step.set) Object.assign(s.flags, step.set);
    if (step.shake) s.shakeN = (s.shakeN ?? 0) + 1;
    if (step.sfx) s.sfx.push(step.sfx);
    if (step.wait) return { ...s, i, line: null, choice: null, wait: step.wait };
    i++;
  }
  return { ...s, i: steps.length, done: true, choice: null, wait: 0 };
}

// Full-screen cutscene. Calls onEnd(flags) when it finishes.
// profile: the player's { name, signature } — {manager} in a line becomes their name.
// onSign(profile): called when they sign the job application.
export default function VNPlayer({ sceneId, flags, onEnd, mobile, portrait, profile = null, onSign }) {
  const steps = SCENES[sceneId] ?? NO_STEPS;
  const signedRef = useRef(!!profile?.signature);   // already signed → skip the application step
  const [st, setSt] = useState(() => run(steps, 0, { bg: undefined, actors: [], flags: { ...flags }, line: null, log: [] }, signedRef.current));
  const [auto, setAuto] = useState(false);
  const [skip, setSkip] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const text = (st.line?.text ?? '').replaceAll('{manager}', profile?.name || 'Manager');
  const [shown, finish] = useTypewriter(text, 44, skip);
  const typed = shown >= text.length;
  const ended = useRef(false);

  // sounds from { sfx } steps
  useEffect(() => { st.sfx?.forEach(n => playSFX(`${BASE}sounds/${n.replace(/\.mp3$/, '')}.mp3`)); }, [st.sfx]);
  useEffect(() => {
    if (st.done && !ended.current) { ended.current = true; onEnd(st.flags); }
  }, [st.done, st.flags, onEnd]);

  const next = useCallback(() => {
    if (st.done || st.choice || st.application || showLog) return;
    if (st.line && !typed) { finish(); return; }
    setSt(prev => {
      const log = prev.line ? [...prev.log, prev.line] : prev.log;
      return run(steps, prev.i + 1, { ...prev, log }, signedRef.current);
    });
  }, [st, typed, finish, steps, showLog]);

  const choose = (c) => {
    playPress();
    setSt(prev => {
      const p = { ...prev, flags: { ...prev.flags, ...(c.set ?? {}) }, log: [...prev.log, ...(prev.line ? [prev.line] : []), { who: 'choice', text: `▸ ${c.text}` }], line: null };
      const j = c.goto ? steps.findIndex(x => x?.label === c.goto) : -1;
      return run(steps, j >= 0 ? j : prev.i + 1, p, signedRef.current);
    });
    setSkip(false);
  };

  // waits, auto-play and skip
  useEffect(() => {
    if (st.done || st.choice || st.application) { if (st.choice || st.application) setSkip(false); return; }
    let ms = null;
    if (st.wait) ms = st.wait * 1000;
    else if (skip) ms = 70;
    else if (auto && typed) ms = 900 + text.length * 28;
    if (ms == null) return;
    const id = setTimeout(() => setSt(prev => run(steps, prev.i + 1, { ...prev, log: prev.line ? [...prev.log, prev.line] : prev.log }, signedRef.current)), ms);
    return () => clearTimeout(id);
  }, [st, skip, auto, typed, text, steps]);

  // keyboard: Space / Enter = next, number keys pick a choice
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (st.choice && /^[1-9]$/.test(e.key) && st.choice[+e.key - 1]) choose(st.choice[+e.key - 1]);
      else if (e.key === 'Escape') setShowLog(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const speaker = st.line ? CAST[st.line.who] ?? { name: st.line.who, color: CODEC.yellow } : null;
  const narr = st.line?.who === 'narrator';
  const bgUrl = st.bg ? asset(st.bg) : null;
  const tall = mobile && portrait;

  return (
    <div onPointerDown={e => { if (e.button === 0) next(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#06080f', overflow: 'hidden', userSelect: 'none', cursor: 'pointer', fontFamily: CODEC.font }}>
      <div key={`shake${st.shakeN ?? 0}`} className={st.shakeN ? 'vn-shake' : ''} style={{ position: 'absolute', inset: 0 }}>
        {/* background */}
        <div key={bgUrl ?? 'none'} className="vn-bg" style={{ position: 'absolute', inset: 0,
          background: bgUrl ? `#06080f url(${bgUrl}) center/cover no-repeat` : 'radial-gradient(ellipse at 50% 30%, #1d2b44, #06080f 75%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 55%, rgba(0,0,0,0.55))' }} />

        {/* characters */}
        {st.actors.map(a => {
          const c = CAST[a.id] ?? {};
          const src = asset((a.mood && c.moods?.[a.mood]) || c.sprite);
          const talking = st.line?.who === a.id;
          const dim = st.line && !narr && !talking;
          return (
            <div key={a.id} className="vn-actor" style={{ position: 'absolute', bottom: tall ? '26%' : 0, left: `${POS[a.at] ?? 50}%`,
              transform: `translateX(-50%) scale(${talking ? 1.03 : 1})`, transformOrigin: 'bottom center',
              height: tall ? '52%' : '82%', aspectRatio: '0.7', filter: dim ? 'brightness(0.45) saturate(0.6)' : 'none', zIndex: talking ? 3 : 2, pointerEvents: 'none' }}>
              {src ? <img src={src} alt={c.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'bottom' }} />
                   : <Silhouette color={c.color ?? '#888'} name={c.name ?? a.id} />}
            </div>
          );
        })}
      </div>

      {/* top buttons */}
      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6, zIndex: 6 }} onPointerDown={e => e.stopPropagation()}>
        <button className={`vn-btn${auto ? ' on' : ''}`} onClick={() => setAuto(v => !v)}>AUTO</button>
        <button className={`vn-btn${skip ? ' on' : ''}`} onClick={() => setSkip(v => !v)} title="Skip to the next choice or the end">SKIP ▸▸</button>
        <button className="vn-btn" onClick={() => setShowLog(true)}>LOG</button>
      </div>

      {/* text box */}
      {st.line && (
        <div style={{ position: 'absolute', left: '50%', bottom: tall ? 12 : 18, transform: 'translateX(-50%)', width: 'min(1040px, calc(100% - 20px))', zIndex: st.choice ? 8 : 5,
          display: 'flex', gap: tall ? 8 : 12, alignItems: 'stretch' }}>
          {!narr && speaker && !tall && <Portrait who={st.line.who} size={118} />}
          <div style={{ flex: 1, minWidth: 0, position: 'relative', minHeight: tall ? 128 : 118,
            background: narr ? 'rgba(6,10,18,0.86)' : `radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1.2px) 0 0/4px 4px, linear-gradient(${CODEC.green}, ${CODEC.greenDark})`,
            border: `3px solid ${narr ? '#64748b' : CODEC.yellow}`, padding: tall ? '22px 14px 14px' : '24px 22px 16px', boxShadow: '0 6px 18px rgba(0,0,0,0.5)' }}>
            {!narr && speaker?.name && (
              <div style={{ position: 'absolute', top: -16, left: 14, background: '#0b1a12', border: `3px solid ${speaker.color ?? CODEC.yellow}`, color: speaker.color ?? CODEC.yellow,
                fontWeight: 900, fontSize: tall ? 13 : 15, letterSpacing: 1.5, padding: '2px 12px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
                {tall && <Portrait who={st.line.who} size={26} border={speaker.color ?? CODEC.yellow} />}
                {speaker.name}
              </div>
            )}
            <div style={{ fontWeight: narr ? 400 : 700, fontSize: (tall ? 16 : 21) + (narr ? 5 : 0), lineHeight: narr ? 1.3 : 1.4, color: narr ? '#e2e8f0' : CODEC.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: narr ? 'var(--font-narration)' : undefined, letterSpacing: narr ? 0.5 : undefined }}>
              {text.slice(0, shown)}<span style={{ opacity: 0 }}>{text.slice(shown)}</span>
            </div>
            {typed && !st.choice && <div className="vn-next" style={{ position: 'absolute', right: 12, bottom: 6, color: narr ? '#cbd5e1' : CODEC.yellow, fontSize: 14 }}>▼</div>}
          </div>
        </div>
      )}

      {/* choices */}
      {st.choice && (
        <div onPointerDown={e => e.stopPropagation()} style={{ position: 'absolute', inset: 0, zIndex: 7, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
          background: 'rgba(3,6,12,0.55)', paddingBottom: st.line ? (tall ? 140 : 150) : 0 }}>
          {st.choice.map((c, n) => (
            <TapButton key={n} className="vn-choice" onClick={() => choose(c)} autoFocus={n === 0}>
              <span style={{ opacity: 0.6, marginRight: 10 }}>{n + 1}</span>{c.text}
            </TapButton>
          ))}
        </div>
      )}

      {/* backlog */}
      {showLog && (
        <div onPointerDown={e => e.stopPropagation()} style={{ position: 'absolute', inset: 0, zIndex: 9, background: 'rgba(3,8,6,0.94)', display: 'flex', flexDirection: 'column', cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: `2px solid ${CODEC.yellow}55` }}>
            <span style={{ color: CODEC.yellow, fontWeight: 900, letterSpacing: 2, flex: 1 }}>LOG</span>
            <button className="vn-btn" onClick={() => setShowLog(false)}>CLOSE ✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 900, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            {[...st.log, ...(st.line ? [st.line] : [])].map((l, n) => {
              const c = CAST[l.who];
              return (
                <div key={n} style={{ color: l.who === 'choice' ? '#93c5fd' : l.who === 'narrator' ? '#94a3b8' : CODEC.text, fontSize: l.who === 'narrator' ? 19 : 15, lineHeight: 1.4, fontFamily: l.who === 'narrator' ? 'var(--font-narration)' : undefined }}>
                  {c?.name && <b style={{ color: c.color, marginRight: 8, textTransform: 'uppercase' }}>{c.name}</b>}{l.text}
                </div>
              );
            })}
            {!st.log.length && !st.line && <div style={{ color: '#667' }}>Nothing yet.</div>}
          </div>
        </div>
      )}
      {st.application && (
        <JobApplication initialName={profile?.name ?? ''} onSigned={p => { onSign?.(p); setSt(prev => run(steps, prev.i + 1, prev, signedRef.current)); }} />
      )}
    </div>
  );
}

function Silhouette({ color, name }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', left: '28%', right: '28%', top: '6%', aspectRatio: '1', borderRadius: '50%', background: `${color}55`, border: `3px solid ${color}aa` }} />
      <div style={{ position: 'absolute', left: '12%', right: '12%', top: '34%', bottom: 0, borderRadius: '45% 45% 0 0', background: `${color}44`, border: `3px solid ${color}aa`, borderBottom: 'none' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: '12%', textAlign: 'center', color: '#fff', fontWeight: 900, fontSize: 14, letterSpacing: 1, textShadow: '0 1px 3px #000', opacity: 0.8 }}>{name}</div>
    </div>
  );
}
