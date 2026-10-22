import { useState, useMemo, memo, useCallback, useTransition } from 'react';
import { playClose } from '../utils/sfx';
import { thumb } from '../utils/assets';
import { CHARACTERS } from '../data/characters';
import { setOfCard, formatSub, CARD_SETS } from '../combat/sets';
import { SKILLS, ULTS, describeKit, describeSiStep, ULT_CD_PER_SI, weakKit, SKILL_UNLOCK } from '../combat/kits';
import { cardBattleStats } from '../combat/stats';
import useIsMobile from '../hooks/useIsMobile';

const RARITY_COLOR = { 6:'#ff4444', 5:'#f0c040', 4:'#a855f7', 3:'#60a5fa' };
const RARITY_LABEL = { 6:'6★', 5:'5★', 4:'4★', 3:'3★' };
const ELEMENT_ICON = { Geo:'🪨', Hydro:'💧', Ice:'❄️', Fire:'🔥', Lightning:'⚡', Physical:'⚔️', Quantum:'🌌', Imaginary:'✨', Wind:'💨', Shadow:'🌑' };

const CardImage = memo(({ card, size = 28, small = false }) => {
  const full = card.characterImage || card.image;
  const src = small ? thumb(full) : full;
  const isPlaceholder = !src || src.includes('placeholder');
  return isPlaceholder
    ? <span style={{ fontSize: size, fontWeight: 900, color: '#fff' }}>{card.name[0]}</span>
    : <img src={src} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        loading={small ? 'lazy' : undefined} decoding="async"
        onError={e => { if (e.target.src !== full) e.target.src = full; }}
      />;
});

