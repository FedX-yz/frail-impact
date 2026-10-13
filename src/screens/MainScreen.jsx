import { useEffect, useMemo, useRef, useState } from 'react';
import { playSFX, playPress } from '../utils/sfx';
import { createBattle, fmt } from '../combat/engine';
import { computePlayerStats, siMult } from '../combat/stats';
import { SKILL_UNLOCK, ULT_UNLOCK } from '../combat/kits';
import { formatSub } from '../combat/sets';
import BattleArena from '../combat/BattleArena';
import useIsMobile from '../hooks/useIsMobile';

const BASE = import.meta.env.BASE_URL;

const NAV_CONFIG = [
  { label: 'shop',     screen: 'shop',     hoverImg: `${BASE}ui/ui_hovershop.png`,     tabSfx: 'ui_shop.mp3',  uniqueSfx: true  },
  { label: 'gamble',   screen: 'gacha',    hoverImg: `${BASE}ui/ui_hovergamble.png`,   tabSfx: 'ui_warp.mp3',  uniqueSfx: true  },
  { label: 'deck',     screen: 'deck',     hoverImg: `${BASE}ui/ui_hoverdeck.png`,     tabSfx: 'ui_warp.mp3',  uniqueSfx: false },
  { label: 'tower',    screen: 'tower',    hoverImg: `${BASE}ui/ui_hovertower.png`,    tabSfx: 'ui_warp.mp3',  uniqueSfx: false },
  { label: 'codex',    screen: 'cards',    hoverImg: `${BASE}ui/ui_hovercodex.png`,    tabSfx: 'ui_codex.mp3', uniqueSfx: true  },
  { label: 'settings', screen: 'settings', hoverImg: `${BASE}ui/ui_hoversettings.png`, tabSfx: 'ui_warp.mp3',  uniqueSfx: false },
];
const NAV_BOXES = [
  { left: '2%',  top: '2%',  width: '47%', height: '29%' },
  { left: '51%', top: '2%',  width: '47%', height: '29%' },
  { left: '2%',  top: '33%', width: '47%', height: '31%' },
  { left: '51%', top: '33%', width: '47%', height: '31%' },
  { left: '2%',  top: '66%', width: '62%', height: '32%' },
  { left: '66%', top: '66%', width: '32%', height: '32%' },
];
const MENU_BG = `${BASE}ui/ui_menu.png`;
const PIX = { imageRendering: 'pixelated' };

const CoinIcon = ({ size = 26 }) => <img src={`${BASE}ui/ui_cucoin.png`} alt="coin" style={{ width: size, height: size, objectFit: 'contain', ...PIX, flexShrink: 0 }} />;
const GemIcon  = ({ size = 26 }) => <img src={`${BASE}ui/ui_frailite.png`} alt="gem" style={{ width: size, height: size, objectFit: 'contain', ...PIX, flexShrink: 0 }} />;

