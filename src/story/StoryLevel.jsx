import { useCallback, useEffect, useRef, useState } from 'react';
import BattleArena from '../combat/BattleArena';
import { createBattle, fmt } from '../combat/engine';
import { computePlayerStats } from '../combat/stats';
import { CHARACTERS } from '../data/characters';
import { ENEMY_TYPES } from '../combat/enemies';
import { makeStoryStage, parseWhen, testFlag } from './story';
import { CodecPopup } from './Codec';
import { CODEC, STORY_CSS } from './codecStyle';
import VNPlayer from './VNPlayer';
import { playPress } from '../utils/sfx';
import TapButton from '../components/TapButton';

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

// A level's steps, in order: { scene } or { battle, codec, play, name }. Most levels are just
// intro → battle → outro (chapters.js); a level with node.steps can chain several of each.
function levelSteps(node) {
  if (node.steps) return node.steps;
  return [node.intro && { scene: node.intro }, node.battle && { battle: node.battle, codec: node.codec }, node.outro && { scene: node.outro }].filter(Boolean);
}
// a fight that hands you a card (step.play: card id, at step.playLevel): your deck sits it out.
// The card comes on its own: no supports, sets, HQ upgrades or superimpositions. step.playStats
// ({ click, hp }) pins its click damage and max HP (its kit works the same, just from those numbers),
// so a 6★ in an early fight doesn't one-shot everything
function borrowedStats(id, level = 30, pin = null) {
  const card = CHARACTERS.find(c => c.id === id);
  if (!card) return null;
  const make = (multiplier = 1) => computePlayerStats({ deck: { main: card, supports: [] }, cardInventory: { [id]: { level } }, multiplier });
  let stats = make();
  if (pin?.click) stats = make(pin.click / stats.clickDmg);
  if (pin?.hp) stats = { ...stats, maxHp: pin.hp };
  return { card, stats };
}

