import { useState, useCallback, useRef, useMemo } from 'react';
import { CHARACTERS } from '../data/characters';
import { playClose } from '../utils/sfx';

const BASE = import.meta.env.BASE_URL;

// ─── Config ──────────────────────────────────────────────────────────────────
const RARITY_PRICE = { 5: 75000, 4: 7500, 3: 1200 };
const RARITY_LABEL = { 6: '✦✦✦✦✦✦', 5: '✦✦✦✦✦', 4: '✦✦✦✦', 3: '✦✦✦' };
const RARITY_COLOR = { 6: '#ff3366', 5: '#f0c040', 4: '#b06dff', 3: '#66aaff' };
const RARITY_BG    = {
  6: 'linear-gradient(135deg,#330012,#220020)',
  5: 'linear-gradient(135deg,#1a1500,#221800)',
  4: 'linear-gradient(135deg,#150020,#1a1030)',
  3: 'linear-gradient(135deg,#001225,#001830)',
};

// S1–S5: each fusion costs 1 duplicate (need ≥2 copies, consumes 1)
const SI_BONUSES = [
  { atkMult: 1.00, label: 'S1 – Base'        },
  { atkMult: 1.12, label: 'S2 +12% ATK'      },
  { atkMult: 1.25, label: 'S3 +25% ATK'      },
  { atkMult: 1.40, label: 'S4 +40% ATK'      },
  { atkMult: 1.60, label: 'S5 +60% ATK ⚡MAX' },
];

const SHOP_CARDS = CHARACTERS
  .filter(c => c.rarity !== 6)
  .sort((a, b) => b.rarity - a.rarity);

const fmt = n =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' :
  n >= 1000 ? (n / 1000).toFixed(1) + 'k' :
  Math.floor(n);

const CoinIcon = ({ size = 30 }) => (
  <img
    src={`${BASE}ui/ui_cucoin.png`} alt="coin"
    style={{ width: size, height: size, objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0 }}
  />
);

