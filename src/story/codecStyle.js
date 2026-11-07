import { useEffect, useState } from 'react';

// Codec look from the mockup: green panel, yellow frame, bold mono text
export const CODEC = {
  green: '#1d6b4c', greenDark: '#124a35', yellow: '#f2ea5c', text: '#f6ef6a',
  font: 'var(--font-dialogue)',
};

// When each letter of `text` shows up (ms after the line starts): a steady pace, with a
// breath after the end of a sentence, a shorter one after a comma, and "..." trailing off
export function typeTimes(text, cps = 42) {
  const step = 1000 / cps, t = new Array(text.length);
  let at = 0;
  for (let i = 0; i < text.length; i++) {
    t[i] = at;
    at += step;
    const c = text[i], nx = text[i + 1];
    const brk = nx === ' ' || nx === '\n' || nx === '"' || nx === ')';   // a word ends here
    if (c === '.' && nx === '.') at += 90;
    else if ((c === '.' || c === '!' || c === '?' || c === '…') && brk) at += 210;
    else if ((c === ',' || c === ';' || c === ':' || c === '—') && brk) at += 90;
  }
  return t;
}

// Typewriter: how many characters of `text` are showing. `instant` shows all.
// breaths: pause a moment at full stops and commas (off for the battle codec: no time to linger)
export function useTypewriter(text, cps = 42, instant = false, breaths = true) {
  // remembers which text the count belongs to, so a new line never flashes
  // the first letters of itself at the old line's length
  const [st, setSt] = useState({ text, n: 0 });
  const shown = instant ? text.length : st.text === text ? st.n : 0;
  useEffect(() => {
    if (instant || !text) return;
    const started = performance.now(), times = breaths ? typeTimes(text, cps) : [...text].map((_, i) => i * 1000 / cps);
    let n = 0;
    const id = setInterval(() => {
      const el = performance.now() - started;
      while (n < text.length && times[n] <= el) n++;
      const m = n;
      setSt(prev => (prev.text === text && prev.n >= m ? prev : { text, n: m }));
      if (n >= text.length) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [text, cps, instant, breaths]);
  return [shown, () => setSt({ text, n: text.length })];
}

// Words that always stand out in story text (dialogue and narration): the story's big
// names. [pattern, style] — styles are the .kt-* classes in STORY_CSS. Matching ignores case.
export const KEY_TERMS = [
  ['Red Mist', 'red'],
  ['Demon Cores?', 'gold'],
  ['Havoc', 'havoc'],
  ['Ground Zero', 'zone'],
  ['Big Boy', 'gold'],
];
const TERM_RE = new RegExp(`\\b(${KEY_TERMS.map(k => k[0]).join('|')})\\b`, 'gi');
const termStyle = (word) => KEY_TERMS.find(([p]) => new RegExp(`^${p}$`, 'i').test(word))?.[1];

// A line cut into pieces for drawing: [{ t: text, k: style or null }]
export function termPieces(text) {
  const out = [];
  let last = 0, m;
  TERM_RE.lastIndex = 0;
  while ((m = TERM_RE.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index), k: null });
    out.push({ t: m[0], k: termStyle(m[0]) ?? null });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), k: null });
  return out;
}

// All in capitals (2+ letters): someone's shouting
export const isShout = (text) => {
  const letters = text.match(/[a-z]/gi) ?? [];
  return letters.length >= 2 && letters.filter(c => c >= 'A' && c <= 'Z').length / letters.length >= 0.8;
};

// A narration line written like -BOOM!- is a sound: drawn big in the middle of the screen
export const sfxWord = (text) => (/^-[^-\s].*-$/.test(text.trim()) ? text.trim().slice(1, -1).trim() : null);

