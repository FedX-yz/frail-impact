import { useState, useEffect, useRef, useMemo } from 'react';
import HomeScreen     from './screens/HomeScreen';
import MainScreen     from './screens/MainScreen';
import GachaScreen    from './screens/GachaScreen';
import DeckScreen     from './screens/DeckScreen';
import CardsScreen    from './screens/CardsScreen';
import SettingsScreen from './screens/SettingsScreen';
import CardShop       from './screens/CardShop';
import TowerScreen    from './screens/TowerScreen';
import { normalizeStory } from './story/story';
import { CHARACTERS }  from './data/characters';
import { rollSubs }    from './combat/sets';
import { createBattle } from './combat/engine';
import { computePlayerStats } from './combat/stats';
import { SKILL_UNLOCK, ULT_UNLOCK } from './combat/kits';
import { trainCost } from './combat/balance';

const DEV_KEY = 'frail_dev';
const devFromStorage = () => {
  try {
    if (new URLSearchParams(location.search).has('dev')) localStorage.setItem(DEV_KEY, '1');
    return localStorage.getItem(DEV_KEY) === '1';
  } catch { return false; }
};

const SAVE_KEY = 'rhg_v3';

// Settings sets this before wiping the save, so the unload handler
// below doesn't write the old progress straight back.
const isResetting = () => window.__frailResetting === true;

// The deck is saved as full card objects; swap them for the current
// definitions so edits to characters.js reach old saves.
function rehydrateCard(card) {
  if (!card) return null;
  return CHARACTERS.find(c => c.id === card.id) ?? card;
}

function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}

function writeSave(data) {
  if (isResetting()) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage full or blocked: keep playing */ }
}

