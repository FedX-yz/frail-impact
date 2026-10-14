import { useCallback, useEffect, useRef, useState } from 'react';
import BattleArena from '../combat/BattleArena';
import { createBattle, fmt } from '../combat/engine';
import { ENEMY_TYPES } from '../combat/enemies';
import { makeStoryStage, parseWhen, testFlag } from './story';
import { CodecPopup } from './Codec';
import { CODEC, STORY_CSS } from './codecStyle';
import VNPlayer from './VNPlayer';
import { playPress } from '../utils/sfx';

const BASE = import.meta.env.BASE_URL;
const NO_LINES = [];

// Does a codec trigger match the battle right now?
function triggered(w, s, ev) {
  if (s.phase === 'clear' || s.phase === 'defeat') return false;
  switch (w.type) {
    case 'start':    return s.time > 0.4;
    case 'kills':    return s.kills >= w.n;
    case 'time':     return s.time >= w.n;
    case 'boss':     return s.phase === 'boss' && !!s.bossInfo;
    case 'bossHalf': {
      if (!s.bossInfo) return false;
      const hp = s.enemies.filter(e => e.tier === 'boss').reduce((a, e) => a + Math.max(0, e.hp), 0);
      return hp / s.bossInfo.maxHp <= 0.5;
    }
    case 'lowHp':    return s.player.hp > 0 && s.player.hp / s.player.maxHp <= 0.3;
    case 'hit':      return ev.hit;
    case 'ult':      return ev.ult;
    default:         return false;
  }
}

