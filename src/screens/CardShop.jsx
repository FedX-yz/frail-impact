// Shop → "Requisitions": the Frail Initiative's supply office.
// REQUISITION: a catalog form. REQUEST a card → a requisition slip comes up on the
// side; sign & submit it (your signature from the job application goes on it),
// it gets an APPROVED stamp and the coins are spent.
// PROMOTIONS: fusion. Spare copies raise a card's superimposition (S1→S5).
import { useState, useCallback, useRef, useMemo } from 'react';
import { CHARACTERS } from '../data/characters';
import { playClose, playPress, playStamp } from '../utils/sfx';
import { thumb } from '../utils/assets';
import { upgradeSubs, formatSub, setOfCard } from '../combat/sets';
import { siMult, SI_MULT, SI_MULT_HIGH } from '../combat/stats';
import { skillKitFor, ultKitFor, describeSiStep, ULT_CD_PER_SI } from '../combat/kits';
import useIsMobile from '../hooks/useIsMobile';
import TermTitle from '../components/TermTitle';

const BASE = import.meta.env.BASE_URL;

// ─── Config ──────────────────────────────────────────────────────────────────
const RARITY_PRICE = { 5: 75000, 4: 7500, 3: 1200 };
const RC = { 6: '#ff4d6d', 5: '#e0a800', 4: '#9b5de5', 3: '#3a7bd5' };
const KIND = r => (r >= 5 ? 'agent' : 'evidence');

const siLabel = (si, rarity) => si === 0 ? 'S1 · base'
  : `S${si + 1} · +${Math.round((siMult(si, rarity) - 1) * 100)}% ATK/HP/DEF${si === 4 ? ' · MAX' : ''}`;

// 6★ and cards held back (unpullable) aren't in the catalog
const SHOP_CARDS = CHARACTERS
  .filter(c => RARITY_PRICE[c.rarity] && !c.unpullable)
  .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));

const fmt = n =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' :
  n >= 1000 ? (n / 1000).toFixed(1) + 'k' :
  Math.floor(n);

const CoinIcon = ({ size = 30 }) => (
  <img src={`${BASE}ui/ui_cucoin.png`} alt="coin"
    style={{ width: size, height: size, objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0, verticalAlign: 'middle' }} />
);

