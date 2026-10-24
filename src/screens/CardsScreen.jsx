// Codex → "Records": the Frail Initiative's filing cabinet.
// Drawers by rarity (and one for sets, "case files"). Opening a drawer shows its
// folders; cards you don't own yet are folders with a blacked-out tab. Picking a
// folder opens it on the desk: a personnel file for 5★/6★, an evidence file for
// 3★/4★. On phones the open folder covers the screen.
//
// handlerNote (optional, in characters.js): a handwritten line on the card's file.
import { useState, useMemo } from 'react';
import { playClose, playPress } from '../utils/sfx';
import { thumb } from '../utils/assets';
import { CHARACTERS } from '../data/characters';
import { BANNERS } from '../data/banners';
import { setOfCard, formatSub, CARD_SETS } from '../combat/sets';
import { SKILLS, ULTS, STYLES, describeKit, describePassive, describeSiStep, ULT_CD_PER_SI, weakKit, SKILL_UNLOCK, abilityText } from '../combat/kits';
import { cardBattleStats, siMult } from '../combat/stats';
import useIsMobile from '../hooks/useIsMobile';
import TermTitle from '../components/TermTitle';

const RC = { 6: '#ff4d6d', 5: '#e0a800', 4: '#9b5de5', 3: '#3a7bd5' };
const CLEAR = { 3: 'C', 4: 'B', 5: 'A', 6: 'Ω' };
const DRAWERS = [
  { id: '6', label: 'CLASSIFIED', sub: '6★ · PLATINUM & SPECIAL', rarity: 6 },
  { id: '5', label: 'AGENTS', sub: '5★ PERSONNEL', rarity: 5 },
  { id: '4', label: 'EVIDENCE · B', sub: '4★ EXHIBITS', rarity: 4 },
  { id: '3', label: 'EVIDENCE · C', sub: '3★ EXHIBITS', rarity: 3 },
  { id: 'sets', label: 'CASE FILES', sub: 'SETS OF EVIDENCE' },
];
const fileNo = c => `FI-${String(c.id).padStart(4, '0')}`;
const photoOf = c => c.cardArt || c.sprite || c.characterImage || c.image;

