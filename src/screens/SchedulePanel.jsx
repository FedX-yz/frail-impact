// The owner's banner schedule panel. Open the game with ?schedule at the end of the
// address. Anyone can look; only someone with a GitHub key that can write to the repo
// can save. Saving writes the schedule file (SCHEDULE_SOURCE in data/banners.js) that
// every player's game reads, so changes reach players within ~5 minutes, no deploy.
import { useEffect, useState } from 'react';
import { BANNERS, SCHEDULE_SOURCE } from '../data/banners';
import { normalizeSchedule, bannerStatus, formatTimeLeft, formatLength } from '../utils/bannerSchedule';
import { SCHEDULE_FILE_URL, getLiveSchedule, setLiveSchedule } from '../utils/liveSchedule';

const { owner, repo, branch, path } = SCHEDULE_SOURCE;
const API = `https://api.github.com/repos/${owner}/${repo}`;
const KEY_STORAGE = 'frail_owner_key';
const HOUR = 3600000, DAY = 86400000;
const bannerOf = id => BANNERS.find(b => b.id === id);
const newId = () => Math.random().toString(36).slice(2, 8);

// ── GitHub ──────────────────────────────────────────────────────
async function gh(key, url, opts = {}) {
  const r = await fetch(url, { ...opts, cache: 'no-store', headers: {
    Accept: 'application/vnd.github+json', Authorization: `Bearer ${key}`, 'X-GitHub-Api-Version': '2022-11-28',
    ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}
const toBase64 = str => { let bin = ''; new TextEncoder().encode(str).forEach(b => { bin += String.fromCharCode(b); }); return btoa(bin); };
const fromBase64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));

async function checkKey(key) {
  const r = await gh(key, API);
  if (r.status === 401) return { error: "GitHub didn't accept this key. Check that you copied all of it and that it hasn't expired." };
  if (r.status === 404) return { error: `This key can't see ${owner}/${repo}. When making the key, pick that repository.` };
  if (!r.ok) return { error: `GitHub said: ${r.body.message || r.status}` };
  if (r.body.permissions && !r.body.permissions.push) return { error: "This key's account isn't allowed to change the repo." };
  const me = await gh(key, 'https://api.github.com/user');
  return { login: me.body.login || 'you' };
}
async function loadFile(key) {
  const r = await gh(key, `${API}/contents/${path}?ref=${branch}`);
  if (r.status === 404) return { file: null, sha: null };
  if (!r.ok) throw new Error(`Couldn't load the schedule: ${r.body.message || r.status}`);
  return { file: JSON.parse(fromBase64(r.body.content)), sha: r.body.sha };
}
async function saveFile(key, file, sha) {
  const put = () => gh(key, `${API}/contents/${path}`, { method: 'PUT', body: JSON.stringify({
    message: 'Banner schedule update', content: toBase64(JSON.stringify(file, null, 2) + '\n'), branch, ...(sha ? { sha } : {}) }) });
  let r = await put();
  if (!r.ok && /branch/i.test(r.body.message || '')) {
    // first save: the schedule branch doesn't exist yet, so make it from the main branch
    const info = await gh(key, API);
    const head = await gh(key, `${API}/git/ref/heads/${info.body.default_branch || 'main'}`);
    const made = await gh(key, `${API}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: head.body.object?.sha }) });
    if (!made.ok) throw new Error(`Couldn't create the "${branch}" branch: ${made.body.message || made.status}`);
    r = await put();
  }
  if (r.status === 409) throw new Error('The schedule was changed somewhere else since you opened it. Reload the page and make your change again.');
  if (r.status === 403) throw new Error("This key isn't allowed to write files. Make a key with Contents: Read and write.");
  if (!r.ok) throw new Error(`GitHub said: ${r.body.message || r.status}`);
  return r.body.content.sha;
}

// ── the schedule as edited here (times in ms, end Infinity = no end) ↔ the file ──
const toDraft = file => normalizeSchedule(file) || normalizeSchedule(getLiveSchedule());
const toFile = (d, revision = 0) => ({
  version: 1, revision, savedAt: new Date().toISOString(), permanent: d.permanent,
  entries: [...d.entries].sort((a, b) => a.start - b.start).map(e => ({
    id: e.id, banner: e.banner, start: new Date(e.start).toISOString(), end: e.end === Infinity ? null : new Date(e.end).toISOString() })),
});
const sameSchedule = (a, b) => { const k = d => JSON.stringify({ ...toFile(d), savedAt: 0 }); return k(a) === k(b); };
const revisionOf = file => (Number.isFinite(file?.revision) ? file.revision : 0);

// <input type="datetime-local"> works in the device's own time zone
const toLocalInput = ms => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const fromLocalInput = s => new Date(s).getTime();
const when = ms => new Date(ms).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// ── look ────────────────────────────────────────────────────────
const C = { bg: '#120d22', card: 'rgba(255,255,255,0.045)', line: 'rgba(255,255,255,0.10)', dim: 'rgba(255,255,255,0.5)', faint: 'rgba(255,255,255,0.32)', red: '#f87171', green: '#4ade80', gold: '#f0c040' };
const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: '14px 16px' };
const h2 = { margin: '0 0 10px', fontSize: 13, letterSpacing: 2, color: C.dim, fontWeight: 800, textTransform: 'uppercase' };
const btn = (tone = 'plain') => ({
  padding: '6px 12px', fontSize: 13, fontWeight: 700, borderRadius: 999, cursor: 'pointer',
  background: tone === 'go' ? 'rgba(74,222,128,0.14)' : tone === 'stop' ? 'rgba(248,113,113,0.14)' : tone === 'main' ? '#7c3aed' : 'rgba(255,255,255,0.07)',
  color: tone === 'go' ? C.green : tone === 'stop' ? C.red : '#fff',
  border: `1px solid ${tone === 'go' ? 'rgba(74,222,128,0.4)' : tone === 'stop' ? 'rgba(248,113,113,0.4)' : tone === 'main' ? '#a78bfa' : C.line}`,
});
const input = { background: 'rgba(0,0,0,0.35)', color: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: '7px 9px', fontSize: 14, fontFamily: 'inherit', colorScheme: 'dark' };

export default function SchedulePanel() {
  const [key, setKey] = useState(() => { try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; } });
  const [keyInput, setKeyInput] = useState('');
  const [account, setAccount] = useState(null);        // { login } once GitHub has accepted the key
  const [keyError, setKeyError] = useState('');
  const [base, setBase] = useState(null);              // the schedule as saved: { draft, sha, revision }
  const [draft, setDraft] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);          // { ok, text }
  const [editing, setEditing] = useState(null);        // id of the entry whose times are open
  const [showEnded, setShowEnded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Load: with a key, straight from GitHub (fresh); without one, the public copy (view only)
  useEffect(() => {
    let dead = false;
    (async () => {
      setLoadError(''); setKeyError('');
      try {
        if (key) {
          const who = await checkKey(key);
          if (dead) return;
          if (who.error) { setKeyError(who.error); setAccount(null); }
          else {
            setAccount(who);
            const { file, sha } = await loadFile(key);
            if (dead) return;
            const d = toDraft(file);
            setBase({ draft: d, sha, revision: revisionOf(file) }); setDraft(d);
            return;
          }
        }
        const r = await fetch(SCHEDULE_FILE_URL, { cache: 'no-store' }).catch(() => null);
        const file = r && r.ok ? await r.json().catch(() => null) : null;
        if (dead) return;
        const d = toDraft(file);
        setBase({ draft: d, sha: null, revision: revisionOf(file) }); setDraft(d);
      } catch (e) { if (!dead) setLoadError(e.message); }
    })();
    return () => { dead = true; };
  }, [key]);

  const canEdit = !!account && !!draft;
  const dirty = draft && base && !sameSchedule(draft, base.draft);
  useEffect(() => {
    if (!dirty) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const submitKey = () => {
    const k = keyInput.trim(); if (!k) return;
    try { localStorage.setItem(KEY_STORAGE, k); } catch { /* storage blocked: still works until the page closes */ }
    setKeyInput(''); setKey(k);
  };
  const forgetKey = () => { try { localStorage.removeItem(KEY_STORAGE); } catch { /* ignore */ } setKey(''); setAccount(null); };

  const save = async () => {
    setSaving(true); setNotice(null);
    try {
      const file = toFile(draft, base.revision + 1);
      const sha = await saveFile(key, file, base.sha);
      setBase({ draft, sha, revision: file.revision });
      setLiveSchedule(file);   // your own game shows it right away
      setNotice({ ok: true, text: 'Saved. Players get it within about 5 minutes.' });
    } catch (e) { setNotice({ ok: false, text: e.message }); }
    setSaving(false);
  };

  // ── edits ──
  // (each edit also refreshes the clock, so something started "now" shows as live straight away)
  const change = (id, patch) => { setNow(Date.now()); setDraft(d => ({ ...d, entries: d.entries.map(e => (e.id === id ? { ...e, ...patch } : e)) })); };
  const remove = id => setDraft(d => ({ ...d, entries: d.entries.filter(e => e.id !== id) }));
  const add = e => { setNow(Date.now()); setDraft(d => ({ ...d, entries: [...d.entries, { id: newId(), ...e }] })); };
  const extend = (e, ms) => change(e.id, { end: e.end === Infinity ? Infinity : Math.max(e.end, Date.now()) + ms });
  const startNow = e => { const t = Date.now(); change(e.id, { start: t, end: e.end === Infinity ? Infinity : t + (e.end - e.start) }); };
  const stopNow = e => change(e.id, { end: Math.max(e.start + 1000, Date.now()) });
  const runAgain = e => { const t = Date.now(); add({ banner: e.banner, start: t, end: e.end === Infinity ? Infinity : t + (e.end - e.start) }); };
  const togglePermanent = id => setDraft(d => ({ ...d, permanent: d.permanent.includes(id) ? d.permanent.filter(x => x !== id) : [...d.permanent, id] }));

  if (!draft) {
    return <Page><div style={{ ...card, color: loadError ? C.red : C.dim }}>{loadError || 'Loading the schedule…'}</div></Page>;
  }

  const status = bannerStatus(now, toFile(draft));
  const entries = [...draft.entries].sort((a, b) => a.start - b.start);
  const liveNow = entries.filter(e => e.start <= now && e.end > now);
  const comingUp = entries.filter(e => e.start > now);
  const ended = entries.filter(e => e.end <= now).reverse();
  const lastEnd = Math.max(now, ...entries.filter(e => e.end !== Infinity && e.end > now).map(e => e.end));

  return (
    <Page>
      {/* GitHub key */}
      <section style={card}>
        {account ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div><span style={{ color: C.green, fontWeight: 800 }}>✓ Signed in as {account.login}</span><span style={{ color: C.dim, fontSize: 13 }}> · you can change the schedule</span></div>
            <button style={btn()} onClick={forgetKey}>Forget key on this device</button>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>View only</div>
            <div style={{ color: C.dim, fontSize: 13, marginBottom: 10 }}>
              To change the schedule, paste your GitHub key. It stays on this device and is only sent to GitHub.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="password" placeholder="github_pat_…" value={keyInput} onChange={e => setKeyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitKey()} style={{ ...input, flex: '1 1 220px' }} autoComplete="off" spellCheck={false} />
              <button style={btn('main')} onClick={submitKey}>Use key</button>
            </div>
            {keyError && <div style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{keyError}</div>}
            <details style={{ marginTop: 10, fontSize: 13, color: C.dim }}>
              <summary style={{ cursor: 'pointer', color: '#c4b5fd' }}>How do I get a key?</summary>
              <ol style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.7 }}>
                <li>On github.com (signed in as {owner}): Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token.</li>
                <li>Name it e.g. "Frail Impact schedule" and pick an expiry.</li>
                <li>Repository access: <b>Only select repositories</b> → <b>{owner}/{repo}</b>.</li>
                <li>Permissions → Repository permissions → <b>Contents: Read and write</b>.</li>
                <li>Generate, copy the key (starts with github_pat_) and paste it here. Don't share it: whoever has it can change the repo.</li>
              </ol>
            </details>
          </>
        )}
      </section>

      {/* What players get right now */}
      <section style={card}>
        <h2 style={h2}>Players see right now{dirty && <span style={{ color: C.gold, letterSpacing: 0, textTransform: 'none' }}> (once you save)</span>}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {status.live.map(b => (
            <span key={b.id} style={{ border: `1px solid ${b.accentColor}88`, background: `${b.accentColor}1f`, borderRadius: 999, padding: '4px 12px', fontSize: 13 }}>
              <b style={{ color: b.accentColor }}>{b.name}</b>
              <span style={{ color: C.dim }}> · {b.id in status.endsAt ? (status.endsAt[b.id] === Infinity ? 'no end' : `ends in ${formatTimeLeft(status.endsAt[b.id] - now)}`) : 'always'}</span>
            </span>
          ))}
        </div>
        <div style={{ color: C.dim, fontSize: 13, marginTop: 10 }}>
          {status.upcoming[0]
            ? <>Up next: <b style={{ color: status.upcoming[0].banner.accentColor }}>{status.upcoming[0].banner.name}</b> in {formatTimeLeft(status.upcoming[0].start - now)}</>
            : <span style={{ color: C.gold }}>Nothing is scheduled after this. When the live banners end, only the always-available ones are left.</span>}
        </div>
      </section>

      <Timeline entries={entries.filter(e => e.end > now)} now={now} />

      {/* The schedule */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ ...h2, margin: '6px 0 0' }}>Live now</h2>
        {liveNow.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>No limited banner is live.</div>}
        {liveNow.map(e => (
          <Entry key={e.id} e={e} now={now} canEdit={canEdit} editing={editing === e.id} setEditing={setEditing} change={change}
            note={draft.permanent.includes(e.banner) ? 'Always available, so this entry has no effect' : null}
            actions={<>
              <button style={btn('go')} onClick={() => extend(e, DAY)} disabled={e.end === Infinity}>+1 day</button>
              <button style={btn('go')} onClick={() => extend(e, 7 * DAY)} disabled={e.end === Infinity}>+7 days</button>
              <button style={btn('stop')} onClick={() => stopNow(e)}>Stop now</button>
            </>} remove={remove} />
        ))}

        <h2 style={{ ...h2, margin: '10px 0 0' }}>Coming up</h2>
        {comingUp.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>Nothing scheduled.</div>}
        {comingUp.map(e => (
          <Entry key={e.id} e={e} now={now} canEdit={canEdit} editing={editing === e.id} setEditing={setEditing} change={change}
            note={draft.permanent.includes(e.banner) ? 'Always available, so this entry has no effect' : null}
            actions={<button style={btn('go')} onClick={() => startNow(e)}>Start now</button>} remove={remove} />
        ))}

        {ended.length > 0 && (
          <button style={{ ...btn(), alignSelf: 'flex-start', marginTop: 6 }} onClick={() => setShowEnded(v => !v)}>
            {showEnded ? '▾' : '▸'} Ended ({ended.length})
          </button>
        )}
        {showEnded && ended.map(e => (
          <Entry key={e.id} e={e} now={now} canEdit={canEdit} editing={editing === e.id} setEditing={setEditing} change={change}
            actions={<button style={btn('go')} onClick={() => runAgain(e)}>Run again from now</button>} remove={remove} faded />
        ))}
      </section>

      {canEdit && <AddBanner add={add} lastEnd={lastEnd} />}

      {/* Always-available banners */}
      <section style={card}>
        <h2 style={h2}>Always available</h2>
        <div style={{ color: C.dim, fontSize: 13, marginBottom: 10 }}>These are always in the banner list, with no timer.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {BANNERS.map(b => {
            const on = draft.permanent.includes(b.id);
            return (
              <button key={b.id} disabled={!canEdit} onClick={() => togglePermanent(b.id)}
                style={{ ...btn(), cursor: canEdit ? 'pointer' : 'default', color: on ? '#fff' : C.dim, background: on ? `${b.accentColor}33` : 'transparent', border: `1px solid ${on ? b.accentColor : C.line}` }}>
                {on ? '✓ ' : ''}{b.name}{b.hidden ? ' (hidden)' : ''}
              </button>
            );
          })}
        </div>
      </section>

      <div style={{ height: 80 }} />

      {/* Save bar */}
      {canEdit && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', background: 'rgba(12,8,24,0.94)',
          borderTop: `1px solid ${C.line}`, backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ width: '100%', maxWidth: 760, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: '1 1 auto', minWidth: 0, fontSize: 13, lineHeight: 1.35, color: notice && !notice.ok ? C.red : dirty ? C.gold : notice ? C.green : C.faint }}>
              {notice && (!notice.ok || !dirty) ? notice.text : dirty ? 'Unsaved changes. Players won\'t see them until you save.' : 'No changes.'}
            </div>
            <button style={{ ...btn(), flexShrink: 0 }} disabled={!dirty || saving} onClick={() => { setDraft(base.draft); setNotice(null); setEditing(null); }}>Undo</button>
            <button style={{ ...btn('main'), flexShrink: 0, opacity: dirty && !saving ? 1 : 0.5 }} disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}
    </Page>
  );
}