const CardTile = memo(({ card, isSelected, count, onSelect }) => {
  return (
    <div onClick={() => onSelect(card)} style={{
      border: `2px solid ${isSelected ? '#ff8c00' : RARITY_COLOR[card.rarity]}`,
      borderRadius:8, padding:8,
      background: isSelected ? '#2a1f00' : 'var(--panel)',
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
        <CardImage card={card} size={28} small />
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

// Plain grid. (It used to be "virtualized" with a fixed 160px row height, but
// tiles are much taller on wide screens, so the last rows could never be
// scrolled into view. A few dozen cards with lazy thumbnails don't need it.)
const FastVirtualGrid = memo(({ cards, counts, selected, onSelect, cols = 5 }) => (
  <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 12, background:'var(--desk)' }}>
    {cards.length === 0 ? (
      <div style={{ color: '#445', textAlign: 'center', fontSize: 14, marginTop: 40 }}>no cards yet — go pull!</div>
    ) : (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 10 }}>
        {cards.map(card => (
          <CardTile key={card.id} card={card} isSelected={selected?.id === card.id} count={counts[card.id]} onSelect={onSelect} />
        ))}
      </div>
    )}
  </div>
));

export default function CardsScreen({ navigate, collection, cardInventory = {} }) {
  const { mobile } = useIsMobile();
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [showArt, setShowArt] = useState(null);
  const [, startTransition] = useTransition();

  // Copies from the gacha AND the shop
  const counts = useMemo(() => {
    const c = {};
    collection.forEach(card => { c[card.id] = (c[card.id] || 0) + 1; });
    Object.entries(cardInventory).forEach(([id, e]) => { if (e.count) c[id] = (c[id] || 0) + e.count; });
    return c;
  }, [collection, cardInventory]);

  // Current card definitions (not the copies saved at pull time)
  const unique = useMemo(
    () => CHARACTERS.filter(c => counts[c.id] > 0).sort((a, b) => b.rarity - a.rarity),
    [counts],
  );

  const display = useMemo(
    () => (filter === 'all' || filter === 'sets') ? unique : unique.filter(c => {
      const rarity = parseInt(String(c.rarity), 10);
      return rarity === parseInt(filter, 10);
    }),
    [filter, unique]
  );
  // "Sets" view: one section per set (with all 3 members, owned or not), then the rest
  const setGroups = useMemo(() => filter !== 'sets' ? null : [
    ...CARD_SETS.map(set => ({ set, cards: set.members.map(id => CHARACTERS.find(c => c.id === id)).filter(Boolean) })),
    { set: null, cards: unique.filter(c => !setOfCard(c.id)) },
  ], [filter, unique]);

  const handleCardSelect = useCallback((card) => {
    startTransition(() => {
      setSelected(prev => prev?.id === card.id ? null : card);
    });
  }, []);

  return (
    <div style={{ width:'100%', height:"100dvh", background:'var(--desk)', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:'var(--font-ui)', color:'#eee' }}>
      <style>{`
        img { -webkit-user-drag:none; user-select:none; -webkit-touch-callout: none; }
        body { -webkit-font-smoothing: antialiased; }
      `}</style>

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', background:'var(--bar)', borderBottom:'2px solid #ff8c00', flexShrink:0, gap:12 }}>
        <button onPointerDown={playClose} onClick={() => navigate('main')} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.2)', color:'#ccc', fontSize:14, padding:'7px 18px', borderRadius:8, cursor:'pointer' }}>← back</button>
        <span style={{ color:'#ff8c00', fontWeight:700, fontSize:18, letterSpacing:2 }}>CODEX</span>
        {!mobile && <span style={{ color:'#445', fontSize:12 }}>{Object.values(counts).reduce((a, b) => a + b, 0)} total · {unique.length} unique</span>}
        <div style={{ flex:1 }} />
        <button onClick={() => navigate('gacha')} style={{ background:'#1a1000', border:'2px solid #f0c040', color:'#f0c040', fontSize:13, padding:'6px 18px', borderRadius:6, cursor:'pointer', fontWeight:700 }}>
          ✨ PULL
        </button>
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Grid */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Filter bar */}
          <div style={{ display:'flex', gap:8, padding:'10px 14px', borderBottom:'1px solid var(--line)', flexShrink:0, flexWrap:'wrap' }}>
            {[['all','ALL'],['6','6★'],['5','5★'],['4','4★'],['3','3★'],['sets','◆ SETS']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} style={{
                background: filter===val ? '#ff8c0022' : 'none',
                border: `1px solid ${filter===val ? '#ff8c00' : 'var(--line)'}`,
                color: filter===val ? '#ff8c00' : '#556',
                padding:'4px 14px', borderRadius:4, cursor:'pointer', fontSize:12,
              }}>
                {label}
              </button>
            ))}
          </div>

          {setGroups ? (
            <div style={{ flex:1, overflowY:'auto', padding:12 }}>
              {setGroups.filter(g => g.cards.length).map(({ set, cards }) => (
                <div key={set?.id ?? 'rest'} style={{ marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap', marginBottom:8, paddingBottom:4, borderBottom:`1px solid ${set ? set.color + '55' : '#2a3050'}` }}>
                    <span style={{ color: set?.color ?? '#889', fontWeight:800, fontSize:14 }}>{set ? `◆ ${set.name}` : 'No set'}</span>
                    {set && <span style={{ color:'#667', fontSize:11 }}>{cards.filter(c => counts[c.id] > 0).length}/3 owned</span>}
                    {set && <span style={{ color:'#889', fontSize:12 }}>{set.desc}</span>}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:`repeat(${mobile ? 3 : 5}, 1fr)`, gap:10 }}>
                    {cards.map(card => (
                      <div key={card.id} style={{ opacity: counts[card.id] > 0 ? 1 : 0.35, filter: counts[card.id] > 0 ? 'none' : 'grayscale(1)' }}
                        title={counts[card.id] > 0 ? '' : 'not owned yet'}>
                        <CardTile card={card} isSelected={selected?.id === card.id} count={counts[card.id] ?? 0} onSelect={handleCardSelect} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <FastVirtualGrid
              cards={display}
              counts={counts}
              selected={selected}
              onSelect={handleCardSelect}
              cols={mobile ? 3 : 5}
            />
          )}
        </div>

        {/* Detail panel — side column on PC, bottom sheet on phones */}
        {mobile && selected && <div onClick={() => setSelected(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:40 }} />}
        <div style={mobile
          ? { display: selected ? 'block' : 'none', position:'fixed', left:0, right:0, bottom:0, maxHeight:'78dvh', zIndex:41, borderTop:'2px solid #ff8c00', borderRadius:'14px 14px 0 0', padding:16, overflowY:'auto', background:'var(--panel)' }
          : { width:260, flexShrink:0, borderLeft:'1px solid var(--line)', padding:16, overflowY:'auto', background:'var(--panel)' }}>
          {mobile && selected && (
            <button onClick={() => setSelected(null)} style={{ float:'right', background:'none', border:'1px solid #445', color:'#aaa', borderRadius:6, padding:'2px 10px', fontSize:16 }}>×</button>
          )}
          {selected ? (
            <>
              <div
                onClick={() => { if (selected.cardArt) setShowArt(selected); }}
                style={{ width: mobile ? '55%' : '100%', margin: mobile ? '0 auto 6px' : undefined, aspectRatio:'1', borderRadius:12, overflow:'hidden', background:selected.color, marginBottom:6, display:'flex', alignItems:'center', justifyContent:'center', border:`3px solid ${RARITY_COLOR[selected.rarity]}`, cursor: selected.cardArt ? 'zoom-in' : 'default' }}
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

              {(() => {
                // Your copy of the card: level and superimposition change the numbers
                const e = cardInventory[selected.id] ?? {};
                const si = Math.min(4, e.si ?? 0);
                const bs = cardBattleStats(selected, e);
                const changed = bs.atk !== selected.stats?.atk;
                return (
                  <>
                    {changed && counts[selected.id] > 0 && (
                      <div style={{ color:'#889', fontSize:11, textAlign:'center', marginTop:-6, marginBottom:10 }}>
                        Yours{selected.rarity >= 5 ? ` (LV${e.level ?? 1}` : ' ('}{si > 0 ? `${selected.rarity >= 5 ? ', ' : ''}S${si + 1}` : ''}): ATK {bs.atk} · HP {bs.hp} · DEF {bs.def}
                      </div>
                    )}
                    {[['✦ Skill', selected.skill, SKILLS[selected.skill?.effect]], ['⚡ Ult · LV50', selected.ult, ULTS[selected.ult?.effect]]].filter(([, a]) => a).map(([tag, a, kit]) => (
                      <div key={tag} style={{ background:'#1a1000', border:'1px solid #4a3000', borderRadius:6, padding:'8px 10px', marginBottom:8 }}>
                        <div style={{ color:'#f0c040', fontWeight:700, marginBottom:4 }}>{a.name} <span style={{ color:'#776', fontWeight:400, fontSize:11 }}>{tag}{si > 0 ? ` · S${si + 1}` : ''}</span></div>
                        <div style={{ color:'#aaa', fontSize:12 }}>{kit ? describeKit(kit, si) : a.description}</div>
                        {tag.startsWith('⚡') && <div style={{ color:'#889', fontSize:11, marginTop:4 }}>Cooldown {Math.round((a.cooldown ?? 30) * (1 - ULT_CD_PER_SI * si))}s · fills from damage you deal · press E</div>}
                        {!tag.startsWith('⚡') && kit?.lv1 && (
                          <div style={{ color:'#8a7a3a', fontSize:11, marginTop:4 }}>
                            Always on. Before LV{SKILL_UNLOCK} (weaker): {describeKit(weakKit(kit), si)}
                          </div>
                        )}
                        {kit && si < 4 && <div style={{ color:'#7c6a2a', fontSize:11, marginTop:3 }}>Next S{si + 2}: {describeSiStep(kit, si)}{tag.startsWith('⚡') ? `, cooldown −${Math.round(ULT_CD_PER_SI * 100)}%` : ''}</div>}
                      </div>
                    ))}
                  </>
                );
              })()}

              {selected.rarity >= 5 && !selected.skill && !selected.ult && (
                <div style={{ background:'#1a1000', border:'1px dashed #4a3000', borderRadius:6, padding:'8px 10px', marginBottom:8, color:'#998', fontSize:12 }}>
                  ✦ Skill and ult coming soon — for now this card brings its stats.
                </div>
              )}
              {selected.passive && (
                <div style={{ background:'#0a1020', border:'1px solid #1a2a40', borderRadius:6, padding:'8px 10px', marginBottom:8 }}>
                  <div style={{ color:'#88aaff', fontWeight:700, marginBottom:4 }}>◈ {selected.passive.name}</div>
                  <div style={{ color:'#aaa', fontSize:12 }}>{selected.passive.description}</div>
                </div>
              )}

              {(() => {
                const set = setOfCard(selected.id);
                const subs = cardInventory[selected.id]?.subs ?? [];
                if (!set && !subs.length) return null;
                return (
                  <div style={{ background:'#0a1020', border:`1px solid ${set?.color ?? '#1a2a40'}66`, borderRadius:6, padding:'8px 10px', marginBottom:8 }}>
                    {set && <>
                      <div style={{ color:set.color, fontWeight:700, marginBottom:3 }}>◆ Set: {set.name}</div>
                      <div style={{ color:'#aaa', fontSize:12 }}>{set.desc}</div>
                      <div style={{ color:'#667', fontSize:11, marginTop:3 }}>
                        {set.members.map(id => CHARACTERS.find(c => c.id === id)?.name).join(' · ')}
                      </div>
                    </>}
                    {subs.length > 0 && (
                      <div style={{ marginTop: set ? 8 : 0 }}>
                        <div style={{ color:'#88aaff', fontSize:11, marginBottom:2 }}>SUB-STATS</div>
                        {subs.map((sb, i) => <div key={i} style={{ color:'#ddd', fontSize:12 }}>{formatSub(sb)}{sb.ups ? <span style={{ color:'#f0c040' }}> {'▲'.repeat(sb.ups)}</span> : null}</div>)}
                      </div>
                    )}
                  </div>
                );
              })()}

              {!selected.skill && !selected.ult && selected.rarity < 5 && !setOfCard(selected.id) && (
                <div style={{ color:'#445', fontSize:12, textAlign:'center', marginTop:8 }}>no abilities — stat support only</div>
              )}

              {counts[selected.id] > 1 && (
                <div style={{ marginTop:10, color:'#ff8c00', fontSize:12, textAlign:'center' }}>×{counts[selected.id]} owned</div>
              )}
            </>
          ) : (
            <div style={{ color:'var(--line)', fontSize:13, textAlign:'center', marginTop:60 }}>click a card to view details</div>
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