// ─────────────────────────────────────────────────────────────────────────────
export default function CardShop({ navigate, coins, setCoins, collection, setCollection, gachaCollection = [], profile = null }) {
  const { mobile } = useIsMobile();
  const [tab, setTab]       = useState('req');
  const [filter, setFilter] = useState(0);         // 0 = all, else rarity
  const [slip, setSlip]     = useState(null);      // { card, status: 'pending' | 'approved', no }
  const [toast, setToast]   = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, color = '#ffb35a') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, color });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const getCardCounts = useCallback((cardId) => {
    const shopCount = collection[cardId]?.count ?? 0;
    const gachaCount = (gachaCollection || []).filter(g => g.id === cardId).length;
    return shopCount + gachaCount;
  }, [collection, gachaCollection]);

  // slip numbers go up with every card the office has handed out
  const slipNo = useMemo(() => 400 + Object.values(collection).reduce((n, e) => n + (e.count ?? 0), 0), [collection]);

  // ── REQUEST (buy) ──────────────────────────────────────────────────────────
  const request = (card) => {
    playPress();
    if ((collection[card.id]?.si ?? 0) >= 4) return;
    setSlip({ card, status: 'pending', no: slipNo + 1 });
  };

  const handleBuy = useCallback((card) => {
    const price = RARITY_PRICE[card.rarity];
    if (!price) return;
    if (coins < price) { showToast('Denied: not enough coins', '#ff5555'); return; }
    setCoins(c => c - price);
    setCollection(prev => {
      const entry = prev[card.id] ?? { count: 0, si: 0 };
      return { ...prev, [card.id]: { ...entry, count: entry.count + 1 } };
    });
    playStamp();
    setSlip(s => (s ? { ...s, status: 'approved' } : s));
  }, [coins, setCoins, setCollection, showToast]);

  // ── PROMOTE (fuse) ─────────────────────────────────────────────────────────
  const handleFuse = useCallback((card) => {
    const totalCount = getCardCounts(card.id);
    const si = collection[card.id]?.si ?? 0;
    if (si >= 4) { showToast('Already at S5 · MAX', '#ff8c00'); return; }
    // S(n+1) needs n+1 copies in total. Copies aren't used up; the requirement just goes up.
    if (totalCount < si + 2) {
      const need = si + 2 - totalCount;
      showToast(`Need ${need} more cop${need === 1 ? 'y' : 'ies'}`, '#ff5555');
      return;
    }
    setCollection(prev => {
      const cur = prev[card.id] ?? { count: 0, si: 0 };
      // 3★/4★: each promotion also upgrades one sub-stat
      const subs = card.rarity <= 4 ? upgradeSubs(cur.subs, card.rarity) : cur.subs;
      return { ...prev, [card.id]: { ...cur, si: (cur.si ?? 0) + 1, ...(subs ? { subs } : {}) } };
    });
    playStamp(0.8);
    showToast(`PROMOTED · ${card.name} → ${siLabel(si + 1, card.rarity)}`, RC[card.rarity]);
  }, [collection, setCollection, showToast, getCardCounts]);

  const ownedCards = useMemo(() => CHARACTERS
    .filter(c => getCardCounts(c.id) >= 1)
    .sort((a, b) => {
      const ready = c => { const si = collection[c.id]?.si ?? 0; return si < 4 && getCardCounts(c.id) >= si + 2 ? 1 : 0; };
      return ready(b) - ready(a) || b.rarity - a.rarity || a.name.localeCompare(b.name);
    }), [collection, getCardCounts]);
  const readyCount = ownedCards.filter(c => { const si = collection[c.id]?.si ?? 0; return si < 4 && getCardCounts(c.id) >= si + 2; }).length;

  const catalog = SHOP_CARDS.filter(c => !filter || c.rarity === filter);
  const managerName = profile?.name || 'Field Manager';

  const slipView = slip && (
    <Slip slip={slip} coins={coins} managerName={managerName} signature={profile?.signature}
      onSubmit={() => handleBuy(slip.card)} onClose={() => { playClose(); setSlip(null); }} />
  );

  return (
    <div className="rq-root">
      <style>{CSS}</style>

      {/* TOP BAR */}
      <div className="rq-top">
        <button className="rq-btn" onPointerDown={playClose} onClick={() => navigate('main')}>[&nbsp;back&nbsp;]</button>
        {!mobile && <TermTitle path={tab === 'req' ? 'REQUISITIONS' : 'REQUISITIONS\\PROMOTIONS'} />}
        <div className="rq-coins"><CoinIcon size={22} /><span>{fmt(coins)}</span></div>
        <div style={{ flex: 1 }} />
        <button className={`rq-tab${tab === 'req' ? ' on' : ''}`} onClick={() => { playPress(); setTab('req'); }}>{mobile ? 'FORMS' : 'REQUISITION'}</button>
        <button className={`rq-tab${tab === 'promo' ? ' on' : ''}`} onClick={() => { playPress(); setTab('promo'); setSlip(null); }}>
          {mobile ? 'PROMO' : 'PROMOTIONS'}{readyCount > 0 && <b className="rq-dot">{readyCount}</b>}
        </button>
      </div>

      {/* ── REQUISITION ─────────────────────────────────────────────────────── */}
      {tab === 'req' && (
        <div className="rq-body">
          <div className="rq-form">
            <div className="rq-formhd">
              <div className="rq-formtitle">FORM FI-07 · PERSONNEL &amp; EVIDENCE REQUISITION</div>
              <div className="rq-formsub">FRAIL INITIATIVE SUPPLY OFFICE · ALL REQUESTS SUBJECT TO BUDGET APPROVAL</div>
              <div className="rq-filters">
                {[[0, 'ALL'], [5, '5★ AGENTS'], [4, '4★ EVIDENCE'], [3, '3★ EVIDENCE']].map(([r, l]) => (
                  <button key={r} className={filter === r ? 'on' : ''} onClick={() => setFilter(r)}>{filter === r ? '☒' : '☐'} {l}</button>
                ))}
              </div>
            </div>
            <div className="rq-lines">
              {catalog.map((card, i) => {
                const price = RARITY_PRICE[card.rarity];
                const owned = getCardCounts(card.id);
                const si = collection[card.id]?.si ?? 0;
                const maxed = si >= 4;
                const set = setOfCard(card.id);
                return (
                  <div key={card.id} className={`rq-line${slip?.card.id === card.id ? ' sel' : ''}`}>
                    <span className="rq-no">{String(i + 1).padStart(3, '0')}</span>
                    <span className="rq-thumb" style={{ borderColor: RC[card.rarity] }}>
                      {card.image ? <img src={thumb(card.image)} alt="" loading="lazy" decoding="async" /> : null}
                    </span>
                    <span className="rq-item">
                      <span className="rq-name">{card.name}
                        {owned > 0 && <span className="rq-onfile">ON FILE ×{owned}</span>}
                      </span>
                      <span className="rq-desc">{card.subtitle ? `${card.subtitle} · ` : ''}{card.rarity}★ {KIND(card.rarity)}{card.element ? ` · ${card.element}` : ''}{set ? ` · ${set.name} set` : ''}{owned > 0 ? ` · S${si + 1}` : ''}</span>
                    </span>
                    <span className={`rq-price${coins < price ? ' poor' : ''}`}><CoinIcon size={14} /> {price.toLocaleString()}</span>
                    <button className="rq-request" disabled={maxed} onClick={() => request(card)}>{maxed ? 'MAX S5' : 'REQUEST'}</button>
                  </div>
                );
              })}
            </div>
          </div>

          {!mobile && (
            <div className="rq-side">
              {slipView || (
                <div className="rq-hint">
                  <div className="rq-hinthd">HOW IT WORKS</div>
                  Pick a line and press REQUEST. Sign the slip and the supply office sends the agent or the evidence over.<br /><br />
                  Spare copies can be used in <b>PROMOTIONS</b> to raise a card's rank (superimposition).
                  {readyCount > 0 && <div className="rq-ready">▸ {readyCount} promotion{readyCount === 1 ? '' : 's'} ready</div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PROMOTIONS ──────────────────────────────────────────────────────── */}
      {tab === 'promo' && (
        <div className="rq-promo">
          <div className="rq-board">
            <div className="rq-boardhd">PROMOTIONS · spare copies raise a card's rank (S1 → S5). Each rank boosts ATK/HP/DEF · 5★/6★ also power up their skill &amp; ult · 3★/4★ upgrade a sub-stat.</div>
            {ownedCards.length === 0 ? (
              <div className="rq-none">No cards on file yet. Request some, or recruit.</div>
            ) : ownedCards.map(card => {
              const entry = collection[card.id] ?? { count: 0, si: 0 };
              const count = getCardCounts(card.id);
              const si = entry.si ?? 0;
              const maxed = si >= 4;
              const need = si + 2;
              const canFuse = !maxed && count >= need;
              const mult = siMult(si, card.rarity);
              const nextMult = !maxed ? siMult(si + 1, card.rarity) : null;
              const skillKit = skillKitFor(card.skill?.effect);
              const ultKit = ultKitFor(card.ult?.effect);
              return (
                <div key={card.id} className={`rq-prow${canFuse ? ' ready' : ''}`}>
                  <span className="rq-pthumb" style={{ borderColor: RC[card.rarity] }}>
                    {card.image && <img src={thumb(card.image)} alt="" loading="lazy" decoding="async" />}
                    <i>×{count}</i>
                  </span>
                  <div className="rq-pinfo">
                    <div className="rq-ptitle">{card.name.toUpperCase()} · {maxed ? 'S5 · MAX' : `S${si + 1} → S${si + 2}`}</div>
                    <div className="rq-pnow">ATK {Math.round(card.stats.atk * mult)} · HP {Math.round(card.stats.hp * mult)} · DEF {Math.round(card.stats.def * mult)}
                      {nextMult && <span> → ATK {Math.round(card.stats.atk * nextMult)} · HP {Math.round(card.stats.hp * nextMult)}{card.rarity <= 4 ? ' + a sub-stat upgrade' : ''}</span>}
                    </div>
                    {nextMult && skillKit && <div className="rq-pkit">✦ {card.skill.name}: {describeSiStep(skillKit, si)}</div>}
                    {nextMult && ultKit && <div className="rq-pkit">⚡ {card.ult.name}: {describeSiStep(ultKit, si) || 'stronger'}, cooldown −{Math.round(ULT_CD_PER_SI * 100)}%</div>}
                    {(entry.subs ?? []).length > 0 && (
                      <div className="rq-psubs">{entry.subs.map((sb, i) => <span key={i}>{formatSub(sb)}{sb.ups ? <b> {'▲'.repeat(sb.ups)}</b> : null}</span>)}</div>
                    )}
                    {!maxed && <div className="rq-bar"><span style={{ width: `${Math.min(100, (count / need) * 100)}%` }} /></div>}
                    <div className={`rq-pstat${canFuse ? ' ok' : ''}`}>{maxed ? 'fully promoted' : `${Math.min(count, need)} / ${need} copies${canFuse ? ' · READY' : ''}`}</div>
                  </div>
                  <button className="rq-promote" disabled={!canFuse} onClick={() => handleFuse(card)}>
                    {maxed ? 'MAX' : canFuse ? `PROMOTE ▸ S${si + 2}` : `NEED ×${need}`}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="rq-ref">
            <div className="rq-hinthd">RANK TABLE (SUPERIMPOSITION)</div>
            {SI_MULT.map((m, i) => (
              <div key={i} className="rq-refrow">
                <b>S{i + 1}</b>
                <span>3★/4★ +{Math.round((m - 1) * 100)}% · 5★/6★ +{Math.round((SI_MULT_HIGH[i] - 1) * 100)}%{i > 0 ? ' + stronger kit' : ''}</span>
                <i>{i === 0 ? '1 copy' : `${i + 1} copies`}</i>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* phone: the slip comes up over the form */}
      {mobile && slipView && (
        <div className="rq-sheet" onClick={() => { if (slip.status === 'approved') setSlip(null); }}>
          <div onClick={e => e.stopPropagation()}>{slipView}</div>
        </div>
      )}

      {toast && <div className="rq-toast" style={{ borderColor: toast.color, color: toast.color }}>{toast.msg}</div>}
    </div>
  );
}

// ─── The requisition slip ─────────────────────────────────────────────────────
function Slip({ slip, coins, managerName, signature, onSubmit, onClose }) {
  const { card, status, no } = slip;
  const price = RARITY_PRICE[card.rarity];
  const approved = status === 'approved';
  const short = !approved && coins < price;
  return (
    <div className="rq-slip" key={`${card.id}-${no}`}>
      <div className="rq-sliphd">REQUISITION SLIP Nº {String(no).padStart(5, '0')}</div>
      <div className="rq-sliprow"><i>ITEM</i><span>{card.rarity >= 5 ? 'Agent transfer' : 'Evidence'} · {card.name} ({card.rarity}★)</span></div>
      <div className="rq-sliprow"><i>COST</i><span>{price.toLocaleString()} coins</span></div>
      <div className="rq-sliprow"><i>REQUESTED BY</i><span>Field Manager {managerName}</span></div>
      <div className="rq-sign">
        <i>SIGNED</i>
        {approved
          ? (signature ? <img src={signature} alt="signature" /> : <span className="rq-signtext">{managerName}</span>)
          : <span className="rq-signline" />}
      </div>
      {approved && <span className="rq-approved">APPROVED</span>}
      {short && <span className="rq-approved denied">INSUFFICIENT FUNDS</span>}
      <div className="rq-slipbtns">
        {approved
          ? <button className="rq-btn dark" onClick={onClose}>[&nbsp;file it&nbsp;]</button>
          : <>
              <button className="rq-btn dark" onClick={onClose}>[&nbsp;cancel&nbsp;]</button>
              <button className="rq-submit" disabled={short} onClick={onSubmit}>SIGN &amp; SUBMIT</button>
            </>}
      </div>
    </div>
  );
}

const CSS = `
  .rq-root { width:100%; height:100dvh; display:flex; flex-direction:column; overflow:hidden; background:var(--desk); color:var(--amber); font-family:var(--font-ui); user-select:none; }
  .rq-top { display:flex; align-items:center; gap:12px; padding:8px 14px; background:var(--bar); border-bottom:2px solid #ff8c00; flex-shrink:0; }
  .rq-btn { background:transparent; border:1px solid var(--amber-dim); color:var(--amber); font-size:13px; padding:5px 12px; font-family:inherit; cursor:pointer; white-space:nowrap; }
  .rq-btn.dark { border-color:#5a4a33; color:#3a2d1c; }
  .rq-coins { display:flex; align-items:center; gap:6px; border:1px solid var(--amber-dim); padding:2px 10px 2px 6px; font-size:14px; }
  .rq-tab { position:relative; background:transparent; border:1px solid var(--amber-dim); color:var(--amber-dim); font-family:inherit; font-size:13px; padding:6px 14px; cursor:pointer; white-space:nowrap; }
  .rq-tab.on { background:#ff9a2e; color:#1a0d02; border-color:#ff9a2e; text-shadow:none; }
  .rq-dot { position:absolute; top:-8px; right:-8px; background:#6ef59b; color:#062010; font-size:10px; min-width:16px; height:16px; line-height:16px; padding:0 3px; text-shadow:none; }
  .rq-body { flex:1; min-height:0; display:flex; gap:26px; padding:18px 22px; }
  /* the form */
  .rq-form { flex:1; min-width:0; display:flex; flex-direction:column; color:#211a12; text-shadow:none; transform:rotate(-.4deg); box-shadow:0 18px 40px rgba(0,0,0,.75);
    background:repeating-linear-gradient(0deg,rgba(120,95,60,.07) 0 1px,transparent 1px 4px), #e9dfc6; }
  .rq-formhd { padding:16px 22px 8px; border-bottom:2px solid #211a12; margin:0 0 0; flex-shrink:0; }
  .rq-formtitle { font-size:clamp(15px,1.9vw,22px); letter-spacing:2px; }
  .rq-formsub { font-size:9.5px; letter-spacing:1.5px; color:#6f6150; margin-top:2px; }
  .rq-filters { display:flex; flex-wrap:wrap; gap:4px 14px; margin-top:8px; }
  .rq-filters button { background:none; border:none; padding:0; font-family:inherit; font-size:12px; color:#6f6150; cursor:pointer; }
  .rq-filters button.on { color:#211a12; }
  .rq-lines { flex:1; overflow-y:auto; padding:4px 22px 16px; }
  .rq-line { display:flex; align-items:center; gap:14px; padding:9px 4px; border-bottom:1px dashed rgba(40,30,20,.35); }
  .rq-line.sel { background:rgba(255,190,90,.25); }
  .rq-no { font-size:11px; color:#6f6150; width:26px; flex-shrink:0; }
  .rq-thumb { width:52px; height:52px; flex-shrink:0; border:2px solid; outline:1px solid #211a12; background:#222; overflow:hidden; }
  .rq-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
  .rq-item { flex:1; min-width:0; display:flex; flex-direction:column; }
  .rq-name { font-size:15px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .rq-onfile { font-size:10.5px; letter-spacing:1px; color:#1f4fa8; border:2px solid #1f4fa8; padding:0 5px; transform:rotate(-4deg); opacity:.85; mix-blend-mode:multiply; }
  .rq-desc { font-size:11px; color:#6f6150; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .rq-price { font-size:14px; white-space:nowrap; display:flex; align-items:center; gap:4px; }
  .rq-price.poor { color:#a8321f; }
  .rq-request { font-family:inherit; font-size:12.5px; letter-spacing:1px; padding:6px 14px; background:#f6f0e0; color:#211a12; border:1.5px solid #211a12; box-shadow:3px 3px 0 #211a12; cursor:pointer; white-space:nowrap; }
  .rq-request:active:not(:disabled) { transform:translate(2px,2px); box-shadow:1px 1px 0 #211a12; }
  .rq-request:disabled { opacity:.4; cursor:default; }
  /* side */
  .rq-side { width:min(420px,36vw); flex-shrink:0; overflow-y:auto; padding:6px 4px; }
  .rq-hint { border:1px solid var(--amber-dim); background:rgba(0,0,0,.25); padding:14px 16px; font-size:12.5px; line-height:1.5; color:var(--amber); }
  .rq-hint b { font-weight:400; color:#ffd08a; }
  .rq-hinthd { font-size:11px; letter-spacing:2px; color:var(--amber-dim); border-bottom:1px solid var(--line); padding-bottom:4px; margin-bottom:8px; }
  .rq-ready { margin-top:12px; color:#6ef59b; }
  /* slip */
  .rq-slip { position:relative; color:#211a12; text-shadow:none; padding:16px 20px 30px; transform:rotate(1.2deg); box-shadow:0 14px 30px rgba(0,0,0,.7); animation:rqSlip .3s cubic-bezier(.2,.9,.25,1.05) both;
    background:repeating-linear-gradient(0deg,rgba(120,95,60,.06) 0 1px,transparent 1px 4px), #f3ecda;
    clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),96% 100%,92% calc(100% - 8px),87% 100%,82% calc(100% - 9px),77% 100%,71% calc(100% - 8px),65% 100%,59% calc(100% - 9px),53% 100%,47% calc(100% - 8px),41% 100%,35% calc(100% - 9px),29% 100%,23% calc(100% - 8px),17% 100%,11% calc(100% - 9px),5% 100%,0 calc(100% - 8px)); }
  .rq-sliphd { font-size:17px; letter-spacing:2px; border-bottom:2px solid #211a12; padding-bottom:4px; margin-bottom:8px; }
  .rq-sliprow { display:flex; gap:10px; padding:4px 0; font-size:13px; border-bottom:1px dotted rgba(40,30,20,.3); }
  .rq-sliprow i, .rq-sign i { font-style:normal; font-size:9.5px; letter-spacing:1.5px; color:#6f6150; width:100px; flex-shrink:0; padding-top:2px; }
  .rq-sign { display:flex; align-items:flex-end; gap:10px; margin-top:12px; min-height:58px; }
  .rq-sign img { height:58px; max-width:220px; object-fit:contain; animation:rqInk .5s ease-out both; }
  .rq-signtext { font-family:var(--font-hand); font-size:30px; color:#22306e; animation:rqInk .5s ease-out both; }
  .rq-signline { flex:1; border-bottom:1.5px solid #211a12; height:40px; }
  .rq-approved { position:absolute; right:14px; top:58px; font-family:var(--font-hit); font-size:34px; color:#2f6b3a; border:5px solid currentColor; padding:0 10px; border-radius:6px !important;
    transform:rotate(-14deg); opacity:.85; mix-blend-mode:multiply; pointer-events:none; animation:rqStamp .32s cubic-bezier(.3,1.4,.5,1) both; }
  .rq-approved.denied { color:#a8321f; font-size:20px; top:70px; }
  .rq-slipbtns { display:flex; gap:10px; justify-content:flex-end; margin-top:14px; }
  .rq-submit { font-family:inherit; font-size:13px; letter-spacing:1px; padding:6px 16px; background:#211a12; color:#f3ecda; border:none; cursor:pointer; }
  .rq-submit:disabled { opacity:.35; cursor:default; }
  /* promotions */
  .rq-promo { flex:1; min-height:0; overflow-y:auto; display:flex; gap:22px; padding:18px 22px; align-items:flex-start; }
  .rq-board { flex:1; min-width:0; border:1px solid #ff9a2e; background:rgba(0,0,0,.3); padding:14px 18px; }
  .rq-boardhd { font-size:11.5px; letter-spacing:1px; color:var(--amber-dim); border-bottom:1px solid var(--line); padding-bottom:8px; margin-bottom:6px; line-height:1.4; }
  .rq-none { padding:40px 0; text-align:center; color:var(--amber-dim); }
  .rq-prow { display:flex; align-items:center; gap:14px; padding:12px 0; border-bottom:1px solid rgba(90,51,19,.6); }
  .rq-pthumb { position:relative; width:64px; height:64px; flex-shrink:0; border:2px solid; background:#111; }
  .rq-pthumb img { width:100%; height:100%; object-fit:cover; display:block; }
  .rq-pthumb i { position:absolute; right:-6px; bottom:-6px; font-style:normal; font-size:11px; background:var(--bar); border:1px solid var(--amber-dim); padding:0 4px; }
  .rq-pinfo { flex:1; min-width:0; }
  .rq-ptitle { font-size:15px; color:#ffcf8a; }
  .rq-pnow { font-size:11.5px; color:var(--amber-dim); margin-top:2px; }
  .rq-pnow span { color:var(--amber); }
  .rq-pkit { font-size:11.5px; color:var(--amber); margin-top:2px; }
  .rq-psubs { display:flex; flex-wrap:wrap; gap:2px 12px; font-size:11px; color:#9cc4ff; margin-top:3px; }
  .rq-psubs b { font-weight:400; color:#ffd08a; }
  .rq-bar { height:9px; border:1px solid var(--amber-dim); margin-top:6px; max-width:420px; }
  .rq-bar span { display:block; height:100%; background:#ff9a2e; box-shadow:0 0 8px #ff8c00; }
  .rq-pstat { font-size:11px; color:var(--amber-dim); margin-top:3px; }
  .rq-pstat.ok { color:#6ef59b; }
  .rq-promote { font-family:inherit; font-size:12.5px; padding:7px 12px; background:transparent; color:var(--amber-dim); border:1px solid var(--amber-dim); cursor:pointer; white-space:nowrap; }
  .rq-prow.ready .rq-promote { background:#ff9a2e; border-color:#ff9a2e; color:#1a0d02; text-shadow:none; }
  .rq-promote:disabled { cursor:default; opacity:.6; }
  .rq-ref { width:320px; flex-shrink:0; border:1px solid var(--amber-dim); background:rgba(0,0,0,.25); padding:14px 16px; position:sticky; top:0; }
  .rq-refrow { display:flex; gap:10px; align-items:baseline; font-size:11.5px; padding:5px 0; border-bottom:1px solid rgba(90,51,19,.5); }
  .rq-refrow b { font-weight:400; color:#ffcf8a; width:24px; }
  .rq-refrow span { flex:1; color:var(--amber); }
  .rq-refrow i { font-style:normal; color:var(--amber-dim); white-space:nowrap; }
  /* phone */
  .rq-sheet { position:fixed; inset:0; z-index:60; background:rgba(5,3,2,.85); display:flex; align-items:center; justify-content:center; padding:14px; }
  .rq-sheet > div { width:min(420px,100%); }
  .rq-toast { position:fixed; bottom:28px; left:50%; transform:translateX(-50%); padding:9px 22px; background:var(--bar); border:1px solid; font-size:14px; z-index:999; pointer-events:none; white-space:nowrap; animation:rqUp .22s ease-out; }
  @media (max-width: 700px) {
    .rq-body { padding:10px 8px; }
    .rq-form { transform:none; }
    .rq-formhd { padding:12px 12px 6px; }
    .rq-lines { padding:2px 10px 12px; }
    .rq-line { gap:9px; flex-wrap:wrap; }
    .rq-no { display:none; }
    .rq-thumb { width:44px; height:44px; }
    .rq-item { flex-basis:calc(100% - 60px); }
    .rq-price { margin-left:53px; flex:1; }
    .rq-tab { padding:6px 8px; font-size:11.5px; }
    .rq-promo { flex-direction:column; padding:10px 8px; align-items:stretch; }
    .rq-board { padding:10px; }
    .rq-prow { flex-wrap:wrap; }
    .rq-promote { width:100%; }
    .rq-ref { width:auto; position:static; }
  }
  @keyframes rqSlip  { from { opacity:0; transform:translateY(-30px) rotate(-4deg); } to { opacity:1; transform:rotate(1.2deg); } }
  @keyframes rqStamp { from { opacity:0; transform:rotate(-14deg) scale(2.4); } to { opacity:.85; transform:rotate(-14deg) scale(1); } }
  @keyframes rqInk   { from { clip-path:inset(0 100% 0 0); } to { clip-path:inset(0 0 0 0); } }
  @keyframes rqUp    { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%); } }
`;