function Page({ children }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: C.bg, color: '#fff' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>Banner schedule</div>
            <div style={{ color: C.dim, fontSize: 13 }}>Only the owner can change this. Changes reach players within about 5 minutes of saving.</div>
          </div>
          <a href={location.pathname} style={{ fontSize: 13, fontWeight: 700 }}>← Back to the game</a>
        </header>
        {children}
      </div>
    </div>
  );
}

// One scheduled banner
function Entry({ e, now, canEdit, editing, setEditing, change, actions, remove, note, faded }) {
  const b = bannerOf(e.banner);
  const color = b?.accentColor || '#888';
  const isLive = e.start <= now && e.end > now;
  const line = (e.end <= now ? `Ran ${when(e.start)} → ${when(e.end)}`
    : isLive ? `Started ${when(e.start)} · ${e.end === Infinity ? 'no end date' : `ends in ${formatTimeLeft(e.end - now)} (${when(e.end)})`}`
      : `Starts in ${formatTimeLeft(e.start - now)} (${when(e.start)}) · runs ${formatLength(e.end - e.start)}`)
    + (b?.hidden ? ' · HIDDEN from players (hidden: true in banners.js)' : '');
  return (
    <div style={{ ...card, padding: 0, display: 'flex', overflow: 'hidden', opacity: faded ? 0.7 : 1 }}>
      <div style={{ width: 6, background: color, flexShrink: 0 }} />
      <div style={{ padding: '12px 14px', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <b style={{ color, fontSize: 16 }}>{b ? b.name : `${e.banner} (deleted banner)`}</b>
          {isLive && <span style={{ fontSize: 11, fontWeight: 800, color: C.green, letterSpacing: 1 }}>● LIVE</span>}
        </div>
        <div style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{line}</div>
        {note && <div style={{ color: C.gold, fontSize: 12, marginTop: 2 }}>{note}</div>}
        {canEdit && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {actions}
            <button style={btn()} onClick={() => setEditing(editing ? null : e.id)}>{editing ? 'Close' : 'Edit times'}</button>
            <button style={btn('stop')} onClick={() => remove(e.id)}>Remove</button>
          </div>
        )}
        {canEdit && editing && <EditTimes e={e} change={change} />}
      </div>
    </div>
  );
}

function EditTimes({ e, change }) {
  const [start, setStart] = useState(toLocalInput(e.start));
  const [end, setEnd] = useState(e.end === Infinity ? toLocalInput(e.start + 7 * DAY) : toLocalInput(e.end));
  const [noEnd, setNoEnd] = useState(e.end === Infinity);
  const s = fromLocalInput(start), en = noEnd ? Infinity : fromLocalInput(end);
  const bad = !Number.isFinite(s) || Number.isNaN(en) || en <= s;
  const apply = () => { if (!bad) change(e.id, { start: s, end: en }); };
  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'rgba(0,0,0,0.25)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
      <label style={{ fontSize: 12, color: C.dim, display: 'flex', flexDirection: 'column', gap: 4 }}>Starts
        <input type="datetime-local" value={start} onChange={ev => setStart(ev.target.value)} style={input} /></label>
      <label style={{ fontSize: 12, color: C.dim, display: 'flex', flexDirection: 'column', gap: 4, opacity: noEnd ? 0.4 : 1 }}>Ends
        <input type="datetime-local" value={end} disabled={noEnd} onChange={ev => setEnd(ev.target.value)} style={input} /></label>
      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8 }}>
        <input type="checkbox" checked={noEnd} onChange={ev => setNoEnd(ev.target.checked)} /> No end</label>
      <button style={{ ...btn('main'), opacity: bad ? 0.5 : 1 }} disabled={bad} onClick={apply}>Apply</button>
      {bad && <div style={{ color: C.red, fontSize: 12, width: '100%' }}>The end has to be after the start.</div>}
    </div>
  );
}

