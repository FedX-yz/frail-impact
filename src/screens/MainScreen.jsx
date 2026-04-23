import { useState, useEffect, useRef, useCallback } from 'react';

const BASE = import.meta.env.BASE_URL;

const ENEMY_TYPES = [
  { name:'Xiao',               image:`${BASE}enemies/xiaoenemy.png`, hp:220,  maxHp:220,  coinReward:50,  isBoss:false },
  { name:'Bonk',               image:`${BASE}enemies/bonkenemy.png`, hp:300,  maxHp:300,  coinReward:80,  isBoss:false },
  { name:'DEVOURER OF WORLDS', image:`${BASE}enemies/hoxboss.jpg`,   hp:1200, maxHp:1200, coinReward:300, isBoss:true, gemReward:10 },
];

const REGULAR_SIZE  = 74;
const BOSS_SIZE     = 120;
const BASE_CRIT     = 0.20;
const MOVE_PATTERNS = ['stationary', 'stationary', 'patrol', 'erratic'];

// ─── Asset & Sound Config ───────────────────────────────────────────────────
// uniqueSfx: true  → play ONLY tabSfx on click (skip press sounds)
// uniqueSfx: false → play ONLY press sound on click (skip tabSfx)
const NAV_CONFIG = [
  { label: 'shop',     screen: 'shop',     hoverImg: `${BASE}ui/ui_hovershop.png`,     tabSfx: 'ui_shop.mp3',  uniqueSfx: true  },
  { label: 'gamble',   screen: 'gacha',    hoverImg: `${BASE}ui/ui_hovergamble.png`,   tabSfx: 'ui_warp.mp3',  uniqueSfx: true  },
  { label: 'deck',     screen: 'deck',     hoverImg: `${BASE}ui/ui_hoverdeck.png`,     tabSfx: 'ui_warp.mp3',  uniqueSfx: false },
  { label: 'tower',    screen: 'tower',    hoverImg: `${BASE}ui/ui_hovertower.png`,    tabSfx: 'ui_warp.mp3',  uniqueSfx: false },
  { label: 'codex',    screen: 'cards',    hoverImg: `${BASE}ui/ui_hovercodex.png`,    tabSfx: 'ui_codex.mp3', uniqueSfx: true,  closeSfx: 'ui_close.mp3' },
  { label: 'settings', screen: 'settings', hoverImg: `${BASE}ui/ui_hoversettings.png`, tabSfx: 'ui_warp.mp3',  uniqueSfx: false },
];

const PRESS_SFXS   = [`${BASE}sounds/ui_press.mp3`, `${BASE}sounds/ui_press2.mp3`];
const MENU_BG      = `${BASE}ui/ui_menu.png`;

// ─── playSFX helper ──────────────────────────────────────────────────────────
const playSFX = (src, gain = 3.5) => {
  const ctx    = new (window.AudioContext || window.webkitAudioContext)();
  const source = ctx.createBufferSource();
  const gainNode = ctx.createGain();
  gainNode.gain.value = gain; // > 1.0 amplifies beyond normal max

  fetch(src)
    .then(r => r.arrayBuffer())
    .then(buf => ctx.decodeAudioData(buf))
    .then(decoded => {
      source.buffer = decoded;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
    })
    .catch(() => {});
};

const playPress = () =>
  playSFX(PRESS_SFXS[Math.floor(Math.random() * PRESS_SFXS.length)]);

function spawnEnemy(forceBoss = false, currentKills = 0) {
  const pool  = forceBoss
    ? ENEMY_TYPES[ENEMY_TYPES.length - 1]
    : ENEMY_TYPES[Math.floor(Math.random() * (ENEMY_TYPES.length - 1))];
  const wave  = Math.floor(currentKills / 10);
  const scale = 1 + wave * 0.3;
  const pattern = pool.isBoss ? 'stationary' : MOVE_PATTERNS[Math.floor(Math.random() * MOVE_PATTERNS.length)];
  return {
    ...pool,
    hp:          Math.floor(pool.maxHp * scale),
    maxHp:       Math.floor(pool.maxHp * scale),
    coinReward:  Math.floor((pool.coinReward || 0) * scale),
    id:          Date.now() + Math.random(),
    x:           50 + Math.random() * 35,
    y:           25 + Math.random() * 50,
    movePattern: pattern,
    patrolDir:   Math.random() > 0.5 ? 1 : -1,
  };
}

