import { useState } from 'react';
import { playClose } from '../utils/sfx';
import { thumb } from '../utils/assets';
import { CHARACTERS } from '../data/characters';
import { CARD_SETS, setOfCard, formatSub } from '../combat/sets';
import { cardBattleStats } from '../combat/stats';
import { BAL } from '../combat/balance';
import useIsMobile from '../hooks/useIsMobile';
import TermTitle from '../components/TermTitle';

const rc     = (r) => ({ 6:'#ff4444', 5:'#f0c040', 4:'#a855f7', 3:'#60a5fa' }[r] || '#888');
const rLabel = (r) => ({ 6:'6★', 5:'5★', 4:'4★', 3:'3★' }[r] || '?');

const SLOT_KEYS  = ['main', 'sup0', 'sup1', 'sup2', 'sup3'];
const SLOT_LABEL = { main:'Main Card (5★/6★ only)', sup0:'Support 1', sup1:'Support 2', sup2:'Support 3', sup3:'Support 4' };

export default function DeckScreen({ navigate, collection, deck, setDeck, cardInventory, stats }) {
  const [activeSlot,  setActiveSlot]  = useState(null);
  const [filter,      setFilter]      = useState('all');
  const [sortBy,      setSortBy]      = useState(() => { try { return localStorage.getItem('frail_deck_sort') || 'rarity'; } catch { return 'rarity'; } });
  const chooseSort = (v) => { setSortBy(v); try { localStorage.setItem('frail_deck_sort', v); } catch { /* ignore */ } };
  const { mobile } = useIsMobile();
  
  const supports = deck?.supports || [null, null, null, null];

  const getSlotCard = (slot) => {
    if (slot === 'main') return deck?.main;
    const idx = parseInt(slot.replace('sup', ''));
    return supports[idx] ?? null;
  };

  const equip = (card) => {
    if (!activeSlot) return;
    if (alreadyEquipped(card)) return; // block same card in two slots
    if (activeSlot === 'main') {
      if (card.rarity < 5) return;
      setDeck(d => ({ ...d, main: card }));
    } else {
      const idx = parseInt(activeSlot.replace('sup', ''));
      setDeck(d => {
        const s = [...(d.supports || [null, null, null, null])];
        s[idx] = card;
        return { ...d, supports: s };
      });
    }
    setActiveSlot(null);
  };

  const unequip = (slot) => {
    if (slot === 'main') {
      setDeck(d => ({ ...d, main: null }));
    } else {
      const idx = parseInt(slot.replace('sup', ''));
      setDeck(d => {
        const s = [...(d.supports || [null, null, null, null])];
        s[idx] = null;
        return { ...d, supports: s };
      });
    }
    if (activeSlot === slot) setActiveSlot(null);
  };

  // Check by card.id so the same card can't fill two slots
const alreadyEquipped = (card) => {
  if (deck?.main?.id === card.id) return true;
  return supports.some(s => s?.id === card.id);
};

// Count copies per card.id
// Count copies per card.id (from both gacha AND shop)
const cardCounts = {};

// Count from gacha collection
collection.forEach(c => { 
  cardCounts[c.id] = (cardCounts[c.id] || 0) + 1; 
});

// Add shop inventory counts
Object.entries(cardInventory || {}).forEach(([cardId, entry]) => {
  cardCounts[cardId] = (cardCounts[cardId] || 0) + (entry.count || 0);
});

// Every owned card, from the gacha OR the shop. (Shop-bought cards
// used to be missing here, so you couldn't equip them.)
const pool = CHARACTERS
  .filter(c => (cardCounts[c.id] || 0) > 0)
  .filter(c => {
    if (activeSlot === 'main') return c.rarity >= 5;
    return true;
  })
  .filter(c => filter === 'all' || c.rarity === Number(filter))
  .sort((a, b) => b.rarity - a.rarity);

  // Group the picker by set: one section per set you own cards from, then the rest
  const groups = sortBy === 'set'
    ? [
        ...CARD_SETS.map(set => ({ set, cards: pool.filter(c => set.members.includes(c.id)) })).filter(g => g.cards.length),
        { set: null, cards: pool.filter(c => !setOfCard(c.id)) },
      ].filter(g => g.cards.length)
    : [{ set: null, cards: pool }];

  // Set progress: how many members of each set are in the support slots
  const supportIds = new Set(supports.filter(Boolean).map(c => c.id));
  const setProgress = CARD_SETS
    .map(set => ({ set, have: set.members.filter(m => supportIds.has(m)).length }))
    .filter(x => x.have > 0);

  return (
    <div style={{ width:'100%', height:'100dvh', background:'var(--desk)', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:'var(--font-ui)', color:'#fff' }}>

      <style>{`
        img { -webkit-user-drag:none; user-select:none; }
        .slot-card { transition:all 0.15s; cursor:pointer; }
        .slot-card:hover { filter:brightness(1.1); }
        .card-tile { transition:transform 0.12s; cursor:pointer; }
        .card-tile:hover { transform:translateY(-3px) scale(1.03); }
        .filter-btn { background:var(--panel-deep);border:2px solid var(--line);color:#667;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;transition:all 0.12s; }
        .filter-btn.on { border-color:#ff8c00;color:#ff8c00;background:rgba(255,140,0,0.1); }
      `}</style>

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 18px', background:'var(--bar)', borderBottom:'2px solid #ff8c00', flexShrink:0 }}>
      <button onPointerDown={playClose} onClick={() => navigate('main')} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.2)', color:'#ccc', fontSize:14, padding:'7px 18px', borderRadius:8, cursor:'pointer' }}>[&nbsp;back&nbsp;]</button>
        <TermTitle path="DECK" />
        {!mobile && <div style={{ color:'#445', fontSize:12, marginLeft:4 }}>main must be 5★ or 6★ · 3 of a set in supports = set bonus</div>}
        <div style={{ flex:1 }} />
        <div style={{ color:'#445', fontSize:13, whiteSpace:'nowrap' }}>{CHARACTERS.filter(c => cardCounts[c.id] > 0).length}{mobile ? '' : ' unique'} cards</div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection: mobile ? 'column' : 'row', overflow:'hidden' }}>

        {/* LEFT — slots */}
        <div style={mobile
          ? { maxHeight:'46dvh', flexShrink:0, borderBottom:'1px solid #2a3050', display:'flex', flexDirection:'column', padding:10, gap:6, overflowY:'auto' }
          : { width:290, flexShrink:0, borderRight:'1px solid #2a3050', display:'flex', flexDirection:'column', padding:14, gap:8, overflowY:'auto' }}>
          <div style={{ color:'#445', fontSize:11, letterSpacing:3, marginBottom:4 }}>EQUIPPED</div>

          {SLOT_KEYS.map(slotKey => {
  const card     = getSlotCard(slotKey);
  const isActive = activeSlot === slotKey;
  const isMain   = slotKey === 'main';
  const accent   = isMain ? '#f0c040' : '#5588ff';
  const si       = card ? (cardInventory[card.id]?.si ?? 0) : 0;
  const bs       = card ? cardBattleStats(card, cardInventory[card.id]) : null;
  const lvl      = card ? (cardInventory[card.id]?.level ?? 1) : 1;

  return (
    <div key={slotKey} className="slot-card"
      onClick={() => setActiveSlot(isActive ? null : slotKey)}
      style={{
        background: isActive ? 'rgba(255,140,0,0.15)' : 'rgba(0,0,0,0.3)',
        border: `2px solid ${isActive ? '#ff8c00' : card ? rc(card.rarity)+'88' : accent+'44'}`,
        borderRadius:10, padding:'10px 12px',
        display:'flex', alignItems:'center', gap:10,
        boxShadow: isActive ? '0 0 16px rgba(255,140,0,0.3)' : 'none',
      }}
    >
      {/* Avatar */}
      <div style={{ width: isMain ? 56 : 44, height: isMain ? 56 : 44, flexShrink:0, borderRadius:6, overflow:'hidden', background:'var(--panel-deep)', border:`1px solid ${card ? rc(card.rarity)+'55' : '#223'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {card
          ? <img src={thumb(card.characterImage || card.image)} alt={card.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { e.target.style.display='none'; }} />
          : <span style={{ color:'var(--line)', fontSize:20 }}>+</span>}
      </div>
      {/* Info */}
      <div style={{ minWidth:0, flex:1 }}>
        <div style={{ color:'rgba(255,255,255,0.35)', fontSize:10, marginBottom:2 }}>
          {isActive ? '⬅ pick a card' : SLOT_LABEL[slotKey]}
        </div>
        {card ? (
          <>
            <div style={{ color:rc(card.rarity), fontSize:13, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {rLabel(card.rarity)} {card.name}
            </div>
            {bs && (isMain ? (
              <div style={{ color:'rgba(255,255,255,0.45)', fontSize:11, marginTop:1 }}>
                {card.rarity >= 5 && <span style={{ color:'#4ade80' }}>LV{lvl} </span>}
                {si > 0 && <span style={{ color:'#f0c040' }}>S{si + 1} </span>}
                ATK {bs.atk} · HP {bs.hp} · DEF {bs.def}
              </div>
            ) : (
              <div style={{ color:'rgba(255,255,255,0.45)', fontSize:11, marginTop:1 }}>
                {si > 0 && <span style={{ color:'#f0c040' }}>S{si + 1} </span>}
                gives +{Math.round(bs.atk * BAL.SUPPORT_ATK)} ATK · +{Math.round(bs.hp * BAL.SUPPORT_HP)} HP · +{Math.round(bs.def * BAL.SUPPORT_DEF)} DEF
              </div>
            ))}
            {!isMain && (cardInventory[card.id]?.subs?.length > 0) && (
              <div style={{ color:'#88aaff', fontSize:10, marginTop:1 }}>{cardInventory[card.id].subs.map(formatSub).join(' · ')}</div>
            )}
            {!isMain && setOfCard(card.id) && (
              <div style={{ color:setOfCard(card.id).color, fontSize:10 }}>◆ {setOfCard(card.id).name}</div>
            )}
            {isMain && card.skill && (
              <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                ✦ {card.skill.name}{card.ult ? ` · ⚡ ${card.ult.name}` : ''}
              </div>
            )}
          </>
        ) : (
          <div style={{ color:'#445', fontSize:12 }}>Empty slot</div>
        )}
      </div>
      {card && (
        <button onClick={e => { e.stopPropagation(); unequip(slotKey); }}
          style={{ background:'rgba(255,50,50,0.2)', border:'1px solid rgba(255,50,50,0.4)', color:'#ff6666', borderRadius:6, padding:'3px 7px', cursor:'pointer', fontSize:13, flexShrink:0 }}>
          ✕
        </button>
      )}
    </div>
  );
})}

          {/* Set progress */}
          {setProgress.length > 0 && (
            <div style={{ background:'rgba(0,0,0,0.3)', border:'1px solid #2a3050', borderRadius:8, padding:'10px 12px' }}>
              <div style={{ color:'#445', fontSize:10, letterSpacing:2, marginBottom:6 }}>SETS</div>
              {setProgress.map(({ set, have }) => (
                <div key={set.id} style={{ marginBottom:5, opacity: have >= 3 ? 1 : 0.6 }}>
                  <div style={{ color:set.color, fontSize:12, fontWeight:700 }}>◆ {set.name} {have}/3 {have >= 3 && '✓'}</div>
                  <div style={{ color:'rgba(255,255,255,0.45)', fontSize:11 }}>{set.desc}</div>
                </div>
              ))}
            </div>
          )}

          {/* Battle stats: exactly what you get in a fight */}
          {stats && (
            <div style={{ background:'rgba(0,0,0,0.3)', border:'1px solid #2a3050', borderRadius:8, padding:'10px 12px' }}>
              <div style={{ color:'#445', fontSize:10, letterSpacing:2, marginBottom:6 }}>BATTLE STATS</div>
              <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', columnGap:10, rowGap:2, fontSize:12, fontVariantNumeric:'tabular-nums' }}>
                <span style={{ color:'#889' }}>ATK</span><span><b style={{ color:'#f0c040' }}>{stats.atk}</b> <span style={{ color:'#556', fontSize:11 }}>= damage per click</span></span>
                <span style={{ color:'#889' }}>HP</span><span><b style={{ color:'#4ade80' }}>{stats.maxHp}</b></span>
                <span style={{ color:'#889' }}>DEF</span><span><b style={{ color:'#88aaff' }}>{stats.def}</b> <span style={{ color:'#556', fontSize:11 }}>−{Math.round(stats.defReduction * 100)}% damage taken</span></span>
                <span style={{ color:'#889' }}>Auto</span><span>{Math.round(stats.autoDps)}/s</span>
                <span style={{ color:'#889' }}>Crit</span><span>{Math.round(stats.critRate * 100)}% · +{Math.round(stats.critDmg * 100)}% DMG</span>
                {stats.ult && <><span style={{ color:'#889' }}>Ult CD</span><span>{Math.round(stats.ult.cooldown)}s</span></>}
              </div>
              <div style={{ color:'#556', fontSize:10, marginTop:6, lineHeight:1.4 }}>
                Main card's stats + {Math.round(BAL.SUPPORT_ATK * 100)}% of supports' ATK and {Math.round(BAL.SUPPORT_HP * 100)}% of their HP/DEF
                {stats.trainLevel > 0 && <>, Train +{Math.round(stats.trainLevel * BAL.TRAIN_ATK * 100)}% ATK</>}
                {stats.parts.atkPct - stats.trainLevel * BAL.TRAIN_ATK > 0.001 && <>, sub-stats/sets +{Math.round((stats.parts.atkPct - stats.trainLevel * BAL.TRAIN_ATK) * 100)}% ATK</>}
                {stats.parts.dmgMult > 1.001 && <>, passives ×{stats.parts.dmgMult.toFixed(2)}</>}.
              </div>
              {[deck?.main, ...supports].filter(Boolean).filter(c => c.passive).map((c, i) => (
                <div key={i} style={{ marginTop:5 }}>
                  <span style={{ color:rc(c.rarity), fontSize:11, fontWeight:700 }}>{c.passive.name}</span>
                  <span style={{ color:'rgba(255,255,255,0.4)', fontSize:11 }}> — {c.passive.description}</span>
                </div>
              ))}
            </div>
          )}

          {/* Active slot hint */}
          {activeSlot && (
            <div style={{ background:'rgba(255,140,0,0.1)', border:'2px solid rgba(255,140,0,0.4)', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
              <div style={{ color:'#ff8c00', fontSize:13, fontWeight:700 }}>
                {activeSlot === 'main' ? 'Pick a 5★ or 6★ card' : 'Pick any card'}
              </div>
              <button onClick={() => setActiveSlot(null)} style={{ marginTop:6, background:'none', border:'1px solid #445', color:'#667', padding:'3px 12px', borderRadius:6, cursor:'pointer', fontSize:12 }}>cancel</button>
            </div>
          )}

          {pool.length === 0 && filter === 'all' && !activeSlot && (
            <div style={{ color:'#445', fontSize:12, textAlign:'center', marginTop:12 }}>
              No cards yet!
              <br />
              <button onClick={() => navigate('gacha')} style={{ marginTop:8, background:'none', border:'1px solid #445', color:'#778', padding:'5px 14px', borderRadius:4, cursor:'pointer', fontSize:12 }}>→ gacha</button>
            </div>
          )}
        </div>

        {/* RIGHT — card picker */}
        <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Filter bar */}
          <div style={{ display:'flex', gap:8, padding:'10px 14px', borderBottom:'1px solid #2a3050', flexShrink:0, flexWrap:'wrap', alignItems:'center' }}>
            {['all','6','5','4','3'].map(f => (
              <button key={f} className={`filter-btn${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : `${f}★`}
              </button>
            ))}
            <span style={{ width:1, height:20, background:'#2a3050', margin:'0 2px' }} />
            <button className={`filter-btn${sortBy === 'rarity' ? ' on' : ''}`} onClick={() => chooseSort('rarity')}>★ Rarity</button>
            <button className={`filter-btn${sortBy === 'set' ? ' on' : ''}`} onClick={() => chooseSort('set')}>◆ Sets</button>
            {activeSlot === 'main' && (
              <div style={{ color:'#f0c040', fontSize:11, marginLeft:4 }}>⚠ showing 5★/6★ only</div>
            )}
            <div style={{ flex:1 }} />
            <div style={{ color:'#445', fontSize:12 }}>{pool.length} cards</div>
          </div>

          {/* Grid */}
          <div style={{ flex:1, overflowY:'auto', padding:12 }}>
            {CHARACTERS.every(c => !cardCounts[c.id]) ? (
              <div style={{ textAlign:'center', color:'var(--line)', marginTop:60, fontSize:15 }}>No cards yet. Go pull!</div>
            ) : pool.length === 0 ? (
              <div style={{ textAlign:'center', color:'var(--line)', marginTop:60, fontSize:14 }}>
                {activeSlot === 'main' ? 'No 5★/6★ cards yet' : `No ${filter}★ cards`}
              </div>
            ) : (
              groups.map(({ set, cards }) => (
              <div key={set?.id ?? 'rest'} style={{ marginBottom: 14 }}>
                {sortBy === 'set' && (
                  <div style={{ display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap', margin:'2px 2px 8px', borderBottom:`1px solid ${set ? set.color + '55' : '#2a3050'}`, paddingBottom:4 }}>
                    <span style={{ color: set?.color ?? '#889', fontWeight:800, fontSize:13 }}>{set ? `◆ ${set.name}` : 'No set'}</span>
                    {set && <span style={{ color:'#667', fontSize:11 }}>{set.members.filter(m => cardCounts[m] > 0).length}/3 owned · {set.members.filter(m => supportIds.has(m)).length}/3 equipped</span>}
                    {set && <span style={{ color:'#556', fontSize:11 }}>{set.desc}</span>}
                  </div>
                )}
              <div style={{ display:'grid', gridTemplateColumns:`repeat(auto-fill,minmax(${mobile ? 92 : 108}px,1fr))`, gap: mobile ? 6 : 10 }}>
                {cards.map(card => {
  const equipped   = alreadyEquipped(card);
  const isSelected = activeSlot && getSlotCard(activeSlot)?.id === card.id;
  const cantEquip  = activeSlot === 'main' && card.rarity < 5;
  const count      = cardCounts[card.id] || 1;
  return (
    <div key={card.id} className="card-tile"
      onClick={() => {
        if (!activeSlot) return;
        if (cantEquip || equipped) return;
        equip(card);
      }}
      style={{
        background:`linear-gradient(160deg,${rc(card.rarity)}14,rgba(0,0,0,0.5))`,
        border:`2px solid ${isSelected ? '#ff8c00' : rc(card.rarity)+'44'}`,
        borderRadius:10, padding:'10px 8px', textAlign:'center',
        opacity: cantEquip ? 0.35 : 1,
        position:'relative',
      }}
    >
      {/* Equipped badge */}
      {equipped && (
        <div style={{ position:'absolute', top:4, right:4, background:'#ff8c00', color:'#000', fontSize:9, fontWeight:900, padding:'1px 5px', borderRadius:4, zIndex:2 }}>EQ</div>
      )}
      {/* Stack count */}
      {count > 1 && (
        <div style={{ position:'absolute', top:4, left:4, background:'rgba(0,0,0,0.75)', color:'#fff', fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:4, zIndex:2 }}>
          ×{count}
        </div>
      )}

      <img
        src={thumb(card.characterImage || card.image)}
        loading="lazy" decoding="async"
        alt={card.name}
        style={{ width:'100%', height:88, objectFit:'contain', marginBottom:6, filter:`drop-shadow(0 0 6px ${rc(card.rarity)}77)` }}
        onError={e => {
          const fallback = card.characterImage || card.image;
          if (fallback && e.target.src !== fallback) e.target.src = fallback;
        }}
      />
      <div style={{ color:rc(card.rarity), fontSize:12, letterSpacing:0.5, marginBottom:2 }}>
        {'★'.repeat(Math.min(card.rarity, 6))}
      </div>
      <div style={{ color:'#ccc', fontSize:11, fontWeight:600, lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
        {card.name}
      </div>
      {setOfCard(card.id) && (
        <div style={{ color:setOfCard(card.id).color, fontSize:9, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>◆ {setOfCard(card.id).name}</div>
      )}

      {activeSlot && !cantEquip && !equipped && (
        <div style={{ marginTop:5, background:'rgba(255,140,0,0.2)', border:'1px solid rgba(255,140,0,0.5)', borderRadius:4, color:'#ff8c00', fontSize:11, padding:'2px 0' }}>
          equip
        </div>
      )}
      {activeSlot && equipped && (
        <div style={{ marginTop:5, color:'rgba(255,255,255,0.2)', fontSize:10 }}>already equipped</div>
      )}
    </div>
  );
})}
              </div>
              </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}