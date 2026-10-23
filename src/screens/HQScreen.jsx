// Frail Initiative HQ as a facility-management terminal. Rooms (combat/hq.js) are rows
// in a table; pick one with the mouse / ↑↓ / its number, upgrade with Enter, the
// [ UPGRADE ] button, or by typing a command (help lists them). Every action is logged.
import { useEffect, useMemo, useRef, useState } from 'react';
import { FACILITIES, facilityCost, maxed, describeEffect } from '../combat/hq';
import { fmt } from '../combat/engine';
import { playClose, playPress, sfx } from '../utils/sfx';
import useIsMobile from '../hooks/useIsMobile';
import { Icon } from '../components/Icon';

const num = n => Math.floor(n).toLocaleString('en-US');
const bar = (lv, max, w = 10) => {
  if (!max) return `${'■'.repeat(Math.min(w, lv))}${lv > w ? '+' : ''}`.padEnd(w, '·');
  const f = Math.round(lv / max * w);
  return '■'.repeat(f) + '·'.repeat(w - f);
};
const find = (q) => {
  q = (q || '').trim().toLowerCase();
  if (!q) return null;
  const i = parseInt(q, 10);
  if (!Number.isNaN(i)) return FACILITIES[i - 1] ?? null;
  return FACILITIES.find(f => f.id.startsWith(q) || f.name.toLowerCase().startsWith(q)) ?? null;
};
const HELP = [
  'COMMANDS',
  '  upgrade <room|#>   upgrade a room          (also: up, buy, build)',
  '  upgrade           upgrade the selected room (or press Enter)',
  '  info <room|#>      details for a room',
  '  status            what all rooms give right now',
  '  list              the room table',
  '  clear             clear this log',
  '  exit              back to the ops screen   (also: back, q)',
];

