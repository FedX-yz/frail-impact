import { useState, useEffect, useRef } from 'react';
import HomeScreen     from './screens/HomeScreen';
import MainScreen     from './screens/MainScreen';
import GachaScreen    from './screens/GachaScreen';
import DeckScreen     from './screens/DeckScreen';
import CardsScreen    from './screens/CardsScreen';
import SettingsScreen from './screens/SettingsScreen';
import CardShop       from './screens/CardShop';

const SAVE_KEY = 'rhg_v3';

function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}

function useDebouncedSave(data, delay = 1500) {
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
    }, delay);
    return () => clearTimeout(timer.current);
  });
}

export default function App() {
  const s = loadSave() || {};

  const [screen,        setScreen]        = useState('main');
  const [pullCurrency,  setPullCurrency]  = useState(s.pullCurrency  ?? 10);
  const [coins,         setCoins]         = useState(s.coins         ?? 0);
  const [collection,    setCollection]    = useState(s.collection    ?? []);
  const [killCount, setKillCount] = useState(s.killCount ?? 0);
  // ── Shop inventory: { [cardId]: { count: number, si: number (0–4) } }  ──────
  // Kept separate from `collection` (the gacha array) so nothing breaks.
  const [cardInventory, setCardInventory] = useState(s.cardInventory ?? {}); // ← NEW
  const [clickPower,    setClickPower]    = useState(s.clickPower    ?? 5);
  const [cps,           setCps]           = useState(s.cps           ?? 1);
  const [multiplier]                      = useState(s.multiplier    ?? 1);
  const [totalEarned,   setTotalEarned]   = useState(s.totalEarned   ?? 0);
  const [upgradeCost,   setUpgradeCost]   = useState(s.upgradeCost   ?? 100);
  const [pity4,         setPity4]         = useState(s.pity4         ?? 0);
  const [pity5,         setPity5]         = useState(s.pity5         ?? 0);

  const defaultDeck = { main: null, supports: [null, null, null, null] };
  const [deck, setDeck] = useState(() => {
    const saved = s.deck ?? defaultDeck;
    if ((saved.supports?.length ?? 0) < 4) {
      saved.supports = [...(saved.supports || []), null, null, null, null].slice(0, 4);
    }
    return saved;
  });

  // NO auto-income — coins come from kills only
  // Add killCount to useDebouncedSave:
  useDebouncedSave({
    pullCurrency, coins, collection, cardInventory,
    clickPower, cps, multiplier, totalEarned, upgradeCost,
    deck, pity4, pity5, killCount,  // ← add killCount
  });

  const buyUpgrade = () => {
    if (coins < upgradeCost) return;
    setCoins(c => c - upgradeCost);
    setCps(c => c + 5);
    setClickPower(c => c + 5);
    setUpgradeCost(c => Math.floor(c * 1.8));
  };

  const navigate = (sc) => setScreen(sc);
  const common   = { navigate, pullCurrency, setPullCurrency, coins, setCoins, collection, setCollection };

  if (screen === 'home')     return <HomeScreen navigate={navigate} />;
  if (screen === 'cards')    return <CardsScreen navigate={navigate} collection={collection} />;
  if (screen === 'settings') return <SettingsScreen navigate={navigate} />;

  if (screen === 'gacha' || screen === 'gamble') return (
    <GachaScreen {...common}
      currency={pullCurrency} setCurrency={setPullCurrency}
      pity4={pity4} setPity4={setPity4}
      pity5={pity5} setPity5={setPity5}
      cardInventory={cardInventory}
      setCoins={setCoins}
    />
  );

  if (screen === 'deck') return (
    <DeckScreen 
      navigate={navigate} 
      collection={collection} 
      deck={deck} 
      setDeck={setDeck}
      cardInventory={cardInventory}  // ← ADD THIS
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
      clickPower={clickPower} cps={cps} multiplier={multiplier}
      totalEarned={totalEarned} setTotalEarned={setTotalEarned}
      upgradeCost={upgradeCost} buyUpgrade={buyUpgrade}
      deck={deck}
      cardInventory={cardInventory}
      killCount={killCount}
      setKillCount={setKillCount}
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