// ─── Exported helper for MainScreen SI bonus ──────────────────────────────────
export function getSiAtkMult(cardInventory, cardId) {
  const si = cardInventory?.[cardId]?.si ?? 0;
  return SI_BONUSES[Math.min(si, 4)]?.atkMult ?? 1;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CardShop({ navigate, coins, setCoins, collection, setCollection, gachaCollection = [] }) {
  const [tab,        setTab]        = useState('exchange');
  const [toast,      setToast]      = useState(null);
  const [confirmBuy, setConfirmBuy] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, color = '#f0c040') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, color });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const getCardCounts = useCallback((cardId) => {
    const shopCount = collection[cardId]?.count ?? 0;
    const gachaCount = (gachaCollection || []).filter(g => g.id === cardId).length;
    return shopCount + gachaCount;
  }, [collection, gachaCollection]);

  // ── EXCHANGE ────────────────────────────────────────────────────────────────
  const handleBuy = useCallback((card) => {
    const price = RARITY_PRICE[card.rarity];
    if (!price) return;
    if (coins < price) { showToast('Not enough coins!', '#ff4444'); return; }
    setCoins(c => c - price);
    setCollection(prev => {
      const entry = prev[card.id] ?? { count: 0, si: 0 };
      return { ...prev, [card.id]: { ...entry, count: entry.count + 1 } };
    });
    showToast(`Obtained ${card.name}!`, RARITY_COLOR[card.rarity]);
    setConfirmBuy(null);
  }, [coins, setCoins, setCollection, showToast]);

  // ── FUSION ──────────────────────────────────────────────────────────────────
  const handleFuse = useCallback((card) => {
    const shopCount = collection[card.id]?.count ?? 0;
    const gachaCount = (gachaCollection || []).filter(g => g.id === card.id).length;
    const totalCount = shopCount + gachaCount;
    const si = collection[card.id]?.si ?? 0;
    
    if (si >= 4) { 
      showToast('Already at S5 – MAX!', '#ff8c00'); 
      return; 
    }
    if (totalCount < 2) { 
      showToast('Need 1 more copy to fuse!', '#ff4444'); 
      return; 
    }
    
    setCollection(prev => {
      const cur = prev[card.id] ?? { count: 0, si: 0 };
      const newSi = cur.si + 1;
      const newCount = Math.max(0, cur.count - 1);
      
      // ALWAYS keep the entry to preserve SI — don't delete it!
      return { ...prev, [card.id]: { count: newCount, si: newSi } };
    });
    
    showToast(`${card.name} → ${SI_BONUSES[si + 1].label}`, RARITY_COLOR[card.rarity]);
  }, [collection, setCollection, showToast, gachaCollection]);

  // Memoized — only recomputes when collection changes, not on every render
  const ownedCards  = useMemo(() => CHARACTERS.filter(c => {
    const shopCount = collection[c.id]?.count ?? 0;
    const gachaCount = (gachaCollection || []).filter(g => g.id === c.id).length;
    return (shopCount + gachaCount) >= 1;
  }), [collection, gachaCollection]);

  const pendingCard = useMemo(() => confirmBuy != null ? CHARACTERS.find(c => c.id === confirmBuy) : null, [confirmBuy]);

  return (
    <div style={ROOT}>
      <style>{CSS}</style>

      {/* TOP BAR */}
      <div style={TOP_BAR}>
        <button
          className="cs-back-btn"
          onClick={() => { playClose(); navigate('main'); }}
        >
          ← back
        </button>
        <div style={COIN_BADGE}>
          <CoinIcon />
          <span style={{ color: '#f0c040', fontWeight: 700, fontSize: 16 }}>{fmt(coins)}</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ color: '#ff8c00', fontWeight: 900, fontSize: 20, letterSpacing: 2 }}>
          {tab === 'exchange' ? 'SHOP' : '⚡ FUSION'}
        </span>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', flexShrink: 0, borderBottom: '2px solid #1a2a40', background: '#0d1220' }}>
        {[
          { key: 'exchange', content: <><CoinIcon size={14} /> EXCHANGE</> },
          { key: 'fusion',   content: <>⚡ FUSION</>                        },
        ].map(t => (
          <button key={t.key} style={TAB_BTN(tab === t.key)} onClick={() => setTab(t.key)}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              {t.content}
            </span>
          </button>
        ))}
      </div>

      {/* ── EXCHANGE ─────────────────────────────────────────────────────────── */}
      {tab === 'exchange' && (
        <div style={GRID}>
          {SHOP_CARDS.map(card => {
            const price     = RARITY_PRICE[card.rarity];
            const owned     = getCardCounts(card.id);
            const si        = collection[card.id]?.si    ?? 0;
            const canAfford = coins >= price;

            return (
              <div
                key={card.id}
                className="cs-card"
                style={{ background: RARITY_BG[card.rarity], '--hover-color': RARITY_COLOR[card.rarity] }}
              >
                {owned > 0 && <div className="cs-owned-badge">×{owned} owned</div>}

                <div style={IMG_WRAP(RARITY_COLOR[card.rarity], 72)}>
                  {card.image
                    ? <img src={card.image} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ color: RARITY_COLOR[card.rarity], fontSize: 10 }}>{card.name.slice(0, 6)}</span>}
                </div>

                <div style={{ color: RARITY_COLOR[card.rarity], fontSize: 11, letterSpacing: 1 }}>
                  {RARITY_LABEL[card.rarity]}
                </div>
                <div style={{ color: '#eee', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>{card.name}</div>
                {card.subtitle && (
                  <div style={{ color: '#556', fontSize: 11, textAlign: 'center', marginTop: -4 }}>{card.subtitle}</div>
                )}

                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#778' }}>
                  <span>ATK <span style={{ color: '#f0c040' }}>{card.stats.atk}</span></span>
                  <span>HP  <span style={{ color: '#66ff88' }}>{card.stats.hp}</span></span>
                  <span>DEF <span style={{ color: '#88aaff' }}>{card.stats.def}</span></span>
                </div>

                {card.ability && (
                  <div style={{ background: '#1a0a2a', border: '1px solid #3a1a5a', borderRadius: 4, padding: '3px 7px', fontSize: 10, color: '#cc88ff' }}>
                    ✦ {card.ability.name}
                  </div>
                )}

                {owned > 0 && <SiPips si={si} color={RARITY_COLOR[card.rarity]} />}

                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <CoinIcon size={16} />
                  <span style={{ color: canAfford ? '#f0c040' : '#664422', fontWeight: 700, fontSize: 13 }}>
                    {fmt(price)}
                  </span>
                </div>

                <button
                className="cs-buy-btn"
                disabled={!canAfford || si >= 4}
                style={{ background: (canAfford && si < 4) ? `linear-gradient(90deg,${RARITY_COLOR[card.rarity]}88,${RARITY_COLOR[card.rarity]})` : '#1a2a40' }}
                onClick={() => setConfirmBuy(card.id)}
              >
                {si >= 4 ? 'MAX S5' : owned === 0 ? 'OBTAIN' : 'BUY DUPE'}
              </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── FUSION ───────────────────────────────────────────────────────────── */}
      {tab === 'fusion' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {ownedCards.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#445', marginTop: 60 }}>
              <div style={{ fontSize: 44 }}>🃏</div>
              <div style={{ marginTop: 10, fontSize: 16 }}>You don't own any cards yet.</div>
              <div style={{ fontSize: 13, marginTop: 6, color: '#334' }}>Buy cards in Exchange, or pull from the gacha.</div>
            </div>
          ) : (
            <>
              <div style={{ color: '#445', fontSize: 11, marginBottom: 14, letterSpacing: 1 }}>
                FUSE 1 DUPLICATE TO RAISE SUPERIMPOSITION (S1→S5). EACH LEVEL BOOSTS ATK.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, alignContent: 'start' }}>
                {ownedCards.map(card => {
                  const entry     = collection[card.id] ?? { count: 0, si: 0 };
                  const count     = getCardCounts(card.id);
                  const { si } = entry;
                  const maxed     = si >= 4;
                  const canFuse   = !maxed && count >= 2;
                  const bonus     = SI_BONUSES[si];
                  const nextBonus = !maxed ? SI_BONUSES[si + 1] : null;

                  return (
                    <div
                      key={card.id}
                      className="cs-card"
                      style={{ background: RARITY_BG[card.rarity], '--hover-color': RARITY_COLOR[card.rarity] }}
                    >
                      <div style={{ position: 'relative' }}>
                        <div style={IMG_WRAP(RARITY_COLOR[card.rarity], 60)}>
                          {card.image
                            ? <img src={card.image} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ color: RARITY_COLOR[card.rarity], fontSize: 9 }}>{card.name.slice(0, 6)}</span>}
                        </div>
                        <div style={{ position: 'absolute', bottom: -5, right: -8, background: '#0f1420', border: `1px solid ${RARITY_COLOR[card.rarity]}`, borderRadius: 10, padding: '1px 7px', fontSize: 11, color: RARITY_COLOR[card.rarity], fontWeight: 900 }}>
                          ×{count}
                        </div>
                      </div>

                      <div style={{ color: '#eee', fontWeight: 700, fontSize: 13 }}>{card.name}</div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#445', fontSize: 11 }}>S{si + 1}</span>
                        <SiPips si={si} color={RARITY_COLOR[card.rarity]} glow />
                        {maxed && <span style={{ color: '#ff8c00', fontSize: 10, fontWeight: 700 }}>MAX</span>}
                      </div>

                      <div style={{ background: '#0a1020', border: '1px solid #1a2a40', borderRadius: 6, padding: '6px 10px', width: '100%', fontSize: 11, color: '#778' }}>
                        <div style={{ color: RARITY_COLOR[card.rarity], fontWeight: 700, marginBottom: 2 }}>{bonus.label}</div>
                        <div>
                          ATK: <span style={{ color: '#f0c040' }}>{Math.round(card.stats.atk * bonus.atkMult)}</span>
                          <span style={{ color: '#445' }}> (base {card.stats.atk})</span>
                        </div>
                        {nextBonus && (
                          <div style={{ marginTop: 3, color: '#334' }}>
                            → S{si + 2}: ATK {Math.round(card.stats.atk * nextBonus.atkMult)}
                          </div>
                        )}
                      </div>

                      {!maxed && (
                        <div style={{ fontSize: 11, color: canFuse ? '#66ff88' : '#664', textAlign: 'center' }}>
                          {canFuse ? '✓ Ready to fuse!' : `Need 1 more copy · have ×${count}`}
                        </div>
                      )}

                      <button className="cs-fuse-btn" disabled={!canFuse} onClick={() => handleFuse(card)}>
                        {maxed ? '✦ MAX REACHED' : canFuse ? `⚡ FUSE → S${si + 2}` : 'FUSE (need ×2)'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Reference table */}
              <div style={{ marginTop: 28, background: '#090e1a', border: '1px solid #1a2a40', borderRadius: 8, padding: '14px 18px' }}>
                <div style={{ color: '#f0c040', fontWeight: 700, marginBottom: 10, fontSize: 13 }}>SUPERIMPOSITION REFERENCE</div>
                {SI_BONUSES.map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < 4 ? '1px solid #111a2a' : 'none' }}>
                    <span style={{ color: '#aa44ff', fontWeight: 700, fontSize: 12 }}>S{i + 1}</span>
                    <span style={{ color: '#778', fontSize: 12 }}>{b.label}</span>
                    <span style={{ color: '#445', fontSize: 11 }}>{i === 0 ? '1 copy' : `${i + 1} copies total`}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── CONFIRM MODAL ────────────────────────────────────────────────────── */}
      {pendingCard && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 100 }} onClick={() => setConfirmBuy(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: RARITY_BG[pendingCard.rarity], border: `2px solid ${RARITY_COLOR[pendingCard.rarity]}`, borderRadius: 12, padding: '28px 32px', zIndex: 101, textAlign: 'center', minWidth: 260, animation: 'cs-modalIn 0.18s ease-out' }}>
            <div style={{ color: RARITY_COLOR[pendingCard.rarity], fontSize: 13, letterSpacing: 2, marginBottom: 8 }}>{RARITY_LABEL[pendingCard.rarity]}</div>
            <div style={{ ...IMG_WRAP(RARITY_COLOR[pendingCard.rarity], 80), margin: '0 auto 12px' }}>
              {pendingCard.image && <img src={pendingCard.image} alt={pendingCard.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 18, marginBottom: 4 }}>{pendingCard.name}</div>
            <div style={{ color: '#556', fontSize: 13, marginBottom: 16 }}>{pendingCard.subtitle}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
              <CoinIcon size={24} />
              <span style={{ color: '#f0c040', fontWeight: 700, fontSize: 20 }}>{fmt(RARITY_PRICE[pendingCard.rarity])}</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmBuy(null)} style={{ flex: 1, padding: '9px 0', border: '1px solid #334', background: 'transparent', color: '#778', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button onClick={() => handleBuy(pendingCard)} style={{ flex: 2, padding: '9px 0', border: 'none', background: `linear-gradient(90deg,${RARITY_COLOR[pendingCard.rarity]}88,${RARITY_COLOR[pendingCard.rarity]})`, color: '#fff', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                Confirm Purchase
              </button>
            </div>
          </div>
        </>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ ...TOAST_BOX, borderColor: toast.color, color: toast.color }}>{toast.msg}</div>
      )}
    </div>
  );
}

// ─── SI pips sub-component ────────────────────────────────────────────────────
function SiPips({ si, color, glow = false }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          width: 18, height: 5, borderRadius: 2,
          background: i <= si ? color : '#1a2a40',
          boxShadow: glow && i === si ? `0 0 6px ${color}` : 'none',
          transition: 'background 0.2s',
        }} />
      ))}
    </div>
  );
}

