// Works out the banner schedule (BANNER_SCHEDULE in data/banners.js) for a moment in time.
import { BANNERS, BANNER_SCHEDULE } from '../data/banners.js';

const DAY = 86400000;
const idsOf = e => [].concat(e.banner ?? []);

// The schedule from `now` on: the stretch running now (if any) and the ones after
// it, as [{ ids, start, end }] (times in ms). `count` limits how many come back.
export function bannerTimeline(now = Date.now(), count = 6, schedule = BANNER_SCHEDULE) {
  const rot = (schedule.rotation || []).filter(e => e.days > 0);
  const t0 = Date.parse(schedule.start);
  if (!rot.length || !Number.isFinite(t0)) return [];
  const cycle = rot.reduce((sum, e) => sum + e.days * DAY, 0);
  let t = t0, i = 0;
  if (schedule.repeat && now > t0) t = t0 + Math.floor((now - t0) / cycle) * cycle;   // skip whole past cycles
  const out = [];
  for (let guard = 0; out.length < count && guard < 1000; guard++) {
    if (i >= rot.length) { if (!schedule.repeat) break; i = 0; }
    const e = rot[i++], end = t + e.days * DAY;
    if (end > now) out.push({ ids: idsOf(e), start: t, end });
    t = end;
  }
  return out;
}

// Everything the gacha screen needs at `now`:
//   live     banners you can pull on right now (limited first, then permanent)
//   endsAt   id → when that banner leaves (missing = permanent)
//   upcoming the next banners to arrive: [{ banner, start, end }]
export function bannerStatus(now = Date.now(), schedule = BANNER_SCHEDULE) {
  const rot = (schedule.rotation || []).filter(e => e.days > 0);
  const timeline = bannerTimeline(now, rot.length * 2 + 2, schedule);
  const current = timeline[0] && timeline[0].start <= now ? timeline[0] : null;
  const byId = id => BANNERS.find(b => b.id === id);
  const permanent = (schedule.permanent || []).filter(byId);
  // a banner that's in every stretch of a repeating rotation never leaves
  const always = id => schedule.repeat && rot.length > 0 && rot.every(e => idsOf(e).includes(id));

  const endsAt = {};
  const liveIds = [];
  for (const id of current ? current.ids : []) {
    if (!byId(id) || permanent.includes(id) || liveIds.includes(id)) continue;
    liveIds.push(id);
    if (always(id)) continue;
    // if the next stretch has it too, it keeps going until that one ends
    let end = current.end;
    for (const seg of timeline.slice(1)) { if (seg.start === end && seg.ids.includes(id)) end = seg.end; else break; }
    endsAt[id] = end;
  }
  const live = [...liveIds, ...permanent].map(byId);

  const upcoming = [];
  for (const seg of timeline) {
    if (seg.start <= now) continue;
    for (const id of seg.ids) {
      if (!byId(id) || liveIds.includes(id) || permanent.includes(id) || upcoming.some(u => u.banner.id === id)) continue;
      upcoming.push({ banner: byId(id), start: seg.start, end: seg.end });
    }
  }
  return { live, endsAt, upcoming };
}

// "6d 04h 31m", or "04:31:09" under a day
export function formatTimeLeft(ms) {
  if (ms <= 0) return '00:00:00';
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  const p = n => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${p(h)}h ${p(m)}m` : `${p(h)}:${p(m)}:${p(s)}`;
}
