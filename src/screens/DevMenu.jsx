import { useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { ENEMY_TYPES } from '../combat/enemies';

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox / developer menu. Turn it on in Settings (tap the SETTINGS title
// 5 times) or open the site with ?dev in the URL. Everything here changes
// your real save, so use "Reset Save" in Settings to start clean afterwards.
// ─────────────────────────────────────────────────────────────────────────────
const SPAWNABLE = ['xiao', 'swarmling', 'bonk', 'rusher', 'shielder', 'treasure', 'devourer', 'worm', 'hydra'];
const RC = { 6: '#ff4444', 5: '#f0c040', 4: '#a855f7', 3: '#60a5fa' };

export default function DevMenu({ engine, actions, state, mobile, onClose }) {
  const { setPullCurrency, setCoins, setCardInventory, setDeck, setTrainLevel, setPity4, setPity5, disable } = actions;
  const { cardInventory, deck, trainLevel, pity4, pity5 } = state;
  const sorted = [...CHARACTERS].sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
  const [cardId, setCardId] = useState(deck?.main?.id ?? sorted[0].id);
  const [stageTo, setStageTo] = useState(engine.state.stageNum + 1);
  const [god, setGod] = useState(engine.state.dev.god);
  const [speed, setSpeed] = useState(engine.state.dev.timeScale);
  const [toast, setToast] = useState('');
  const say = (t) => { setToast(t); setTimeout(() => setToast(x => (x === t ? '' : x)), 1600); };

  const card = CHARACTERS.find(c => c.id === Number(cardId));
  const entry = cardInventory[card.id] ?? {};

  const giveCard = (id, n = 1) => setCardInventory(prev => {
    const e = prev[id] ?? { count: 0, si: 0 };
    return { ...prev, [id]: { ...e, count: (e.count ?? 0) + n } };
  });
  const patchCard = (id, patch) => setCardInventory(prev => ({ ...prev, [id]: { count: 0, si: 0, ...prev[id], ...patch } }));

  return (
    <div className="dev-menu" style={mobile
      ? { position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '62dvh' }
      : { position: 'fixed', right: 12, top: 56, bottom: 12, width: 340 }}>
      <style>{CSS}</style>
      <div className="dev-head">
        <b>🛠 SANDBOX</b>
        <span style={{ color: '#a78bfa', fontSize: 11 }}>changes your real save</span>
        <div style={{ flex: 1 }} />
        <button className="dv" onClick={onClose}>✕</button>
      </div>

      <div className="dev-body">
        <Section title="Resources">
          <Row>
            <button className="dv" onClick={() => { setPullCurrency(v => v + 10); say('+10 gems'); }}>+10 gems</button>
            <button className="dv" onClick={() => { setPullCurrency(v => v + 100); say('+100 gems'); }}>+100 gems</button>
          </Row>
          <Row>
            <button className="dv" onClick={() => { setCoins(v => v + 10000); say('+10k coins'); }}>+10k coins</button>
            <button className="dv" onClick={() => { setCoins(v => v + 1e6); say('+1M coins'); }}>+1M coins</button>
          </Row>
          <Row>
            <span className="lbl">Train LV {trainLevel}</span>
            <button className="dv" onClick={() => setTrainLevel(l => Math.max(0, l - 1))}>−1</button>
            <button className="dv" onClick={() => setTrainLevel(l => l + 1)}>+1</button>
            <button className="dv" onClick={() => setTrainLevel(l => l + 10)}>+10</button>
          </Row>
        </Section>

        <Section title="Cards">
          <select className="dv-sel" value={cardId} onChange={e => setCardId(Number(e.target.value))}>
            {sorted.map(c => <option key={c.id} value={c.id}>{'★'.repeat(c.rarity)} {c.name}</option>)}
          </select>
          <div style={{ fontSize: 11, color: RC[card.rarity] }}>
            {card.name} · owned {(entry.count ?? 0)} from shop/dev · LV {entry.level ?? 1} · S{(entry.si ?? 0) + 1}
          </div>
          <Row>
            <button className="dv" onClick={() => { giveCard(card.id, 1); say(`+1 ${card.name}`); }}>Give 1</button>
            <button className="dv" onClick={() => { giveCard(card.id, 5); say(`+5 ${card.name}`); }}>Give 5</button>
            {card.rarity >= 5 && <button className="dv" onClick={() => { giveCard(card.id, deck?.main ? 0 : 1); setDeck(d => ({ ...d, main: card })); say(`${card.name} is your main`); }}>Equip as main</button>}
          </Row>
          {card.rarity >= 5 && (
            <Row>
              <span className="lbl">Level</span>
              {[1, 20, 50, 80].map(l => <button key={l} className="dv" onClick={() => { patchCard(card.id, { level: l, xp: 0 }); say(`${card.name} LV${l}`); }}>{l}</button>)}
              <button className="dv" onClick={() => patchCard(card.id, { level: (entry.level ?? 1) + 10, xp: 0 })}>+10</button>
            </Row>
          )}
          <Row>
            <span className="lbl">Superimpose</span>
            {[0, 1, 2, 3, 4].map(si => (
              <button key={si} className={`dv${(entry.si ?? 0) === si ? ' on' : ''}`} onClick={() => { patchCard(card.id, { si, count: Math.max(entry.count ?? 0, 1) }); say(`${card.name} S${si + 1}`); }}>S{si + 1}</button>
            ))}
          </Row>
          <Row>
            <button className="dv" onClick={() => { CHARACTERS.forEach(c => giveCard(c.id, 1)); say('Gave every card'); }}>Give every card</button>
          </Row>
        </Section>

        <Section title="Battle">
          <Row>
            <button className={`dv${god ? ' on' : ''}`} onClick={() => { engine.dev.setGod(!god); setGod(!god); }}>God mode {god ? 'ON' : 'off'}</button>
            <button className="dv" onClick={() => { engine.dev.fillUlt(); say('Ult ready'); }}>Ult ready</button>
            <button className="dv" onClick={() => engine.dev.heal()}>Full heal</button>
          </Row>
          <Row>
            <span className="lbl">Speed</span>
            {[0.25, 0.5, 1, 2, 4].map(x => (
              <button key={x} className={`dv${speed === x ? ' on' : ''}`} onClick={() => { engine.dev.setTimeScale(x); setSpeed(x); }}>{x}×</button>
            ))}
          </Row>
          <Row>
            <button className="dv" onClick={() => engine.dev.killAll()}>Kill all (with rewards)</button>
            <button className="dv" onClick={() => engine.dev.clearEnemies()}>Clear enemies</button>
          </Row>
          <Row>
            <button className="dv" onClick={() => { engine.dev.summonBoss(); say('Boss incoming'); }}>Summon this stage's boss</button>
          </Row>
          <Row>
            <span className="lbl">Go to stage</span>
            <input className="dv-in" type="number" min={1} value={stageTo} onChange={e => setStageTo(e.target.value)} />
            <button className="dv" onClick={() => { engine.dev.gotoStage(Number(stageTo) || 1); say(`Stage ${stageTo}`); }}>Go</button>
          </Row>
          <div className="lbl" style={{ marginTop: 2 }}>Spawn</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
            {SPAWNABLE.map(id => {
              const t = ENEMY_TYPES[id];
              return (
                <button key={id} className="dv" onClick={() => engine.dev.spawn(id)}
                  style={{ borderColor: t.tier === 'boss' ? '#ef4444' : t.tier === 'elite' ? '#a855f7' : t.tier === 'treasure' ? '#f59e0b' : '#475569' }}>
                  {id === 'swarmling' ? 'Horde' : t.tier === 'boss' ? t.name.split(' ').slice(-1)[0] : t.name}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Gacha">
          <Row>
            <span className="lbl">Pity 4★ {pity4} · 5★ {pity5}</span>
          </Row>
          <Row>
            <button className="dv" onClick={() => { setPity5(89); say('Next pull is a 5★+'); }}>Next pull 5★</button>
            <button className="dv" onClick={() => { setPity4(9); }}>Next pull 4★</button>
            <button className="dv" onClick={() => { setPity4(0); setPity5(0); }}>Reset pity</button>
          </Row>
        </Section>

        <button className="dv" style={{ width: '100%', marginTop: 4, borderColor: '#7f1d1d', color: '#fca5a5' }} onClick={() => { disable(); onClose(); }}>
          Turn developer mode off
        </button>
      </div>
      {toast && <div className="dev-toast">{toast}</div>}
    </div>
  );
}

const Section = ({ title, children }) => (
  <div className="dev-sec">
    <div className="dev-title">{title}</div>
    {children}
  </div>
);
const Row = ({ children }) => <div className="dev-row">{children}</div>;

const CSS = `
  .dev-menu { z-index: 200; display:flex; flex-direction:column; background: rgba(12,10,28,0.96); border: 2px solid #7c3aed;
              border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); color:#e5e7eb; font-size:13px; overflow:hidden;
              cursor: auto !important; }
  .dev-menu * { cursor: auto !important; }
  .dev-menu button, .dev-menu select { cursor: pointer !important; }
  .dev-head { display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid #3b2a6b; background:#1a1036; }
  .dev-body { overflow-y:auto; padding:8px 10px 12px; display:flex; flex-direction:column; gap:8px; }
  .dev-sec { background: rgba(255,255,255,0.03); border:1px solid #2e2650; border-radius:8px; padding:8px; display:flex; flex-direction:column; gap:6px; }
  .dev-title { font-size:11px; letter-spacing:2px; color:#a78bfa; font-weight:800; text-transform:uppercase; }
  .dev-row { display:flex; flex-wrap:wrap; gap:5px; align-items:center; }
  .dev-menu .dv { background:#1e1b3a; border:1px solid #4c3d8f; color:#e9d5ff; border-radius:6px; padding:5px 9px; font-size:12px; font-weight:600; }
  .dev-menu .dv:hover { background:#2d2660; }
  .dev-menu .dv.on { background:#7c3aed; border-color:#c4b5fd; color:#fff; }
  .dev-sel, .dv-in { background:#0f0d24; color:#e5e7eb; border:1px solid #4c3d8f; border-radius:6px; padding:5px 6px; font-size:12px; }
  .dv-in { width:64px; }
  .lbl { font-size:11px; color:#9ca3af; margin-right:2px; }
  .dev-toast { position:absolute; left:50%; bottom:12px; transform:translateX(-50%); background:#7c3aed; color:#fff; font-weight:700;
               padding:5px 14px; border-radius:14px; font-size:12px; pointer-events:none; }
`;
