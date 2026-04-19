import { useState, useMemo, memo, useCallback, useTransition, useRef } from 'react';
import { playClose } from '../utils/sfx';

const RARITY_COLOR = { 6:'#ff4444', 5:'#f0c040', 4:'#a855f7', 3:'#60a5fa' };
const RARITY_LABEL = { 6:'6★', 5:'5★', 4:'4★', 3:'3★' };
const ELEMENT_ICON = { Geo:'🪨', Hydro:'💧', Ice:'❄️', Fire:'🔥', Lightning:'⚡', Physical:'⚔️', Quantum:'🌌', Imaginary:'✨', Wind:'💨' };

const CardImage = memo(({ card, size = 28 }) => {
  const src = card.characterImage || card.image;
  const isPlaceholder = !src || src.includes('placeholder');
  return isPlaceholder
    ? <span style={{ fontSize: size, fontWeight: 900, color: '#fff' }}>{card.name[0]}</span>
    : <img src={src} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={e => { e.target.src = card.characterImage || card.image; }}
      />;
});

const CardTile = memo(({ card, isSelected, count, onSelect }) => {
  return (
    <div onClick={() => onSelect(card)} style={{
      border: `2px solid ${isSelected ? '#ff8c00' : RARITY_COLOR[card.rarity]}`,
      borderRadius:8, padding:8,
      background: isSelected ? '#2a1f00' : '#141928',
      cursor:'pointer', textAlign:'center', transition:'all 0.15s', position:'relative',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      <div style={{ 
        width:'100%', 
        aspectRatio:'1', 
        position:'relative', 
        borderRadius:4, 
        overflow:'hidden', 
        background:card.color, 
        marginBottom:6,
        display:'flex', 
        alignItems:'center', 
        justifyContent:'center',
        flexShrink: 0,
      }}>
        <CardImage card={card} size={28} />
      </div>
      <div style={{ fontSize:11, fontWeight:700, color:'#eee', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{card.name}</div>
      <div style={{ fontSize:10, color:RARITY_COLOR[card.rarity] }}>{RARITY_LABEL[card.rarity]}</div>
      {count > 1 && (
        <div style={{ position:'absolute', top:4, right:4, background:'#ff8c00', color:'#000', fontSize:9, fontWeight:700, borderRadius:8, padding:'1px 5px' }}>×{count}</div>
      )}
    </div>
  );
}, (prev, next) => {
  return prev.card.id === next.card.id && 
         prev.isSelected === next.isSelected && 
         prev.count === next.count;
});

const FastVirtualGrid = memo(({ cards, counts, selected, onSelect }) => {
  const scrollRef = useRef(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const rafRef = useRef(null);

  const GAP = 10;
  const PADDING = 12;
  const CARD_HEIGHT = 160;
  const COLS = 5;

  const totalRows = Math.ceil(cards.length / COLS);
  const totalHeight = totalRows * CARD_HEIGHT + (totalRows - 1) * GAP;

  const handleScroll = useCallback((e) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const scrollTop = e.currentTarget.scrollTop;
      const containerHeight = e.currentTarget.clientHeight;
      
      const startRow = Math.max(0, Math.floor((scrollTop - 200) / (CARD_HEIGHT + GAP)));
      const endRow = Math.min(totalRows, Math.ceil((scrollTop + containerHeight + 200) / (CARD_HEIGHT + GAP)));
      
      const start = startRow * COLS;
      const end = Math.min(endRow * COLS, cards.length);
      
      setVisibleRange({ start, end });
    });
  }, [cards.length, totalRows]);

  const visibleCards = useMemo(() => {
    return cards.slice(visibleRange.start, visibleRange.end);
  }, [cards, visibleRange]);

  const offsetY = Math.floor(visibleRange.start / COLS) * (CARD_HEIGHT + GAP);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: PADDING,
        background: '#1a2035',
        position: 'relative',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      }}
    >
      <style>{`
        div::-webkit-scrollbar { width: 8px; }
        div::-webkit-scrollbar-track { background: transparent; }
        div::-webkit-scrollbar-thumb { background: #334; border-radius: 4px; }
        div::-webkit-scrollbar-thumb:hover { background: #556; }
      `}</style>

      {cards.length === 0 ? (
        <div style={{ color: '#445', textAlign: 'center', fontSize: 14, marginTop: 40 }}>
          no cards yet — go pull!
        </div>
      ) : (
        <div style={{ position: 'relative', height: totalHeight }}>
          <div
            style={{
              position: 'absolute',
              top: offsetY,
              left: 0,
              right: 0,
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gap: GAP,
              width: '100%',
              willChange: 'transform',
            }}
          >
            {visibleCards.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                isSelected={selected?.id === card.id}
                count={counts[card.id]}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  return prev.cards === next.cards && 
         prev.selected?.id === next.selected?.id && 
         prev.counts === next.counts;
});

export default function CardsScreen({ navigate, collection }) {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [showArt, setShowArt] = useState(null);
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c = {};
    collection.forEach(card => { c[card.id] = (c[card.id] || 0) + 1; });
    return c;
  }, [collection]);

  const unique = useMemo(() => {
    const seen = new Set();
    return collection
      .slice()
      .sort((a, b) => b.rarity - a.rarity)
      .filter(c => {
        // Debug: check for rarity mismatches
        const id = c.id;
        if (seen.has(id)) return false;
        seen.add(id);
        // Force rarity to be a number
        if (typeof c.rarity !== 'number') {
          c.rarity = parseInt(c.rarity, 10);
        }
        return true;
      });
  }, [collection]);

  const display = useMemo(
    () => filter === 'all' ? unique : unique.filter(c => {
      const rarity = parseInt(String(c.rarity), 10);
      return rarity === parseInt(filter, 10);
    }),
    [filter, unique]
  );

  const handleCardSelect = useCallback((card) => {
    startTransition(() => {
      setSelected(prev => prev?.id === card.id ? null : card);
    });
  }, []);

  return (
    <div style={{ width:'100%', height:'100vh', background:'#1a2035', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:"'Segoe UI',sans-serif", color:'#eee' }}>
      <style>{`
        img { -webkit-user-drag:none; user-select:none; -webkit-touch-callout: none; }
        body { -webkit-font-smoothing: antialiased; }
      `}</style>

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', background:'#141928', borderBottom:'2px solid #ff8c00', flexShrink:0, gap:12 }}>
        <button onClick={() => { playClose(); navigate('main'); }} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.2)', color:'#ccc', fontSize:14, padding:'7px 18px', borderRadius:8, cursor:'pointer' }}>← back</button>
        <span style={{ color:'#ff8c00', fontWeight:700, fontSize:18, letterSpacing:2 }}>CODEX</span>
        <span style={{ color:'#445', fontSize:12 }}>{collection.length} total · {unique.length} unique</span>
        <div style={{ flex:1 }} />
        <button onClick={() => navigate('gacha')} style={{ background:'#1a1000', border:'2px solid #f0c040', color:'#f0c040', fontSize:13, padding:'6px 18px', borderRadius:6, cursor:'pointer', fontWeight:700 }}>
          ✨ PULL
        </button>
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Grid */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Filter bar */}
          <div style={{ display:'flex', gap:8, padding:'10px 14px', borderBottom:'1px solid #2a2a3a', flexShrink:0 }}>
            {[['all','ALL'],['6','6★'],['5','5★'],['4','4★'],['3','3★']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} style={{
                background: filter===val ? '#ff8c0022' : 'none',
                border: `1px solid ${filter===val ? '#ff8c00' : '#334'}`,
                color: filter===val ? '#ff8c00' : '#556',
                padding:'4px 14px', borderRadius:4, cursor:'pointer', fontSize:12,
              }}>
                {label}
              </button>
            ))}
          </div>

          <FastVirtualGrid
            cards={display}
            counts={counts}
            selected={selected}
            onSelect={handleCardSelect}
          />
        </div>

        {/* Detail panel */}
        <div style={{ width:260, flexShrink:0, borderLeft:'1px solid #2a2a3a', padding:16, overflowY:'auto', background:'#141928' }}>
          {selected ? (
            <>
              <div
                onClick={() => { if (selected.cardArt) setShowArt(selected); }}
                style={{ width:'100%', aspectRatio:'1', borderRadius:12, overflow:'hidden', background:selected.color, marginBottom:6, display:'flex', alignItems:'center', justifyContent:'center', border:`3px solid ${RARITY_COLOR[selected.rarity]}`, cursor: selected.cardArt ? 'zoom-in' : 'default' }}
              >
                <CardImage card={selected} size={56} />
              </div>
              {selected.cardArt && (
                <div style={{ color:'rgba(255,255,255,0.25)', fontSize:11, textAlign:'center', marginBottom:10 }}>tap image for full art</div>
              )}

              <div style={{ color:RARITY_COLOR[selected.rarity], fontSize:13, marginBottom:2 }}>{RARITY_LABEL[selected.rarity]}</div>
              <div style={{ fontSize:20, fontWeight:700, marginBottom:2 }}>{selected.name}</div>
              <div style={{ color:'#778', fontSize:13, marginBottom:10 }}>{selected.subtitle}</div>

              {selected.element && (
                <div style={{ color:selected.color, fontSize:13, marginBottom:10 }}>
                  {ELEMENT_ICON[selected.element]} {selected.element}
                </div>
              )}

              {selected.stats && (
                <div style={{ background:'#0f1420', borderRadius:6, padding:'8px 12px', marginBottom:10, display:'flex', gap:12, justifyContent:'center' }}>
                  <div style={{ textAlign:'center' }}><div style={{ color:'#556', fontSize:10 }}>HP</div><div style={{ color:'#44cc66', fontWeight:700 }}>{selected.stats.hp}</div></div>
                  <div style={{ textAlign:'center' }}><div style={{ color:'#556', fontSize:10 }}>ATK</div><div style={{ color:'#f0c040', fontWeight:700 }}>{selected.stats.atk}</div></div>
                  <div style={{ textAlign:'center' }}><div style={{ color:'#556', fontSize:10 }}>DEF</div><div style={{ color:'#5588ff', fontWeight:700 }}>{selected.stats.def}</div></div>
                </div>
              )}

              {selected.ability && (
                <div style={{ background:'#1a1000', border:'1px solid #4a3000', borderRadius:6, padding:'8px 10px', marginBottom:8 }}>
                  <div style={{ color:'#f0c040', fontWeight:700, marginBottom:4 }}>✦ {selected.ability.name}</div>
                  <div style={{ color:'#aaa', fontSize:12 }}>{selected.ability.description}</div>
                  <div style={{ color:'#556', fontSize:11, marginTop:4 }}>CD: {selected.ability.cooldown}s</div>
                </div>
              )}

              {selected.passive && (
                <div style={{ background:'#0a1020', border:'1px solid #1a2a40', borderRadius:6, padding:'8px 10px', marginBottom:8 }}>
                  <div style={{ color:'#88aaff', fontWeight:700, marginBottom:4 }}>◈ {selected.passive.name}</div>
                  <div style={{ color:'#aaa', fontSize:12 }}>{selected.passive.description}</div>
                </div>
              )}

              {!selected.ability && selected.rarity < 5 && (
                <div style={{ color:'#445', fontSize:12, textAlign:'center', marginTop:8 }}>no abilities — stat support only</div>
              )}

              {counts[selected.id] > 1 && (
                <div style={{ marginTop:10, color:'#ff8c00', fontSize:12, textAlign:'center' }}>×{counts[selected.id]} owned</div>
              )}
            </>
          ) : (
            <div style={{ color:'#334', fontSize:13, textAlign:'center', marginTop:60 }}>click a card to view details</div>
          )}
        </div>
      </div>

      {showArt && (
        <div
          onClick={() => setShowArt(null)}
          style={{
            position:'fixed', inset:0, zIndex:100,
            background:'rgba(0,0,0,0.95)',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            cursor:'pointer',
          }}
        >
          <button
            onClick={() => setShowArt(null)}
            style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', fontSize:28, width:48, height:48, borderRadius:'50%', cursor:'pointer' }}
          >×</button>
          <img
            src={showArt.cardArt}
            alt={showArt.name}
            style={{ maxWidth:'90vw', maxHeight:'80vh', objectFit:'contain', borderRadius:12 }}
          />
          <div style={{ marginTop:16, textAlign:'center' }}>
            <div style={{ color:({ 6:'#ff4444', 5:'#f0c040' }[showArt.rarity]), fontSize:16, marginBottom:4 }}>
              {'★'.repeat(showArt.rarity)} {showArt.name}
            </div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:13 }}>{showArt.subtitle}</div>
            <div style={{ color:'rgba(255,255,255,0.2)', fontSize:12, marginTop:8 }}>tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
}