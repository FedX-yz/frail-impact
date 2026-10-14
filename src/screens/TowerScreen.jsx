import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CHAPTERS } from '../story/chapters';
import { asset, chapterOpen, checkStory, findNode, nextNode, nodeOpen, nodeVisible, EMPTY_STORY } from '../story/story';
import { CODEC, STORY_CSS } from '../story/codecStyle';
import StoryLevel from '../story/StoryLevel';
import { ENEMY_TYPES } from '../combat/enemies';
import { MODIFIERS } from '../combat/stages';
import { fmt } from '../combat/engine';
import useIsMobile from '../hooks/useIsMobile';
import { playPress, playClose } from '../utils/sfx';
import { thumb } from '../utils/assets';

const BASE = import.meta.env.BASE_URL;
const MAP_ASPECT = 16 / 9;

const kindOf = (n) => (!n.battle ? 'story' : n.battle.boss ? 'boss' : 'battle');
const ICON = { story: '📖', battle: '⚔', boss: '💀' };

// The Tower: chapter maps made of nodes. Pick a node → play its level.
export default function TowerScreen({ navigate, story, setStory, stats, deck, devMode, onReward, coins, pullCurrency }) {
  const { mobile, portrait } = useIsMobile();
  const [unlockAll, setUnlockAll] = useState(false);
  const [playing, setPlaying] = useState(null);       // node id being played
  const [toast, setToast] = useState(null);

  const startChapter = () => {
    const at = story.at && findNode(story.at);
    if (at) return CHAPTERS.indexOf(at.chapter);
    const open = CHAPTERS.map((c, i) => [c, i]).filter(([c]) => chapterOpen(c, story));
    return open.length ? open[open.length - 1][1] : 0;
  };
  const [chIdx, setChIdx] = useState(startChapter);
  const ch = CHAPTERS[chIdx];
  const open = chapterOpen(ch, story, unlockAll);
  const [sel, setSel] = useState(() => (story.at && ch.nodes.some(n => n.id === story.at) ? story.at : nextNode(ch, story).id));
  const [panel, setPanel] = useState(false);
  const selNode = ch.nodes.find(n => n.id === sel) ?? ch.nodes[0];

  // typo check for the story files (developer mode / npm run dev)
  const problems = useMemo(() => {
    if (!devMode && !import.meta.env.DEV) return [];
    const p = checkStory();
    p.forEach(x => console.warn('[story]', x));
    return p;
  }, [devMode]);

  const say = (t) => { setToast(t); setTimeout(() => setToast(x => (x === t ? null : x)), 1800); };
  const switchChapter = (d) => {
    const i = chIdx + d;
    if (i < 0 || i >= CHAPTERS.length) return;
    playPress();
    setChIdx(i); setPanel(false);
    const c = CHAPTERS[i];
    setSel(story.at && c.nodes.some(n => n.id === story.at) ? story.at : nextNode(c, story).id);
  };

  const pick = (n) => {
    if (!nodeOpen(n, ch, story, unlockAll)) {
      const from = (n.after ?? []).map(id => findNode(id)?.node.name).filter(Boolean);
      say(open ? `🔒 Clear ${from.join(' or ') || 'the earlier levels'} first` : '🔒 This chapter is still locked');
      return;
    }
    playPress();
    if (n.id === sel && panel) return;
    setSel(n.id);
    setPanel(true);
  };

  const play = () => {
    if (!nodeOpen(selNode, ch, story, unlockAll)) return;
    playPress();
    setStory(s => ({ ...s, at: selNode.id }));
    setPlaying(selNode.id);
  };

  // finished a level: mark it cleared, keep the flags, pay first-clear rewards
  const playingNode = playing ? findNode(playing)?.node : null;
  const complete = useCallback(({ flags, firstClear }) => {
    if (!playingNode) return;
    setStory(s => ({ ...s, flags, at: playingNode.id, cleared: { ...s.cleared, [playingNode.id]: true } }));
    if (firstClear) onReward({ coins: playingNode.rewards?.coins ?? 0, gems: playingNode.rewards?.gems ?? 0 });
  }, [playingNode, setStory, onReward]);

  // map size: fits the screen; on a tall phone it's full height and scrolls sideways
  const viewRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const measure = () => {
      const vw = el.clientWidth, vh = el.clientHeight;
      if (!vw || !vh) return;
      const fit = vw / vh > MAP_ASPECT ? { w: vh * MAP_ASPECT, h: vh } : vw / vh > 1.2 ? { w: vw, h: vw / MAP_ASPECT } : { w: vh * MAP_ASPECT, h: vh };
      setSize({ ...fit, scrolls: fit.w > vw + 1 });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el); measure();
    return () => ro.disconnect();
  }, [playing]);
  // keep the selected node on screen when the map scrolls
  useEffect(() => {
    const el = viewRef.current;
    if (!el || !size.w || el.scrollWidth <= el.clientWidth) return;
    el.scrollTo({ left: selNode.x / 100 * size.w - el.clientWidth / 2, behavior: 'smooth' });
  }, [sel, size.w, selNode.x]);

  // Enter = play, Esc = close the card / leave
  useEffect(() => {
    if (playing) return;
    const onKey = (e) => {
      if (e.key === 'Enter' && panel) play();
      if (e.key === 'Escape') { if (panel) setPanel(false); else { playClose(); navigate('main'); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (playingNode) {
    return (
      <StoryLevel key={playing} node={playingNode} story={story} stats={stats} mainCard={deck?.main ?? null}
        mobile={mobile} portrait={portrait} devMode={devMode} onReward={onReward}
        onComplete={complete} onLeave={() => setPlaying(null)} />
    );
  }

  const visible = ch.nodes.filter(n => nodeVisible(n, story) || unlockAll);
  const state = (n) => (story.cleared[n.id] ? 'cleared' : nodeOpen(n, ch, story, unlockAll) ? 'open' : 'locked');
  const clearedCount = ch.nodes.filter(n => story.cleared[n.id]).length;
  const nodeSize = mobile ? 46 : 58;
  const mapBg = asset(ch.map);
  const mc = deck?.main;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#070b14', fontFamily: "'Segoe UI',sans-serif", userSelect: 'none', color: '#ddd',
      cursor: mobile ? 'auto' : `url(${BASE}ui/mouse.png) 0 0, auto` }}>
      <style>{STORY_CSS + TOWER_CSS}</style>

      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 6 : 12, padding: mobile ? '6px 8px' : '8px 16px', background: '#141928', borderBottom: '2px solid #ff8c00', flexShrink: 0 }}>
        <button className="tw-back" onPointerDown={() => playClose()} onClick={() => navigate('main')}>← back</button>
        {!mobile && <div style={{ color: '#ff8c00', fontWeight: 800, letterSpacing: 3, fontSize: 18 }}>TOWER</div>}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 0 }}>
          <button className="tw-arrow" disabled={chIdx === 0} onClick={() => switchChapter(-1)} aria-label="Previous chapter">◀</button>
          <div style={{ textAlign: 'center', minWidth: 0 }}>
            <div style={{ color: CODEC.yellow, fontFamily: CODEC.font, fontWeight: 900, fontSize: mobile ? 13 : 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {open ? '' : '🔒 '}{ch.name}
            </div>
            <div style={{ color: '#667', fontSize: 11 }}>{clearedCount}/{ch.nodes.length} cleared</div>
          </div>
          <button className="tw-arrow" disabled={chIdx === CHAPTERS.length - 1} onClick={() => switchChapter(1)} aria-label="Next chapter">▶</button>
        </div>
        <div className="tw-pill" style={{ borderColor: '#5588ff' }}><img src={`${BASE}ui/ui_frailite.png`} alt="gems" />{pullCurrency}</div>
        {!mobile && <div className="tw-pill" style={{ borderColor: '#cc8800', color: '#f0c040' }}><img src={`${BASE}ui/ui_cucoin.png`} alt="coins" />{fmt(coins)}</div>}
      </div>

      {/* map */}
      <div ref={viewRef} className="tw-view" style={{ flex: 1, minHeight: 0, position: 'relative', overflowX: 'auto', overflowY: 'hidden', display: 'flex', justifyContent: size.scrolls ? 'flex-start' : 'center', alignItems: 'center' }}
        onPointerDown={e => { if (e.target === e.currentTarget) setPanel(false); }}>
        {size.w > 0 && (
          <div style={{ position: 'relative', width: size.w, height: size.h, flexShrink: 0, overflow: 'hidden',
            background: mapBg ? `#0b1220 url(${mapBg}) center/100% 100% no-repeat` : PLACEHOLDER_BG, filter: open ? 'none' : 'grayscale(0.8) brightness(0.6)' }}
            onPointerDown={e => { if (e.target === e.currentTarget) setPanel(false); }}>
            {!mapBg && <div style={{ position: 'absolute', right: '3%', bottom: '4%', fontFamily: CODEC.font, fontWeight: 900, fontSize: size.h * 0.09, color: 'rgba(255,255,255,0.05)', letterSpacing: 4, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
              {ch.name.split('—').pop().trim().toUpperCase()}
            </div>}

            {/* paths */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {visible.flatMap(n => (n.after ?? []).map(id => {
                const a = visible.find(x => x.id === id);
                if (!a) return null;
                const lit = !!story.cleared[a.id] || unlockAll;
                const mx = (a.x + n.x) / 2, my = (a.y + n.y) / 2 - Math.abs(n.x - a.x) * 0.12;
                return (
                  <g key={`${id}>${n.id}`}>
                    <path d={`M${a.x} ${a.y} Q${mx} ${my} ${n.x} ${n.y}`} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={mobile ? 9 : 12} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                    <path d={`M${a.x} ${a.y} Q${mx} ${my} ${n.x} ${n.y}`} fill="none" stroke={lit ? '#ffd166' : '#4b5568'} strokeWidth={mobile ? 4 : 5}
                      strokeDasharray={lit ? 'none' : '2 9'} vectorEffect="non-scaling-stroke" strokeLinecap="round" className={lit && !story.cleared[n.id] ? 'tw-path-new' : ''} />
                  </g>
                );
              }))}
            </svg>

            {/* nodes */}
            {visible.map(n => {
              const st = state(n), kind = kindOf(n);
              const isSel = n.id === sel;
              return (
                <button key={n.id} data-node={n.id} className={`tw-node ${st}${isSel ? ' sel' : ''} ${kind}`} onClick={() => pick(n)}
                  style={{ left: `${n.x}%`, top: `${n.y}%`, width: nodeSize * (kind === 'boss' ? 1.25 : 1), height: nodeSize * (kind === 'boss' ? 1.25 : 1) }}
                  aria-label={`${n.name}${st === 'locked' ? ' (locked)' : st === 'cleared' ? ' (cleared)' : ''}`}>
                  <span style={{ fontSize: nodeSize * (kind === 'boss' ? 0.5 : 0.42), filter: st === 'locked' ? 'grayscale(1) opacity(0.5)' : 'none' }}>{st === 'locked' ? '🔒' : ICON[kind]}</span>
                  {st === 'cleared' && <span className="tw-check">✓</span>}
                  <span className="tw-label" style={{ fontSize: mobile ? 11 : 13 }}>{n.name}</span>
                </button>
              );
            })}

            {/* you */}
            <div className="tw-marker" style={{ left: `${selNode.x}%`, top: `${selNode.y}%`, transform: `translate(-50%, calc(-100% - ${nodeSize * (kindOf(selNode) === 'boss' ? 0.62 : 0.5) + 4}px))` }}>
              <div style={{ width: mobile ? 34 : 42, height: mobile ? 34 : 42, borderRadius: '50%', border: `3px solid ${CODEC.yellow}`, overflow: 'hidden', background: '#1a2035', boxShadow: '0 4px 10px rgba(0,0,0,0.6)' }}>
                {mc ? <img src={thumb(mc.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: '#ff8c00' }} />}
              </div>
              <div style={{ width: 0, height: 0, margin: '-1px auto 0', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: `9px solid ${CODEC.yellow}` }} />
            </div>
          </div>
        )}
      </div>

      {/* node card */}
      {panel && <NodeCard node={selNode} story={story} mobile={mobile} onPlay={play} onClose={() => setPanel(false)} />}

      {!panel && (
        <div style={{ position: 'absolute', bottom: mobile ? 10 : 16, left: '50%', transform: 'translateX(-50%)', color: '#8899aa', fontSize: 12, background: 'rgba(7,11,20,0.75)', padding: '5px 12px', borderRadius: 20, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {open ? 'Pick a level on the map' : `🔒 Clear ${findNode(ch.after)?.node.name ?? 'the previous chapter'} to open this chapter`}
        </div>
      )}

      {toast && <div className="tw-toast">{toast}</div>}

      {devMode && (
        <div style={{ position: 'absolute', top: mobile ? 56 : 66, right: 8, background: 'rgba(30,10,50,0.92)', border: '1px solid #a855f7', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, maxWidth: 280, zIndex: 5 }}>
          <b style={{ color: '#e9d5ff' }}>🛠 Story dev</b>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#ddd' }}>
            <input type="checkbox" checked={unlockAll} onChange={e => setUnlockAll(e.target.checked)} /> Unlock every node
          </label>
          <button style={{ fontSize: 12, padding: '3px 8px', background: '#3b0764', color: '#fff', border: '1px solid #a855f7' }}
            onClick={() => { if (confirm('Reset story progress and flags?')) { setStory({ ...EMPTY_STORY }); setSel(nextNode(ch, EMPTY_STORY).id); setPanel(false); } }}>Reset story progress</button>
          <div style={{ color: '#c4b5fd' }}>Flags: {Object.entries(story.flags).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}</div>
          {problems.length > 0 && (
            <details style={{ color: '#fca5a5' }}>
              <summary>⚠ {problems.length} problem{problems.length > 1 ? 's' : ''} in the story files</summary>
              <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function NodeCard({ node, story, mobile, onPlay, onClose }) {
  const cleared = !!story.cleared[node.id];
  const b = node.battle;
  const kind = kindOf(node);
  const mod = b?.modifier && MODIFIERS[b.modifier];
  const r = node.rewards ?? {};
  return (
    // PC: on the side of the screen away from the node, so it never covers it
    <div className="tw-card" style={mobile
      ? { left: 8, right: 8, bottom: 8 }
      : { [node.x < 50 ? 'right' : 'left']: 16, bottom: 16, width: 340 }}>
      <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', color: CODEC.yellow, fontSize: 18, padding: 4 }}>✕</button>
      <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 900, color: kind === 'boss' ? '#ff6b4a' : kind === 'story' ? '#93c5fd' : '#a7f3d0' }}>
        {kind === 'boss' ? 'BOSS' : kind === 'story' ? 'STORY' : 'BATTLE'}
      </div>
      <div style={{ color: CODEC.yellow, fontWeight: 900, fontSize: 22, lineHeight: 1.15, paddingRight: 24 }}>{node.name}</div>
      {node.desc && <div style={{ color: '#d1fae5', fontSize: 13, fontFamily: "'Segoe UI',sans-serif" }}>{node.desc}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {b && <span className="tw-chip">LV {b.level ?? 1}</span>}
        {b?.boss && <span className="tw-chip" style={{ borderColor: '#ff6b4a', color: '#ffb4a2' }}>💀 {ENEMY_TYPES[b.boss]?.name}</span>}
        {mod && <span className="tw-chip" style={{ borderColor: mod.color, color: mod.color }} title={mod.desc}>◆ {mod.name}</span>}
        {(node.intro || node.outro) && <span className="tw-chip">📖 cutscene</span>}
      </div>
      {mod && <div style={{ color: '#a7c4b5', fontSize: 12, fontFamily: "'Segoe UI',sans-serif" }}>{mod.desc}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <div style={{ flex: 1, display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, fontWeight: 900 }}>
          {cleared ? <span style={{ color: '#4ade80' }}>✓ Cleared</span> : (
            <>
              {r.gems ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#93c5fd' }}><img src={`${BASE}ui/ui_frailite.png`} alt="gems" style={{ width: 20, height: 20, imageRendering: 'pixelated' }} />{r.gems}</span> : null}
              {r.coins ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f0c040' }}><img src={`${BASE}ui/ui_cucoin.png`} alt="coins" style={{ width: 20, height: 20, imageRendering: 'pixelated' }} />{fmt(r.coins)}</span> : null}
              {!r.gems && !r.coins && <span style={{ color: '#667' }}>no reward</span>}
            </>
          )}
        </div>
        <button className="tw-play" onClick={onPlay} autoFocus={!mobile}>{cleared ? '↻ REPLAY' : '▶ ENTER'}</button>
      </div>
    </div>
  );
}

// Placeholder map until the real map art is in (chapter.map in chapters.js)
const PLACEHOLDER_BG = [
  'radial-gradient(ellipse at 20% 80%, rgba(56,189,148,0.18), transparent 45%)',
  'radial-gradient(ellipse at 85% 30%, rgba(244,114,94,0.2), transparent 45%)',
  'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px) 0 0/40px 40px',
  'linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px) 0 0/40px 40px',
  'linear-gradient(160deg, #13203a, #0b1424 60%, #10172b)',
].join(', ');

const TOWER_CSS = `
  .tw-back { background:none; border:1px solid #445; color:#ccc; border-radius:6px; padding:5px 12px; font-size:14px; cursor:pointer; flex-shrink:0; }
  .tw-back:hover { border-color:#ff8c00; color:#ff8c00; }
  .tw-arrow { background:none; border:none; color:${CODEC.yellow}; font-size:16px; padding:4px 8px; cursor:pointer; }
  .tw-arrow:disabled { opacity:0.2; cursor:default; }
  .tw-pill { display:flex; align-items:center; gap:5px; background:#0f1420; border:2px solid; border-radius:20px; padding:2px 10px 2px 4px; font-weight:700; font-size:14px; color:#fff; flex-shrink:0; }
  .tw-pill img { width:20px; height:20px; object-fit:contain; image-rendering:pixelated; }
  .tw-view { scrollbar-width: thin; scrollbar-color: #334 transparent; }
  .tw-node { position:absolute; transform:translate(-50%,-50%); border-radius:50%; padding:0; display:flex; align-items:center; justify-content:center;
             border:4px solid #4b5568; background:radial-gradient(circle at 40% 35%, #2a3550, #121a2c); box-shadow:0 5px 0 rgba(0,0,0,0.45), 0 8px 18px rgba(0,0,0,0.4);
             cursor:pointer; transition:transform 0.12s, border-color 0.2s; z-index:2; touch-action:manipulation; }
  .tw-node:hover { transform:translate(-50%,-50%) scale(1.08); }
  .tw-node.open { border-color:#ffd166; background:radial-gradient(circle at 40% 35%, #3a4f2d, #1d2a14); animation: nodePulse 1.6s ease-in-out infinite; }
  .tw-node.cleared { border-color:#4ade80; background:radial-gradient(circle at 40% 35%, #1f5a3c, #0f2d1e); }
  .tw-node.boss.open { border-color:#ff6b4a; background:radial-gradient(circle at 40% 35%, #5a1f1f, #2a0d0d); }
  .tw-node.locked { cursor:not-allowed; }
  .tw-node.sel { outline:3px solid ${CODEC.yellow}; outline-offset:4px; }
  .tw-check { position:absolute; right:-6px; top:-6px; width:20px; height:20px; border-radius:50%; background:#4ade80; color:#052e16; font-size:13px; font-weight:900;
              display:flex; align-items:center; justify-content:center; border:2px solid #052e16; }
  .tw-label { position:absolute; top:calc(100% + 6px); left:50%; transform:translateX(-50%); white-space:nowrap; font-weight:800; color:#e2e8f0;
              text-shadow:0 1px 3px #000, 0 0 6px #000; pointer-events:none; letter-spacing:0.3px; }
  .tw-node.locked .tw-label { color:#64748b; }
  .tw-node.open .tw-label { color:#ffd166; }
  @keyframes nodePulse { 0%,100% { box-shadow:0 5px 0 rgba(0,0,0,0.45), 0 0 0 0 rgba(255,209,102,0.55); } 50% { box-shadow:0 5px 0 rgba(0,0,0,0.45), 0 0 0 10px rgba(255,209,102,0); } }
  .tw-marker { position:absolute; z-index:3; pointer-events:none; transition:left 0.45s cubic-bezier(.4,1.3,.5,1), top 0.45s cubic-bezier(.4,1.3,.5,1); animation: markerBob 1.2s ease-in-out infinite; }
  @keyframes markerBob { 50% { margin-top:-5px; } }
  .tw-path-new { stroke-dasharray: 6 6; animation: pathFlow 0.8s linear infinite; }
  @keyframes pathFlow { to { stroke-dashoffset: -12; } }
  .tw-card { position:absolute; z-index:6; display:flex; flex-direction:column; gap:8px; padding:14px 16px; font-family:${CODEC.font};
             background: radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1.2px) 0 0/4px 4px, linear-gradient(${CODEC.green}, ${CODEC.greenDark});
             border:3px solid ${CODEC.yellow}; box-shadow:0 10px 30px rgba(0,0,0,0.55); animation: codecIn 0.2s ease-out; }
  .tw-chip { font-size:11px; font-weight:800; border:1px solid #6ee7b7; color:#a7f3d0; padding:2px 7px; border-radius:3px; background:rgba(0,0,0,0.25); }
  .tw-play { font-family:${CODEC.font}; font-weight:900; font-size:16px; letter-spacing:1px; background:${CODEC.yellow}; color:#0b2e20; border:none; border-radius:0;
             padding:10px 18px; cursor:pointer; box-shadow:0 4px 0 #8a8320; flex-shrink:0; }
  .tw-play:hover { filter:brightness(1.08); }
  .tw-play:active { transform:translateY(3px); box-shadow:0 1px 0 #8a8320; }
  .tw-toast { position:absolute; left:50%; top:72px; transform:translateX(-50%); z-index:8; background:rgba(15,20,32,0.95); border:1px solid #475569; color:#e2e8f0;
              padding:8px 16px; border-radius:20px; font-size:13px; white-space:nowrap; animation: codecIn 0.2s ease-out; }
  @media (prefers-reduced-motion: reduce) { .tw-node.open, .tw-marker, .tw-path-new { animation:none; } }
`;