export default function CardsScreen({ navigate, collection, cardInventory = {}, mainCardId = null }) {
  const { mobile } = useIsMobile();
  const [drawer, setDrawer] = useState('5');
  const [open, setOpen] = useState(null);          // { kind: 'card', card } | { kind: 'set', set }
  const [showArt, setShowArt] = useState(null);

  const counts = useMemo(() => {
    const c = {};
    collection.forEach(card => { c[card.id] = (c[card.id] || 0) + 1; });
    Object.entries(cardInventory).forEach(([id, e]) => { if (e.count) c[id] = (c[id] || 0) + e.count; });
    return c;
  }, [collection, cardInventory]);
  const owned = c => (counts[c.id] ?? 0) > 0;
  const inDrawer = r => CHARACTERS.filter(c => c.rarity === r).sort((a, b) => (owned(b) - owned(a)) || a.name.localeCompare(b.name));
  const found = CHARACTERS.filter(owned).length;

  const pick = (o) => { playPress(); setOpen(o); };
  const toggle = (id) => { playPress(); setDrawer(d => (d === id ? null : id)); };

  const cabinet = (
    <div className="rc-cab">
      <div className="rc-cabtop">FRAIL INITIATIVE · RECORDS · DO NOT REMOVE</div>
      {DRAWERS.map(d => {
        const cards = d.rarity ? inDrawer(d.rarity) : null;
        const have = cards ? cards.filter(owned).length : CARD_SETS.filter(s => s.members.every(id => counts[id] > 0)).length;
        const total = cards ? cards.length : CARD_SETS.length;
        const isOpen = drawer === d.id;
        return (
          <div key={d.id} className="rc-dwrap">
            <button className={`rc-drawer${isOpen ? ' open' : ''}`} onClick={() => toggle(d.id)}>
              <span className="rc-label">{d.label}<small>{d.sub}</small></span>
              <span className="rc-pull" />
              <span className="rc-cnt">{have} / {total}{d.id === 'sets' ? ' complete' : ''}</span>
              {isOpen && <span className="rc-openmark">▼ OPEN</span>}
            </button>
            {isOpen && (
              <div className="rc-slot">
                {cards ? cards.map((c, i) => {
                  const has = owned(c);
                  const sel = open?.kind === 'card' && open.card.id === c.id;
                  return (
                    <button key={c.id} className={`rc-folder${has ? '' : ' sealed'}${sel ? ' sel' : ''}`} onClick={() => pick({ kind: 'card', card: c })}
                      style={{ '--tab': `${(i % 3) * 30}%`, '--rc': RC[c.rarity] }}>
                      <span className="rc-tab">{has ? c.name : <span className="rc-bar">██████████</span>}</span>
                      <span className="rc-edge">{has ? <>{fileNo(c)}{c.subtitle ? ` · ${c.subtitle}` : ''}{counts[c.id] > 1 ? ` · ×${counts[c.id]}` : ''}</> : 'SEALED'}</span>
                    </button>
                  );
                }) : CARD_SETS.map((s, i) => {
                  const n = s.members.filter(id => counts[id] > 0).length;
                  const sel = open?.kind === 'set' && open.set.id === s.id;
                  return (
                    <button key={s.id} className={`rc-folder case${sel ? ' sel' : ''}`} onClick={() => pick({ kind: 'set', set: s })} style={{ '--tab': `${(i % 3) * 30}%`, '--rc': s.color }}>
                      <span className="rc-tab">CASE: {s.name}</span>
                      <span className="rc-edge">{n}/{s.members.length} exhibits{n === s.members.length ? ' · CLOSED' : ''}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const desk = open
    ? (open.kind === 'set'
      ? <CaseFile set={open.set} counts={counts} onOpen={c => pick({ kind: 'card', card: c })} />
      : owned(open.card)
        ? <CardFile card={open.card} entry={cardInventory[open.card.id] ?? {}} count={counts[open.card.id] ?? 0} active={open.card.id === mainCardId}
            counts={counts} onArt={src => setShowArt({ card: open.card, src })} onOpen={c => pick({ kind: 'card', card: c })} />
        : <SealedFile card={open.card} />)
    : <div className="rc-empty">Open a drawer and pick a folder.</div>;

  return (
    <div className="rc-root">
      <style>{CSS}</style>
      <div className="rc-top">
        <button onPointerDown={playClose} onClick={() => navigate('main')}>[&nbsp;back&nbsp;]</button>
        <TermTitle path="RECORDS" small={mobile} />
        {!mobile && <span className="rc-meta">{found} of {CHARACTERS.length} files recovered</span>}
        <div style={{ flex: 1 }} />
        <button onClick={() => navigate('gacha')}>[&nbsp;recruit&nbsp;]</button>
      </div>

      {mobile ? (
        <div className="rc-body phone">{cabinet}</div>
      ) : (
        <div className="rc-body">{cabinet}<div className="rc-desk">{desk}</div></div>
      )}

      {mobile && open && (
        <div className="rc-sheet">
          <button className="rc-close" onClick={() => { playClose(); setOpen(null); }}>[&nbsp;close&nbsp;]</button>
          {desk}
        </div>
      )}

      {showArt && (
        <div onClick={() => setShowArt(null)} className="rc-art">
          <img src={showArt.src || photoOf(showArt.card)} alt={showArt.card.name} />
          <div style={{ marginTop: 12, color: 'var(--amber)' }}>{showArt.card.name} · tap to close</div>
        </div>
      )}
    </div>
  );
}

// ── An owned card's file ──────────────────────────────────────────────────────
function CardFile({ card, entry, count, active, counts, onArt, onOpen }) {
  const agent = card.rarity >= 5;
  const si = Math.min(4, entry.si ?? 0);
  const bs = cardBattleStats(card, entry);
  const set = setOfCard(card.id);
  const subs = entry.subs ?? [];
  // others from the same banner(s)
  const assoc = [...new Set(BANNERS.filter(b => b.featuredIds?.includes(card.id)).flatMap(b => b.featuredIds))]
    .filter(id => id !== card.id).map(id => CHARACTERS.find(c => c.id === id)).filter(Boolean);
  const kits = [['SKILL', card.skill, SKILLS[card.skill?.effect]], ['ULT · LV 50', card.ult, ULTS[card.ult?.effect]]].filter(([, a]) => a);

  return (
    <div className="rc-folderopen" key={card.id}>
      <div className="rc-page">
        <div className="rc-hd"><span>{agent ? 'PERSONNEL FILE' : 'EVIDENCE LOG'} · {fileNo(card)}</span><span style={{ color: RC[card.rarity] }}>{'★'.repeat(Math.min(card.rarity, 6))}</span></div>
        {agent ? (
          <button className="rc-photo" onClick={() => onArt()} title="view full art">
            <span className="rc-clip" /><img src={photoOf(card)} alt={card.name} style={{ objectPosition: card.cardArt ? '50% 12%' : '50% 4%' }} />
          </button>
        ) : (
          <button className="rc-pol" onClick={() => onArt()} title="view full art">
            <span className="rc-tape" /><span className="rc-polimg"><img src={thumb(card.characterImage || card.image)} alt={card.name} className={card.cardArt ? '' : 'framed'} /></span>
            <span className="rc-cap">{card.name}</span>
          </button>
        )}
        {agent && card.image && (
          <button className="rc-badge" onClick={() => onArt(card.image)} title="Initiative ID card">
            <span className="rc-lanyard" /><span className="rc-badgeclip keep-round" />
            <img src={thumb(card.image)} alt={`${card.name} ID card`} />
            <span className="rc-badgetag">ID · {fileNo(card)}</span>
          </button>
        )}
        {agent && <div className="rc-name">{card.name}</div>}
        {card.subtitle && <Row k="TITLE" v={card.subtitle} />}
        <Row k="CLEARANCE" v={`LVL ${CLEAR[Math.min(card.rarity, 6)]}${card.element ? ` · ${card.element}` : ''}${card.series === 'platinum' ? ' · Platinum Series' : ''}`} />
        <Row k="ORIGIN" v={card.origin || <Blank />} />
        {!agent && <Row k="OBJECT CLASS" v={card.objectClass || <Blank />} />}
        <Row k="ON FILE" v={`×${count} cop${count === 1 ? 'y' : 'ies'}${agent ? ` · LV ${entry.level ?? 1}` : ''}`} />
        <Row k="STATS" v={`ATK ${bs.atk} · HP ${bs.hp} · DEF ${bs.def}`} />
        {active && <span className="rc-stamp" style={{ color: '#b3121b', top: '46%', right: 10, zIndex: 4 }}>ACTIVE DUTY</span>}
      </div>
      <div className="rc-page">
        <div className="rc-hd"><span>{agent ? 'FIELD NOTES' : 'CASE NOTES'}</span><span>PAGE 2</span></div>
        {kits.map(([tag, a, kit]) => (
          <div key={tag}>
            <div className="rc-sect">{tag} · {a.name.toUpperCase()}{tag === 'SKILL' && STYLES[kit?.style] && <span style={{ marginLeft: 8, color: STYLES[kit.style].color }}>[{STYLES[kit.style].name} · {STYLES[kit.style].how}]</span>}</div>
            <div className="rc-kit">{kit ? describeKit(kit, si) : abilityText(a, si)}</div>
            {tag === 'SKILL' && kit?.lv1 && <div className="rc-small">Before LV{SKILL_UNLOCK} (weaker): {describeKit(weakKit(kit), si)}</div>}
            {tag === 'SKILL' && kit?.passive && <div className="rc-kit" style={{ marginTop: 4 }}><b>Passive:</b> {describePassive(kit, si)}</div>}
            {tag !== 'SKILL' && <div className="rc-small">Cooldown {Math.round((a.cooldown ?? 30) * (1 - ULT_CD_PER_SI * si))}s · fills from damage you deal · press E</div>}
            {kit && si < 4 && <div className="rc-small">Next commendation: {describeSiStep(kit, si)}</div>}
          </div>
        ))}
        {agent && !card.skill && !card.ult && <><div className="rc-sect">KIT</div><div className="rc-kit">Skill and ult pending. For now this agent brings their stats.</div></>}
        {card.passive && <><div className="rc-sect">PASSIVE · {card.passive.name.toUpperCase()}</div><div className="rc-kit">{card.passive.description}</div></>}
        {set && <>
          <div className="rc-sect">CASE · {set.name.toUpperCase()}</div>
          <div className="rc-kit">{set.desc}</div>
          <div className="rc-links">{set.members.map(id => CHARACTERS.find(c => c.id === id)).filter(Boolean).map(c => (
            counts[c.id] > 0 ? <button key={c.id} onClick={() => onOpen(c)}>{c.name}</button> : <span key={c.id} className="rc-red">████████</span>))}</div>
        </>}
        {subs.length > 0 && <>
          <div className="rc-sect">SUB-STATS</div>
          {subs.map((sb, i) => <div key={i} className="rc-kit">{formatSub(sb)}{sb.ups ? <b> {'▲'.repeat(sb.ups)}</b> : null}</div>)}
        </>}
        <div className="rc-sect">{agent ? 'COMMENDATIONS' : 'CONDITION'} (SUPERIMPOSITION)</div>
        <div className="rc-com">{[0, 1, 2, 3, 4].map(i => <span key={i} className={i <= si ? 'on' : ''}>{i <= si ? '★' : '☆'}</span>)}</div>
        <div className="rc-small">S{si + 1} · +{Math.round((siMult(si, card.rarity) - 1) * 100)}% ATK/HP/DEF{si < 4 ? ` · next at ${si + 2} copies` : ' · MAX'}</div>
        <div className="rc-sect">{agent ? 'BACKGROUND' : 'INCIDENT REPORT'}</div>
        <Ruled text={agent ? card.background : card.incident} />
        <div className="rc-sect">HANDLER'S NOTE</div>
        <div className={`rc-note${card.handlerNote ? '' : ' none'}`}>{card.handlerNote || 'no note on file'}</div>
        {assoc.length > 0 && <>
          <div className="rc-sect">KNOWN ASSOCIATES</div>
          <div className="rc-links">{assoc.map(c => counts[c.id] > 0
            ? <button key={c.id} onClick={() => onOpen(c)}>{c.name}</button>
            : <span key={c.id} className="rc-red">████████</span>)}</div>
        </>}
      </div>
    </div>
  );
}

function SealedFile({ card }) {
  return (
    <div className="rc-folderopen" key={card.id}>
      <div className="rc-page">
        <div className="rc-hd"><span>{card.rarity >= 5 ? 'PERSONNEL FILE' : 'EVIDENCE LOG'} · {fileNo(card)}</span><span style={{ color: RC[card.rarity] }}>{'★'.repeat(Math.min(card.rarity, 6))}</span></div>
        <div className="rc-sealedbox">?</div>
        <div className="rc-name"><span className="rc-red">██████</span></div>
        <Row k="TITLE" v={<span className="rc-red">████████████</span>} />
        <Row k="CLEARANCE" v={`LVL ${CLEAR[Math.min(card.rarity, 6)]}`} />
        <Row k="ON FILE" v="none" />
        <span className="rc-stamp" style={{ color: '#5b4a2a' }}>SEALED</span>
      </div>
      <div className="rc-page">
        <div className="rc-hd"><span>NOTICE</span><span>PAGE 2</span></div>
        <div className="rc-kit" style={{ marginTop: 14 }}>This file stays sealed until the Initiative has {card.rarity >= 5 ? 'recruited this agent' : 'logged this evidence'}.</div>
        {[80, 95, 60, 88, 70, 92, 55].map((w, i) => <div key={i} className="rc-red" style={{ display: 'block', width: `${w}%`, height: 12, margin: '12px 0' }} />)}
      </div>
    </div>
  );
}

function CaseFile({ set, counts, onOpen }) {
  const members = set.members.map(id => CHARACTERS.find(c => c.id === id)).filter(Boolean);
  const n = members.filter(c => counts[c.id] > 0).length;
  return (
    <div className="rc-folderopen" key={set.id}>
      <div className="rc-page" style={{ flex: 2 }}>
        <div className="rc-hd"><span>CASE FILE · {set.id.toUpperCase()}</span><span>{n}/{members.length} EXHIBITS</span></div>
        <div className="rc-name" style={{ color: '#160f08' }}>{set.name}</div>
        <div className="rc-kit">Bonus with all {members.length} in your deck's supports: {set.desc}</div>
        <div className="rc-board">
          {members.map((c, i) => counts[c.id] > 0 ? (
            <button key={c.id} className="rc-pol small" onClick={() => onOpen(c)} style={{ transform: `rotate(${(i - 1) * 4}deg)` }}>
              <span className="rc-tape" /><span className="rc-polimg"><img src={thumb(c.characterImage || c.image)} alt={c.name} className="framed" /></span>
              <span className="rc-cap">{c.name}</span>
            </button>
          ) : (
            <div key={c.id} className="rc-pol small missing" style={{ transform: `rotate(${(i - 1) * 4}deg)` }}>
              <span className="rc-polimg"><span>?</span></span><span className="rc-cap">missing</span>
            </div>
          ))}
        </div>
        {n === members.length && <span className="rc-stamp" style={{ color: '#2f6b3a', top: 'auto', bottom: 18 }}>CASE CLOSED</span>}
      </div>
    </div>
  );
}

const Row = ({ k, v }) => <div className="rc-row"><i>{k}</i><span>{v}</span></div>;
// an empty form field, waiting for someone to write it (characters.js)
const Blank = () => <span className="rc-blank" />;
// typed report on ruled lines; empty → blank lines
const Ruled = ({ text }) => (text
  ? <div className="rc-ruled">{text}</div>
  : <div className="rc-ruled empty"><span>— awaiting report —</span></div>);

const CSS = `
  .rc-root { width:100%; height:100dvh; display:flex; flex-direction:column; overflow:hidden; background:var(--desk); color:var(--amber); font-family:var(--font-ui); user-select:none; }
  .rc-top { display:flex; align-items:center; gap:12px; padding:8px 14px; background:var(--bar); border-bottom:2px solid #ff8c00; flex-shrink:0; }
  .rc-top button { background:transparent; border:1px solid var(--amber-dim); color:var(--amber); font-size:13px; padding:5px 12px; font-family:inherit; cursor:pointer; white-space:nowrap; }
  .rc-meta { font-size:12px; color:var(--amber-dim); }
  .rc-body { flex:1; min-height:0; display:flex; gap:18px; padding:16px; }
  .rc-body.phone { padding:10px; overflow-y:auto; display:block; }
  /* cabinet */
  .rc-cab { width:420px; flex-shrink:0; overflow-y:auto; background:linear-gradient(90deg,#3b3f45,#585e66 12%,#4a4f56 50%,#3a3e44); border:2px solid #000;
    box-shadow:0 14px 30px rgba(0,0,0,.7), inset 0 2px 0 rgba(255,255,255,.12); padding:14px 12px; display:flex; flex-direction:column; gap:10px; text-shadow:none; }
  .rc-body.phone .rc-cab { width:auto; overflow:visible; }
  .rc-cabtop { font-size:10.5px; letter-spacing:3px; color:#1a1c1f; text-align:center; background:#d8d2c0; padding:3px 0; box-shadow:inset 0 0 0 1px #000; }
  .rc-drawer { position:relative; width:100%; height:78px; display:flex; align-items:center; justify-content:center; gap:16px; cursor:pointer; font-family:inherit;
    background:linear-gradient(180deg,#5d636b,#454a51); border:2px solid #1d1f22; box-shadow:inset 0 2px 0 rgba(255,255,255,.12), inset 0 -3px 0 rgba(0,0,0,.35); transition:filter .12s; }
  .rc-drawer:hover { filter:brightness(1.12); }
  .rc-drawer.open { height:54px; }
  .rc-label { background:#efe7d3; color:#1d1711; width:200px; padding:5px 8px; text-align:center; box-shadow:inset 0 0 0 2px #2b2b2b, 0 0 0 3px #8e949b; font-size:13px; line-height:1.2; }
  .rc-label small { display:block; font-size:9.5px; color:#5d4f3c; letter-spacing:1px; }
  .rc-pull { width:64px; height:15px; border-radius:8px !important; background:linear-gradient(180deg,#b9bec5,#6a7078); box-shadow:0 2px 0 #000; }
  .rc-cnt { position:absolute; right:8px; bottom:4px; font-size:10px; color:#d8d2c0; letter-spacing:1px; text-shadow:0 1px 0 #000; }
  .rc-openmark { position:absolute; left:8px; bottom:4px; font-size:10px; color:#6ef59b; text-shadow:0 0 6px #22c55e; }
  .rc-slot { background:linear-gradient(180deg,#26292d,#1a1c1f); border:2px solid #111; border-top:none; box-shadow:inset 0 10px 18px rgba(0,0,0,.75); padding:14px 10px 10px;
    display:flex; flex-direction:column; gap:0; max-height:330px; overflow-y:auto; }
  .rc-body.phone .rc-slot { max-height:none; }
  .rc-folder { position:relative; display:block; flex-shrink:0; width:100%; height:50px; margin-top:-6px; padding:0; border:none; cursor:pointer; text-align:left; font-family:inherit;
    background:linear-gradient(180deg,#e2c487,#d2b06f); box-shadow:0 -2px 6px rgba(0,0,0,.45); border-top:1px solid #8a6a32; transition:transform .12s; }
  .rc-folder:first-child { margin-top:12px; }
  .rc-folder:hover { filter:brightness(1.08); }
  .rc-folder.sel { transform:translateY(-6px); }
  .rc-folder.sel { background:linear-gradient(180deg,#f0d59b,#e2c487); }
  .rc-tab { position:absolute; top:-14px; left:var(--tab); height:16px; padding:0 9px; background:inherit; border:1px solid #8a6a32; border-bottom:none; color:#2a1f10; font-size:11.5px; line-height:15px;
    white-space:nowrap; max-width:60%; overflow:hidden; text-overflow:ellipsis; box-shadow:inset 0 2px 0 var(--rc); }
  .rc-edge { position:absolute; left:calc(var(--tab) + 10px); right:10px; top:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:10px; letter-spacing:1px; color:#6b5326; }
  .rc-folder.sealed { background:linear-gradient(180deg,#b9a678,#a8946a); }
  .rc-folder.sealed .rc-edge { color:#4a3d22; }
  .rc-bar { color:#111; letter-spacing:-1px; }
  .rc-folder.case { background:linear-gradient(180deg,#c9b9e0,#b7a5d2); }
  .rc-folder.case .rc-tab, .rc-folder.case .rc-edge { color:#21183a; }
  /* desk */
  .rc-desk { flex:1; min-width:0; position:relative; overflow:auto; }
  .rc-empty { height:100%; display:flex; align-items:center; justify-content:center; color:var(--amber-dim); font-size:14px; letter-spacing:1px; }
  .rc-folderopen { position:relative; display:flex; gap:4px; padding:14px; background:#c8a463; transform:rotate(-.8deg); box-shadow:0 18px 40px rgba(0,0,0,.75); margin:6px 10px 14px 4px;
    animation: rcOpen .28s cubic-bezier(.2,.9,.25,1.05) both; text-shadow:none; }
  .rc-page { flex:1; min-width:0; position:relative; color:#211a12; padding:14px 18px 18px;
    background:radial-gradient(ellipse at 30% 15%, rgba(255,255,255,.45), transparent 60%), repeating-linear-gradient(0deg,rgba(120,95,60,.05) 0 1px,transparent 1px 3px), #ece2c9; }
  .rc-hd { display:flex; justify-content:space-between; gap:8px; font-size:10px; letter-spacing:1.5px; color:#6f6150; border-bottom:1.5px solid #211a12; padding-bottom:4px; }
  .rc-photo { position:relative; display:block; margin:16px auto 10px; width:min(230px,70%); aspect-ratio:4/5; padding:0; border:none; cursor:zoom-in; overflow:visible;
    background:linear-gradient(180deg,#c9a24a,#6b5326); box-shadow:0 0 0 7px #f6f0e0, 0 4px 10px 6px rgba(0,0,0,.25); transform:rotate(2deg); }
  .rc-photo img { width:100%; height:100%; object-fit:cover; display:block; }
  .rc-clip { position:absolute; top:-10px; left:50%; transform:translateX(-50%); width:58px; height:20px; z-index:2; background:linear-gradient(180deg,#3a3a3a,#0e0e0e); box-shadow:0 2px 3px rgba(0,0,0,.5); }
  .rc-clip::before { content:''; position:absolute; left:8px; right:8px; top:-12px; height:14px; border:2.5px solid #c9ccd1; border-bottom:none; }
  .rc-name { font-family:var(--font-dramatic); font-size:clamp(30px,3.4vw,46px); line-height:1; margin:6px 0 4px; }
  .rc-row { display:flex; gap:10px; border-bottom:1px dotted rgba(40,30,20,.35); padding:3px 0; font-size:13px; }
  .rc-row i { font-style:normal; font-size:9.5px; letter-spacing:1.5px; color:#6f6150; width:86px; flex-shrink:0; padding-top:2px; }
  .rc-stamp { position:absolute; right:16px; top:56px; font-family:var(--font-hit); font-size:30px; letter-spacing:1px; padding:0 10px; border:4px solid currentColor; border-radius:6px !important;
    transform:rotate(-12deg); opacity:.85; mix-blend-mode:multiply; pointer-events:none; animation: rcStamp .3s .2s cubic-bezier(.3,1.4,.5,1) both; }
  .rc-sect { font-size:10px; letter-spacing:1.5px; color:#6f6150; margin:12px 0 4px; border-bottom:1px solid #211a12; }
  .rc-kit { font-size:12.5px; line-height:1.45; }
  .rc-kit b { font-weight:400; color:#9a6b00; }
  .rc-small { font-size:11px; color:#6f6150; margin-top:2px; }
  .rc-com { display:flex; gap:6px; margin-top:4px; }
  .rc-com span { width:28px; height:28px; border:2px solid #211a12; display:grid; place-items:center; font-size:15px; }
  .rc-com span.on { background:#b3121b; color:#fff; border-color:#b3121b; }
  .rc-note { font-family:var(--font-hand); color:#22306e; font-size:19px; line-height:1.25; }
  .rc-note.none { color:rgba(34,48,110,.35); }
  .rc-links { display:flex; flex-wrap:wrap; gap:6px 10px; font-size:12.5px; }
  .rc-links button { background:none; border:none; border-bottom:1px solid #211a12; padding:0; color:#211a12; font-family:inherit; font-size:12.5px; cursor:pointer; }
  .rc-red { background:#111; color:#111; }
  .rc-sealedbox { margin:16px auto 10px; width:min(230px,70%); aspect-ratio:4/5; background:#1b1b1b; color:#3a3a3a; display:grid; place-items:center; font-size:80px; box-shadow:0 0 0 7px #f6f0e0; }
  /* ID badge (the card) clipped to the personnel file */
  .rc-badge { position:absolute; right:-14px; top:34px; width:min(31%,150px); padding:7px 7px 5px; border:none; cursor:zoom-in; z-index:3;
    background:#e7e2d4; box-shadow:0 8px 16px rgba(0,0,0,.45); transform:rotate(7deg); font-family:inherit; transition:transform .15s; }
  .rc-badge:hover { transform:rotate(4deg) scale(1.04); }
  .rc-badge img { display:block; width:100%; aspect-ratio:2633/3752; object-fit:cover; }
  .rc-lanyard { position:absolute; left:50%; top:-60px; width:16px; height:56px; transform:translateX(-50%);
    background:repeating-linear-gradient(180deg,#b3121b 0 6px,#7a0c12 6px 8px); box-shadow:0 2px 4px rgba(0,0,0,.4); }
  .rc-badgeclip { position:absolute; left:50%; top:-9px; width:26px; height:14px; transform:translateX(-50%); border-radius:4px; z-index:2;
    background:linear-gradient(180deg,#d9dde2,#8a9098); box-shadow:0 1px 2px rgba(0,0,0,.5); }
  .rc-badgetag { display:block; font-size:9px; letter-spacing:1.5px; color:#3a2e20; text-align:center; margin-top:4px; }
  .rc-blank { display:inline-block; width:170px; max-width:100%; border-bottom:1.5px dotted rgba(40,30,20,.45); height:13px; }
  .rc-ruled { font-size:12.5px; line-height:22px; min-height:66px; padding:0 4px;
    background:repeating-linear-gradient(180deg,transparent 0 21px,rgba(60,90,160,.28) 21px 22px); }
  .rc-ruled.empty span { font-size:11px; color:rgba(40,30,20,.35); letter-spacing:1px; }
  /* evidence polaroid */
  .rc-pol { position:relative; display:block; margin:18px auto 10px; width:min(240px,75%); padding:10px 10px 6px; background:#f3efe6; border:none; cursor:zoom-in; font-family:inherit;
    box-shadow:0 8px 18px rgba(0,0,0,.35); transform:rotate(-2deg); }
  .rc-tape { position:absolute; top:-10px; left:50%; width:44%; height:20px; transform:translateX(-50%) rotate(-3deg); background:rgba(235,225,190,.8); z-index:2;
    clip-path: polygon(3% 0, 97% 4%, 100% 50%, 96% 100%, 2% 96%, 0 45%); }
  .rc-polimg { position:relative; display:grid; place-items:center; aspect-ratio:1/1; overflow:hidden; background:#222; color:#555; font-size:46px; }
  .rc-polimg img { width:100%; height:100%; object-fit:cover; }
  .rc-polimg img.framed { position:absolute; width:132.4%; height:auto; left:-16.2%; top:-13.2%; max-width:none; }
  .rc-cap { display:block; font-family:var(--font-hand); font-size:20px; color:#22306e; text-align:center; margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .rc-board { display:flex; flex-wrap:wrap; gap:18px; justify-content:center; margin-top:16px; }
  .rc-pol.small { width:170px; margin:8px 0; }
  .rc-pol.small .rc-cap { font-size:16px; }
  .rc-pol.missing { cursor:default; opacity:.6; }
  /* phone sheet */
  .rc-sheet { position:fixed; inset:0; z-index:50; overflow-y:auto; background:rgba(5,3,2,.94); padding:10px 8px 24px; }
  .rc-close { display:block; margin:0 0 6px auto; background:transparent; border:1px solid var(--amber-dim); color:var(--amber); font-family:inherit; font-size:13px; padding:5px 12px; }
  .rc-sheet .rc-folderopen { flex-direction:column; transform:none; margin:6px 2px; }
  .rc-art { position:fixed; inset:0; z-index:100; background:rgba(0,0,0,.95); display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; }
  .rc-art img { max-width:90vw; max-height:80vh; object-fit:contain; }
  @media (max-width: 700px) { .rc-openmark { display:none; } .rc-cabtop { font-size:9px; letter-spacing:2px; } .rc-top { gap:8px; padding:8px 10px; } }
  @keyframes rcOpen { from { opacity:0; transform: translateY(24px) rotate(-3deg); } to { opacity:1; transform: rotate(-.8deg); } }
  @keyframes rcStamp { from { opacity:0; transform: rotate(-12deg) scale(2.4); } to { opacity:.85; transform: rotate(-12deg) scale(1); } }
`;