// One story level: its steps (cutscenes and battles with codec lines), then the results.
export default function StoryLevel({ node, story, stats: deckStats, mainCard: deckMain, mobile, portrait, devMode, onReward, onComplete, onLeave, profile, onSign }) {
  const firstClear = useRef(!story.cleared[node.id]).current;
  const steps = useRef(levelSteps(node)).current;
  const [at, setAt] = useState(0);
  const step = steps[at] ?? null;
  const phase = !step ? 'result' : step.scene ? 'scene' : 'battle';
  const [flags, setFlags] = useState(() => ({ ...story.flags }));
  // this fight's card: one it hands you, or your deck's
  const lent = useRef({});
  const borrowed = step?.play != null ? (lent.current[at] ??= borrowedStats(step.play, step.playLevel, step.playStats)) : null;
  const stats = borrowed?.stats ?? deckStats, mainCard = borrowed?.card ?? deckMain;
  const battle = step?.battle ?? null;

  // ── Battle ────────────────────────────────────────────────────────────────
  const handlers = useRef({});
  const [engine, setEngine] = useState(null);
  const [lost, setLost] = useState(false);
  const [menu, setMenu] = useState(false);
  const [queue, setQueue] = useState([]);
  const fired = useRef(new Set());
  const events = useRef({ hit: false, ult: false });

  // on to the next step (a new fight gets a fresh battle)
  const next = useCallback(() => {
    setEngine(null); setLost(false); setMenu(false); setQueue([]);
    fired.current = new Set(); events.current = { hit: false, ult: false };
    setAt(i => i + 1);
  }, []);
  const afterBattle = next;
  const afterScene = useCallback((f) => {
    if (f.__ending) { onLeave(); return; }   // a bad ending (scenes.js { ending }): back to the map, nothing saved
    setFlags(f);
    next();
  }, [next, onLeave]);

  useEffect(() => {
    if (phase !== 'battle' || engine) return;
    const stepNode = { ...node, name: step.name ?? node.name, battle };
    setEngine(createBattle({ stageNum: battle?.level ?? 1, stats, makeStage: () => makeStoryStage(stepNode), callbacks: handlers }));
  }, [phase, engine, node, step, battle, stats]);
  useEffect(() => { engine?.setStats(stats); }, [engine, stats]);

  handlers.current = {
    onReward: (r) => onReward(r, engine),
    onPlayerHit: () => { events.current.hit = true; },
    onUlt: () => { events.current.ult = true; },
    onStoryEnd: (res) => { if (res === 'won') afterBattle(); else setLost(true); },
  };

  // codec lines: check the triggers a few times a second
  const lines = step?.codec ?? NO_LINES;
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
  if (phase === 'scene') {
    body = <VNPlayer key={`s${at}`} sceneId={step.scene} flags={flags} onEnd={afterScene} mobile={mobile} portrait={portrait} profile={profile} onSign={onSign} />;
  } else if (phase === 'battle' && engine) {
    const codecH = current ? (mobile ? 54 : 78) + 8 : 0;
    const boss = battle?.boss ? ENEMY_TYPES[battle.boss]?.name : null;
    const fights = steps.filter(x => x.battle).length, nth = steps.slice(0, at + 1).filter(x => x.battle).length;
    body = (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0b0f1c', fontFamily: 'var(--font-ui)', userSelect: 'none',
        cursor: mobile ? 'auto' : `url(${BASE}ui/mouse.png) 0 0, auto` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: mobile ? '6px 8px' : '8px 14px', background:'var(--bar)', borderBottom: `2px solid ${CODEC.yellow}`, flexShrink: 0 }}>
          <button className="vn-btn" onClick={() => { playPress(); setMenu(true); }} title="Pause (Esc)">❚❚ PAUSE</button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: CODEC.yellow, fontFamily: CODEC.font, fontWeight: 900, letterSpacing: 1, fontSize: mobile ? 13 : 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.name ?? node.name}{fights > 1 ? ` · ${nth}/${fights}` : ''}</div>
            {!mobile && <div style={{ color: '#778', fontSize: 11 }}>LV {battle?.level ?? 1}{boss ? ` · boss: ${boss}` : ''}{borrowed ? ` · playing as ${borrowed.card.name}${borrowed.card.subtitle ? ` (${borrowed.card.subtitle})` : ''}` : ''}</div>}
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
              <div style={{ color: lost ? '#ff6b4a' : CODEC.yellow, fontWeight: lost ? 400 : 900, fontSize: lost ? 34 : 26, letterSpacing: 3, textAlign: 'center', fontFamily: lost ? 'var(--font-glitch)' : undefined }}>{lost ? 'DEFEATED' : 'PAUSED'}</div>
              {lost && <div style={{ color: '#d1fae5', fontSize: 13, textAlign: 'center', marginBottom: 4 }}>{borrowed ? 'Try again: get a feel for the card first.' : 'Train or change your deck, then come back — or try again now.'}</div>}
              {!lost && <TapButton className="vn-choice" style={{ width: '100%' }} onClick={() => { playPress(); setMenu(false); }}>▶ Resume</TapButton>}
              <TapButton className="vn-choice" style={{ width: '100%' }} onClick={retry}>↻ Retry</TapButton>
              <TapButton className="vn-choice" style={{ width: '100%' }} onClick={leave}>⌂ Back to map</TapButton>
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
          <div style={{ color: '#4ade80', fontWeight: 900, fontSize: mobile ? 28 : 38, letterSpacing: 4, textShadow: '0 0 24px #16a34a' }}>{steps.some(x => x.battle) ? 'CLEAR!' : 'COMPLETE'}</div>
          <div style={{ color: CODEC.yellow, fontWeight: 900, fontSize: 18, letterSpacing: 1 }}>{node.name}</div>
          {got ? (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {r.gems ? <Reward icon="ui/ui_frailite.png" text={`+${r.gems}`} color="#93c5fd" /> : null}
              {r.coins ? <Reward icon="ui/ui_cucoin.png" text={`+${fmt(r.coins)}`} color="#f0c040" /> : null}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>{firstClear ? '' : 'Replay — first-clear rewards already collected.'}</div>
          )}
          <TapButton className="vn-choice" style={{ width: 'min(300px, 100%)', textAlign: 'center' }} autoFocus onClick={() => { playPress(); onLeave(); }}>Continue ▶</TapButton>
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