function AddBanner({ add, lastEnd }) {
  const [banner, setBanner] = useState(BANNERS.find(b => b.id !== 'standard')?.id || BANNERS[0].id);
  const [startMode, setStartMode] = useState('now');       // now | after | at
  const [at, setAt] = useState(() => toLocalInput(Date.now() + DAY));
  const [length, setLength] = useState(21);
  const [unit, setUnit] = useState('days');
  const [noEnd, setNoEnd] = useState(false);
  const go = () => {
    const start = startMode === 'now' ? Date.now() : startMode === 'after' ? lastEnd : fromLocalInput(at);
    const len = Number(length) * (unit === 'days' ? DAY : HOUR);
    if (!Number.isFinite(start) || (!noEnd && !(len > 0))) return;
    add({ banner, start, end: noEnd ? Infinity : start + len });
  };
  const choice = (val, label) => (
    <button key={val} onClick={() => setStartMode(val)} style={{ ...btn(), background: startMode === val ? 'rgba(124,58,237,0.35)' : 'transparent', borderColor: startMode === val ? '#a78bfa' : C.line }}>{label}</button>
  );
  return (
    <section style={card}>
      <h2 style={h2}>Add a banner</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ fontSize: 12, color: C.dim, display: 'flex', flexDirection: 'column', gap: 4 }}>Banner
          <select value={banner} onChange={e => setBanner(e.target.value)} style={input}>
            {BANNERS.map(b => <option key={b.id} value={b.id}>{b.name}{b.hidden ? ' (hidden in code)' : ''}</option>)}
          </select></label>
        <div>
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 4 }}>Starts</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {choice('now', 'Now')}
            {choice('after', `After the last one (${when(lastEnd)})`)}
            {choice('at', 'At…')}
            {startMode === 'at' && <input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} style={input} />}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 4 }}>Runs for</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="number" min="1" value={length} disabled={noEnd} onChange={e => setLength(e.target.value)} style={{ ...input, width: 80, opacity: noEnd ? 0.4 : 1 }} />
            <select value={unit} disabled={noEnd} onChange={e => setUnit(e.target.value)} style={{ ...input, opacity: noEnd ? 0.4 : 1 }}>
              <option value="days">days</option><option value="hours">hours</option>
            </select>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={noEnd} onChange={e => setNoEnd(e.target.checked)} /> No end (until you stop it)</label>
          </div>
        </div>
        <button style={{ ...btn('main'), alignSelf: 'flex-start', padding: '8px 18px' }} onClick={go}>Add to schedule</button>
        <div style={{ color: C.faint, fontSize: 12 }}>Banners can overlap: add several with the same start to run them at the same time.</div>
      </div>
    </section>
  );
}