// Saves within 1.5s of any change, and immediately when the page is closed,
// hidden or the phone switches apps (phones often kill a backgrounded tab
// without firing beforeunload, which used to lose recent progress).
function useSave(data, delay = 1500) {
  const latest = useRef(data);
  latest.current = data;
  // At most one save every `delay` ms, but always within `delay` of a change.
  // (Restarting the timer on every change meant that during combat, where
  // something changes every second, the save kept getting postponed.)
  const timer = useRef(null);
  useEffect(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => { timer.current = null; writeSave(latest.current); }, delay);
  });
  useEffect(() => () => { clearTimeout(timer.current); timer.current = null; }, []);
  useEffect(() => {
    const flush = () => writeSave(latest.current);
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}


export default function App() {
  // Read the save once, not on every render.
  const [s] = useState(() => loadSave() || {});

  const [screen,        setScreen]        = useState('main');
  const [pullCurrency,  setPullCurrency]  = useState(s.pullCurrency  ?? 10);
  const [coins,         setCoins]         = useState(s.coins         ?? 0);
  // Pull history: only the card id is needed (old saves stored the whole card
  // every pull, ~600 bytes each, which could overflow the browser's save limit)
  const [collection,    setCollection]    = useState(() => (s.collection ?? []).filter(c => c?.id != null).map(c => ({ id: c.id })));
  const [killCount, setKillCount] = useState(s.killCount ?? 0);
  const [stage,     setStage]     = useState(s.stage ?? 1);
  const [stageKills, setStageKills] = useState(s.stageKills ?? 0);
  // ── Shop inventory: { [cardId]: { count: number, si: number (0–4) } }  ──────
  // Kept separate from `collection` (the gacha array) so nothing breaks.
  const [cardInventory, setCardInventory] = useState(s.cardInventory ?? {}); // ← NEW
  // Train level (+10% ATK each). Old saves stored +5 click power per Train.
  const [trainLevel,    setTrainLevel]    = useState(s.trainLevel ?? Math.max(0, Math.round(((s.clickPower ?? 5) - 5) / 5)));
  const [multiplier]                      = useState(s.multiplier    ?? 1);
  const [totalEarned,   setTotalEarned]   = useState(s.totalEarned   ?? 0);
  const [devMode,       setDevMode]       = useState(devFromStorage);
  const [pity4,         setPity4]         = useState(s.pity4         ?? 0);
  const [pity5,         setPity5]         = useState(s.pity5         ?? 0);
  // Story mode (Tower): cleared nodes, choice flags, where you are on the map
  const [story,         setStory]         = useState(() => normalizeStory(s.story));

  const defaultDeck = { main: null, supports: [null, null, null, null] };
  const [deck, setDeck] = useState(() => {
    const saved = s.deck ?? defaultDeck;
    const supports = [...(saved.supports || []), null, null, null, null].slice(0, 4);
    return { main: rehydrateCard(saved.main), supports: supports.map(rehydrateCard) };
  });

  // 3★/4★ cards roll relic sub-stats the first time you own them
  useEffect(() => {
    const owned = new Set([
      ...collection.map(c => c.id),
      ...Object.entries(cardInventory).filter(([, e]) => (e.count ?? 0) > 0).map(([id]) => Number(id)),
    ]);
    const missing = CHARACTERS.filter(c => c.rarity <= 4 && owned.has(c.id) && !cardInventory[c.id]?.subs);
    if (!missing.length) return;
    setCardInventory(prev => {
      const next = { ...prev };
      missing.forEach(c => {
        if (next[c.id]?.subs) return;
        next[c.id] = { count: 0, si: 0, ...next[c.id], subs: rollSubs(c.rarity) };
      });
      return next;
    });
  }, [collection, cardInventory]);

  // Coins come from kills only (no idle income)
  useSave({
    pullCurrency, coins, collection, cardInventory,
    trainLevel, multiplier, totalEarned,
    deck, pity4, pity5, killCount, stage, stageKills, story,
  });

  const buyUpgrade = () => {
    const cost = trainCost(trainLevel);
    if (coins < cost) return;
    setCoins(c => c - cost);
    setTrainLevel(l => l + 1);
  };

  // ── Battle ────────────────────────────────────────────────────────────────
  // Your stats, straight from the deck (also shown in Deck)
  const stats = useMemo(
    () => computePlayerStats({ deck, cardInventory, trainLevel, multiplier }),
    [deck, cardInventory, trainLevel, multiplier],
  );

  // The battle lives here, not in the main screen, so opening a menu pauses
  // it instead of throwing your stage progress away.
  const battleHandlers = useRef({});
  const [engine] = useState(() => createBattle({ stageNum: s.stage ?? 1, kills: s.stageKills ?? 0, stats, callbacks: battleHandlers }));
  useEffect(() => { engine.setStats(stats); }, [engine, stats]);

  const cardInvRef = useRef(cardInventory);
  cardInvRef.current = cardInventory;
  const deckRef = useRef(deck);
  deckRef.current = deck;
  // Coins, gems and XP from any battle. `eng` is the battle that earned them
  // (the endless one or a story level), so level-ups are announced there.
  const giveRewards = ({ coins: c = 0, gems = 0, xp = 0, kill } = {}, eng = engine) => {
    if (c) { setCoins(v => v + c); setTotalEarned(v => v + c); }
    if (gems) setPullCurrency(v => v + gems);
    if (kill) setKillCount(v => v + 1);
    // XP goes to the main card (5★/6★)
    const mc = deckRef.current?.main;
    if (xp && mc && mc.rarity >= 5) {
      const addXp = (entry = { si: 0, xp: 0, level: 1 }) => {
        let level = entry.level ?? 1, cur = (entry.xp ?? 0) + xp;
        while (cur >= level * 100) { cur -= level * 100; level++; }
        return { ...entry, xp: cur, level };
      };
      // announce level-ups
      const before = cardInvRef.current[mc.id];
      const after = addXp(before);
      for (let lv = (before?.level ?? 1) + 1; lv <= after.level; lv++) {
        eng?.announce(`${mc.name} LV${lv}!`);
        if (lv === SKILL_UNLOCK) eng?.announce('SKILL UNLOCKED!', '#4ade80');
        if (lv === ULT_UNLOCK)   eng?.announce('ULT UNLOCKED!', '#c084fc');
      }
      cardInvRef.current = { ...cardInvRef.current, [mc.id]: after };
      // functional update: never overwrites a fusion/sub-stat change made at the same moment
      setCardInventory(prev => ({ ...prev, [mc.id]: addXp(prev[mc.id]) }));
    }
  };
  battleHandlers.current = {
    onReward: (r) => giveRewards(r, engine),
    onProgress: ({ stage: st, kills }) => { setStage(st); setStageKills(kills); },
    onStageClear: (next) => setStage(next),
  };

  // Everything the sandbox menu can change
  const devActions = {
    setPullCurrency, setCoins, setCollection, setCardInventory, setDeck, setTrainLevel, setPity4, setPity5,
    disable: () => { try { localStorage.removeItem(DEV_KEY); } catch { /* ignore */ } resetDevBattle(); setDevMode(false); },
  };
  // turning developer mode off also switches off god mode and game speed
  const resetDevBattle = () => { engine.dev.setGod(false); engine.dev.setTimeScale(1); };
  const toggleDev = () => {
    try { if (devMode) localStorage.removeItem(DEV_KEY); else localStorage.setItem(DEV_KEY, '1'); } catch { /* ignore */ }
    if (devMode) resetDevBattle();
    setDevMode(!devMode);
  };

  const navigate = (sc) => setScreen(sc);
  const common   = { navigate, pullCurrency, setPullCurrency, coins, setCoins, collection, setCollection };

  if (screen === 'tower') return (
    <TowerScreen navigate={navigate} story={story} setStory={setStory} stats={stats} deck={deck}
      devMode={devMode} onReward={giveRewards} coins={coins} pullCurrency={pullCurrency} />
  );

  if (screen === 'home')     return <HomeScreen navigate={navigate} />;
  if (screen === 'cards')    return <CardsScreen navigate={navigate} collection={collection} cardInventory={cardInventory} />;
  if (screen === 'settings') return <SettingsScreen navigate={navigate} devMode={devMode} toggleDev={toggleDev} />;

  if (screen === 'gacha' || screen === 'gamble') return (
    <GachaScreen {...common}
      currency={pullCurrency} setCurrency={setPullCurrency}
      pity4={pity4} setPity4={setPity4}
      pity5={pity5} setPity5={setPity5}
      cardInventory={cardInventory}
      setCoins={setCoins}
      devMode={devMode}
    />
  );

  if (screen === 'deck') return (
    <DeckScreen 
      navigate={navigate} 
      collection={collection} 
      deck={deck} 
      setDeck={setDeck}
      cardInventory={cardInventory}
      stats={stats}
    />
  );

  // ── Card Shop ──────────────────────────────────────────────────────────────
  if (screen === 'shop') return (
    <CardShop
      navigate={navigate}
      coins={coins}
      setCoins={setCoins}
      collection={cardInventory}
      setCollection={setCardInventory}
      gachaCollection={collection}
    />
  );

  if (screen === 'main') return (
    <MainScreen {...common}
      engine={engine} stats={stats}
      trainLevel={trainLevel} buyUpgrade={buyUpgrade}
      deck={deck}
      cardInventory={cardInventory}
      devMode={devMode} devActions={devActions}
      pity4={pity4} pity5={pity5}
    />
  );

  return (
    <div style={{ width:'100%', height:'100vh', background:'#1a2035', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ color:'#ff8c00', fontSize:34, fontWeight:700, letterSpacing:3, marginBottom:16 }}>{screen.toUpperCase()}</div>
      <div style={{ color:'#445', marginBottom:32, fontSize:15 }}>coming soon</div>
      <button onClick={() => navigate('main')} style={{ background:'none', border:'2px solid #ff8c00', color:'#ff8c00', padding:'10px 28px', borderRadius:6, cursor:'pointer', fontSize:15 }}>← back</button>
    </div>
  );
}