function getDeckBonuses(deck, cardInventory = {}) {
  let atkBonus = 0, dmgMult = 1;
  const cards = [deck?.main, ...(deck?.supports ?? [])].filter(Boolean);
  console.log('getDeckBonuses - cards to process:', cards.length);
  
  cards.forEach((card, idx) => {
    console.log(`Card ${idx}: ${card.name} (ID: ${card.id})`);
    if (card.stats) {
      const si = cardInventory[card.id]?.si ?? 0;
      const siMult = [1, 1.12, 1.25, 1.40, 1.60][si];
      const cardAtk = (card.stats.atk ?? 0);
      const boostedAtk = cardAtk * siMult;
      console.log(`  ATK: ${cardAtk}, SI: ${si}, Mult: ${siMult}, Boosted: ${boostedAtk}`);
      atkBonus += boostedAtk;
    }
    if (card.passive) {
      if (card.passive.effect === 'global_dmg_boost')  dmgMult  += card.passive.value;
      if (card.passive.effect === 'atk_boost_high_hp') atkBonus += (card.stats?.atk ?? 0) * card.passive.value;
    }
  });
  console.log('Final atkBonus:', atkBonus);
  return { atkBonus, dmgMult };
}

const fmt = n => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'k' : Math.floor(n);

// ─── Inline icon helpers ─────────────────────────────────────────────────────
const CoinIcon = ({ size = 28 }) => (
  <img src={`${BASE}ui/ui_cucoin.png`} alt="coin" style={{ width: size, height: size, objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0 }} />
);
const GemIcon = ({ size = 28 }) => (
  <img src={`${BASE}ui/ui_frailite.png`} alt="gem" style={{ width: size, height: size, objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0 }} />
);

