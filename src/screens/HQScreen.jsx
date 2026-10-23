// Frail Initiative HQ: coins upgrade rooms (combat/hq.js); their bonuses apply to
// every fight. Same amber look as the other menus: one card per room, grouped by floor,
// a summary of what's built, and a short activity readout of recent upgrades.
import { useState } from 'react';
import { FACILITIES, facilityCost, maxed, describeEffect } from '../combat/hq';
import { fmt } from '../combat/engine';
import { playClose, sfx } from '../utils/sfx';
import useIsMobile from '../hooks/useIsMobile';
import TermTitle from '../components/TermTitle';
import { Icon } from '../components/Icon';

const BASE = import.meta.env.BASE_URL;
const FLOORS = [
  { label: 'B1', name: 'FIELD SUPPORT', rooms: ['armory', 'infirmary', 'security'] },
  { label: '2F', name: 'OPERATIONS', rooms: ['analytics', 'ops'] },
  { label: '3F', name: 'ADMINISTRATION', rooms: ['payroll'] },
];
const byId = id => FACILITIES.find(f => f.id === id);
const Coin = ({ size = 16 }) => <img src={`${BASE}ui/ui_cucoin.png`} alt="" style={{ width: size, height: size, imageRendering: 'pixelated', verticalAlign: 'middle', flexShrink: 0 }} />;
const clock = () => new Date().toTimeString().slice(0, 5);