export const STORY_CSS = `
  .codec-pop { animation: codecIn 0.22s cubic-bezier(.2,1.4,.4,1); }
  @keyframes codecIn { from { transform: translateX(-24px) scale(0.96); opacity: 0; } to { transform: none; opacity: 1; } }
  .codec-next { animation: blinkNext 0.9s steps(2) infinite; }
  @keyframes blinkNext { 50% { opacity: 0; } }

  /* ── cutscene text ─────────────────────────────────────────────────────── */
  /* the speaker's name: a slanted tab in their colour on top of the codec box */
  .vn-name { display: inline-flex; align-items: center; gap: 8px; background: var(--c, ${CODEC.yellow}); color: #0a120d;
             font-family: var(--font-dramatic); font-weight: 700; line-height: 1.15; letter-spacing: .5px; white-space: nowrap;
             padding: 2px 24px 3px 12px; clip-path: polygon(0 0, 100% 0, calc(100% - 13px) 100%, 0 100%); }
  .vn-name-wrap { filter: drop-shadow(0 3px 0 rgba(4,14,9,.9)); }
  /* the codec box: green panel, yellow frame, faint scanlines */
  .vn-box { position: relative; flex: 1; min-width: 0; box-sizing: border-box; border: 3px solid ${CODEC.yellow};
            background: repeating-linear-gradient(0deg, rgba(0,0,0,.07) 0 1px, transparent 1px 3px),
                        radial-gradient(ellipse 90% 120% at 30% 0%, rgba(255,255,255,.07), transparent 60%),
                        linear-gradient(${CODEC.green}, ${CODEC.greenDark});
            box-shadow: inset 0 0 0 2px rgba(4,20,13,.55), 0 8px 22px rgba(0,0,0,.55); }
  .vn-say { color: ${CODEC.text}; text-shadow: 0 2px 0 rgba(6,32,21,.85); white-space: pre-wrap; word-break: break-word; }
  .vn-say.shout { letter-spacing: .6px; }
  .vn-say.shout.big { animation: vnPunch .28s cubic-bezier(.2,1.8,.4,1); transform-origin: 0 50%; }
  @keyframes vnPunch { from { transform: scale(1.14); } to { transform: none; } }
  /* narration: no box, prose on a dark band across the bottom */
  .vn-prose { position: absolute; left: 0; right: 0; bottom: 0; pointer-events: none;
              background: linear-gradient(to top, rgba(3,5,9,.95) 0%, rgba(3,5,9,.88) 50%, rgba(3,5,9,.6) 78%, rgba(3,5,9,0) 100%); }
  .vn-prose-text { margin: 0 auto; color: #ece6d6; font-family: var(--font-narration); font-weight: 500; text-align: center;
                   text-wrap: balance; white-space: pre-wrap; word-break: break-word; text-shadow: 0 2px 6px rgba(0,0,0,.8); }
  /* a sound written as -BOOM!-: slammed onto the middle of the screen */
  .vn-sfx-wrap { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
  .vn-sfx { font-family: var(--font-hit); color: #fff1dc; text-transform: uppercase; letter-spacing: 3px; line-height: 1; white-space: nowrap;
            -webkit-text-stroke: 3px #1a0505; paint-order: stroke fill;
            text-shadow: 7px 7px 0 #b3121b, 0 0 42px rgba(255,70,40,.4);
            transform: rotate(var(--r, -6deg)); animation: vnSlam .34s cubic-bezier(.2,1.5,.45,1) both; }
  @keyframes vnSlam { from { transform: rotate(var(--r, -6deg)) scale(2.6); opacity: 0; } 55% { opacity: 1; } to { transform: rotate(var(--r, -6deg)) scale(1); opacity: 1; } }
  /* "next" marker: a small bobbing triangle */
  .vn-next { animation: vnBob 1s ease-in-out infinite; }
  @keyframes vnBob { 0%,100% { transform: translateY(0); opacity: 1; } 50% { transform: translateY(3px); opacity: .55; } }
  /* the story's big names (KEY_TERMS) */
  .kt-red   { color: #ff6b5f; }
  .kt-gold  { color: #ffcf6e; }
  .kt-zone  { color: #ffcf6e; letter-spacing: .5px; }
  .kt-havoc { color: #ff5146; letter-spacing: .5px; }
  .vn-box .kt-red, .vn-box .kt-havoc { color: #ff8f80; }
  .vn-box .kt-gold { color: #ffab57; }   /* (the codec text is yellow already: orange stands out) */
  .vn-box .kt-zone { color: #ffffff; }
  .vn-box [class^="kt-"] { text-shadow: 0 2px 0 rgba(40,6,4,.9), 0 0 10px rgba(255,120,60,.35); }
  /* someone on a call (cast.js → call): a voice line instead of a face */
  .vn-wave { display: block; border-radius: 2px; animation: vnWave .8s ease-in-out infinite alternate; }
  @keyframes vnWave { from { transform: scaleY(.22); } to { transform: scaleY(1); } }
  .vn-rec { animation: blinkNext 1.4s steps(2) infinite; }
  /* the player's answers */
  .vn-choice.vn-opt { display: flex; align-items: center; gap: 14px; width: 100%; padding: 12px 16px; text-align: left;
                      animation: vnOptIn .24s ease-out backwards; box-shadow: 0 4px 0 #0b2e20, 0 10px 24px rgba(0,0,0,.45); }
  .vn-opt .k { flex: none; display: grid; place-items: center; width: 1.5em; height: 1.5em; font-size: .85em; background: ${CODEC.yellow}; color: #123; }
  .vn-opt:hover .k, .vn-opt:focus-visible .k { background: #123; color: ${CODEC.yellow}; }
  @keyframes vnOptIn { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: none; } }
  .vn-bg { animation: vnFade 0.5s ease-out; }
  @keyframes vnFade { from { opacity: 0; } to { opacity: 1; } }
  .vn-actor { transition: filter 0.2s, transform 0.25s, left 0.35s; animation: vnIn 0.3s ease-out; }
  @keyframes vnIn { from { opacity: 0; transform: translateX(-50%) translateY(18px); } to { opacity: 1; } }
  .vn-shake { animation: vnShake 0.45s; }
  .vn-crawl { animation: vnFade 0.8s ease-out; transition: opacity 1.6s ease-in; }
  .vn-crawl.out { opacity: 0; }
  .credits-roll { position:absolute; left:0; right:0; top:0; padding:0 24px; text-align:center; animation-name: creditsRoll; animation-timing-function: linear; animation-fill-mode: both; }
  @keyframes creditsRoll { from { transform: translateY(100vh); } to { transform: translateY(-100%); } }
  .vn-crawl-p { animation: crawlIn 1.8s ease-out both; }
  /* intro crawl highlights ({style:words} in scenes.js): white first, then they light up */
  .cw { animation-duration: 1.4s; animation-delay: 1.1s; animation-fill-mode: both; animation-timing-function: ease-out; }
  .cw-red    { animation-name: cwRed; }
  .cw-gold   { animation-name: cwGold; }
  .cw-zone   { font-family: var(--font-hit); font-size: 1.05em; letter-spacing: 1px; animation-name: cwGold; }   /* worn, weathered: the Frail Environments */
  .cw-green  { animation-name: cwGreen; }
  .cw-em     { font-style: italic; color: #fff; }
  .cw-dim    { font-style: italic; animation-name: cwDim; }
  .cw-title  { font-family: var(--font-dramatic); font-size: 1.25em; letter-spacing: 2px; animation-name: cwTitle; }
  .cw-shake  { display: inline-block; animation: cwRed 1.4s 1.1s ease-out both, cwShake .18s 1.1s 6 linear; }
  .cw-havoc  { position: relative; display: inline-block; font-family: var(--font-glitch); font-size: 1.12em; letter-spacing: 1px;
               animation: cwHavoc 1.4s 1.1s ease-out both, cwJit 3.2s 2.5s steps(1) infinite; }
  .cw-havoc::after { content: attr(data-t); position: absolute; left: 2px; top: 0; color: #00e5ff; opacity: 0; mix-blend-mode: screen;
               animation: cwGhost 3.2s 2.5s steps(1) infinite; pointer-events: none; }
  @keyframes cwRed   { from { color: #f1f1f1; text-shadow: none; } to { color: #ff5a4f; text-shadow: 0 0 8px rgba(255,60,50,.5); } }
  @keyframes cwGold  { from { color: #f1f1f1; text-shadow: none; } to { color: #ffc46b; text-shadow: 0 0 8px rgba(255,170,60,.45); } }
  @keyframes cwGreen { from { color: #f1f1f1; text-shadow: none; } to { color: #a6e86a; text-shadow: 0 0 8px rgba(140,230,80,.4); } }
  @keyframes cwDim   { from { opacity: 1; } to { opacity: .55; } }
  @keyframes cwTitle { from { color: #f1f1f1; text-shadow: none; } to { color: #fff; text-shadow: 0 0 14px rgba(255,255,255,.65), 0 0 32px rgba(255,180,90,.35); } }
  @keyframes cwHavoc { from { color: #f1f1f1; text-shadow: none; } to { color: #ff3b30; text-shadow: 0 0 12px rgba(255,40,30,.8), 2px 0 0 rgba(0,229,255,.3); } }
  @keyframes cwJit   { 0%,100% { transform: none; } 91% { transform: translate(2px,0) skewX(-8deg); } 93% { transform: translate(-2px,1px); } 95% { transform: none; } }
  @keyframes cwGhost { 0%,100% { opacity: 0; } 91% { opacity: .7; transform: translate(-3px,0); } 95% { opacity: 0; } }
  @keyframes cwShake { 0%,100% { transform: none; } 25% { transform: translate(-1px,1px) rotate(-1deg); } 75% { transform: translate(1px,-1px) rotate(1deg); } }
  @keyframes crawlIn { from { opacity: 0; transform: translateY(6px); filter: blur(3px); } to { opacity: 1; transform: none; filter: none; } }
  @keyframes vnShake { 10%,50%,90% { transform: translate(-6px, 2px); } 30%,70% { transform: translate(6px, -2px); } }
  .vn-btn { font-family: ${CODEC.font}; font-weight: 900; font-size: 12px; letter-spacing: 1px; color: ${CODEC.yellow};
            background: rgba(6,16,12,0.62); border: 1px solid ${CODEC.yellow}66; border-radius: 3px; padding: 5px 10px; cursor: pointer;
            transition: border-color .15s, background .15s; }
  .vn-btn:hover, .vn-btn:focus-visible { border-color: ${CODEC.yellow}; background: rgba(10,30,22,0.9); outline: none; }
  .vn-btn.on { background: ${CODEC.yellow}; color: #123; border-color: ${CODEC.yellow}; }
  .vn-choice { font-family: ${CODEC.font}; font-weight: 800; font-size: 17px; color: ${CODEC.text}; text-align: left;
               background: linear-gradient(${CODEC.green}, ${CODEC.greenDark}); border: 3px solid ${CODEC.yellow}; border-radius: 0;
               padding: 12px 18px; cursor: pointer; width: min(560px, 90vw); box-shadow: 0 4px 0 #0b2e20; transition: transform 0.1s; }
  .vn-choice:hover, .vn-choice:focus-visible { transform: translateX(6px); outline: none; background: ${CODEC.yellow}; color: #123; }
  @media (prefers-reduced-motion: reduce) { .codec-pop, .vn-actor, .vn-bg, .vn-shake, .vn-sfx, .vn-say, .vn-opt, .vn-wave, .vn-next { animation: none !important; } }
`;
