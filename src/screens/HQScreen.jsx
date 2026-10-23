// Frail Initiative HQ: a cutaway of the building, one room per upgrade (combat/hq.js).
// Coins buy room levels; the rooms' bonuses apply to every fight.
import { useState } from 'react';
import { FACILITIES, facilityCost, maxed, describeEffect } from '../combat/hq';
import { fmt } from '../combat/engine';
import { playClose, playStamp, sfx } from '../utils/sfx';
import useIsMobile from '../hooks/useIsMobile';
import TermTitle from '../components/TermTitle';
import { Icon } from '../components/Icon';

const BASE = import.meta.env.BASE_URL;
const FLOORS = [
  { label: '3F', name: 'ADMINISTRATION', rooms: ['payroll'] },
  { label: '2F', name: 'OPERATIONS', rooms: ['analytics', 'ops'] },
  { label: 'B1', name: 'FIELD SUPPORT', rooms: ['armory', 'infirmary', 'security'] },
];
const byId = id => FACILITIES.find(f => f.id === id);
const Coin = ({ size = 16 }) => <img src={`${BASE}ui/ui_cucoin.png`} alt="" style={{ width: size, height: size, imageRendering: 'pixelated', verticalAlign: 'middle' }} />;

export default function HQScreen({ navigate, coins, hq, buy, stats }) {
  const { mobile } = useIsMobile();
  const [flash, setFlash] = useState(null);

  const upgrade = (id) => {
    if (buy(id)) { playStamp(0.6); setFlash({ id, n: Date.now() }); }
    else sfx('miss');
  };
  const built = FACILITIES.filter(f => (hq[f.id] ?? 0) > 0);

  return (
    <div className="hq-root">
      <style>{CSS}</style>
      <div className="hq-top">
        <button className="hq-btn" onPointerDown={playClose} onClick={() => navigate('main')}>[&nbsp;back&nbsp;]</button>
        <TermTitle path="HQ" small={mobile} />
        <div className="hq-coins"><Coin size={20} /><span>{fmt(coins)}</span></div>
        <div style={{ flex: 1 }} />
        {!mobile && <span className="hq-meta">ATK {stats.atk} · HP {stats.maxHp} · crit {Math.round(stats.critRate * 100)}%</span>}
      </div>

      <div className="hq-body">
        <div className="hq-building">
          <div className="hq-roof"><span className="hq-antenna" />FRAIL INITIATIVE · FIELD OFFICE</div>
          {FLOORS.map(fl => (
            <div key={fl.label} className="hq-floor">
              <div className="hq-flabel"><b>{fl.label}</b><small>{fl.name}</small></div>
              <div className="hq-rooms" style={{ gridTemplateColumns: mobile ? '1fr' : `repeat(${fl.rooms.length}, 1fr)` }}>
                {fl.rooms.map(id => {
                  const f = byId(id), lv = hq[id] ?? 0, done = maxed(f, lv), cost = facilityCost(f, lv), can = !done && coins >= cost;
                  return (
                    <div key={`${id}-${flash?.id === id ? flash.n : 0}`} className={`hq-room${lv ? ' lit' : ''}${flash?.id === id ? ' flash' : ''}`}>
                      <div className="hq-plate">{f.room}</div>
                      <div className="hq-icon"><Icon name={id} size={mobile ? 44 : 48} /></div>
                      <div className="hq-name">{f.name}</div>
                      <div className="hq-flavor">{f.flavor}</div>
                      <div className="hq-lv">LV {lv}{f.max ? <span> / {f.max}</span> : null}</div>
                      {f.max && <div className="hq-bar"><span style={{ width: `${lv / f.max * 100}%` }} /></div>}
                      <div className="hq-eff">{lv ? describeEffect(f, lv) : 'not built yet'}</div>
                      {!done && <div className="hq-next">next: {describeEffect(f, lv + 1)}</div>}
                      <button className="hq-up" disabled={!can} onClick={() => upgrade(id)}>
                        {done ? 'FULLY UPGRADED' : <>{lv ? 'UPGRADE' : 'BUILD'} <span className="hq-cost"><Coin size={14} /> {fmt(cost)}</span></>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="hq-ground" />
        </div>

        <div className="hq-side">
          <div className="hq-sidehd">HQ BONUSES · ALL FIGHTS</div>
          {built.length === 0
            ? <div className="hq-none">Nothing built yet. Rooms cost coins and their bonuses apply to every fight, endless and story.</div>
            : built.map(f => <div key={f.id} className="hq-sum"><Icon name={f.id} size={18} /><span>{f.name}</span><b>{describeEffect(f, hq[f.id])}</b></div>)}
          <div className="hq-tip">Coins come from kills, bosses and stage clears. Later stages pay more.</div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
  .hq-root { width:100%; height:100dvh; display:flex; flex-direction:column; overflow:hidden; color:var(--amber); font-family:var(--font-ui); user-select:none;
    background: linear-gradient(rgba(255,140,40,.035) 1px, transparent 1px) 0 0/24px 24px, linear-gradient(90deg, rgba(255,140,40,.035) 1px, transparent 1px) 0 0/24px 24px, var(--desk); }
  .hq-top { display:flex; align-items:center; gap:12px; padding:8px 14px; background:var(--bar); border-bottom:2px solid #ff8c00; flex-shrink:0; }
  .hq-btn { background:transparent; border:1px solid var(--amber-dim); color:var(--amber); font-size:13px; padding:5px 12px; font-family:inherit; cursor:pointer; white-space:nowrap; }
  .hq-coins { display:flex; align-items:center; gap:6px; border:1px solid var(--amber-dim); padding:2px 10px 2px 6px; font-size:14px; }
  .hq-meta { font-size:12px; color:var(--amber-dim); }
  .hq-body { flex:1; min-height:0; overflow-y:auto; display:flex; gap:22px; padding:14px 22px 24px; align-items:flex-start; }
  .hq-building { flex:1; min-width:0; max-width:980px; position:relative; }
  .hq-roof { position:relative; text-align:center; font-size:12px; letter-spacing:4px; color:#1a0d02; background:#ff9a2e; padding:6px 0; margin:0 4%;
    clip-path: polygon(3% 0, 97% 0, 100% 100%, 0 100%); text-shadow:none; }
  .hq-antenna { position:absolute; right:12%; bottom:100%; width:3px; height:26px; background:#ff9a2e; }
  .hq-antenna::after { content:''; position:absolute; top:-4px; left:-3px; width:9px; height:9px; background:#ff4040; box-shadow:0 0 10px #ff4040; animation: hqBlink 1.6s steps(1) infinite; }
  .hq-floor { display:flex; border:2px solid #ff9a2e; border-top:none; background:rgba(10,5,2,.6); }
  .hq-floor:first-of-type { border-top:2px solid #ff9a2e; }
  .hq-flabel { width:74px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; border-right:2px solid #ff9a2e;
    background: repeating-linear-gradient(0deg, rgba(255,154,46,.08) 0 2px, transparent 2px 8px); }
  .hq-flabel b { font-size:24px; font-weight:400; color:#ffcf8a; }
  .hq-flabel small { font-size:8.5px; letter-spacing:1.5px; color:var(--amber-dim); writing-mode:vertical-rl; transform:rotate(180deg); }
  .hq-rooms { flex:1; display:grid; }
  .hq-room { position:relative; padding:20px 12px 12px; border-left:1px dashed rgba(255,154,46,.35); display:flex; flex-direction:column; align-items:center; text-align:center; gap:1px;
    background: radial-gradient(ellipse at 50% 0%, rgba(255,154,46,.0), transparent 70%); transition: background .3s; }
  .hq-room:first-child { border-left:none; }
  .hq-room.lit { background: radial-gradient(ellipse at 50% -10%, rgba(255,180,90,.22), transparent 65%); }
  .hq-room.lit::before { content:''; position:absolute; top:0; left:50%; width:44px; height:5px; transform:translateX(-50%); background:#ffe2a8; box-shadow:0 0 14px 4px rgba(255,200,120,.55); }
  .hq-room.flash { animation: hqFlash .6s ease-out; }
  .hq-plate { position:absolute; top:8px; left:10px; font-size:10px; letter-spacing:1.5px; color:#1a0d02; background:#d8c7a0; padding:1px 6px; text-shadow:none; }
  .hq-icon { margin:2px 0 3px; line-height:0; }
  .hq-name { font-size:17px; color:#ffcf8a; letter-spacing:2px; }
  .hq-flavor { font-size:11px; color:var(--amber-dim); font-style:italic; min-height:15px; }
  .hq-lv { font-size:13px; margin-top:4px; } .hq-lv span { color:var(--amber-dim); }
  .hq-bar { width:80%; height:6px; border:1px solid var(--amber-dim); } .hq-bar span { display:block; height:100%; background:#ff9a2e; }
  .hq-eff { font-size:13px; color:#6ef59b; margin-top:4px; min-height:18px; }
  .hq-next { font-size:11px; color:var(--amber-dim); }
  .hq-up { margin-top:6px; width:100%; max-width:220px; font-family:inherit; font-size:13px; letter-spacing:1px; padding:7px 10px; cursor:pointer;
    background:#ff9a2e; color:#1a0d02; border:none; text-shadow:none; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 3px 0 #8a4a10; }
  .hq-up:active:not(:disabled) { transform:translateY(2px); box-shadow:0 1px 0 #8a4a10; }
  .hq-up:disabled { background:transparent; color:var(--amber-dim); border:1px solid var(--amber-dim); box-shadow:none; cursor:default; }
  .hq-cost { display:inline-flex; align-items:center; gap:4px; }
  .hq-ground { height:10px; margin:0 -10px; background: repeating-linear-gradient(135deg, #ff9a2e 0 6px, transparent 6px 12px); opacity:.5; }
  .hq-side { width:300px; flex-shrink:0; border:1px solid var(--amber-dim); background:rgba(0,0,0,.3); padding:14px 16px; position:sticky; top:0; }
  .hq-sidehd { font-size:11px; letter-spacing:2px; color:var(--amber-dim); border-bottom:1px solid var(--line); padding-bottom:6px; margin-bottom:8px; }
  .hq-sum { display:flex; align-items:center; gap:8px; font-size:12px; padding:5px 0; border-bottom:1px solid rgba(90,51,19,.5); }
  .hq-sum span { width:78px; color:var(--amber-dim); } .hq-sum b { flex:1; font-weight:400; color:#6ef59b; text-align:right; }
  .hq-none { font-size:12px; line-height:1.5; color:var(--amber); }
  .hq-tip { margin-top:12px; font-size:11px; color:var(--amber-dim); line-height:1.4; }
  @media (max-width: 760px) {
    .hq-body { flex-direction:column; padding:12px 8px 24px; }
    .hq-side { width:auto; position:static; align-self:stretch; }
    .hq-flabel { width:40px; } .hq-flabel b { font-size:16px; }
    .hq-roof { letter-spacing:1.5px; font-size:10px; }
    .hq-room { border-left:none; border-top:1px dashed rgba(255,154,46,.35); }
    .hq-room:first-child { border-top:none; }
  }
  @keyframes hqFlash { 0% { background:rgba(255,220,150,.45); } 100% { } }
  @keyframes hqBlink { 50% { opacity:.2; } }
`;
