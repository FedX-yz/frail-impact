// The banner schedule every player follows. It's a file in the GitHub repo
// (SCHEDULE_SOURCE in data/banners.js) that the owner edits from the schedule panel.
// The game loads it when the gacha screen opens and every 5 minutes while it's open,
// keeps the last copy for offline play, and uses DEFAULT_SCHEDULE until it has one.
// GitHub can take up to ~5 minutes to hand out a freshly saved file.
import { useSyncExternalStore } from 'react';
import { DEFAULT_SCHEDULE, SCHEDULE_SOURCE } from '../data/banners.js';
import { normalizeSchedule } from './bannerSchedule.js';

const CACHE_KEY = 'frail_schedule';
const REFRESH_MS = 5 * 60 * 1000;
const { owner, repo, branch, path } = SCHEDULE_SOURCE;
export const SCHEDULE_FILE_URL = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

function loadCached() {
  try { const s = JSON.parse(localStorage.getItem(CACHE_KEY)); return normalizeSchedule(s) ? s : null; } catch { return null; }
}
let current = loadCached() || DEFAULT_SCHEDULE;
const listeners = new Set();

export const getLiveSchedule = () => current;

// Also used by the panel right after saving, so the owner's own game shows it at once.
export function setLiveSchedule(s) {
  if (!normalizeSchedule(s)) return;
  current = s;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
  listeners.forEach(f => f());
}

export async function refreshLiveSchedule() {
  try {
    const r = await fetch(SCHEDULE_FILE_URL, { cache: 'no-store' });
    if (!r.ok) return;                       // no file yet → keep what we have
    const s = await r.json();
    // GitHub may still hand out the previous file for a few minutes after a save;
    // every save bumps `revision`, so an older copy never replaces a newer one
    const older = Number.isFinite(current.revision) && !(s?.revision >= current.revision);
    if (!older) setLiveSchedule(s);
  } catch { /* offline → keep what we have */ }
}

let timer = null;
function subscribe(fn) {
  listeners.add(fn);
  if (!timer) { refreshLiveSchedule(); timer = setInterval(refreshLiveSchedule, REFRESH_MS); }
  return () => { listeners.delete(fn); if (!listeners.size) { clearInterval(timer); timer = null; } };
}

export function useLiveSchedule() {
  return useSyncExternalStore(subscribe, getLiveSchedule);
}
