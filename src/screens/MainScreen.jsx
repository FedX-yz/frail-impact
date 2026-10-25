import { useState } from 'react';
import { playSFX, playPress } from '../utils/sfx';
import { fmt } from '../combat/engine';
import { cardBattleStats } from '../combat/stats';
import { SKILL_UNLOCK, ULT_UNLOCK, abilityText, skillKitFor, STYLES } from '../combat/kits';
import { BAL } from '../combat/balance';
import { FACILITIES, facilityCost, maxed } from '../combat/hq';
import { formatSub } from '../combat/sets';
import BattleArena from '../combat/BattleArena';
import DevMenu from './DevMenu';
import useIsMobile from '../hooks/useIsMobile';
import { thumb } from '../utils/assets';
import TermTitle from '../components/TermTitle';

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
  pullCurrency, coins, collection,
  engine, stats,
  hq = {},
  deck,
  cardInventory,
  devMode, devActions, pity4, pity5,
}) {
  const { mobile, portrait } = useIsMobile();
  const mainCard = deck?.main ?? null;
  const [devOpen, setDevOpen] = useState(false);

  const [hoveredNav, setHoveredNav] = useState(null);
  // Sound on press (instant), screen change on release
  const navSound = (cfg) => {
    if (cfg.uniqueSfx && cfg.tabSfx) playSFX(`${BASE}sounds/${cfg.tabSfx}`);
    else playPress();
  };
  const handleNavClick = (cfg) => navigate(cfg.screen);

  const level = stats.level;
  const xpEntry = mainCard ? cardInventory[mainCard.id] : null;
  // HQ rooms you can afford to upgrade right now
  const hqReady = FACILITIES.filter(f => !maxed(f, hq[f.id] ?? 0) && coins >= facilityCost(f, hq[f.id] ?? 0)).length;
  const statLine = (size) => (
    <span style={{ fontSize: size, color: '#778', whiteSpace: 'nowrap' }}>
      ATK <b style={{ color: '#f0c040' }}>{fmt(stats.atk)}</b>
      {' · '}HP <b style={{ color: '#4ade80' }}>{fmt(stats.maxHp)}</b>
      {' · '}DEF <b style={{ color: '#88aaff' }}>{fmt(stats.def)}</b>
    </span>
  );

  // ── Pieces shared by both layouts ─────────────────────────────────────────
  const topBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 8 : 12, padding: mobile ? '6px 10px' : '8px 16px', background:'var(--bar)', borderBottom:'2px solid #ff8c00', flexShrink: 0, flexWrap: 'wrap' }}>
      {!mobile && <TermTitle path="OPS" small />}
      <div className="pill" style={{ borderColor: '#5588ff' }}><GemIcon size={mobile ? 20 : 26} /><span style={{ color: '#fff' }}>{pullCurrency}</span></div>
      <div className="pill" style={{ borderColor: '#cc8800' }}><CoinIcon size={mobile ? 20 : 26} /><span style={{ color: '#f0c040' }}>{fmt(coins)}</span></div>
      <div style={{ fontSize: mobile ? 11 : 13, color: '#778', lineHeight: 1.3 }}>
        {statLine(mobile ? 11 : 13)}
        {' · '}crit <b style={{ color: '#ff8844' }}>{Math.round(stats.critRate * 100)}%</b>
        {!mobile && <>{' · '}dmg taken <b style={{ color: '#88aaff' }}>−{Math.round(stats.dmgReduction * 100)}%</b></>}
      </div>
      <div style={{ flex: 1 }} />
      {devMode && (
        <button onClick={() => setDevOpen(o => !o)} style={{ background: devOpen ? '#7c3aed' : '#2a1040', border: '1px solid #a855f7', color: '#e9d5ff', fontWeight: 800, fontSize: 12, padding: '4px 10px', borderRadius: 6 }}>
          🛠 DEV
        </button>
      )}
    </div>
  );

  // (was the Train button) → the HQ screen, where coins buy upgrades
  const trainBtn = (
    <button className="train-btn" onPointerDown={playPress} onClick={() => navigate('hq')}
      title="Frail Initiative HQ: spend coins on upgrades (ATK, HP, crit, ult charge, coins/XP)">
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
        <span>▣ HQ</span>
        <span style={{ fontSize: 10, color: hqReady ? '#6ef59b' : '#d6b25e', fontWeight: 600 }}>{hqReady ? `${hqReady} upgrade${hqReady === 1 ? '' : 's'} ready` : 'upgrades'}</span>
      </span>
      {!mobile && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><CoinIcon size={14} />{fmt(coins)}</span>}
    </button>
  );

  const skillStyle = STYLES[skillKitFor(mainCard?.skill?.effect)?.style];
  const kitInfo = mainCard && (
    <div style={{ fontSize: 11, color: '#778', lineHeight: 1.45, minWidth: 0, whiteSpace: mobile && portrait ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {mainCard.skill && (
        <div style={{ color: stats.skill ? '#4ade80' : '#556' }} title={abilityText(mainCard.skill, stats.si)}>
          ✦ {mainCard.skill.name} {skillStyle && <span style={{ color: skillStyle.color, fontSize: 10, border: `1px solid ${skillStyle.color}`, borderRadius: 3, padding: '0 4px', marginRight: 4 }} title={skillStyle.how}>{skillStyle.name} · {mobile ? skillStyle.phone : skillStyle.how}</span>}
          {stats.skill?.weak && <span style={{ color: '#fbbf24' }} title={`Weaker until LV${SKILL_UNLOCK}`}>½ until LV{SKILL_UNLOCK}</span>}
        </div>
      )}
      {mainCard.rarity >= 5 && !mainCard.skill && !mainCard.ult && <div style={{ color: '#667', fontStyle: 'italic' }}>✦ Kit coming soon</div>}
      {mainCard.ult && (
        <div style={{ color: stats.ult ? '#c084fc' : '#556' }} title={abilityText(mainCard.ult, stats.si)}>
          ⚡ {mainCard.ult.name} {!stats.ult ? <span style={{ color: '#f87171' }}>LV{ULT_UNLOCK}</span> : <span style={{ color: '#667' }}>[E]</span>}
        </div>
      )}
    </div>
  );

  const heroBar = (
    <div style={{ background:'var(--panel-deep)', border: '2px solid var(--line)', borderRadius: 6, padding: mobile ? '8px 8px' : '10px 14px', display: 'flex', flexDirection: mobile && portrait ? 'column' : 'row', alignItems: mobile && portrait ? 'stretch' : 'center', justifyContent: 'center', gap: mobile ? 8 : 12, flex: mobile && portrait ? 1 : undefined, flexShrink: 0, flexWrap: mobile && !portrait ? 'wrap' : 'nowrap' }}>
      {(
        <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 4, overflow: 'hidden', border: `2px solid ${mainCard ? '#f0c040' : 'var(--line)'}`, background:'var(--desk)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {mainCard ? <img src={thumb(mainCard.image)} alt={mainCard.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 9, color: '#445', textAlign: 'center' }}>NO CARD</span>}
        </div>
      )}
      <div style={{ flex: mobile && portrait ? 'none' : 1, minWidth: mobile && !portrait ? '100%' : 0 }}>
        {mobile && mainCard && <div style={{ color: '#ccc', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{mainCard.name} <span style={{ color: '#4ade80', fontSize: 11 }}>LV{level}</span></div>}
        {!mobile && <div style={{ color: '#ccc', fontSize: 14 }}>{mainCard ? mainCard.name : 'No card equipped'} {mainCard && <span style={{ color: '#4ade80', fontSize: 12 }}>LV{level}{stats.si > 0 ? ` · S${stats.si + 1}` : ''}</span>}
          {mainCard?.rarity >= 5 && <span style={{ color: '#4a6', fontSize: 11, marginLeft: 6 }}>{xpEntry?.xp ?? 0}/{level * 100} xp</span>}</div>}
        {mainCard ? kitInfo : <div style={{ fontSize: 11, color: '#556' }}>Equip a 5★ card in Deck to get skills and an ult.</div>}
      </div>
      {trainBtn}
    </div>
  );

  // Phone: compact card panel next to the menu art
  const xpNeed = level * 100, xpHave = xpEntry?.xp ?? 0;
  const mobilePanel = (
    <div className="m-panel">
      {mainCard ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={thumb(mainCard.image)} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', border: '2px solid #f0c040', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#eee', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mainCard.name}</div>
              <div style={{ color: '#4ade80', fontSize: 11, fontWeight: 700 }}>LV {level}{stats.si > 0 ? ` · S${stats.si + 1}` : ''}</div>
            </div>
          </div>
          {mainCard.rarity >= 5 && (
            <div>
              <div style={{ height: 5, background: '#0a1a10', borderRadius: 3 }}>
                <div style={{ width: `${Math.min(100, xpHave / xpNeed * 100)}%`, height: '100%', background: '#4ade80', borderRadius: 3 }} />
              </div>
              <div style={{ color: '#4a6', fontSize: 9, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{xpHave}/{xpNeed} xp</div>
            </div>
          )}
          <div style={{ lineHeight: 1.2 }}>{statLine(10)}</div>
          <div style={{ fontSize: 11, lineHeight: 1.5 }}>
            {mainCard.skill && <div style={{ color: stats.skill ? '#4ade80' : '#667', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>✦ {mainCard.skill.name}{stats.skill?.weak && <span style={{ color: '#fbbf24' }}> · ½ to LV{SKILL_UNLOCK}</span>}</div>}
            {mainCard.skill && skillStyle && <div style={{ color: skillStyle.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 10 }}>{skillStyle.name} · {skillStyle.phone}</div>}
            {mainCard.rarity >= 5 && !mainCard.skill && !mainCard.ult && <div style={{ color: '#667', fontStyle: 'italic' }}>✦ Kit coming soon</div>}
            {mainCard.ult && <div style={{ color: stats.ult ? '#c084fc' : '#667', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>⚡ {mainCard.ult.name}{!stats.ult && <span style={{ color: '#f87171' }}> · LV{ULT_UNLOCK}</span>}</div>}
            {stats.sets.map(set => <div key={set.id} style={{ color: set.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>◆ {set.name}</div>)}
          </div>
        </>
      ) : (
        <div style={{ color: '#778', fontSize: 12, lineHeight: 1.4 }}>No main card.<br />Equip a 5★ in <b style={{ color: '#ff8c00' }}>Deck</b> for skills and an ult.</div>
      )}
      <div style={{ flex: 1 }} />
      {trainBtn}
    </div>
  );

  // Supports: one slim line of chips (full details on hover, and in Deck) so the battle keeps its room
  const supportsPanel = !mobile && deck?.supports?.some(Boolean) && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', fontSize: 11, height: 22 }}>
      <span style={{ color: 'var(--amber-dim)', letterSpacing: 1, flexShrink: 0 }}>SUPPORTS</span>
      {deck.supports.map((card, i) => card && (
        <span key={i} title={(cardInventory[card.id]?.subs ?? []).map(formatSub).join(' · ') || card.passive?.description || ''}
          style={{ border: '1px solid var(--line)', padding: '1px 7px', color: 'var(--amber)', flexShrink: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {card.name} <span style={{ color: '#6ef59b' }}>+{Math.round(cardBattleStats(card, cardInventory[card.id]).atk * BAL.SUPPORT_ATK)}</span>
        </span>
      ))}
      {stats.sets.map(set => (
        <span key={set.id} title={set.desc} style={{ border: `1px solid ${set.color}88`, color: set.color, padding: '1px 7px', flexShrink: 0 }}>◆ {set.name}</span>
      ))}
    </div>
  );

  // Your menu art with its hover images, used on PC and phone.
  // On touch screens the hover image flashes while your finger is down.
  const navArt = (style) => (
    <div style={{ position: 'relative', overflow: 'hidden', ...style }}>
      <img src={MENU_BG} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none', filter: 'drop-shadow(0 0 6px rgba(255,110,0,0.3))' }} />
      {NAV_CONFIG.map(cfg => hoveredNav === cfg.label && (
        <img key={cfg.label} src={cfg.hoverImg} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }} />
      ))}
      {NAV_CONFIG.map((cfg, i) => (
        <div key={cfg.label} data-nav={cfg.label} style={{ position: 'absolute', cursor: 'pointer', touchAction: 'manipulation', ...NAV_BOXES[i] }}
          onPointerEnter={e => { if (e.pointerType === 'mouse') setHoveredNav(cfg.label); }}
          onPointerLeave={() => setHoveredNav(null)}
          onPointerDown={() => { setHoveredNav(cfg.label); navSound(cfg); }}
          onPointerUp={e => { if (e.pointerType !== 'mouse') setHoveredNav(null); }}
          onClick={() => handleNavClick(cfg)} />
      ))}
    </div>
  );

  const arena = <BattleArena engine={engine} mainCard={mainCard} mobile={mobile} />;
  const devMenu = devMode && devOpen && (
    <DevMenu engine={engine} actions={devActions} mobile={mobile} onClose={() => setDevOpen(false)}
      state={{ pullCurrency, coins, collection, cardInventory, deck, hq, pity4, pity5 }} />
  );

  return (
    <div style={{ width: '100%', height: '100dvh', background:'var(--desk)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-ui)', userSelect: 'none', cursor: mobile ? 'auto' : `url(${BASE}ui/mouse.png) 0 0, auto` }}>
      <style>{`
        ${mobile ? '' : `* { cursor: url('${BASE}ui/mouse.png') 0 0, auto !important; }`}
        img { -webkit-user-drag:none; user-select:none; }
        .pill { display:flex; align-items:center; gap:6px; background:#0b0602; border:1px solid; border-radius:2px; box-shadow: inset 0 0 8px rgba(255,122,0,0.18); padding:3px 12px 3px 6px; font-weight:700; font-size:${mobile ? 14 : 17}px; }
        .train-btn { border:2px solid #f0c040; background:#2a2000; color:#f0c040; border-radius:6px; cursor:pointer; font-size:13px; font-weight:700; padding:7px 12px; white-space:nowrap; display:flex; gap:6px; align-items:center; flex-shrink:0; touch-action:manipulation; }
        .train-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .train-btn:hover:not(:disabled) { background:#3a2c00; }
        .m-panel { flex:1; display:flex; flex-direction:column; gap:7px; background:var(--panel-deep); border:2px solid var(--line); border-radius:6px; padding:8px; min-height:0; }
        ${mobile ? '.train-btn { justify-content:center; padding:9px 6px; width:100%; }' : ''}
      `}</style>

      {topBar}
      {devMenu}

      {mobile ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: portrait ? 'column' : 'row', gap: 6, padding: 6 }}>
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {arena}
          </div>
          {portrait ? (
            // menu art (left) + your card / Train (right)
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'stretch' }}>
              {navArt({ width: '58%', aspectRatio: '2045 / 1971', flexShrink: 0 })}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                {mobilePanel}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 230, flexShrink: 0, overflowY: 'auto' }}>
              {mobilePanel}
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