export default function HQScreen({ navigate, coins, hq, buy }) {
  const { mobile } = useIsMobile();
  const [feed, setFeed] = useState([]);   // recent upgrades: { t, s, ok }
  const [flash, setFlash] = useState(null);

  const upgrade = (f) => {
    const lv = hq[f.id] ?? 0;
    if (buy(f.id)) {
      sfx('combo', 0);
      setFlash({ id: f.id, n: Date.now() });
      setFeed(l => [{ t: clock(), s: `${f.name} → LV ${lv + 1} · ${describeEffect(f, lv + 1)}`, ok: true }, ...l].slice(0, 4));
    } else {
      sfx('miss');
      setFeed(l => [{ t: clock(), s: `${f.name}: not enough coins`, ok: false }, ...l].slice(0, 4));
    }
  };
  const built = FACILITIES.filter(f => (hq[f.id] ?? 0) > 0);
  const ready = FACILITIES.filter(f => !maxed(f, hq[f.id] ?? 0) && coins >= facilityCost(f, hq[f.id] ?? 0)).length;

  const summary = (
    <div className="hm-side">
      <div className="hm-sidehd">HQ BONUSES · EVERY FIGHT</div>
      {built.length === 0
        ? <div className="hm-none">Nothing built yet. Rooms cost coins, and what they give applies to every fight, endless and story.</div>
        : built.map(f => <div key={f.id} className="hm-sum"><Icon name={f.id} size={18} /><span>{f.name}</span><b>{describeEffect(f, hq[f.id])}</b></div>)}
      <div className="hm-sidehd" style={{ marginTop: 16 }}>ACTIVITY</div>
      {feed.length === 0
        ? <div className="hm-none dim">&gt; awaiting orders<span className="term-cursor">_</span></div>
        : feed.map((l, i) => <div key={`${l.t}-${i}-${l.s}`} className={`hm-feed${l.ok ? '' : ' bad'}${i === 0 ? ' new' : ''}`}><i>{l.t}</i> {l.s}</div>)}
    </div>
  );

  return (
    <div className="hm-root">
      <style>{CSS}</style>
      <div className="hm-top">
        <button className="hm-btn" onPointerDown={playClose} onClick={() => navigate('main')}>[&nbsp;back&nbsp;]</button>
        <TermTitle path="HQ" small={mobile} />
        <div className="hm-coins"><Coin size={20} /><span>{fmt(coins)}</span></div>
        <div style={{ flex: 1 }} />
        {!mobile && <span className={`hm-ready${ready ? ' on' : ''}`}>{ready ? `${ready} upgrade${ready === 1 ? '' : 's'} affordable` : 'earn coins in the field to upgrade'}</span>}
      </div>

      <div className="hm-body">
        <div className="hm-floors">
          {FLOORS.map(fl => (
            <section key={fl.label} className="hm-floor">
              <div className="hm-flhd"><b>{fl.label}</b> {fl.name}<span /></div>
              <div className="hm-grid">
                {fl.rooms.map(id => {
                  const f = byId(id), lv = hq[id] ?? 0, done = maxed(f, lv), cost = facilityCost(f, lv), can = !done && coins >= cost;
                  return (
                    <div key={`${id}-${flash?.id === id ? flash.n : 0}`} className={`hm-card${lv ? ' on' : ''}${flash?.id === id ? ' flash' : ''}`}>
                      <div className="hm-cardhd"><span>{f.room}</span><b>{f.name}</b></div>
                      <div className="hm-cardbody">
                        <div className={`hm-icon${lv ? '' : ' off'}`}><Icon name={id} size={mobile ? 50 : 56} /></div>
                        <div className="hm-info">
                          <div className="hm-lv">LV <b>{lv}</b>{f.max ? <span> / {f.max}</span> : null}</div>
                          {f.max ? <div className="hm-bar"><span style={{ width: `${lv / f.max * 100}%` }} /></div> : <div className="hm-bar inf"><span style={{ width: `${Math.min(100, lv * 4)}%` }} /></div>}
                          <div className="hm-now">{lv ? describeEffect(f, lv) : 'not built yet'}</div>
                          {!done && <div className="hm-next">next: {describeEffect(f, lv + 1)}</div>}
                        </div>
                      </div>
                      <div className="hm-flavor">{f.flavor}</div>
                      <button className="hm-up" disabled={!can} onClick={() => upgrade(f)}>
                        {done ? 'FULLY UPGRADED' : <>{lv ? 'UPGRADE' : 'BUILD'}<span className="hm-cost"><Coin size={15} />{fmt(cost)}</span></>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        {summary}
      </div>
    </div>
  );
}

const CSS = `
  .hm-root { width:100%; height:100dvh; display:flex; flex-direction:column; overflow:hidden; background:var(--desk); color:var(--amber); font-family:var(--font-ui); user-select:none; }
  .hm-top { display:flex; align-items:center; gap:12px; padding:8px 14px; background:var(--bar); border-bottom:2px solid #ff8c00; flex-shrink:0; }
  .hm-btn { background:transparent; border:1px solid var(--amber-dim); color:var(--amber); font-size:13px; padding:5px 12px; font-family:inherit; cursor:pointer; white-space:nowrap; }
  .hm-coins { display:flex; align-items:center; gap:6px; border:1px solid var(--amber-dim); padding:2px 10px 2px 6px; font-size:14px; }
  .hm-ready { font-size:12px; color:var(--amber-dim); } .hm-ready.on { color:#6ef59b; }
  .hm-body { flex:1; min-height:0; overflow-y:auto; display:flex; gap:22px; padding:16px 22px 26px; align-items:flex-start; }
  .hm-floors { flex:1; min-width:0; display:flex; flex-direction:column; gap:16px; }
  .hm-flhd { display:flex; align-items:center; gap:10px; font-size:11px; letter-spacing:2px; color:var(--amber-dim); margin-bottom:8px; }
  .hm-flhd b { font-weight:400; color:#1a0d02; background:#ff9a2e; padding:1px 7px; letter-spacing:1px; text-shadow:none; }
  .hm-flhd span { flex:1; border-bottom:1px dashed var(--line); }
  .hm-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:12px; }
  .hm-card { border:1px solid var(--line); background:rgba(0,0,0,.35); display:flex; flex-direction:column; transition:border-color .2s, box-shadow .2s; }
  .hm-card.on { border-color:var(--amber-dim); box-shadow: inset 0 0 30px rgba(255,140,40,.06); }
  .hm-card:hover { border-color:#ff9a2e; }
  .hm-card.flash { animation: hmFlash .6s ease-out; }
  .hm-cardhd { display:flex; align-items:center; gap:10px; padding:6px 10px; border-bottom:1px solid var(--line); background:rgba(255,154,46,.06); }
  .hm-cardhd span { font-size:10px; letter-spacing:1px; color:var(--amber-dim); }
  .hm-cardhd b { font-weight:400; font-size:15px; letter-spacing:2px; color:#ffcf8a; }
  .hm-cardbody { display:flex; gap:12px; align-items:center; padding:12px 12px 6px; }
  .hm-icon { line-height:0; flex-shrink:0; } .hm-icon.off { filter: grayscale(.85) brightness(.75); }
  .hm-info { flex:1; min-width:0; }
  .hm-lv { font-size:12px; color:var(--amber-dim); } .hm-lv b { font-weight:400; font-size:20px; color:var(--amber); } .hm-lv span { color:var(--amber-dim); }
  .hm-bar { height:6px; border:1px solid var(--amber-dim); margin:4px 0 6px; } .hm-bar span { display:block; height:100%; background:#ff9a2e; box-shadow:0 0 8px rgba(255,140,40,.6); }
  .hm-bar.inf { border-style:dashed; }
  .hm-now { font-size:13px; color:#6ef59b; }
  .hm-next { font-size:11px; color:var(--amber-dim); margin-top:2px; }
  .hm-flavor { font-size:11px; color:var(--amber-dim); font-style:italic; padding:0 12px 8px; }
  .hm-up { margin:0 12px 12px; font-family:inherit; font-size:13px; letter-spacing:1px; padding:8px 12px; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:10px;
    background:#ff9a2e; color:#1a0d02; border:none; text-shadow:none; box-shadow:0 3px 0 #8a4a10; }
  .hm-up:active:not(:disabled) { transform:translateY(2px); box-shadow:0 1px 0 #8a4a10; }
  .hm-up:disabled { background:transparent; color:var(--amber-dim); border:1px solid var(--line); box-shadow:none; cursor:default; }
  .hm-cost { display:inline-flex; align-items:center; gap:4px; }
  .hm-side { width:290px; flex-shrink:0; border:1px solid var(--amber-dim); background:rgba(0,0,0,.3); padding:14px 16px; position:sticky; top:0; }
  .hm-sidehd { font-size:11px; letter-spacing:2px; color:var(--amber-dim); border-bottom:1px solid var(--line); padding-bottom:6px; margin-bottom:8px; }
  .hm-sum { display:flex; align-items:center; gap:8px; font-size:12px; padding:5px 0; border-bottom:1px solid rgba(90,51,19,.5); }
  .hm-sum span { width:78px; color:var(--amber-dim); } .hm-sum b { flex:1; font-weight:400; color:#6ef59b; text-align:right; }
  .hm-none { font-size:12px; line-height:1.5; } .hm-none.dim { color:var(--amber-dim); }
  .hm-feed { font-size:12px; line-height:1.5; color:#6ef59b; } .hm-feed.bad { color:#ff6b5a; } .hm-feed i { font-style:normal; color:var(--amber-dim); }
  .hm-feed.new { animation: hmType .35s steps(20) both; }
  @keyframes hmFlash { 0% { background:rgba(255,200,120,.3); } 100% { } }
  @keyframes hmType { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
  @media (max-width: 760px) {
    .hm-body { flex-direction:column; padding:12px 10px 24px; }
    .hm-side { width:auto; position:static; align-self:stretch; }
    .hm-floors { align-self:stretch; }
    .hm-grid { grid-template-columns:1fr; }
  }
`;