export default function MainScreen({
  navigate,
  pullCurrency, setPullCurrency,
  coins, setCoins,
  clickPower, cps, multiplier,
  totalEarned, setTotalEarned,
  upgradeCost, buyUpgrade,
  deck,
  cardInventory,
  killCount, setKillCount
}) {
  const bonuses      = getDeckBonuses(deck, cardInventory);
  console.log('=== DECK BONUSES ===');
  console.log('Deck:', deck);
  console.log('CardInventory:', cardInventory);
  console.log('Main card:', deck?.main);
  console.log('Main card ID:', deck?.main?.id);
  console.log('SI for main card:', cardInventory[deck?.main?.id]?.si);
  console.log('Bonuses:', bonuses);
  console.log('=== SUPPORT CARDS ===');
deck?.supports?.forEach((card, i) => {
  if (card) {
    console.log(`Support ${i}: ${card.name} (ID: ${card.id}) - SI: ${cardInventory[card.id]?.si ?? 0}`);
  }
});
  const critRate     = BASE_CRIT;
  const atkBonus     = bonuses.atkBonus;
  const dmgMult      = bonuses.dmgMult * multiplier;
  const mainCard     = deck?.main ?? null;
  const abilityCdMax = mainCard?.ability?.cooldown ?? 10;
  const heroImage    = mainCard?.image ?? null;

  const [enemies,      setEnemies]      = useState(() => [spawnEnemy(false, 0), spawnEnemy(false, 0)]);
  const [floaters,     setFloaters]     = useState([]);
  const [bossWarning,  setBossWarning]  = useState(false);
  const [abilityCd,    setAbilityCd]    = useState(0);
  const [abilityReady, setAbilityReady] = useState(true);
  const [bossWeakPts,  setBossWeakPts]  = useState({});
  const [frozenMap,    setFrozenMap]    = useState({});
  const [hoveredNav,   setHoveredNav]   = useState(null);
  const [activeNav,    setActiveNav]    = useState(null);

  const enemiesRef   = useRef(enemies);
  const frozenRef    = useRef(frozenMap);
  const killRef = useRef(killCount);
  const floaterIdRef = useRef(0);

  useEffect(() => { enemiesRef.current = enemies;  }, [enemies]);
  useEffect(() => { frozenRef.current  = frozenMap; }, [frozenMap]);

  const BATTLE_BG = `${BASE}backgrounds/bg1.png`;

  // icon: 'coin' | 'gem' | null — renders ui_cucoin.png or ui_frailite.png after the text
  const addFloater = useCallback((text, x, y, color = '#f0c040', isCrit = false, icon = null) => {
    const id = floaterIdRef.current++;
    setFloaters(f => [...f, { id, text, x, y, color, isCrit, icon }]);
    setTimeout(() => setFloaters(f => f.filter(fl => fl.id !== id)), 1100);
  }, []);

  const checkUpcomingBoss = useCallback((kills) => {
    if (kills > 0 && kills % 10 === 9) {
      setBossWarning(true);
      setTimeout(() => setBossWarning(false), 2600);
    }
  }, []);

  const processDead = useCallback((current, updated) => {
    const dead  = updated.filter(e => e.hp <= 0);
    const alive = updated.filter(e => e.hp > 0);
    if (dead.length > 0) {
      let newKills = killRef.current;
      let coinsEarned = 0, gemsEarned = 0;
      dead.forEach(killed => {
        newKills++;
        const coinGain = Math.floor(killed.coinReward * dmgMult);
        coinsEarned += coinGain;
        addFloater(`+${fmt(coinGain)}`, killed.x, killed.y + 10, '#f0c040', false, 'coin');
        if (killed.isBoss && killed.gemReward) {
          gemsEarned += killed.gemReward;
          addFloater(`+${killed.gemReward}`, killed.x, killed.y + 22, '#5588ff', false, 'gem');
        }
      });

      checkUpcomingBoss(newKills);

      const replacements = dead.map((_, i) => {
        const k         = newKills - dead.length + i + 1;
        const spawnBoss = k > 0 && k % 10 === 0;
        return spawnEnemy(spawnBoss, newKills);
      });

      killRef.current = newKills;
      setKillCount(newKills);
      if (coinsEarned > 0) { setCoins(c => c + coinsEarned); setTotalEarned(t => t + coinsEarned); }
      if (gemsEarned  > 0) setPullCurrency(c => c + gemsEarned);
      setEnemies([...alive, ...replacements]);
    } else {
      setEnemies(updated);
    }
  }, [dmgMult, addFloater, checkUpcomingBoss, setCoins, setTotalEarned, setPullCurrency]);

  // Ability CD
  useEffect(() => {
    if (abilityCd <= 0) return;
    const t = setInterval(() => {
      setAbilityCd(cd => { if (cd <= 1) { setAbilityReady(true); clearInterval(t); return 0; } return cd - 1; });
    }, 1000);
    return () => clearInterval(t);
  }, [abilityCd]);

  // Auto-attack
  useEffect(() => {
    const interval = setInterval(() => {
      const now     = Date.now();
      const current = enemiesRef.current;
      if (!current.length) { setEnemies([spawnEnemy(false, killRef.current)]); return; }
      const targets = current.filter(en => !frozenRef.current[en.id] || frozenRef.current[en.id] < now);
      if (!targets.length) return;
      const target = targets[Math.floor(Math.random() * targets.length)];
      const isCrit = Math.random() < critRate;
      const dmg    = Math.floor((cps + atkBonus * 0.1) * dmgMult * (0.85 + Math.random() * 0.3) * (isCrit ? 2 : 1));
      addFloater((isCrit ? 'CRIT\n' : '') + '-' + fmt(dmg), target.x + (Math.random()-0.5)*8, target.y - 8, isCrit ? '#ff4444' : '#ffffff', isCrit);
      const updated = current.map(en => en.id === target.id ? { ...en, hp: en.hp - dmg } : en);
      processDead(current, updated);
    }, 1000);
    return () => clearInterval(interval);
  }, [cps, dmgMult, critRate, atkBonus, addFloater, processDead]);

  // Enemy movement
  useEffect(() => {
    const interval = setInterval(() => {
      setEnemies(prev => prev.map(en => {
        if (en.isBoss || en.movePattern === 'stationary') return en;
        if (en.movePattern === 'patrol') {
          const newX = en.x + en.patrolDir * 4;
          const clamped = Math.max(50, Math.min(85, newX));
          return { ...en, x: clamped, patrolDir: (newX > 85 || newX < 50) ? -en.patrolDir : en.patrolDir };
        }
        if (en.movePattern === 'erratic' && Math.random() < 0.45) {
          return { ...en, x: 50 + Math.random() * 35, y: 25 + Math.random() * 50 };
        }
        return en;
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Boss weak points
  useEffect(() => {
    const interval = setInterval(() => {
      const now    = Date.now();
      const bosses = enemiesRef.current.filter(e => e.isBoss);
      if (!bosses.length) { setBossWeakPts({}); return; }
      setBossWeakPts(prev => {
        const next = {};
        bosses.forEach(boss => {
          const active = (prev[boss.id] || []).filter(wp => wp.expiresAt > now);
          if (active.length < 3 && Math.random() < 0.65) {
            active.push({ id: Math.random(), relX: 12 + Math.random()*76, relY: 12 + Math.random()*76, expiresAt: now + 1200 + Math.random()*900, dmgMult: 3 + Math.floor(Math.random()*3) });
          }
          next[boss.id] = active;
        });
        return next;
      });
    }, 650);
    return () => clearInterval(interval);
  }, []);

  const handleEnemyClick = useCallback((enemy, e) => {
    e.stopPropagation();
    const isCrit = Math.random() < critRate;
    const dmg    = Math.floor((clickPower + atkBonus) * dmgMult * (0.85 + Math.random() * 0.3) * (isCrit ? 2 : 1));
    addFloater((isCrit ? 'CRIT\n' : '') + '-' + fmt(dmg), enemy.x, enemy.y - 12, isCrit ? '#ff4444' : '#f0c040', isCrit);
    const updated = enemiesRef.current.map(en => en.id === enemy.id ? { ...en, hp: en.hp - dmg } : en);
    processDead(enemiesRef.current, updated);
  }, [clickPower, atkBonus, dmgMult, critRate, addFloater, processDead]);

  const handleWeakPointClick = useCallback((enemy, wp, e) => {
    e.stopPropagation();
    const dmg = Math.floor((clickPower + atkBonus) * dmgMult * wp.dmgMult * (0.9 + Math.random() * 0.2));
    addFloater(`⚡WEAK!\n-${fmt(dmg)}`, enemy.x, enemy.y - 15, '#ffff00', true);
    setBossWeakPts(prev => ({ ...prev, [enemy.id]: (prev[enemy.id] || []).filter(w => w.id !== wp.id) }));
    const updated = enemiesRef.current.map(en => en.id === enemy.id ? { ...en, hp: en.hp - dmg } : en);
    processDead(enemiesRef.current, updated);
  }, [clickPower, atkBonus, dmgMult, addFloater, processDead]);

  const useAbility = useCallback(() => {
    if (!abilityReady || !mainCard?.ability) return;
    const effect  = mainCard.ability.effect;
    const baseDmg = Math.floor((clickPower + atkBonus) * dmgMult);
    const current = enemiesRef.current;
    let updated   = current;

    switch (effect) {
      case 'tectonic_wrath': {
        const dmg = baseDmg * 8;
        current.forEach(en => addFloater(`🗿-${fmt(dmg)}`, en.x, en.y-12, '#F59E0B', true));
        updated = current.map(en => ({ ...en, hp: Math.max(0, en.hp - dmg) }));
        break;
      }
      case 'black_hole': {
        const dmg = baseDmg * 10;
        current.forEach(en => addFloater(`🌌-${fmt(dmg)}`, en.x, en.y-12, '#8B5CF6', true));
        updated = current.map(en => ({ ...en, hp: Math.max(0, en.hp-dmg), x: 65+(Math.random()-0.5)*10, y: 50+(Math.random()-0.5)*10 }));
        break;
      }
      case 'permafrost': {
        const dmg = baseDmg * 5;
        const now = Date.now();
        current.forEach(en => addFloater(`❄️-${fmt(dmg)}`, en.x, en.y-12, '#06B6D4', true));
        const nf = {};
        current.forEach(en => { nf[en.id] = now + 4000; });
        setFrozenMap(prev => ({ ...prev, ...nf }));
        updated = current.map(en => ({ ...en, hp: Math.max(0, en.hp-dmg) }));
        break;
      }
      case 'tidal_surge': {
        const dmg = baseDmg * 6, bon = baseDmg * 3;
        current.forEach(en => addFloater(`💧-${fmt(dmg)}`, en.x, en.y-12, '#3B82F6', true));
        addFloater(`+${fmt(bon)}`, 50, 24, '#f0c040', false, 'coin');
        setCoins(c => c + bon); setTotalEarned(t => t + bon);
        updated = current.map(en => ({ ...en, hp: Math.max(0, en.hp-dmg) }));
        break;
      }
      case 'reality_break': {
        if (!current.length) break;
        const dmg = baseDmg * 18;
        addFloater(`✨REALITY\n-${fmt(dmg)}`, current[0].x, current[0].y-15, '#EAB308', true);
        updated = current.map((en, i) => i === 0 ? { ...en, hp: Math.max(0, en.hp-dmg) } : en);
        break;
      }
      default: {
        const dmg = baseDmg * 5;
        current.forEach(en => addFloater(`✦-${fmt(dmg)}`, en.x, en.y-12, '#cc44ff', true));
        updated = current.map(en => ({ ...en, hp: Math.max(0, en.hp-dmg) }));
      }
    }
    processDead(current, updated);
    setAbilityReady(false);
    setAbilityCd(abilityCdMax);
  }, [abilityReady, mainCard, clickPower, atkBonus, dmgMult, abilityCdMax, addFloater, processDead, setCoins, setTotalEarned]);

  // ─── Nav click: unique-sfx tabs play only their sound; others play only press ───
  const handleNavClick = (cfg) => {
    // If leaving Codex, play its close SFX first
    if (activeNav === 'cards' && cfg.screen !== 'cards') {
      const codexCfg = NAV_CONFIG.find(c => c.screen === 'cards');
      if (codexCfg?.closeSfx) playSFX(`${BASE}sounds/${codexCfg.closeSfx}`);
    }

    if (cfg.uniqueSfx && cfg.tabSfx) {
      playSFX(`${BASE}sounds/${cfg.tabSfx}`);
    } else {
      playPress();
    }

    setActiveNav(cfg.screen);
    navigate(cfg.screen);
  };

  return (
    <div style={{ width:'100%', height:'100vh', background:'#1a2035', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:"'Segoe UI',sans-serif", userSelect:'none' }}>

      <style>{`
        img { -webkit-user-drag:none; user-select:none; }
        @keyframes floatDmg { 0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} 65%{opacity:1} 100%{opacity:0;transform:translateX(-50%) translateY(-64px) scale(0.8)} }
        @keyframes enemyFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
        @keyframes bossPulse { 0%,100%{filter:drop-shadow(0 0 6px #ff4400)} 50%{filter:drop-shadow(0 0 22px #ff4400)} }
        @keyframes bossWarn { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.7)} 20%{opacity:1;transform:translate(-50%,-50%) scale(1.08)} 80%{opacity:1;transform:translate(-50%,-50%) scale(1)} 100%{opacity:0;transform:translate(-50%,-50%) scale(0.95)} }
        @keyframes weakPulse { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:1} 50%{transform:translate(-50%,-50%) scale(1.38);opacity:0.75} }
        .dmg-float { position:absolute;pointer-events:none;z-index:30;animation:floatDmg 1.1s ease-out forwards;text-align:center;line-height:1.25;white-space:pre; }
        .enemy-wrap { position:absolute;text-align:center;z-index:10;cursor:pointer; }
        .enemy-wrap:hover .enemy-sprite { filter:brightness(1.4) !important; }
        .enemy-sprite { image-rendering:pixelated;display:block;animation:enemyFloat 2.4s ease-in-out infinite;transition:filter 0.15s; }
        .enemy-sprite.boss { animation:enemyFloat 1.8s ease-in-out infinite,bossPulse 1.2s ease-in-out infinite; }
        .boss-warning { position:absolute;top:50%;left:50%;animation:bossWarn 2.6s ease-in-out forwards;pointer-events:none;z-index:40;text-align:center; }
        .weak-pt { position:absolute;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle,#ffff44 30%,#ff8800);border:2px solid #fff;cursor:crosshair;z-index:25;animation:weakPulse 0.45s ease-in-out infinite;box-shadow:0 0 14px #ffff44;transform:translate(-50%,-50%); }
        .nav-btn { background:#1a2035;border:2px solid #ff8c00;color:#ff8c00;font-size:clamp(15px,2.3vw,23px);cursor:pointer;border-radius:6px;transition:background 0.12s;padding:0; }
        .nav-btn:hover { background:#ff8c0022; }
        .hp-bar-bg { background:#333;border-radius:3px;height:7px;width:100%;margin-top:4px; }
        .hp-bar-fill { border-radius:3px;height:100%;transition:width 0.3s; }
        .ability-btn { border:2px solid #aa44ff;background:#1a0a2a;color:#cc88ff;border-radius:6px;cursor:pointer;font-size:14px;padding:8px 14px;transition:background 0.12s;white-space:nowrap; }
        .ability-btn:hover:not(:disabled){background:#2a1040}
        .ability-btn:disabled{opacity:0.4;cursor:not-allowed;border-color:#554466;color:#554466}
        .cd-bar-bg{background:#2a1040;border-radius:3px;height:4px;width:100%;margin-top:4px}
        .cd-bar-fill{background:#aa44ff;border-radius:3px;height:100%;transition:width 1s linear}
      `}</style>

      {/* TOP BAR */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 16px', background:'#141928', borderBottom:'2px solid #ff8c00', flexShrink:0 }}>
        {/* Gems */}
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'#0f1420', border:'2px solid #5588ff', borderRadius:20, padding:'4px 14px 4px 8px' }}>
          <GemIcon />
          <span style={{ color:'#fff', fontWeight:700, fontSize:17 }}>{pullCurrency}</span>
        </div>
        {/* Coins */}
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'#0f1420', border:'2px solid #cc8800', borderRadius:20, padding:'4px 14px 4px 8px' }}>
          <CoinIcon />
          <span style={{ color:'#f0c040', fontWeight:700, fontSize:17 }}>{fmt(coins)}</span>
        </div>
        <div style={{ fontSize:13, color:'#667' }}>
          atk <span style={{ color:'#f0c040' }}>{fmt((clickPower+atkBonus)*dmgMult)}</span>
          {' · '}
          auto <span style={{ color:'#f0c040' }}>{fmt(cps*dmgMult)}/s</span>
          {' · '}
          wave <span style={{ color:'#ff8c00' }}>{Math.floor(killCount/10)+1}</span>
        </div>
        <div style={{ flex:1 }} />
      </div>

      {/* BODY */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* LEFT */}
        <div style={{ flex:'0 0 55%', display:'flex', flexDirection:'column', padding:'14px 12px 14px 16px', gap:10 }}>

          {/* Battle viewport */}
          <div style={{ flex:1, border:'2px solid #cc8800', borderRadius:6, position:'relative', overflow:'hidden', backgroundImage:`url(${BATTLE_BG})`, backgroundSize:'cover', backgroundPosition:'center', backgroundColor:'#0f1625' }}>
            <div style={{ position:'absolute', inset:0, background:'rgba(10,14,30,0.45)', zIndex:1, pointerEvents:'none' }} />

            <div style={{ position:'absolute', top:10, left:12, color:'#aaa', fontSize:14, zIndex:10, pointerEvents:'none' }}>
              auto <span style={{ color:'#f0c040' }}>{fmt(cps*dmgMult)}</span>/s · kills <span style={{ color:'#f0c040' }}>{killCount}</span>
            </div>

            {bossWarning && (
              <div className="boss-warning">
                <div style={{ color:'#ff4400', fontSize:'clamp(30px,4.5vw,56px)', fontWeight:900, letterSpacing:5, textShadow:'0 0 32px #ff4400,0 0 12px #ff2200' }}>⚠ BOSS ⚠</div>
                <div style={{ color:'#ff8855', fontSize:'clamp(15px,2.2vw,22px)', marginTop:6, letterSpacing:3 }}>INCOMING!</div>
              </div>
            )}

            {enemies.map(en => {
              const size     = en.isBoss ? BOSS_SIZE : REGULAR_SIZE;
              const isFrozen = frozenMap[en.id] && frozenMap[en.id] > Date.now();
              const isMoving = !en.isBoss && en.movePattern !== 'stationary';
              return (
                <div key={en.id} className="enemy-wrap"
                  onClick={(e) => handleEnemyClick(en, e)}
                  style={{
                    left: en.x+'%', top: en.y+'%',
                    transform:'translate(-50%,-50%)',
                    transition: isMoving ? 'left 0.9s ease-in-out, top 0.9s ease-in-out' : 'none',
                  }}
                >
                  <div style={{ position:'relative', display:'inline-block' }}>
                    <img src={en.image} alt={en.name}
                      className={`enemy-sprite${en.isBoss ? ' boss' : ''}`}
                      style={{ width:size, height:size, objectFit:'contain', filter: isFrozen ? 'hue-rotate(180deg) brightness(1.5) saturate(2)' : undefined }}
                    />
                    {en.isBoss && (bossWeakPts[en.id] || []).map(wp => (
                      <div key={wp.id} className="weak-pt" title={`${wp.dmgMult}× DAMAGE!`}
                        onClick={(e) => handleWeakPointClick(en, wp, e)}
                        style={{ left:wp.relX+'%', top:wp.relY+'%' }}
                      />
                    ))}
                  </div>
                  <div style={{ width:size, margin:'4px auto 0' }}>
                    <div className="hp-bar-bg">
                      <div className="hp-bar-fill" style={{ width:Math.max(0,en.hp/en.maxHp*100)+'%', background:en.isBoss?'#ff4400':'#ff4444' }} />
                    </div>
                  </div>
                  {en.isBoss && <div style={{ color:'#ff6622', fontSize:13, fontWeight:700, marginTop:2 }}>⚔ BOSS</div>}
                  {isFrozen && <div style={{ color:'#06B6D4', fontSize:12, marginTop:1 }}>❄ FROZEN</div>}
                </div>
              );
            })}

            {/* Hero — no HP bar */}
            <div style={{ position:'absolute', left:'7%', bottom:'14%', zIndex:10, textAlign:'center', pointerEvents:'none' }}>
              {heroImage && !heroImage.includes('placeholder') ? (
                <img src={heroImage} alt="hero" style={{ width:200, height:200, objectFit:'contain', imageRendering:'pixelated', display:'block' }} />
              ) : (
                <div style={{ width:60, height:60, background:'#2a3050', border:'2px solid #ff8c00', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#ff8c00', textAlign:'center', lineHeight:1.3 }}>
                  {mainCard ? mainCard.name.slice(0,6) : 'HERO'}
                </div>
              )}
            </div>

            {floaters.map(f => (
              <div key={f.id} className="dmg-float" style={{ left:f.x+'%', top:f.y+'%', color:f.color, fontSize:f.isCrit?'clamp(14px,2.3vw,23px)':'clamp(12px,1.9vw,18px)', fontWeight:f.isCrit?900:600, textShadow:f.isCrit?'0 0 10px rgba(255,60,60,0.9)':'0 1px 4px rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', gap:3 }}>
                <span>{f.text}</span>
                {f.icon === 'coin' && <img src={`${BASE}ui/ui_cucoin.png`}    alt="" style={{ width:24, height:24, objectFit:'contain', imageRendering:'pixelated', flexShrink:0 }} />}
                {f.icon === 'gem'  && <img src={`${BASE}ui/ui_frailite.png`} alt="" style={{ width:24, height:24, objectFit:'contain', imageRendering:'pixelated', flexShrink:0 }} />}
              </div>
            ))}
          </div>

          {/* Hero stat bar — NO HP */}
          <div style={{ background:'#0f1625', border:'2px solid #334', borderRadius:6, padding:'10px 14px', display:'flex', alignItems:'center', gap:14, flexShrink:0 }}>
            <div style={{ width:44, height:44, flexShrink:0, borderRadius:4, overflow:'hidden', border:`2px solid ${mainCard?'#f0c040':'#334'}`, background:'#1a2035', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {mainCard && !mainCard.image?.includes('placeholder')
                ? <img src={mainCard.image} alt={mainCard.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <span style={{ fontSize:9, color:mainCard?'#f0c040':'#445', textAlign:'center', lineHeight:1.3 }}>{mainCard?mainCard.name.slice(0,4):'NO\nCARD'}</span>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'#ccc', fontSize:14 }}>{mainCard ? mainCard.name : 'No card equipped'}</div>
              {mainCard && <div style={{ color:'#556', fontSize:12 }}>{mainCard.subtitle}</div>}
            </div>
            <div style={{ display:'flex', gap:14, flexShrink:0 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ color:'#556', fontSize:11 }}>DMG</div>
                <div style={{ color:'#f0c040', fontWeight:700, fontSize:13 }}>{fmt((clickPower+atkBonus)*dmgMult)}</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ color:'#556', fontSize:11 }}>CRIT</div>
                <div style={{ color:'#ff8844', fontWeight:700, fontSize:13 }}>{Math.round(critRate*100)}%</div>
              </div>
            </div>
            <div style={{ flexShrink:0, textAlign:'center' }}>
              <button className="ability-btn" disabled={!abilityReady || !mainCard?.ability} onClick={useAbility}>
                {!mainCard?.ability ? 'no ability' : abilityReady ? `✦ ${mainCard.ability.name}` : `CD ${abilityCd}s`}
              </button>
              {!abilityReady && (
                <div className="cd-bar-bg">
                  <div className="cd-bar-fill" style={{ width:((abilityCdMax-abilityCd)/abilityCdMax*100)+'%' }} />
                </div>
              )}
            </div>
          </div>

          {/* Support buffs — 4 slots, 2x2 grid */}
          {deck?.supports?.some(Boolean) && (
  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, flexShrink:0 }}>
    {deck.supports.map((card, i) => card && (
      <div key={i} style={{ background:'#0a1020', border:'1px solid #1a2a40', borderRadius:4, padding:'6px 10px', fontSize:11 }}>
        <div style={{ color:'#5588ff', marginBottom:2, fontWeight:700 }}>{card.name} <span style={{ color:'#445', fontWeight:400 }}>support</span></div>
        {card.stats && (() => {
          const si = cardInventory[card.id]?.si ?? 0;
          const siMult = [1, 1.12, 1.25, 1.40, 1.60][si];
          const boostedAtk = Math.round(card.stats.atk * siMult);
          return (
            <span style={{ color:'#aaa' }}>
              +{boostedAtk} ATK
              {si > 0 && <span style={{ color:'#f0c040', marginLeft:4 }}>S{si+1}</span>}
            </span>
          );
        })()}
        {card.passive && <div style={{ color:'#778', marginTop:1 }}>{card.passive.description}</div>}
      </div>
    ))}
  </div>
)}

        </div>

        {/* RIGHT: nav grid */}
        <div style={{
          flex: '0 0 45%',
          padding: '14px 16px 14px 4px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minHeight: 0,
        }}>
          {/* Menu container — aspect ratio matches ui_menu.png */}
          <div style={{
            position: 'relative',
            width: '95%',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}>
            {/* Base menu image */}
            <img
              src={MENU_BG}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                display: 'block',
                pointerEvents: 'none',
              }}
            />

            {/* Hover overlays — each is full canvas, pre-positioned by the artist */}
            {NAV_CONFIG.map((cfg) => (
              hoveredNav === cfg.label && (
                <img
                  key={cfg.label}
                  src={cfg.hoverImg}
                  alt=""
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'fill',
                    pointerEvents: 'none',
                  }}
                />
              )
            ))}

            {/* Invisible click zones — positioned to match each button on the PNG */}
            {[
              { cfg: NAV_CONFIG[0], style: { left:'2%',  top:'2%',  width:'47%', height:'29%' } }, // SHOP
              { cfg: NAV_CONFIG[1], style: { left:'51%', top:'2%',  width:'47%', height:'29%' } }, // GAMBLE
              { cfg: NAV_CONFIG[2], style: { left:'2%',  top:'33%', width:'47%', height:'31%' } }, // DECK
              { cfg: NAV_CONFIG[3], style: { left:'51%', top:'33%', width:'47%', height:'31%' } }, // TOWER
              { cfg: NAV_CONFIG[4], style: { left:'2%',  top:'66%', width:'62%', height:'32%' } }, // CODEX
              { cfg: NAV_CONFIG[5], style: { left:'66%', top:'66%', width:'32%', height:'32%' } }, // SETTINGS
            ].map(({ cfg, style }) => (
              <div
                key={cfg.label}
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  ...style,
                }}
                onMouseEnter={() => setHoveredNav(cfg.label)}
                onMouseLeave={() => setHoveredNav(null)}
                onClick={() => handleNavClick(cfg)}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}