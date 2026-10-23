import { useEffect, useState } from 'react';

// Codec look from the mockup: green panel, yellow frame, bold mono text
export const CODEC = {
  green: '#1d6b4c', greenDark: '#124a35', yellow: '#f2ea5c', text: '#f6ef6a',
  font: 'var(--font-dialogue)',
};

// Typewriter: how many characters of `text` are showing. `instant` shows all.
export function useTypewriter(text, cps = 42, instant = false) {
  // remembers which text the count belongs to, so a new line never flashes
  // the first letters of itself at the old line's length
  const [st, setSt] = useState({ text, n: 0 });
  const shown = instant ? text.length : st.text === text ? st.n : 0;
  useEffect(() => {
    if (instant || !text) return;
    const started = performance.now();
    const id = setInterval(() => {
      const n = Math.min(text.length, Math.floor((performance.now() - started) / 1000 * cps));
      setSt(prev => (prev.text === text && prev.n >= n ? prev : { text, n }));
      if (n >= text.length) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [text, cps, instant]);
  return [shown, () => setSt({ text, n: text.length })];
}

export const STORY_CSS = `
  .codec-pop { animation: codecIn 0.22s cubic-bezier(.2,1.4,.4,1); }
  @keyframes codecIn { from { transform: translateX(-24px) scale(0.96); opacity: 0; } to { transform: none; opacity: 1; } }
  .codec-next, .vn-next { animation: blinkNext 0.9s steps(2) infinite; }
  @keyframes blinkNext { 50% { opacity: 0; } }
  .vn-bg { animation: vnFade 0.5s ease-out; }
  @keyframes vnFade { from { opacity: 0; } to { opacity: 1; } }
  .vn-actor { transition: filter 0.2s, transform 0.25s, left 0.35s; animation: vnIn 0.3s ease-out; }
  @keyframes vnIn { from { opacity: 0; transform: translateX(-50%) translateY(18px); } to { opacity: 1; } }
  .vn-shake { animation: vnShake 0.45s; }
  .vn-crawl { animation: vnFade 0.8s ease-out; transition: opacity 1.6s ease-in; }
  .vn-crawl.out { opacity: 0; }
  .vn-crawl-p { animation: crawlIn 1.8s ease-out both; }
  /* intro crawl highlights ({style:words} in scenes.js): white first, then they light up */
  .cw { animation-duration: 1.4s; animation-delay: 1.1s; animation-fill-mode: both; animation-timing-function: ease-out; }
  .cw-red    { animation-name: cwRed; }
  .cw-gold   { animation-name: cwGold; }
  .cw-green  { animation-name: cwGreen; }
  .cw-em     { font-style: italic; color: #fff; }
  .cw-dim    { font-style: italic; animation-name: cwDim; }
  .cw-title  { font-family: var(--font-dramatic); font-size: 1.25em; letter-spacing: 2px; animation-name: cwTitle; }
  .cw-shake  { display: inline-block; animation: cwRed 1.4s 1.1s ease-out both, cwShake .18s 1.1s 6 linear; }
  .cw-havoc  { position: relative; display: inline-block; font-family: var(--font-glitch); font-size: 1.12em; letter-spacing: 1px;
               animation: cwHavoc 1.4s 1.1s ease-out both, cwJit 3.2s 2.5s steps(1) infinite; }
  .cw-havoc::after { content: attr(data-t); position: absolute; left: 2px; top: 0; color: #00e5ff; opacity: 0; mix-blend-mode: screen;
               animation: cwGhost 3.2s 2.5s steps(1) infinite; pointer-events: none; }
  @keyframes cwRed   { from { color: #f1f1f1; text-shadow: none; } to { color: #ff5a4f; text-shadow: 0 0 12px rgba(255,60,50,.75), 0 0 2px #ff2a1f; } }
  @keyframes cwGold  { from { color: #f1f1f1; text-shadow: none; } to { color: #ffc46b; text-shadow: 0 0 14px rgba(255,170,60,.7); } }
  @keyframes cwGreen { from { color: #f1f1f1; text-shadow: none; } to { color: #a6e86a; text-shadow: 0 0 12px rgba(140,230,80,.6); } }
  @keyframes cwDim   { from { opacity: 1; } to { opacity: .55; } }
  @keyframes cwTitle { from { color: #f1f1f1; text-shadow: none; } to { color: #fff; text-shadow: 0 0 16px rgba(255,255,255,.8), 0 0 40px rgba(255,180,90,.5); } }
  @keyframes cwHavoc { from { color: #f1f1f1; text-shadow: none; } to { color: #ff3b30; text-shadow: 0 0 14px rgba(255,40,30,.9), 2px 0 0 rgba(0,229,255,.35); } }
  @keyframes cwShake { 0%,100% { transform: none; } 25% { transform: translate(-1px,1px) rotate(-1deg); } 75% { transform: translate(1px,-1px) rotate(1deg); } }
  @keyframes cwJit   { 0%,100% { transform: none; } 91% { transform: translate(2px,0) skewX(-8deg); } 93% { transform: translate(-2px,1px); } 95% { transform: none; } }
  @keyframes cwGhost { 0%,100% { opacity: 0; } 91% { opacity: .7; transform: translate(-3px,0); } 95% { opacity: 0; } }
  @keyframes crawlIn { from { opacity: 0; transform: translateY(6px); filter: blur(3px); } to { opacity: 1; transform: none; filter: none; } }
  @keyframes vnShake { 10%,50%,90% { transform: translate(-6px, 2px); } 30%,70% { transform: translate(6px, -2px); } }
  .vn-btn { font-family: ${CODEC.font}; font-weight: 900; font-size: 12px; letter-spacing: 1px; color: ${CODEC.yellow};
            background: rgba(10,30,22,0.82); border: 2px solid ${CODEC.yellow}88; border-radius: 4px; padding: 5px 10px; cursor: pointer; }
  .vn-btn.on { background: ${CODEC.yellow}; color: #123; }
  .vn-choice { font-family: ${CODEC.font}; font-weight: 800; font-size: 17px; color: ${CODEC.text}; text-align: left;
               background: linear-gradient(${CODEC.green}, ${CODEC.greenDark}); border: 3px solid ${CODEC.yellow}; border-radius: 0;
               padding: 12px 18px; cursor: pointer; width: min(560px, 90vw); box-shadow: 0 4px 0 #0b2e20; transition: transform 0.1s; }
  .vn-choice:hover, .vn-choice:focus-visible { transform: translateX(6px); outline: none; background: ${CODEC.yellow}; color: #123; }
  @media (prefers-reduced-motion: reduce) { .codec-pop, .vn-actor, .vn-bg, .vn-shake { animation: none !important; } }
`;