// One story level: intro cutscene → battle (with codec lines) → outro cutscene → results.
export default function StoryLevel({ node, story, stats, mainCard, mobile, portrait, devMode, onReward, onComplete, onLeave }) {
  const firstClear = useRef(!story.cleared[node.id]).current;
  const first = node.intro ? 'intro' : node.battle ? 'battle' : node.outro ? 'outro' : 'result';
  const [phase, setPhase] = useState(first);
  const [flags, setFlags] = useState(() => ({ ...story.flags }));

  // ── Battle ────────────────────────────────────────────────────────────────
  const handlers = useRef({});
  const [engine, setEngine] = useState(null);
  const [lost, setLost] = useState(false);
  const [menu, setMenu] = useState(false);
  const [queue, setQueue] = useState([]);
  const fired = useRef(new Set());
  const events = useRef({ hit: false, ult: false });

  const afterBattle = useCallback(() => setPhase(node.outro ? 'outro' : 'result'), [node.outro]);
  const afterScene = useCallback((which) => (f) => {
    setFlags(f);
    if (which === 'intro') setPhase(node.battle ? 'battle' : node.outro ? 'outro' : 'result');
    else setPhase('result');
  }, [node.battle, node.outro]);

  useEffect(() => {
    if (phase !== 'battle' || engine) return;
    setEngine(createBattle({ stageNum: node.battle?.level ?? 1, stats, makeStage: () => makeStoryStage(node), callbacks: handlers }));
  }, [phase, engine, node, stats]);
  useEffect(() => { engine?.setStats(stats); }, [engine, stats]);

  handlers.current = {
    onReward: (r) => onReward(r, engine),
    onPlayerHit: () => { events.current.hit = true; },
    onUlt: () => { events.current.ult = true; },
    onStoryEnd: (res) => { if (res === 'won') afterBattle(); else setLost(true); },
  };

  // codec lines: check the triggers a few times a second
  const lines = node.codec ?? NO_LINES;
  useEffect(() => {
    if (!engine || phase !== 'battle') return;
    const id = setInterval(() => {
      const s = engine.state;
      if (s.paused || !s.W) return;
      const hits = [];
      lines.forEach((l, i) => {
        if (fired.current.has(i) || !testFlag(flags, l.if)) return;
        if (triggered(parseWhen(l.when), s, events.current)) { fired.current.add(i); hits.push({ ...l, key: `${i}-${s.time}` }); }
      });
      if (hits.length) setQueue(q => [...q, ...hits].slice(-4));
    }, 150);
    return () => clearInterval(id);
  }, [engine, phase, lines, flags]);

  const current = queue[0] ?? null;
  const nextLine = useCallback(() => setQueue(q => q.slice(1)), []);
  // the fight stops while the menu is open or an important line is waiting
  useEffect(() => { engine?.setPaused(menu || !!current?.pause); }, [engine, menu, current]);

  const retry = () => {
    playPress();
    fired.current = new Set(); events.current = { hit: false, ult: false };
    setQueue([]); setLost(false); setMenu(false);
    engine.restart();
  };
  const leave = () => { playPress(); engine?.setPaused(false); onLeave(); };

  // Esc = pause menu
  useEffect(() => {
    if (phase !== 'battle') return;
    const onKey = (e) => { if (e.key === 'Escape' && !lost) setMenu(m => !m); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, lost]);

  // Results: save progress once when you get there
  const saved = useRef(false);
  useEffect(() => {
    if (phase !== 'result' || saved.current) return;
    saved.current = true;
    onComplete({ flags, firstClear });
  }, [phase, flags, firstClear, onComplete]);

  // ── Screens ───────────────────────────────────────────────────────────────
  let body = null;
  if (phase === 'intro' || phase === 'outro') {
    body = <VNPlayer key={phase} sceneId={node[phase]} flags={flags} onEnd={afterScene(phase)} mobile={mobile} portrait={portrait} />;
  } else if (phase === 'battle' && engine) {
    const codecH = current ? (mobile ? 54 : 78) + 8 : 0;
    const boss = node.battle?.boss ? ENEMY_TYPES[node.battle.boss]?.name : null;
    body = (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0b0f1c', fontFamily: "'Segoe UI',sans-serif", userSelect: 'none',
        cursor: mobile ? 'auto' : `url(${BASE}ui/mouse.png) 0 0, auto` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: mobile ? '6px 8px' : '8px 14px', background: '#141928', borderBottom: `2px solid ${CODEC.yellow}`, flexShrink: 0 }}>
          <button className="vn-btn" onClick={() => { playPress(); setMenu(true); }} title="Pause (Esc)">❚❚ PAUSE</button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: CODEC.yellow, fontFamily: CODEC.font, fontWeight: 900, letterSpacing: 1, fontSize: mobile ? 13 : 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</div>
            {!mobile && <div style={{ color: '#778', fontSize: 11 }}>LV {node.battle?.level ?? 1}{boss ? ` · boss: ${boss}` : ''}</div>}
          </div>
          {devMode && <button className="vn-btn" style={{ borderColor: '#a855f7', color: '#e9d5ff' }} onClick={() => engine.dev.win()}>🛠 WIN</button>}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: mobile ? 6 : 12 }}>
          <BattleArena engine={engine} mainCard={mainCard} mobile={mobile} comboTop={40 + codecH}>
            {current && <CodecPopup key={current.key} line={current} mobile={mobile} onDone={nextLine} />}
          </BattleArena>
        </div>

        {(menu || lost) && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(3,6,12,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ width: 'min(360px, 100%)', background: `linear-gradient(${CODEC.green}, ${CODEC.greenDark})`, border: `3px solid ${CODEC.yellow}`, padding: 20,
              display: 'flex', flexDirection: 'column', gap: 10, fontFamily: CODEC.font, boxShadow: '0 10px 40px rgba(0,0,0,0.6)' }}>
              <div style={{ color: lost ? '#ff6b4a' : CODEC.yellow, fontWeight: 900, fontSize: 26, letterSpacing: 3, textAlign: 'center' }}>{lost ? 'DEFEATED' : 'PAUSED'}</div>
              {lost && <div style={{ color: '#d1fae5', fontSize: 13, textAlign: 'center', marginBottom: 4 }}>Train or change your deck, then come back — or try again now.</div>}
              {!lost && <button className="vn-choice" style={{ width: '100%' }} onClick={() => { playPress(); setMenu(false); }}>▶ Resume</button>}
              <button className="vn-choice" style={{ width: '100%' }} onClick={retry}>↻ Retry</button>
              <button className="vn-choice" style={{ width: '100%' }} onClick={leave}>⌂ Back to map</button>
            </div>
          </div>
        )}
      </div>
    );
  } else if (phase === 'result') {
    const r = node.rewards ?? {};
    const got = firstClear && (r.gems || r.coins);
    body = (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'radial-gradient(ellipse at 50% 35%, #1d2b44, #06080f 75%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: CODEC.font }}>
        <div style={{ width: 'min(420px, 100%)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
          <div style={{ color: '#4ade80', fontWeight: 900, fontSize: mobile ? 28 : 38, letterSpacing: 4, textShadow: '0 0 24px #16a34a' }}>{node.battle ? 'CLEAR!' : 'COMPLETE'}</div>
          <div style={{ color: CODEC.yellow, fontWeight: 900, fontSize: 18, letterSpacing: 1 }}>{node.name}</div>
          {got ? (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {r.gems ? <Reward icon="ui/ui_frailite.png" text={`+${r.gems}`} color="#93c5fd" /> : null}
              {r.coins ? <Reward icon="ui/ui_cucoin.png" text={`+${fmt(r.coins)}`} color="#f0c040" /> : null}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>{firstClear ? '' : 'Replay — first-clear rewards already collected.'}</div>
          )}
          <button className="vn-choice" style={{ width: 'min(300px, 100%)', textAlign: 'center' }} autoFocus onClick={() => { playPress(); onLeave(); }}>Continue ▶</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{STORY_CSS}</style>
      {body}
    </>
  );
}

function Reward({ icon, text, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0f1420', border: `2px solid ${color}`, borderRadius: 24, padding: '6px 16px 6px 8px', color, fontWeight: 900, fontSize: 20 }}>
      <img src={`${BASE}${icon}`} alt="" style={{ width: 28, height: 28, objectFit: 'contain', imageRendering: 'pixelated' }} />{text}
    </div>
  );
}
