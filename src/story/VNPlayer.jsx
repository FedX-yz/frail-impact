import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { SCENES } from './scenes';
import { CAST } from './cast';
import { asset, testFlag } from './story';
import { Portrait } from './Codec';
import { CODEC, useTypewriter, termPieces, isShout, sfxWord } from './codecStyle';
import { playSFX, playPress, storyTrack, stopStoryTrack, playVoice, stopVoice, preloadSound, soundLength } from '../utils/sfx';
import { voiceFile } from './voice';
import { dubOn } from '../utils/secrets';
import TapButton from '../components/TapButton';
import JobApplication from './JobApplication';
import { CREDITS } from './credits';
import InterviewTest from './InterviewTest';

const BASE = import.meta.env.BASE_URL;
const sfxUrl = (n) => `${BASE}sounds/${n.replace(/\.mp3$/, '')}.mp3`;   // { sfx: 'name' } → public/sounds/name.mp3
const NO_STEPS = [];
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
// the stage when a scene has no background yet, and a little film grain over it
const STAGE = 'radial-gradient(ellipse 75% 60% at 50% 34%, #1c283c 0%, #0c121d 55%, #05070c 100%)';
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .9 0'/></filter><rect width='180' height='180' filter='url(#n)'/></svg>")}")`;
// each sound word leans its own way (-BOOM!- one way, -Kabam!- the other)
const sfxTilt = (w) => { const n = [...w].reduce((a, ch) => a + ch.charCodeAt(0), 0); return (n % 2 ? -1 : 1) * (3 + (n % 4)); };
// spots for { show, at }. For four people at once, use p1…p4 (evenly spread)
const POS = { left: 24, center: 50, right: 76, farleft: 10, farright: 90, p1: 15, p2: 38, p3: 62, p4: 85 };

// Plays steps from `i` until one needs the player (a line, a choice, a wait)
// and returns the new state. Nothing here touches the screen directly.
function run(steps, from, prev, signed = false) {
  const s = { ...prev, actors: [...prev.actors], flags: { ...prev.flags }, sfx: [], application: false, crawl: null, test: false, ending: null, credits: false };
  const labelAt = (name) => steps.findIndex(x => x?.label === name);
  let i = from;
  for (let guard = 0; i < steps.length && guard < 2000; guard++) {
    const step = steps[i];
    if (typeof step === 'string') return { ...s, i, line: { who: 'narrator', text: step, at: i }, choice: null, wait: 0 };
    if (Array.isArray(step)) return { ...s, i, line: { who: step[0], text: String(step[1] ?? ''), at: i, as: step[2] ?? null }, choice: null, wait: 0 };   // [who, text, shown name]
    if (!step || typeof step !== 'object') { i++; continue; }
    if (step.end) break;
    if (step.crawl) return { ...s, i, line: null, choice: null, wait: 0, crawl: step.crawl };   // intro text on black
    if (step.test) return { ...s, i, line: null, choice: null, wait: 0, test: true };   // the interview test (InterviewTest.jsx)
    if (step.credits) return { ...s, i, line: null, choice: null, wait: 0, credits: true };   // the credits roll (credits.js)
    if (step.ending) return { ...s, i, line: null, choice: null, wait: 0, ending: step.ending };   // a bad ending: the card, then back to the map
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
    if (step.sfx) s.sfx.push({ name: step.sfx, delay: step.delay ?? 0, at: step.at ?? null, hold: step.hold ?? true, gain: step.gain });
    if ('music' in step) s.music = { src: step.music, loop: step.loop ?? true, n: (s.music?.n ?? 0) + 1 };
    if ('ambience' in step) s.ambience = { src: step.ambience, n: (s.ambience?.n ?? 0) + 1 };
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
  const logRef = useRef(null);
  useEffect(() => { if (showLog && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [showLog]);   // open on the newest lines
  const mgr = profile?.name || 'Manager';
  const text = (st.line?.text ?? '').replaceAll('{manager}', mgr);
  const sfx = st.line?.who === 'narrator' ? sfxWord(text) : null;   // -BOOM!- (shows at once)
  const [shown, finish] = useTypewriter(text, 44, skip || !!sfx);
  const pieces = useMemo(() => termPieces(text), [text]);
  const typed = shown >= text.length;
  const ended = useRef(false);

  // music from { music } steps (loops until the next one; null = fade out), stops when the scene ends
  const musicN = st.music?.n ?? 0, ambN = st.ambience?.n ?? 0;
  useEffect(() => {
    if (!st.music) return;
    if (st.music.src) storyTrack('music', asset(st.music.src), { fadeIn: 2, gain: 0.8, loop: st.music.loop });
    else stopStoryTrack('music', 1.5);
  }, [musicN]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!st.ambience) return;
    if (st.ambience.src) storyTrack('ambience', asset(st.ambience.src), { fadeIn: 2.5, gain: 0.9 });
    else stopStoryTrack('ambience', 2);
  }, [ambN]); // eslint-disable-line react-hooks/exhaustive-deps
  // the scene's over (or left): its music and ambience fade out
  useEffect(() => () => { stopStoryTrack('music', 1.2); stopStoryTrack('ambience', 1.2); }, []);
  const [crawlTap, setCrawlTap] = useState(0);
  const endCrawl = useCallback(() => setSt(prev => run(steps, prev.i + 1, prev, signedRef.current)), [steps]);

  // voiced lines (cast.js → voice): play when the line comes up, cut off by the next one
  // (keyed by the line itself: a choice coming up under it mustn't play it again).
  // voiceDone: the line's voice has finished (auto mode and 'end' sounds wait for it)
  const lineKey = st.line ? `${st.line.at}:${st.line.who}` : null;
  // the files a line can play, in order: with the secret dub on (utils/secrets.js), its dub
  // (cast.js → dub, if that voice is picked), then its normal voice; a missing file is skipped
  const voicesOf = line => {
    const c = line && CAST[line.who];
    if (!c) return [];
    const dirs = [dubOn() && c.dub?.id ? c.dub.dir : null, c.voice?.dir].filter(Boolean);
    return dirs.map(d => asset(voiceFile(d, line.text)));
  };
  const [voiced, setVoiced] = useState(false);   // this line really has a voice playing (auto mode's pace)
  const [voiceDone, setVoiceDone] = useState(true);
  useEffect(() => {
    const srcs = voicesOf(st.line);
    setVoiced(false);
    if (!srcs.length || skip) { stopVoice(); setVoiceDone(true); return; }
    let alive = true;
    setVoiceDone(false);
    setVoiced(true);
    playVoice(srcs, played => { if (alive) { setVoiced(played); setVoiceDone(true); window.__vnDebug?.('voiceEnd', st.line.text.slice(0, 30)); } });
    const safety = setTimeout(() => { if (alive) setVoiceDone(true); }, 4000 + st.line.text.length * 90);   // never wait forever
    return () => { alive = false; clearTimeout(safety); };
  }, [lineKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopVoice(), []);

  // ── sounds from { sfx } steps ───────────────────────────────────────────
  // They belong to the line that comes up after them: they play when it appears, `delay`
  // seconds later, or (at: 'end') once it's done (typed out and its voice finished).
  // Clicking past a line drops its pending delayed sounds but still plays its 'end' ones
  // (they're punchlines); skipping plays none. cues.until: when the sounds that should be
  // heard out (hold) will have finished — auto mode waits for it.
  const cues = useRef({ timers: [], end: [], until: 0 });
  const playCue = useCallback((c) => {
    const url = sfxUrl(c.name);
    playSFX(url, c.gain ?? (c.name.startsWith('ui_') ? 2.5 : 1));   // story sounds are mastered for unity gain
    window.__vnDebug?.('cue', c.name);
    if (c.hold) cues.current.until = Math.max(cues.current.until, performance.now() + soundLength(url) * 1000);
  }, []);
  useEffect(() => { steps.forEach(x => x?.sfx && preloadSound(sfxUrl(x.sfx))); }, [steps]);   // ready before they're needed
  useEffect(() => {
    const k = cues.current;
    k.timers.forEach(clearTimeout); k.timers = [];
    if (!skip) k.end.forEach(playCue);   // the line we just left still gets its punchline
    k.end = [];
    if (skip) return;
    for (const c of st.sfx ?? []) {
      if (c.at === 'end') k.end.push(c);
      else if (c.delay > 0) {
        k.timers.push(setTimeout(() => playCue(c), c.delay * 1000));
        if (c.hold) k.until = Math.max(k.until, performance.now() + (c.delay + soundLength(sfxUrl(c.name))) * 1000);
      } else playCue(c);
    }
  }, [st.sfx]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (skip) { const k = cues.current; k.timers.forEach(clearTimeout); k.timers = []; k.end = []; } }, [skip]);
  useEffect(() => () => cues.current.timers.forEach(clearTimeout), []);
  const lineDone = !!st.line && typed && voiceDone;
  useEffect(() => { if (st.line) window.__vnDebug?.('line', text.slice(0, 40)); }, [lineKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {   // the line is done: its 'end' sounds
    if (!lineDone || skip) return;
    const k = cues.current;
    k.end.forEach(playCue); k.end = [];
  }, [lineDone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (st.done && !ended.current) { ended.current = true; onEnd(st.flags); }
  }, [st.done, st.flags, onEnd]);

  // ?debug: window.__vn jumps around the scene (for tests and screenshots).
  // jump(n) plays everything up to step n silently and stops at the first line, choice… from there
  const finRef = useRef(finish); finRef.current = finish;
  useEffect(() => {
    if (!DEBUG) return;
    const jump = (n) => {
      let s = run(steps, 0, { bg: undefined, actors: [], flags: { ...flags }, line: null, log: [] }, true);
      for (let g = 0; g < 3000 && !s.done && s.i < n; g++) s = run(steps, s.i + 1, s, true);
      setSt(s);
    };
    const find = (t) => steps.findIndex(x => (typeof x === 'string' ? x : Array.isArray(x) ? x[1] : '')?.includes?.(t));
    window.__vn = { steps, jump, find, finish: () => finRef.current() };
    return () => { delete window.__vn; };
  }, [steps]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = useCallback(() => {
    if (st.done || st.choice || st.application || st.test || st.ending || st.credits || showLog) return;
    if (st.crawl) { setCrawlTap(t => t + 1); return; }
    if (st.line && !typed) { finish(); return; }
    setSt(prev => {
      const log = prev.line ? [...prev.log, prev.line] : prev.log;
      return run(steps, prev.i + 1, { ...prev, log }, signedRef.current);
    });
  }, [st, typed, finish, steps, showLog]);

  const choose = (c) => {
    playPress();
    setSt(prev => {
      // (the line the choice came up under is usually in the log already)
      const said = prev.line && prev.log[prev.log.length - 1] !== prev.line ? [prev.line] : [];
      const p = { ...prev, flags: { ...prev.flags, ...(c.set ?? {}) }, log: [...prev.log, ...said, { who: 'choice', text: `▸ ${c.text}` }], line: null };
      const j = c.goto ? steps.findIndex(x => x?.label === c.goto) : -1;
      return run(steps, j >= 0 ? j : prev.i + 1, p, signedRef.current);
    });
    setSkip(false);
  };

  // waits, auto-play and skip
  useEffect(() => {
    if (st.done || st.choice || st.application || st.crawl || st.test || st.ending || st.credits) { if (st.choice || st.application || st.test || st.ending) setSkip(false); return; }
    let ms = null;
    if (st.wait) ms = st.wait * 1000;
    else if (skip) ms = 70;
    else if (auto && typed && voiceDone) {
      // auto: after the voice, a short pause (the voice set the reading pace); unvoiced, time
      // to read it — and never before this line's sounds have played out
      const read = voiced ? 800 : 900 + text.length * 28;
      ms = Math.max(read, cues.current.until - performance.now() + 350);
    }
    if (ms == null) return;
    const id = setTimeout(() => setSt(prev => run(steps, prev.i + 1, { ...prev, log: prev.line ? [...prev.log, prev.line] : prev.log }, signedRef.current)), ms);
    return () => clearTimeout(id);
  }, [st, skip, auto, typed, voiceDone, voiced, text, steps]);

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

  const cast0 = st.line ? CAST[st.line.who] ?? { name: st.line.who, color: CODEC.yellow } : null;
  const speaker = cast0 && st.line.as ? { ...cast0, name: st.line.as } : cast0;   // ['ice', '…', '???'] hides the name
  const narr = st.line?.who === 'narrator';
  const shout = !narr && isShout(text);
  const bigShout = shout && text.length <= 42;   // a short shout is drawn bigger
  const bgUrl = st.bg ? asset(st.bg) : null;
  const tall = mobile && portrait;   // phone held upright
  const land = mobile && !portrait;  // phone on its side: everything smaller
  // sizes: face (0 = it goes on the name tab), text, name, the box's least height (= the face's), …
  const S = tall ? { face: 0, say: 16, name: 19, box: 124, pad: '26px 14px 14px', prose: 20, opt: 16, stage: 52 }
          : land ? { face: 74, say: 15, name: 17, box: 80, pad: '19px 16px 10px', prose: 18, opt: 15, stage: 88 }
          : { face: 120, say: 20, name: 24, box: 126, pad: '28px 24px 18px', prose: 27, opt: 18, stage: 82 };
  const next1 = typed && !st.choice;   // the ▼ that says "tap to go on"

  return (
    <div onPointerDown={e => { if (e.button === 0) next(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#06080f', overflow: 'hidden', userSelect: 'none', cursor: 'pointer', fontFamily: CODEC.font }}>
      <div key={`shake${st.shakeN ?? 0}`} className={st.shakeN ? 'vn-shake' : ''} style={{ position: 'absolute', inset: 0 }}>
        {/* background (none yet: a dark stage with a little film grain) */}
        <div key={bgUrl ?? 'none'} className="vn-bg" style={{ position: 'absolute', inset: 0,
          background: bgUrl ? `#06080f url(${bgUrl}) center/cover no-repeat` : STAGE }} />
        {!bgUrl && <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, opacity: 0.07, pointerEvents: 'none' }} />}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 90% 80% at 50% 40%, transparent 55%, rgba(0,0,0,0.5)), linear-gradient(transparent 55%, rgba(0,0,0,0.55))' }} />

        {/* characters: all the same height (cast.js → height for cut-outs that aren't head to toe) */}
        {st.actors.map(a => {
          const c = CAST[a.id] ?? {};
          const src = asset((a.mood && c.moods?.[a.mood]) || c.sprite);
          const talking = st.line?.who === a.id;
          const dim = st.line && !narr && !talking;
          const part = (c.height ?? 1) < 1;   // a bust: its cut edge sinks behind the text box
          return (
            <div key={a.id} className="vn-actor" style={{ position: 'absolute', bottom: tall ? (part ? '18%' : '26%') : 0, left: `${POS[a.at] ?? 50}%`,
              transform: `translateX(-50%) scale(${talking ? 1.03 : 1})`, transformOrigin: 'bottom center', height: `${S.stage * (c.height ?? 1)}%`,
              filter: dim ? 'brightness(0.5) saturate(0.7)' : 'none', zIndex: talking ? 3 : 2, pointerEvents: 'none' }}>
              {!part && <div style={{ position: 'absolute', left: '50%', bottom: '-1.5%', width: '80%', height: '4%', transform: 'translateX(-50%)', background: 'radial-gradient(closest-side, rgba(0,0,0,0.6), transparent)' }} />}
              {src ? <img src={src} alt={c.name} draggable={false} style={{ position: 'relative', display: 'block', height: '100%', width: 'auto' }} />
                   : <Silhouette color={c.color ?? '#888'} />}
            </div>
          );
        })}
      </div>

      {/* top buttons */}
      <div style={{ position: 'absolute', top: land ? 6 : 10, right: land ? 6 : 10, display: 'flex', gap: 6, zIndex: 10 }} onPointerDown={e => e.stopPropagation()}>
        <button className={`vn-btn${auto ? ' on' : ''}`} onClick={() => setAuto(v => !v)}>AUTO</button>
        <button className={`vn-btn${skip ? ' on' : ''}`} onClick={() => setSkip(v => !v)} title="Skip to the next choice or the end">SKIP ▸▸</button>
        <button className="vn-btn" onClick={() => setShowLog(true)}>LOG</button>
      </div>

      {/* a sound line (-BOOM!-): the word, big, in the middle */}
      {st.line && sfx && (
        <div key={lineKey} className="vn-sfx-wrap" style={{ zIndex: 5 }}>
          <span className="vn-sfx" style={{ fontSize: `min(${land ? 120 : 190}px, calc(${land ? 60 : 82}vw / ${(sfx.length * 0.74).toFixed(2)}))`, '--r': `${sfxTilt(sfx)}deg` }}>{sfx}</span>
        </div>
      )}

      {/* narration: prose on a dark band, no box */}
      {st.line && narr && !sfx && (
        <div className="vn-prose" style={{ zIndex: st.choice ? 8 : 5, padding: tall ? '70px 20px 34px' : land ? '44px 40px 16px' : '110px 48px 44px' }}>
          <div className="vn-prose-text" style={{ fontSize: S.prose, lineHeight: 1.45, maxWidth: tall ? 'none' : 860 }}>
            <Typed pieces={pieces} shown={shown} />
          </div>
          {next1 && <div className="vn-next" style={{ position: 'absolute', right: tall ? 16 : 30, bottom: tall ? 12 : 18, color: '#cbd5e1', fontSize: 12 }}>▼</div>}
        </div>
      )}

      {/* someone talking: their face and the codec box, their name on a tab */}
      {st.line && !narr && (
        <div style={{ position: 'absolute', left: '50%', bottom: tall ? 12 : land ? 8 : 20, transform: 'translateX(-50%)', width: 'min(1060px, calc(100% - 20px))', zIndex: st.choice ? 8 : 5,
          display: 'flex', gap: land ? 10 : 14, alignItems: 'stretch' }}>
          {S.face > 0 && speaker && <Portrait who={st.line.who} size={S.face} />}
          <div className="vn-box" style={{ minHeight: S.box, padding: S.pad }}>
            {speaker?.name && (
              <div className="vn-name-wrap" style={{ position: 'absolute', top: tall ? -24 : land ? -17 : -21, left: tall ? 10 : 14 }}>
                <div className="vn-name" style={{ '--c': speaker.color ?? CODEC.yellow, fontSize: S.name, paddingLeft: tall ? 4 : 12 }}>
                  {tall && <Portrait who={st.line.who} size={34} border="#0a120d" />}
                  {speaker.name}
                </div>
              </div>
            )}
            <div key={lineKey} className={`vn-say${shout ? ' shout' : ''}${bigShout ? ' big' : ''}`}
              style={{ fontWeight: 700, fontSize: Math.round(S.say * (bigShout ? 1.3 : 1)), lineHeight: 1.45 }}>
              <Typed pieces={pieces} shown={shown} />
            </div>
            {next1 && <div className="vn-next" style={{ position: 'absolute', right: 12, bottom: 7, color: CODEC.yellow, fontSize: 12 }}>▼</div>}
          </div>
        </div>
      )}

      {/* choices: what you say back */}
      {st.choice && (
        <div onPointerDown={e => e.stopPropagation()} style={{ position: 'absolute', inset: 0, zIndex: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(rgba(3,6,12,0.3), rgba(3,6,12,0.62))', boxSizing: 'border-box',
          padding: `${land ? 34 : 50}px 14px ${st.line ? (narr ? (tall ? 190 : land ? 96 : 190) : (tall ? 160 : land ? 112 : 180)) : 20}px` }}>
          <div style={{ width: 'min(620px, 100%)', display: 'flex', flexDirection: 'column', gap: land ? 8 : 11 }}>
            <div className="vn-name-wrap" style={{ alignSelf: 'flex-start', marginBottom: 2 }}>
              <div className="vn-name" style={{ '--c': CODEC.yellow, fontSize: S.name }}>{mgr}</div>
            </div>
            {st.choice.map((c, n) => (
              <TapButton key={n} className="vn-choice vn-opt" style={{ fontSize: S.opt, padding: land ? '8px 14px' : undefined, animationDelay: `${n * 70}ms` }} onClick={() => choose(c)} autoFocus={n === 0}>
                <span className="k">{n + 1}</span><span>{c.text.replaceAll('{manager}', mgr)}</span>
              </TapButton>
            ))}
          </div>
        </div>
      )}

      {/* backlog: everything said so far, newest at the bottom */}
      {showLog && (
        <div onPointerDown={e => e.stopPropagation()} style={{ position: 'absolute', inset: 0, zIndex: 11, background: '#030806', display: 'flex', flexDirection: 'column', cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: land ? '6px 14px' : '12px 18px', borderBottom: `1px solid ${CODEC.yellow}40` }}>
            <span style={{ color: CODEC.yellow, fontFamily: 'var(--font-dramatic)', fontWeight: 700, fontSize: land ? 20 : 26, flex: 1 }}>Log</span>
            <button className="vn-btn" onClick={() => setShowLog(false)}>CLOSE ✕</button>
          </div>
          <div ref={logRef} style={{ flex: 1, overflowY: 'auto', padding: tall ? '16px 16px 30px' : '20px 24px 40px' }}>
            <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: tall ? 14 : 12 }}>
              {[...st.log, ...(st.line && st.log[st.log.length - 1] !== st.line ? [st.line] : [])].map((l, n) => <LogRow key={n} l={l} mgr={mgr} tall={tall} />)}
              {!st.log.length && !st.line && <div style={{ color: '#667' }}>Nothing yet.</div>}
            </div>
          </div>
        </div>
      )}
      {st.crawl && <IntroCrawl key={st.i} paragraphs={st.crawl} tap={crawlTap} skip={skip} onDone={endCrawl} tall={tall} />}
      {st.test && (
        <InterviewTest onDone={passed => setSt(prev => run(steps, prev.i + 1, { ...prev, flags: { ...prev.flags, failedTest: !passed } }, signedRef.current))} />
      )}
      {st.credits && <CreditsRoll key={st.i} tall={tall} skip={skip} onDone={endCrawl} />}
      {st.ending && <EndingCard ending={st.ending} tall={tall} onDone={() => { if (!ended.current) { ended.current = true; onEnd({ ...st.flags, __ending: st.ending.n }); } }} />}
      {st.application && (
        <JobApplication initialName={profile?.name ?? ''} onSigned={p => { onSign?.(p); setSt(prev => run(steps, prev.i + 1, prev, signedRef.current)); }} />
      )}
    </div>
  );
}

// A line's text, typed out to `shown` letters (the rest is there but invisible, so the
// words don't jump around as they appear). Key terms keep their colour (codecStyle.js).
function Typed({ pieces, shown }) {
  let left = shown;
  return pieces.map((p, i) => {
    const n = Math.max(0, Math.min(p.t.length, left));
    left -= p.t.length;
    return (
      <span key={i} className={p.k ? `kt-${p.k}` : undefined}>
        {p.t.slice(0, n)}{n < p.t.length && <span style={{ opacity: 0 }}>{p.t.slice(n)}</span>}
      </span>
    );
  });
}

// One line of the backlog: the name in its colour (your answers under your name), then the words
function LogRow({ l, mgr, tall }) {
  const narr = l.who === 'narrator', mine = l.who === 'choice';
  const c = CAST[l.who];
  const name = mine ? mgr : (l.as ?? c?.name);
  const words = (mine ? l.text.replace(/^▸\s*/, '') : l.text).replaceAll('{manager}', mgr);
  if (narr) return <div style={{ paddingLeft: tall ? 0 : 168, color: '#9aa6b8', fontFamily: 'var(--font-narration)', fontStyle: 'italic', fontSize: tall ? 17 : 19, lineHeight: 1.4 }}>{words}</div>;
  return (
    <div style={{ display: tall ? 'block' : 'grid', gridTemplateColumns: '150px 1fr', columnGap: 18, alignItems: 'baseline' }}>
      <div style={{ textAlign: tall ? 'left' : 'right', color: mine ? CODEC.yellow : (c?.color ?? '#cbd5e1'), fontFamily: 'var(--font-dramatic)', fontWeight: 700, fontSize: tall ? 16 : 18, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{name}</div>
      <div style={{ color: mine ? '#fde68a' : CODEC.text, fontSize: tall ? 14 : 15, lineHeight: 1.45 }}>{mine && <span style={{ opacity: 0.6, marginRight: 6 }}>▸</span>}{words}</div>
    </div>
  );
}

// {style:words} inside a crawl paragraph: the words light up in that style a moment
// after the paragraph appears. Styles (codecStyle.js → .cw-*): red, havoc, gold, zone, green,
// title, em, dim, shake. Plain text around them stays white.
const MARK = /\{(red|havoc|gold|zone|green|title|em|dim|shake):([^}]+)\}/g;
const plainCrawl = (p) => p.replace(MARK, '$2');
function marked(p) {
  const out = [];
  let last = 0, m, k = 0;
  MARK.lastIndex = 0;
  while ((m = MARK.exec(p))) {
    if (m.index > last) out.push(p.slice(last, m.index));
    out.push(<span key={k++} className={`cw cw-${m[1]}`} data-t={m[2]}>{m[2]}</span>);
    last = m.index + m[0].length;
  }
  if (last < p.length) out.push(p.slice(last));
  return out;
}

// Paragraphs of white text fading in one by one on black, then everything fades out.
// Tap / Space: show the next paragraph now (or, once all are in, fade out). SKIP: done.
function IntroCrawl({ paragraphs, tap, skip, onDone, tall }) {
  const [n, setN] = useState(0);          // paragraphs shown
  const [out, setOut] = useState(false);  // fading out
  const read = (p) => 1600 + plainCrawl(p ?? '').length * 55;   // ms to read a paragraph
  const done = useRef(false);
  const finish = useCallback(() => { if (!done.current) { done.current = true; onDone(); } }, [onDone]);
  useEffect(() => { if (skip) finish(); }, [skip, finish]);
  // next paragraph after the last one has been read; after the last, fade out
  useEffect(() => {
    if (out) { const id = setTimeout(finish, 1800); return () => clearTimeout(id); }
    const id = setTimeout(() => (n < paragraphs.length ? setN(n + 1) : setOut(true)), n === 0 ? 900 : read(paragraphs[n - 1]));
    return () => clearTimeout(id);
  }, [n, out, paragraphs, finish]);
  useEffect(() => {
    if (!tap) return;
    if (n < paragraphs.length) setN(n + 1); else setOut(true);
  }, [tap]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`vn-crawl${out ? ' out' : ''}`} style={{ position: 'absolute', inset: 0, zIndex: 8, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: tall ? '60px 22px' : '60px 40px', overflowY: 'auto' }}>
      <div style={{ maxWidth: 780, display: 'flex', flexDirection: 'column', gap: tall ? 18 : 24 }}>
        {paragraphs.slice(0, n).map((p, i) => (
          <p key={i} className="vn-crawl-p" style={{ margin: 0, color: '#f1f1f1', fontFamily: 'var(--font-narration)', fontWeight: 500, fontSize: tall ? 19 : 25, lineHeight: 1.5,
            textAlign: 'center', opacity: i < n - 1 ? 0.62 : 1, transition: 'opacity 1.2s' }}>{marked(p)}</p>
        ))}
      </div>
    </div>
  );
}

// The credits: they roll up the screen on black, then the scene goes on. Tap to skip.
function CreditsRoll({ onDone, skip, tall }) {
  const done = useRef(false), t0 = useRef(performance.now());
  const finish = useCallback(() => { if (!done.current) { done.current = true; onDone(); } }, [onDone]);
  useEffect(() => { if (skip) finish(); }, [skip, finish]);
  const lines = CREDITS.reduce((n, c) => n + (c.names?.length ?? 0) + 1, 0);
  const dur = Math.max(14, lines * 1.3);   // seconds
  return (
    <div className="vn-crawl" onPointerDown={e => { e.stopPropagation(); if (performance.now() - t0.current > 1200) finish(); }}
      style={{ position: 'absolute', inset: 0, zIndex: 9, background: '#000', overflow: 'hidden', cursor: 'default' }}>
      <div className="credits-roll" style={{ animationDuration: `${dur}s` }} onAnimationEnd={finish}>
        {CREDITS.map((c, i) => c.gap ? <div key={i} style={{ height: tall ? 70 : 110 }} /> : c.title ? (
          <div key={i} style={{ color: '#f1f1f1', fontFamily: 'var(--font-dramatic)', fontSize: tall ? 30 : 46, letterSpacing: 4, margin: '0 0 28px' }}>{c.title}</div>
        ) : (
          <div key={i} style={{ margin: '0 0 30px' }}>
            <div style={{ color: '#94a3b8', fontFamily: 'var(--font-narration)', fontSize: tall ? 14 : 17, letterSpacing: 5, textTransform: 'uppercase', marginBottom: 8 }}>{c.role}</div>
            {c.names.map((nm, j) => <div key={j} style={{ color: '#e5e7eb', fontFamily: 'var(--font-narration)', fontSize: tall ? 18 : 23, lineHeight: 1.45 }}>{nm}</div>)}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', right: 14, bottom: 10, color: '#475569', fontSize: 12, letterSpacing: 2 }}>TAP TO SKIP</div>
    </div>
  );
}

// ENDING n — a bad ending: the title on black, then back to the map (the level isn't cleared)
function EndingCard({ ending, onDone, tall }) {
  return (
    <div onPointerDown={e => e.stopPropagation()} className="vn-crawl" style={{ position: 'absolute', inset: 0, zIndex: 9, background: '#000', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center', cursor: 'default' }}>
      <div className="vn-crawl-p" style={{ color: '#94a3b8', fontFamily: 'var(--font-narration)', fontSize: tall ? 18 : 22, letterSpacing: 6 }}>ENDING {ending.n}</div>
      <div className="vn-crawl-p" style={{ color: '#f1f1f1', fontFamily: 'var(--font-dramatic)', fontSize: tall ? 34 : 52, letterSpacing: 4 }}>{ending.title}</div>
      {ending.text && <div className="vn-crawl-p" style={{ color: '#cbd5e1', fontFamily: 'var(--font-narration)', fontSize: tall ? 16 : 19, maxWidth: 560 }}>{ending.text}</div>}
      <TapButton className="vn-choice" style={{ marginTop: 10 }} autoFocus onClick={() => { playPress(); onDone(); }}>Try again ↻</TapButton>
    </div>
  );
}

// No sprite yet: a dark standing figure, lit at the edges in their colour
function Silhouette({ color }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 120 300" style={{ position: 'relative', display: 'block', height: '100%', width: 'auto', aspectRatio: '0.4', overflow: 'visible' }}>
      <defs>
        {/* lit from above: the edge light and the body both fade into the dark towards the feet */}
        <linearGradient id={`b${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="295"><stop offset="0" stopColor="#273246" /><stop offset=".55" stopColor="#141b27" /><stop offset="1" stopColor="#080b11" /></linearGradient>
        <linearGradient id={`s${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="295"><stop offset="0" stopColor={color} stopOpacity=".85" /><stop offset=".5" stopColor={color} stopOpacity=".4" /><stop offset=".95" stopColor={color} stopOpacity="0" /></linearGradient>
        <radialGradient id={`g${id}`}><stop offset="0" stopColor={color} stopOpacity="0.17" /><stop offset="1" stopColor={color} stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="60" cy="125" rx="84" ry="150" fill={`url(#g${id})`} />
      <g fill={`url(#b${id})`} stroke={`url(#s${id})`} strokeWidth="1.8" strokeLinejoin="round">
        <path vectorEffect="non-scaling-stroke" d="M53 50 L53 60 C40 61 26 64 20 76 C16 92 15 106 14 122 L12 158 Q8 170 12 176 Q20 178 23 168 L25 158 L31 98 L35 140 L33 162 L37 224 L39 284 Q35 292 40 293 L55 293 Q57 289 55 284 L58 180 Q60 176 62 180 L65 284 Q63 289 65 293 L80 293 Q85 292 81 284 L83 224 L87 162 L85 140 L89 98 L95 158 L97 168 Q100 178 108 176 Q112 170 108 158 L106 122 C105 106 104 92 100 76 C94 64 80 61 67 60 L67 50 Z" />
        <ellipse cx="60" cy="33" rx="16" ry="20" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}