// ─── Static styles ────────────────────────────────────────────────────────────
const ROOT       = { width: '100%', height: '100vh', background: '#0d1220', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI',sans-serif", userSelect: 'none', overflow: 'hidden' };
const TOP_BAR    = { display: 'flex', alignItems: 'center', gap: 14, padding: '10px 20px', background: '#090e1a', borderBottom: '2px solid #ff8c00', flexShrink: 0 };
const COIN_BADGE = { display: 'flex', alignItems: 'center', gap: 6, background: '#0f1420', border: '2px solid #cc8800', borderRadius: 20, padding: '4px 14px 4px 8px' };
const GRID       = { flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, alignContent: 'start' };
const TOAST_BOX  = { position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', padding: '10px 28px', borderRadius: 8, background: '#090e1a', border: '2px solid', fontWeight: 700, fontSize: 15, zIndex: 999, pointerEvents: 'none', animation: 'cs-fadeUp 0.22s ease-out' };
const TAB_BTN    = (active) => ({ flex: 1, padding: '12px 0', cursor: 'pointer', border: 'none', background: active ? '#141f35' : 'transparent', color: active ? '#ff8c00' : '#445', fontWeight: 700, fontSize: 15, letterSpacing: 1, borderBottom: active ? '3px solid #ff8c00' : '3px solid transparent', transition: 'all 0.15s' });
const IMG_WRAP   = (color, size) => ({ width: size, height: size, borderRadius: 6, overflow: 'hidden', border: `2px solid ${color}`, background: '#0a1020', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 });

const CSS = `
  @keyframes cs-fadeUp  { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
  @keyframes cs-modalIn { from{opacity:0;transform:translate(-50%,-50%) scale(0.88)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
  ::-webkit-scrollbar{width:6px}
  ::-webkit-scrollbar-track{background:#0d1220}
  ::-webkit-scrollbar-thumb{background:#1a2a40;border-radius:3px}

  .cs-card {
    border: 2px solid #1a2a40;
    border-radius: 10px;
    padding: 14px 12px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: default;
    position: relative;
    will-change: transform;
    transition: transform 0.12s;
  }
  .cs-card::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 10px;
    border: 2px solid var(--hover-color);
    box-shadow: 0 0 18px color-mix(in srgb, var(--hover-color) 30%, transparent);
    opacity: 0;
    transition: opacity 0.15s;
    pointer-events: none;
  }

  .cs-card:hover { transform: translateY(-3px); }
  .cs-card:hover::after { opacity: 1; }
  .cs-back-btn{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.2);color:#ccc;font-size:14px;padding:7px 18px;border-radius:8px;cursor:pointer}
  .cs-back-btn:hover{background:rgba(255,255,255,0.13);color:#fff}
  .cs-buy-btn{border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:13px;padding:7px 0;width:100%;color:#fff;transition:filter 0.15s}
  .cs-buy-btn:hover:not(:disabled){filter:brightness(1.25)}
  .cs-buy-btn:disabled{opacity:0.35;cursor:not-allowed}
  .cs-fuse-btn{border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:13px;padding:7px 0;width:100%;background:linear-gradient(90deg,#4400aa,#aa44ff);color:#fff;transition:filter 0.15s}
  .cs-fuse-btn:hover:not(:disabled){filter:brightness(1.2)}
  .cs-fuse-btn:disabled{opacity:0.35;cursor:not-allowed}
  .cs-owned-badge{position:absolute;top:7px;right:9px;background:#0f1420;border:1px solid #334;border-radius:10px;padding:2px 8px;font-size:11px;color:#aaa;font-weight:700}
`;