export default function MainScreen({
  navigate,
  pullCurrency, setPullCurrency,
  coins, setCoins,
  clickPower, cps, multiplier,
  setTotalEarned,
  upgradeCost, buyUpgrade,
  deck,
  cardInventory, setCardInventory,
  setKillCount,
  stage, setStage,
}) {
  const { mobile, portrait } = useIsMobile();
  const mainCard = deck?.main ?? null;

  const stats = useMemo(
    () => computePlayerStats({ deck, cardInventory, clickPower, cps, multiplier }),
    [deck, cardInventory, clickPower, cps, multiplier],
  );

  // Engine callbacks read the latest props through this ref
  const handlers = useRef({});
  const cardInvRef = useRef(cardInventory);
  useEffect(() => { cardInvRef.current = cardInventory; }, [cardInventory]);

  const [engine] = useState(() => createBattle({ stageNum: stage ?? 1, stats, callbacks: handlers }));
  useEffect(() => { engine.setStats(stats); }, [engine, stats]);

  useEffect(() => {
    handlers.current = {
      onReward: ({ coins: c = 0, gems = 0, xp = 0, kill }) => {
        if (c) { setCoins(v => v + c); setTotalEarned(v => v + c); }
        if (gems) setPullCurrency(v => v + gems);
        if (kill) setKillCount(v => v + 1);
        // XP goes to the main card (5★/6★)
        const mc = deck?.main;
        if (xp && mc && mc.rarity >= 5) {
          const inv = cardInvRef.current;
          const entry = inv[mc.id] ?? { si: 0, xp: 0, level: 1 };
          let level = entry.level ?? 1, cur = (entry.xp ?? 0) + xp;
          while (cur >= level * 100) {
            cur -= level * 100; level++;
            engine.announce(`${mc.name} LV${level}!`);
            if (level === SKILL_UNLOCK) engine.announce('SKILL UNLOCKED!', '#4ade80');
            if (level === ULT_UNLOCK)   engine.announce('ULT UNLOCKED!', '#c084fc');
          }
          const next = { ...inv, [mc.id]: { ...entry, xp: cur, level } };
          cardInvRef.current = next;
          setCardInventory(next);
        }
      },
      onStageClear: (next) => setStage(next),
    };
  }, [deck, engine, setCoins, setTotalEarned, setPullCurrency, setKillCount, setCardInventory, setStage]);

  const [hoveredNav, setHoveredNav] = useState(null);
  const handleNavClick = (cfg) => {
    if (cfg.uniqueSfx && cfg.tabSfx) playSFX(`${BASE}sounds/${cfg.tabSfx}`);
    else playPress();
    navigate(cfg.screen);
  };

  const level = stats.level;
  const xpEntry = mainCard ? cardInventory[mainCard.id] : null;
  const canTrain = coins >= upgradeCost;

  // ── Pieces shared by both layouts ─────────────────────────────────────────
  const topBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 8 : 12, padding: mobile ? '6px 10px' : '8px 16px', background: '#141928', borderBottom: '2px solid #ff8c00', flexShrink: 0, flexWrap: 'wrap' }}>
      <div className="pill" style={{ borderColor: '#5588ff' }}><GemIcon size={mobile ? 20 : 26} /><span style={{ color: '#fff' }}>{pullCurrency}</span></div>
      <div className="pill" style={{ borderColor: '#cc8800' }}><CoinIcon size={mobile ? 20 : 26} /><span style={{ color: '#f0c040' }}>{fmt(coins)}</span></div>
      <div style={{ fontSize: mobile ? 11 : 13, color: '#778', lineHeight: 1.3 }}>
        dmg <b style={{ color: '#f0c040' }}>{fmt(stats.clickDmg)}</b>
        {' · '}auto <b style={{ color: '#f0c040' }}>{fmt(stats.autoDps)}/s</b>
        {' · '}crit <b style={{ color: '#ff8844' }}>{Math.round(stats.critRate * 100)}%</b>
        {mainCard?.rarity >= 5 && <>{' · '}lv <b style={{ color: '#4ade80' }}>{level}</b> <span style={{ color: '#4a6' }}>({xpEntry?.xp ?? 0}/{level * 100})</span></>}
      </div>
    </div>
  );

  const trainBtn = (
    <button className="train-btn" disabled={!canTrain} onClick={() => { buyUpgrade(); playPress(); }}
      title="+5 click power and +5 auto damage">
      ⬆ Train <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><CoinIcon size={14} />{fmt(upgradeCost)}</span>
    </button>
  );

  const kitInfo = mainCard && (
    <div style={{ fontSize: 11, color: '#778', lineHeight: 1.45, minWidth: 0, whiteSpace: mobile && portrait ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {mainCard.skill && (
        <div style={{ color: stats.skill ? '#4ade80' : '#556' }} title={mainCard.skill.description}>
          ✦ {mainCard.skill.name} {!stats.skill && <span style={{ color: '#f87171' }}>LV{SKILL_UNLOCK}</span>}
        </div>
      )}
      {mainCard.ult && (
        <div style={{ color: stats.ult ? '#c084fc' : '#556' }} title={mainCard.ult.description}>
          ⚡ {mainCard.ult.name} {!stats.ult ? <span style={{ color: '#f87171' }}>LV{ULT_UNLOCK}</span> : <span style={{ color: '#667' }}>[E]</span>}
        </div>
      )}
    </div>
  );

  const heroBar = (
    <div style={{ background: '#0f1625', border: '2px solid #334', borderRadius: 6, padding: mobile ? '8px 8px' : '10px 14px', display: 'flex', flexDirection: mobile && portrait ? 'column' : 'row', alignItems: mobile && portrait ? 'stretch' : 'center', justifyContent: 'center', gap: mobile ? 8 : 12, flex: mobile && portrait ? 1 : undefined, flexShrink: 0, flexWrap: mobile && !portrait ? 'wrap' : 'nowrap' }}>
      {!mobile && (
        <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 4, overflow: 'hidden', border: `2px solid ${mainCard ? '#f0c040' : '#334'}`, background: '#1a2035', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {mainCard ? <img src={mainCard.image} alt={mainCard.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 9, color: '#445', textAlign: 'center' }}>NO CARD</span>}
        </div>
      )}
      <div style={{ flex: mobile && portrait ? 'none' : 1, minWidth: mobile && !portrait ? '100%' : 0 }}>
        {mobile && mainCard && <div style={{ color: '#ccc', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{mainCard.name} <span style={{ color: '#4ade80', fontSize: 11 }}>LV{level}</span></div>}
        {!mobile && <div style={{ color: '#ccc', fontSize: 14 }}>{mainCard ? mainCard.name : 'No card equipped'} {mainCard && <span style={{ color: '#556', fontSize: 12 }}>{mainCard.subtitle}</span>}</div>}
        {mainCard ? kitInfo : <div style={{ fontSize: 11, color: '#556' }}>Equip a 5★ card in Deck to get skills and an ult.</div>}
      </div>
      {trainBtn}
    </div>
  );

  const supportsPanel = !mobile && deck?.supports?.some(Boolean) && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {deck.supports.map((card, i) => card && (
          <div key={i} style={{ background: '#0a1020', border: '1px solid #1a2a40', borderRadius: 4, padding: '5px 9px', fontSize: 11 }}>
            <div style={{ color: '#5588ff', fontWeight: 700 }}>{card.name}
              <span style={{ color: '#aaa', fontWeight: 400, marginLeft: 6 }}>+{Math.round((card.stats?.atk ?? 0) * siMult(cardInventory[card.id]?.si))} ATK</span>
            </div>
            <div style={{ color: '#778' }}>{(cardInventory[card.id]?.subs ?? []).map(formatSub).join(' · ') || card.passive?.description}</div>
          </div>
        ))}
      </div>
      {stats.sets.map(set => (
        <div key={set.id} style={{ fontSize: 11, color: set.color, background: '#0a1020', border: `1px solid ${set.color}55`, borderRadius: 4, padding: '4px 9px' }}>
          ◆ {set.name}: <span style={{ color: '#bbb' }}>{set.desc}</span>
        </div>
      ))}
    </div>
  );

  // Your menu art with its hover images, used on PC and phone.
  // On touch screens the hover image flashes while your finger is down.
  const navArt = (style) => (
    <div style={{ position: 'relative', overflow: 'hidden', ...style }}>
      <img src={MENU_BG} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }} />
      {NAV_CONFIG.map(cfg => hoveredNav === cfg.label && (
        <img key={cfg.label} src={cfg.hoverImg} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }} />
      ))}
      {NAV_CONFIG.map((cfg, i) => (
        <div key={cfg.label} data-nav={cfg.label} style={{ position: 'absolute', cursor: 'pointer', touchAction: 'manipulation', ...NAV_BOXES[i] }}
          onPointerEnter={e => { if (e.pointerType === 'mouse') setHoveredNav(cfg.label); }}
          onPointerLeave={() => setHoveredNav(null)}
          onPointerDown={() => setHoveredNav(cfg.label)}
          onPointerUp={e => { if (e.pointerType !== 'mouse') setHoveredNav(null); }}
          onClick={() => handleNavClick(cfg)} />
      ))}
    </div>
  );

  const arena = <BattleArena engine={engine} mainCard={mainCard} mobile={mobile} />;

  return (
    <div style={{ width: '100%', height: '100dvh', background: '#1a2035', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Segoe UI',sans-serif", userSelect: 'none', cursor: mobile ? 'auto' : `url(${BASE}ui/mouse.png) 0 0, auto` }}>
      <style>{`
        ${mobile ? '' : `* { cursor: url('${BASE}ui/mouse.png') 0 0, auto !important; }`}
        img { -webkit-user-drag:none; user-select:none; }
        .pill { display:flex; align-items:center; gap:6px; background:#0f1420; border:2px solid; border-radius:20px; padding:3px 12px 3px 6px; font-weight:700; font-size:${mobile ? 14 : 17}px; }
        .train-btn { border:2px solid #f0c040; background:#2a2000; color:#f0c040; border-radius:6px; cursor:pointer; font-size:13px; font-weight:700; padding:7px 12px; white-space:nowrap; display:flex; gap:6px; align-items:center; flex-shrink:0; touch-action:manipulation; }
        .train-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .train-btn:hover:not(:disabled) { background:#3a2c00; }
        ${mobile && portrait ? '.train-btn { justify-content:center; padding:10px 8px; }' : ''}
      `}</style>

      {topBar}

      {mobile ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: portrait ? 'column' : 'row', gap: 6, padding: 6 }}>
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {arena}
          </div>
          {portrait ? (
            // menu art (left) + your card / Train (right)
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'stretch' }}>
              {navArt({ width: '58%', aspectRatio: '2045 / 1971', flexShrink: 0 })}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {heroBar}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 230, flexShrink: 0, overflowY: 'auto' }}>
              {heroBar}
              {navArt({ width: '100%', aspectRatio: '2045 / 1971', flexShrink: 0 })}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: '0 0 58%', display: 'flex', flexDirection: 'column', padding: '14px 12px 14px 16px', gap: 10, minWidth: 0 }}>
            {arena}
            {heroBar}
            {supportsPanel}
          </div>
          <div style={{ flex: '0 0 42%', padding: '14px 16px 14px 4px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {navArt({ width: '95%', flex: 1, minHeight: 0 })}
          </div>
        </div>
      )}
    </div>
  );
}
