// Works out the banner schedule (see the top of data/banners.js) for a moment in time.
import { BANNERS, DEFAULT_SCHEDULE } from '../data/banners.js';

const DAY = 86400000;
const byId = id => BANNERS.find(b => b.id === id);
// banners with `hidden: true` never show to players, whatever the schedule says; `secret: true`
// ones don't come from the schedule either (the gacha adds them where they've been found)
const shown = id => { const b = byId(id); return !!b && !b.hidden && !b.secret; };

// A schedule as saved in the file → { permanent: [ids], entries: [{ id, banner, start, end }] }
// with times in ms (end: Infinity = no end). Bad entries are dropped; null if it isn't a schedule.
export function normalizeSchedule(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.entries)) return null;
  const time = v => (typeof v === 'number' ? v : Date.parse(v));
  const entries = s.entries.map((e, i) => ({
    id: String(e?.id ?? i), banner: String(e?.banner ?? ''),
    start: time(e?.start), end: e?.end == null ? Infinity : time(e.end),
  })).filter(e => Number.isFinite(e.start) && !Number.isNaN(e.end) && e.end > e.start);
  const permanent = [...new Set((Array.isArray(s.permanent) ? s.permanent : []).map(String))];
  return { permanent, entries };
}

// Everything the gacha screen needs at `now`:
//   live      banners you can pull on right now (limited ones first, newest first, then permanent)
//   endsAt    id → when that limited banner leaves (Infinity = no end); permanent ones aren't in it
//   upcoming  scheduled banners that haven't started yet: [{ banner, start, end }], soonest first
export function bannerStatus(now = Date.now(), schedule = DEFAULT_SCHEDULE) {
  const sch = normalizeSchedule(schedule) || normalizeSchedule(DEFAULT_SCHEDULE);
  const permanent = sch.permanent.filter(shown);
  const entries = sch.entries.filter(e => shown(e.banner) && !permanent.includes(e.banner)).sort((a, b) => a.start - b.start);

  const running = entries.filter(e => e.start <= now && e.end > now).sort((a, b) => b.start - a.start);
  const liveIds = [...new Set(running.map(e => e.banner))];
  const endsAt = {};
  for (const id of liveIds) {
    // follow back-to-back or overlapping entries of the same banner to find when it really leaves
    let end = Math.max(...running.filter(e => e.banner === id).map(e => e.end)), grew = true;
    while (grew && end !== Infinity) {
      grew = false;
      for (const e of entries) if (e.banner === id && e.start <= end && e.end > end) { end = e.end; grew = true; }
    }
    endsAt[id] = end;
  }
  const upcoming = entries
    .filter(e => e.start > now && !(e.banner in endsAt && e.start <= endsAt[e.banner]))
    .map(e => ({ banner: byId(e.banner), start: e.start, end: e.end }));
  return { live: [...liveIds, ...permanent].map(byId), endsAt, upcoming };
}

// "6d 04h 31m", "04:31:09" under a day, "∞" for no end
export function formatTimeLeft(ms) {
  if (ms === Infinity) return '∞';
  if (!(ms > 0)) return '00:00:00';
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  const p = n => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${p(h)}h ${p(m)}m` : `${p(h)}:${p(m)}:${p(s)}`;
}

// how long something runs: "21 days", "1 day", "12 h", "no end"
export function formatLength(ms) {
  if (ms === Infinity) return 'no end';
  const d = ms / DAY;
  return d >= 1 ? `${+d.toFixed(1)} day${d === 1 ? '' : 's'}` : `${Math.max(1, Math.round(d * 24))} h`;
}