// Bars for what's live and coming up, so overlaps are easy to see
function Timeline({ entries, now }) {
  if (!entries.length) return null;
  const from = now - DAY;
  const finiteEnds = entries.filter(e => e.end !== Infinity).map(e => e.end);
  const to = Math.min(now + 120 * DAY, Math.max(now + 28 * DAY, ...finiteEnds, ...entries.map(e => e.start + 7 * DAY)) + 2 * DAY);
  const x = t => `${(Math.min(Math.max(t, from), to) - from) / (to - from) * 100}%`;
  const ticks = [];
  for (let t = Math.ceil(from / (7 * DAY)) * 7 * DAY; t < to; t += 7 * DAY) ticks.push(t);
  return (
    <section style={{ ...card, paddingBottom: 10 }}>
      <h2 style={h2}>Timeline</h2>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {ticks.map(t => <div key={t} style={{ position: 'absolute', left: x(t), top: 0, bottom: 18, width: 1, background: 'rgba(255,255,255,0.06)' }} />)}
        <div style={{ position: 'absolute', left: x(now), top: -4, bottom: 18, width: 2, background: C.green, boxShadow: `0 0 8px ${C.green}`, zIndex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 4 }}>
          {entries.map(e => {
            const b = bannerOf(e.banner), color = b?.accentColor || '#888';
            return (
              <div key={e.id} style={{ position: 'relative', height: 22 }}>
                <div style={{ position: 'absolute', left: x(e.start), width: `calc(${x(e.end)} - ${x(e.start)})`, top: 0, bottom: 0, borderRadius: 6,
                  background: e.end === Infinity ? `linear-gradient(90deg, ${color}cc 70%, ${color}00)` : `${color}cc`, minWidth: 4 }} />
                <div style={{ position: 'absolute', top: 2, fontSize: 12, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px #000', whiteSpace: 'nowrap', padding: '0 6px',
                  ...((e.start - from) / (to - from) > 0.6 ? { right: `calc(100% - ${x(e.end)})` } : { left: x(e.start) }) }}>
                  {b ? b.name : e.banner}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ position: 'relative', height: 18 }}>
          {ticks.map(t => <div key={t} style={{ position: 'absolute', left: x(t), fontSize: 10, color: C.faint, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
            {new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>)}
        </div>
      </div>
    </section>
  );
}