export default function HQScreen({ navigate, coins, hq, buy, stats, profile }) {
  const { mobile } = useIsMobile();
  const [sel, setSel] = useState(0);
  const [cmd, setCmd] = useState('');
  const [log, setLog] = useState(() => [
    { t: 'sys', s: 'FRAIL INITIATIVE // FACILITY MANAGEMENT SYSTEM v2.31' },
    { t: 'sys', s: `SESSION OPENED · ${new Date().toISOString().slice(0, 10)} · AUTHORIZED PERSONNEL ONLY` },
    { t: 'dim', s: mobile ? 'Tap a room, then UPGRADE.' : 'Pick a room (click, ↑↓ or 1-6) and press Enter, or type "help".' },
  ]);
  const logRef = useRef(null), inputRef = useRef(null);
  const user = (profile?.name || 'FIELD MANAGER').toUpperCase();

  const push = (...lines) => setLog(l => [...l, ...lines].slice(-80));
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [log]);

  const upgrade = (f) => {
    const lv = hq[f.id] ?? 0;
    if (maxed(f, lv)) { sfx('miss'); push({ t: 'err', s: `  ERROR: ${f.name} IS FULLY UPGRADED (LV ${lv})` }); return; }
    const cost = facilityCost(f, lv);
    if (coins < cost) { sfx('miss'); push({ t: 'err', s: `  ERROR: INSUFFICIENT FUNDS — need ${num(cost)} ¢, have ${num(coins)} ¢` }); return; }
    if (!buy(f.id)) return;
    sfx('combo', 0);
    push(
      { t: 'dim', s: '  AUTHORIZING… OK' },
      { t: 'ok', s: `  ${f.name.padEnd(10)} LV ${lv} → LV ${lv + 1}    ${lv ? describeEffect(f, lv) : 'none'} → ${describeEffect(f, lv + 1)}` },
      { t: 'dim', s: `  FUNDS      −${num(cost)} ¢   (${num(coins - cost)} ¢ left)` },
    );
  };

  const info = (f) => {
    const lv = hq[f.id] ?? 0;
    push(
      { t: 'out', s: `  [${f.room}] ${f.name} — ${f.flavor}` },
      { t: 'out', s: `  LEVEL ${lv}${f.max ? ` / ${f.max}` : ''} · NOW ${lv ? describeEffect(f, lv) : 'not built'}` },
      maxed(f, lv) ? { t: 'dim', s: '  FULLY UPGRADED' } : { t: 'out', s: `  NEXT ${describeEffect(f, lv + 1)} · COST ${num(facilityCost(f, lv))} ¢` },
    );
  };

  const run = (raw) => {
    const line = raw.trim();
    push({ t: 'cmd', s: `C:\\FRAIL\\HQ> ${line}` });
    if (!line) return;
    const [verb, ...rest] = line.split(/\s+/);
    const arg = rest.join(' ');
    const v = verb.toLowerCase();
    if (['upgrade', 'up', 'buy', 'build', 'u'].includes(v)) {
      const f = arg ? find(arg) : FACILITIES[sel];
      if (!f) { sfx('miss'); push({ t: 'err', s: `  ERROR: NO ROOM "${arg}" — try "list"` }); return; }
      setSel(FACILITIES.indexOf(f)); upgrade(f);
    } else if (v === 'info' || v === 'i') {
      const f = arg ? find(arg) : FACILITIES[sel];
      if (!f) { push({ t: 'err', s: `  ERROR: NO ROOM "${arg}"` }); return; }
      info(f);
    } else if (v === 'status' || v === 'stat') {
      const built = FACILITIES.filter(f => (hq[f.id] ?? 0) > 0);
      push(...(built.length ? built.map(f => ({ t: 'out', s: `  ${f.name.padEnd(10)} LV ${String(hq[f.id]).padStart(2)}   ${describeEffect(f, hq[f.id])}` })) : [{ t: 'dim', s: '  nothing built yet' }]),
        { t: 'dim', s: `  TEAM: ATK ${stats.atk} · HP ${stats.maxHp} · crit ${Math.round(stats.critRate * 100)}%` });
    } else if (v === 'list' || v === 'ls' || v === 'dir') {
      push(...FACILITIES.map((f, i) => ({ t: 'out', s: `  ${String(i + 1).padStart(2, '0')}  ${f.name.padEnd(10)} LV ${String(hq[f.id] ?? 0).padStart(2)}   ${maxed(f, hq[f.id] ?? 0) ? 'MAX' : `${num(facilityCost(f, hq[f.id] ?? 0))} ¢`}` })));
    } else if (v === 'help' || v === '?' || v === 'h') {
      push(...HELP.map(s => ({ t: 'dim', s })));
    } else if (v === 'clear' || v === 'cls') {
      setLog([]);
    } else if (['exit', 'back', 'q', 'quit', 'logout'].includes(v)) {
      playClose(); navigate('main');
    } else if (find(line)) {
      const f = find(line); setSel(FACILITIES.indexOf(f)); info(f);
    } else {
      sfx('miss'); push({ t: 'err', s: `  '${verb}' is not recognized as a command. Type "help".` });
    }
  };

  // keyboard: ↑↓ / 1-6 pick a room, Enter upgrades it (or runs the typed command)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => (s + 1) % FACILITIES.length); playPress(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => (s + FACILITIES.length - 1) % FACILITIES.length); playPress(); }
      else if (e.key === 'Escape') { playClose(); navigate('main'); }
      else if (/^[1-6]$/.test(e.key) && !cmd) { e.preventDefault(); setSel(Number(e.key) - 1); playPress(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cmd, navigate]);

  const f = FACILITIES[sel];
  const lv = hq[f.id] ?? 0, done = maxed(f, lv), cost = facilityCost(f, lv);
  const ready = useMemo(() => FACILITIES.filter(x => !maxed(x, hq[x.id] ?? 0) && coins >= facilityCost(x, hq[x.id] ?? 0)).length, [hq, coins]);

  return (
    <div className="ht-root" onClick={() => !mobile && inputRef.current?.focus()}>
      <style>{CSS}</style>
      <div className="ht-screen">
        <div className="ht-head">
          <span>FRAIL INITIATIVE // FACILITY MANAGEMENT</span>
          <span className="ht-r">USER: {user} · FUNDS: <b>{num(coins)} ¢</b></span>
        </div>
        <div className="ht-rule">{'═'.repeat(160)}</div>

        <div className="ht-main">
          <div className="ht-table">
            <div className="ht-row ht-th"><span>#</span><span>ROOM</span><span>LV</span>{!mobile && <span>STATUS</span>}<span className="ht-eff">EFFECT</span><span className="ht-cost">COST</span></div>
            {FACILITIES.map((x, i) => {
              const l = hq[x.id] ?? 0, m = maxed(x, l), c = facilityCost(x, l);
              return (
                <button key={x.id} className={`ht-row${i === sel ? ' sel' : ''}${!m && coins >= c ? ' can' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setSel(i); playPress(); if (mobile) return; inputRef.current?.focus(); }}
                  onDoubleClick={() => upgrade(x)}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <span>{x.name}</span>
                  <span>{String(l).padStart(2, '0')}</span>
                  {!mobile && <span className="ht-bar">[{bar(l, x.max)}]</span>}
                  <span className="ht-eff">{l ? describeEffect(x, l) : '— offline —'}</span>
                  <span className="ht-cost">{m ? 'MAX' : `${fmt(c)} ¢`}</span>
                </button>
              );
            })}
            <div className="ht-foot">{ready ? `${ready} upgrade${ready === 1 ? '' : 's'} affordable` : 'no upgrades affordable — earn coins in the field'}</div>
          </div>

          <div className="ht-detail">
            <div className="ht-dhead">┌─ {f.room} ─ {f.name} {'─'.repeat(8)}</div>
            <div className="ht-dbody">
              <div className="ht-icon"><Icon name={f.id} size={mobile ? 54 : 72} /></div>
              <div className="ht-dtext">
                <div className="ht-flav">"{f.flavor}"</div>
                <div>LEVEL ... {lv}{f.max ? ` / ${f.max}` : ''}</div>
                <div>NOW ..... <span className="ht-g">{lv ? describeEffect(f, lv) : 'offline'}</span></div>
                {!done && <div>NEXT .... {describeEffect(f, lv + 1)}</div>}
                <div>COST .... {done ? '—' : `${num(cost)} ¢`}</div>
              </div>
            </div>
            <button className="ht-go" disabled={done || coins < cost} onClick={(e) => { e.stopPropagation(); upgrade(f); }}>
              {done ? '[ FULLY UPGRADED ]' : coins < cost ? `[ NEED ${num(cost - coins)} ¢ MORE ]` : `[ ${lv ? 'UPGRADE' : 'BUILD'} ▸ ${fmt(cost)} ¢ ]`}
            </button>
            <div className="ht-dfoot">└{'─'.repeat(40)}</div>
          </div>
        </div>

        <div className="ht-log" ref={logRef}>
          {log.map((l, i) => <div key={i} className={`ht-l ${l.t}${i >= log.length - 3 ? ' new' : ''}`}>{l.s}</div>)}
        </div>
        <form className="ht-prompt" onSubmit={(e) => { e.preventDefault(); run(cmd.trim() ? cmd : `upgrade ${FACILITIES[sel].id}`); setCmd(''); }}>
          <span>C:\FRAIL\HQ&gt;&nbsp;</span>
          <input ref={inputRef} value={cmd} onChange={e => setCmd(e.target.value)} spellCheck={false} autoComplete="off" autoCapitalize="off"
            autoFocus={!mobile} aria-label="command" placeholder={mobile ? 'type a command (help)' : ''} />
        </form>
        <div className="ht-keys">
          <button onClick={() => { playClose(); navigate('main'); }}>[ESC] EXIT</button>
          {!mobile && <span>[↑↓] SELECT · [ENTER] UPGRADE · [1-6] JUMP · "help"</span>}
        </div>
      </div>
    </div>
  );
}

const CSS = `
  .ht-root { width:100%; height:100dvh; background:#070402; display:flex; align-items:stretch; justify-content:center; color:var(--amber); font-family:var(--font-ui); overflow:hidden; }
  .ht-screen { flex:1; min-width:0; max-width:1240px; display:flex; flex-direction:column; min-height:0; padding:14px 22px 10px;
    text-shadow: 0 0 6px rgba(255,150,50,.45); }
  .ht-head { display:flex; justify-content:space-between; gap:12px; font-size:14px; letter-spacing:1px; flex-wrap:wrap; }
  .ht-head b { font-weight:400; color:#ffd59a; }
  .ht-rule { overflow:hidden; white-space:nowrap; color:var(--amber-dim); line-height:1; margin:4px 0 10px; }
  .ht-main { display:flex; gap:22px; flex-shrink:0; }
  .ht-table { flex:1.5; min-width:0; }
  .ht-row { display:grid; grid-template-columns: 34px 120px 34px 150px 1fr 90px; gap:10px; align-items:center; width:100%; text-align:left;
    background:none; border:none; color:inherit; font:inherit; font-size:14px; padding:5px 8px; cursor:pointer; text-shadow:inherit; }
  .ht-row.ht-th { cursor:default; color:var(--amber-dim); font-size:11px; letter-spacing:2px; border-bottom:1px dashed var(--amber-dim); }
  .ht-row:not(.ht-th):hover { background:rgba(255,154,46,.1); }
  .ht-row.sel { background:#ff9a2e; color:#140a04; text-shadow:none; }
  .ht-row.sel .ht-eff, .ht-row.sel .ht-bar { color:#140a04; }
  .ht-row.can:not(.sel) .ht-cost { color:#6ef59b; text-shadow:0 0 6px rgba(110,245,155,.5); }
  .ht-cost { text-align:right; }
  .ht-bar { color:var(--amber-dim); letter-spacing:1px; }
  .ht-eff { color:#ffd59a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ht-foot { font-size:11px; color:var(--amber-dim); padding:6px 8px; border-top:1px dashed var(--amber-dim); margin-top:2px; }
  .ht-detail { flex:1; min-width:0; font-size:14px; }
  .ht-dhead, .ht-dfoot { white-space:nowrap; overflow:hidden; color:var(--amber-dim); }
  .ht-dbody { display:flex; gap:16px; align-items:center; padding:10px 6px 10px 14px; border-left:1px solid var(--amber-dim); }
  .ht-icon { line-height:0; filter: grayscale(1) sepia(1) saturate(5) hue-rotate(-12deg) brightness(1.05); }
  .ht-dtext { display:flex; flex-direction:column; gap:3px; min-width:0; }
  .ht-flav { color:var(--amber-dim); font-size:12px; margin-bottom:4px; }
  .ht-g { color:#6ef59b; }
  .ht-go { margin:4px 0 4px 14px; background:#ff9a2e; color:#140a04; border:none; font:inherit; font-size:14px; letter-spacing:1px; padding:8px 14px; cursor:pointer; text-shadow:none; }
  .ht-go:disabled { background:transparent; color:var(--amber-dim); border:1px dashed var(--amber-dim); cursor:default; }
  .ht-log { flex:1; min-height:80px; overflow-y:auto; margin-top:12px; padding-top:8px; border-top:1px solid var(--amber-dim); font-size:13px; line-height:1.55; white-space:pre-wrap; }
  .ht-l.cmd { color:#ffd59a; } .ht-l.sys { color:var(--amber); } .ht-l.dim { color:var(--amber-dim); }
  .ht-l.ok { color:#6ef59b; text-shadow:0 0 6px rgba(110,245,155,.45); } .ht-l.err { color:#ff6b5a; text-shadow:0 0 6px rgba(255,90,70,.45); }
  .ht-l.new { animation: htType .35s steps(24) both; }
  .ht-prompt { display:flex; align-items:center; font-size:14px; padding:6px 0 4px; flex-shrink:0; }
  .ht-prompt input { flex:1; min-width:0; background:transparent; border:none; outline:none; color:#ffd59a; font:inherit; font-size:14px; caret-color:#ff9a2e; caret-shape:block; text-shadow:inherit; padding:0; }
  .ht-prompt input::placeholder { color:var(--amber-dim); opacity:.6; }
  .ht-keys { display:flex; gap:16px; align-items:center; font-size:11px; color:var(--amber-dim); padding-top:4px; border-top:1px dashed var(--amber-dim); flex-shrink:0; }
  .ht-keys button { background:none; border:1px solid var(--amber-dim); color:var(--amber); font:inherit; font-size:11px; padding:3px 8px; cursor:pointer; }
  @keyframes htType { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
  @media (max-width: 760px) {
    .ht-root { overflow-y:auto; }
    .ht-screen { padding:10px 10px 8px; min-height:auto; }
    .ht-log { flex:none; height:190px; }
    .ht-head { font-size:11px; }
    .ht-main { flex-direction:column; gap:10px; }
    .ht-row { grid-template-columns: 24px 1fr 26px 74px; font-size:13px; gap:6px; padding:6px 6px; }
    .ht-row .ht-eff { display:none; }
    .ht-row.ht-th { font-size:10px; }
    .ht-detail { font-size:13px; }
    .ht-log { font-size:11.5px; min-height:70px; }
  }
`;
