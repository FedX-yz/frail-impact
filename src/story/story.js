// Story mode helpers: unlocking, flags, turning a node into a battle stage,
// and a checker that catches typos in the story files.
import { CHAPTERS } from './chapters';
import { SCENES } from './scenes';
import { CAST } from './cast';
import { makeEndlessStage, MODIFIERS } from '../combat/stages';
import { ENEMY_TYPES } from '../combat/enemies';

const BASE = import.meta.env.BASE_URL;
// 'story/bg/city.png' → full URL for the site
export const asset = (p) => (!p ? null : /^(https?:|data:|\/)/.test(p) ? p : BASE + p);

// Saved story progress
export const EMPTY_STORY = { cleared: {}, flags: {}, at: null };
export function normalizeStory(saved) {
  return {
    cleared: { ...(saved?.cleared ?? {}) },
    flags:   { ...(saved?.flags ?? {}) },
    at:      saved?.at ?? null,
  };
}

// 'flag' → set, '!flag' → not set, nothing → always true
export function testFlag(flags, cond) {
  if (!cond) return true;
  return cond.startsWith('!') ? !flags[cond.slice(1)] : !!flags[cond];
}

export const allNodes = () => CHAPTERS.flatMap(ch => ch.nodes.map(node => ({ chapter: ch, node })));
export const findNode = (id) => allNodes().find(x => x.node.id === id) ?? null;

export const chapterOpen = (ch, story, unlockAll = false) => unlockAll || !ch.after || !!story.cleared[ch.after];
export const nodeVisible = (node, story) => testFlag(story.flags, node.if);
export function nodeOpen(node, ch, story, unlockAll = false) {
  if (!chapterOpen(ch, story, unlockAll) || !nodeVisible(node, story)) return false;
  return unlockAll || !node.after?.length || node.after.some(id => story.cleared[id]);
}

// The first open, not-yet-cleared node of a chapter (where the marker starts)
export function nextNode(ch, story) {
  return ch.nodes.find(n => nodeOpen(n, ch, story) && !story.cleared[n.id]) ?? ch.nodes.find(n => nodeOpen(n, ch, story)) ?? ch.nodes[0];
}

// A node's `battle` → a stage config for the battle engine
export function makeStoryStage(node) {
  const b = node.battle ?? {};
  const base = makeEndlessStage(b.level ?? 1);
  const elites = b.elites ?? base.elites;
  return {
    ...base,
    label: node.name.toUpperCase(),
    sub: b.goal,
    story: true,
    bg: asset(b.bg) ?? undefined,
    killTarget: b.kills ?? base.killTarget,
    boss: b.boss ?? null,
    basics: b.enemies ?? base.basics,
    elites,
    eliteCap: elites.length ? base.eliteCap : 0,
    hordeEvery: b.hordes === false ? 0 : base.hordeEvery,
    affixChance: b.affixes === false ? 0 : base.affixChance,
    mod: b.modifier && MODIFIERS[b.modifier] ? { id: b.modifier, ...MODIFIERS[b.modifier] } : null,
    clearReward: null,         // story rewards are paid by the level screen (first clear only)
    ...(b.tweak ?? {}),
  };
}

// Codec trigger: 'kills 5' → { type: 'kills', n: 5 }
export function parseWhen(when = 'start') {
  const [type, ...rest] = String(when).trim().toLowerCase().split(/\s+/);
  if (type === 'boss' && rest[0] === 'half') return { type: 'bossHalf' };
  if (type === 'low' && rest[0] === 'hp') return { type: 'lowHp' };
  return { type, n: Number(rest[0]) || 0 };
}
const WHEN_TYPES = new Set(['start', 'kills', 'time', 'boss', 'bossHalf', 'lowHp', 'hit', 'ult']);

// ─────────────────────────────────────────────────────────────────────────────
// Typo checker. Runs in `npm run dev` and in developer mode; problems show up
// in the browser console (and on the Tower screen in developer mode).
// ─────────────────────────────────────────────────────────────────────────────
export function checkStory() {
  const out = [];
  const ids = new Set();
  const castOk = (who, where) => { if (!CAST[who]) out.push(`${where}: no one called "${who}" in cast.js`); };

  for (const ch of CHAPTERS) {
    if (ch.after && !findNode(ch.after)) out.push(`chapter ${ch.id}: "after" points to unknown node "${ch.after}"`);
    for (const n of ch.nodes) {
      const at = `node ${n.id}`;
      if (ids.has(n.id)) out.push(`${at}: id used twice`);
      ids.add(n.id);
      (n.after ?? []).forEach(a => { if (!ch.nodes.some(x => x.id === a) && !findNode(a)) out.push(`${at}: "after" points to unknown node "${a}"`); });
      ['intro', 'outro'].forEach(k => { if (n[k] && !SCENES[n[k]]) out.push(`${at}: ${k} scene "${n[k]}" not found in scenes.js`); });
      if (!n.battle && !n.intro && !n.outro) out.push(`${at}: has no battle and no scenes`);
      const b = n.battle;
      if (b) {
        if (b.boss && ENEMY_TYPES[b.boss]?.tier !== 'boss') out.push(`${at}: boss "${b.boss}" isn't a boss in enemies.js`);
        [...(b.enemies ?? []), ...(b.elites ?? [])].forEach(e => { if (!ENEMY_TYPES[e]) out.push(`${at}: unknown enemy "${e}"`); });
        if (b.modifier && !MODIFIERS[b.modifier]) out.push(`${at}: unknown modifier "${b.modifier}"`);
      }
      (n.codec ?? []).forEach((l, i) => {
        castOk(l.who, `${at} codec line ${i + 1}`);
        if (!WHEN_TYPES.has(parseWhen(l.when).type)) out.push(`${at} codec line ${i + 1}: don't understand when "${l.when}"`);
      });
    }
  }
  for (const [id, steps] of Object.entries(SCENES)) {
    const labels = new Set(steps.filter(s => s?.label).map(s => s.label));
    steps.forEach((s, i) => {
      const at = `scene ${id} step ${i + 1}`;
      if (Array.isArray(s)) castOk(s[0], at);
      else if (s && typeof s === 'object') {
        if (s.show) castOk(s.show, at);
        if (s.hide && s.hide !== 'all') castOk(s.hide, at);
        if (s.goto && !labels.has(s.goto)) out.push(`${at}: goto "${s.goto}" but there's no { label: '${s.goto}' }`);
        (s.choice ?? []).forEach(c => { if (c.goto && !labels.has(c.goto)) out.push(`${at}: choice goes to "${c.goto}" but there's no such label`); });
      } else if (typeof s !== 'string') out.push(`${at}: don't understand this step`);
    });
  }
  return out;
}
