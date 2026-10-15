// ─────────────────────────────────────────────────────────────────────────────
// How the Anemic Kaisen kits work in battle. The numbers are in kits.js;
// engine.js calls the hooks below (onKill, onCombo, absorbHit, …).
//
// Shared systems:
//   s.allies  – things on your side: Tyran's crawlers, Bio's shikigami, Doro's
//               fire arrow, Ivy's spirits (drawn from s.kit.souls)
//   s.zones   – ground that burns enemies: Ice's lava
//   s.fire    – Doro's fire-trail segments (also stop enemy shots)
//   s.mahoraga – Bio's ult: enemies attack it instead of you
// ─────────────────────────────────────────────────────────────────────────────
import { BAL } from './balance';
import { SKILLS, scaleKit, weakKit } from './kits';
import { CHARACTERS } from '../data/characters';

// skill id → the skill's name on its card (for Room 16's copies)
export const SKILL_NAMES = Object.fromEntries(CHARACTERS.filter(c => c.skill?.effect).map(c => [c.skill.effect, c.skill.name]));
const COPY_POOL = Object.keys(SKILLS).filter(id => id !== 'copy');

const MAX_LAVA = 6, MAX_FIRE = 50, MAX_CRAWLERS = 4, MAX_SHIKI = 3;
const ZONE_TICK = 0.5;            // lava / fire / spirits deal damage this often
const SHIKI = ['dog', 'toad', 'nue'];
// Jerry's repel: launch speed (slides about speed / friction px), how fast it
// slows down, and how fast it has to be going for a wall or an enemy to crush it
const REPEL_SPEED = 1400, REPEL_FRICTION = 5, CRUSH_SPEED = 260;

export function createKitRuntime(api) {
  const { s, K, rand, pick, dist, distToSegment, clamp, floater, effect, shake, sfx, nextId } = api;

  function init() {
    s.kit = {
      souls: 0, kills: 0, hits: 0,
      inf: 100, infUsed: -9,          // Infinity meter (0–100) and when it last blocked
      repelN: 0,                      // Jerry: hits toward the next repel
      copied: null, copyT: 0,         // Room 16
      oraSkill: null,
      trailPt: null, trailT: 0,       // Doro's trail
      posHist: [],                    // Astrec: where your cursor was
      phantomT: 0,
      purple: null, meteor: null,     // ults that take a moment to land
      tickT: ZONE_TICK,
      ratioU: 0, ratioWin: 0,
    };
    s.allies = []; s.zones = []; s.fire = [];
    s.mahoraga = null; s.choosing = null; s.hoverId = null;
  }
  init();

  // The skill that's active right now (Room 16 swaps in a copied one)
  function skill() {
    const sk = s.stats.skill;
    if (!sk || sk.type !== 'copy') return sk;
    return s.kit.oraSkill ?? s.kit.copied ?? null;
  }

  // A skill effect's hit: can crit, gets combo/frenzy bonuses, doesn't build combo
  function kitHit(e, mult, { color, label = '', charge = 1, quiet = false } = {}) {
    const { dmg, crit } = api.rollClick(mult, { noCount: true });
    return api.damageEnemy(e, dmg, { crit, color, label, charge, quiet });
  }
  // An ult's hit: flat click DMG × mult, no crit (like the older ults)
  const ultHit = (e, mult, color, label) => api.damageEnemy(e, s.stats.clickDmg * mult, { color, label, charge: 0 });
  // things worth hitting: not treasure, not a hydra head that's down (it can't be damaged)
  const foes = () => s.enemies.filter(e => e.tier !== 'treasure' && !(e.down > 0));
  const fighting = () => s.phase === 'fight' || s.phase === 'boss' || s.phase === 'bossIntro';
  const radius = e => e.size * s.k * 0.5;
  const center = () => ({ x: s.W / 2, y: s.H / 2 });
  // where the character "is": the middle of the status frame (bottom-left)
  const origin = () => (s.reserved
    ? { x: (s.reserved.x0 + s.reserved.x1) / 2, y: (s.reserved.y0 + s.reserved.y1) / 2 }
    : { x: s.W * 0.12, y: s.H * 0.85 });
  const nearest = (x, y, list = foes()) => list.reduce((b, e) => (!b || dist(x, y, e.x, e.y) < dist(x, y, b.x, b.y) ? e : b), null);

  // ── Who enemies attack ───────────────────────────────────────────────────
  // Mahoraga out → it's the target. Astrec (Heavenly Restriction) → enemies aim
  // where your cursor was a moment ago.
  function aimPoint() {
    if (s.mahoraga) return { x: s.mahoraga.x, y: s.mahoraga.y };
    const sk = skill();
    if (sk?.type === 'phantom' && s.kit.posHist.length) {
      const want = s.time - sk.lag;
      let p = s.kit.posHist[0];
      for (const h of s.kit.posHist) { if (h.t <= want) p = h; else break; }
      return { x: p.x, y: p.y };
    }
    return null;
  }
  // The spot (and its size) that enemy attacks can actually hit
  function target() {
    if (s.mahoraga) return { x: s.mahoraga.x, y: s.mahoraga.y, r: K(42) };
    const P = s.player.pos;
    return P ? { x: P.x, y: P.y, r: 0 } : null;
  }

  // ── Getting hit ──────────────────────────────────────────────────────────
  // true = the hit was stopped (Toad / Infinity)
  function absorbHit(kind, src) {
    const P = s.player.pos;
    const toad = s.allies.find(a => a.kind === 'toad');
    if (toad) {
      s.allies = s.allies.filter(a => a !== toad);
      floater('🐸 SWALLOWED', toad.x, toad.y - K(30), '#86efac', true);
      effect({ kind: 'burst', x: toad.x, y: toad.y, r: K(50), color: '#22c55e' });
      return true;
    }
    const sk = skill();
    if (sk?.type === 'infinity' && P && s.kit.inf >= 10 && (kind === 'shot' || kind === 'dash' || kind === 'bite')) {
      s.kit.inf = Math.max(0, s.kit.inf - 25); s.kit.infUsed = s.time;
      floater('∞', P.x, P.y - K(40), '#93c5fd', true);
      effect({ kind: 'burst', x: P.x, y: P.y, r: K(sk.radius), color: '#60a5fa' });
      if (src) {
        if (src.dashing) api.finishAttack(src.dashing);
        // a dasher gets thrown back hard (into a wall = crushed); the worm is
        // too long to throw, so its head is just shoved out of the bubble
        if (!launch(src, P, 1.3)) {
          const a = Math.atan2(src.y - P.y, src.x - P.x) || 0;
          const d = K(sk.radius) + radius(src) + K(6);
          src.x = clamp(P.x + Math.cos(a) * d, 0, s.W); src.y = clamp(P.y + Math.sin(a) * d, 0, s.H);
          if (src.move === 'worm') src.angle = a;
          src.target = null;
        }
      }
      return true;
    }
    return false;
  }

  // ── Jerry's repel ────────────────────────────────────────────────────────
  // Bosses, worm parts and hydra heads are too heavy to throw
  const heavy = e => e.tier === 'boss' || e.move === 'worm' || e.role === 'hydra' || !!e.group;
  // Throw an enemy away from a point. false = it didn't budge
  function launch(e, from, power = 1) {
    if (heavy(e) || e.down > 0 || !s.enemies.includes(e)) return false;
    let dx = e.x - from.x, dy = e.y - from.y, d = Math.hypot(dx, dy);
    // hit dead centre → it flies outward, toward the nearest walls
    if (d < radius(e) * 0.3) { dx = e.x - s.W / 2; dy = e.y - s.H / 2; d = Math.hypot(dx, dy); }
    if (d < 0.5) { const a = rand(0, Math.PI * 2); dx = Math.cos(a); dy = Math.sin(a); d = 1; }
    if (e.dashing) api.finishAttack(e.dashing);
    const v = K(REPEL_SPEED) * power * (e.tier === 'elite' ? 0.7 : 1);
    const sk = skill();
    e.kb = { vx: dx / d * v, vy: dy / d * v, hit: [], crush: sk?.crush ?? 2 };
    e.target = null;
    effect({ kind: 'burst', x: e.x, y: e.y, r: radius(e) * 1.3, color: '#93c5fd' });
    return true;
  }
  function crushHit(e, mult, big, quiet = false) {
    if (kitHit(e, mult, { color: '#bfdbfe', label: '💥', quiet }) > 0 && big) {
      floater('CRUSHED', e.x, e.y - radius(e) - K(22), '#93c5fd', true);
    }
  }
  // A thrown enemy sliding (called by the engine instead of its normal move)
  function slide(e, dt) {
    const kb = e.kb;
    e.x += kb.vx * dt; e.y += kb.vy * dt;
    const sp = Math.hypot(kb.vx, kb.vy);
    const f = Math.exp(-REPEL_FRICTION * dt);
    kb.vx *= f; kb.vy *= f;
    const fast = sp >= K(CRUSH_SPEED);
    // walls: the arena's edges, and the status frame in the corner
    const rr = radius(e) * 0.8;
    let wall = null;
    if (e.x < rr) { e.x = rr; wall = { x: 0, y: e.y, a: 0 }; }
    else if (e.x > s.W - rr) { e.x = s.W - rr; wall = { x: s.W, y: e.y, a: Math.PI }; }
    if (e.y < rr) { e.y = rr; wall = { x: e.x, y: 0, a: Math.PI / 2 }; }
    else if (e.y > s.H - rr) { e.y = s.H - rr; wall = { x: e.x, y: s.H, a: -Math.PI / 2 }; }
    const r = s.reserved;
    if (!wall && r && e.x > r.x0 - rr && e.x < r.x1 + rr && e.y > r.y0 - rr && e.y < r.y1) {
      // pushed out the shortest way (the frame has no bottom edge in the arena)
      const out = [[e.x - (r.x0 - rr), -1, 0], [r.x1 + rr - e.x, 1, 0], [e.y - (r.y0 - rr), 0, -1]]
        .reduce((a, b) => (b[0] < a[0] ? b : a));
      e.x += out[1] * out[0]; e.y += out[2] * out[0];
      wall = { x: e.x - out[1] * rr, y: e.y - out[2] * rr, a: Math.atan2(out[2], out[1]) };
    }
    if (wall) {
      e.kb = null;
      if (fast) {
        crushHit(e, kb.crush, true);
        effect({ kind: 'crack', x: wall.x, y: wall.y, a: wall.a, r: radius(e) * 1.2, life: 0.8 });
        effect({ kind: 'shards', x: wall.x, y: wall.y, r: radius(e), color: '#93c5fd', n: 9 });
        shake(0.15); sfx('crit');
      }
      return;
    }
    // slamming into other enemies: both get hurt, and the momentum carries on
    if (fast) {
      for (const o of s.enemies) {
        if (o === e || o.down > 0 || o.tier === 'treasure' || kb.hit.includes(o.id)) continue;
        if (dist(o.x, o.y, e.x, e.y) > (radius(o) + radius(e)) * 0.75) continue;
        kb.hit.push(o.id);
        crushHit(o, kb.crush * 0.5, false);
        crushHit(e, kb.crush * 0.5, false, true);   // one number per collision is plenty
        effect({ kind: 'shards', x: (o.x + e.x) / 2, y: (o.y + e.y) / 2, r: radius(o), color: '#93c5fd', n: 5 });
        sfx('hit');
        if (!s.enemies.includes(e)) return;
        if (!s.enemies.includes(o)) { kb.vx *= 0.6; kb.vy *= 0.6; break; }   // smashed straight through it
        if (heavy(o)) { e.kb = null; return; }                               // bounced off something that won't move
        if (!o.kb) { o.kb = { vx: kb.vx * 0.7, vy: kb.vy * 0.7, hit: [e.id], crush: kb.crush }; o.target = null; }
        kb.vx *= 0.35; kb.vy *= 0.35;
        break;
      }
    }
    if (Math.hypot(kb.vx, kb.vy) < K(50)) e.kb = null;
  }
  function onPlayerHit() {
    const sk = skill();
    if (sk?.type === 'souls' && s.kit.souls > 0) {
      s.kit.souls--;
      const P = s.player.pos;
      if (P) floater('-1 👻', P.x + K(20), P.y - K(10), '#e879f9');
    }
  }
  // Shots slow to a crawl inside Infinity (draining it a little)
  function shotSpeed(a, dt) {
    const sk = skill(), P = s.player.pos;
    if (sk?.type !== 'infinity' || !P || s.kit.inf <= 0 || s.mahoraga) return 1;
    if (dist(a.x, a.y, P.x, P.y) > K(sk.radius)) return 1;
    s.kit.inf = Math.max(0, s.kit.inf - 15 * dt); s.kit.infUsed = s.time;
    return 0.15;
  }
  // Doro's fire walls burn up enemy shots
  function shotBlocked(a) {
    for (const f of s.fire) if (distToSegment(a.x, a.y, f.x1, f.y1, f.x2, f.y2) <= a.r + K(10)) return true;
    return false;
  }

  // ── Clicking ─────────────────────────────────────────────────────────────
  // Nanami's ratio: a red line sweeps 0→1→0; clicking near 0.7 is a ratio hit
  function ratioU(sk) {
    const ph = (s.time % sk.period) / sk.period;
    return ph < 0.5 ? ph * 2 : 2 - ph * 2;
  }
  function clickMods() {
    const act = s.ult.active, sk = skill();
    if (act?.type === 'overtime') return { ratio: true, bonus: sk?.type === 'ratio' ? sk.bonus : 1.5, label: 'RATIO ' };
    if (sk?.type !== 'ratio') return undefined;
    if (Math.abs(ratioU(sk) - 0.7) <= sk.window / 2) return { ratio: true, bonus: sk.bonus, label: 'RATIO ' };
    return undefined;
  }
  function afterClick(e, dmg, auto, mods) {
    if (!auto) { s.kit.lastHitId = e.id; s.kit.lastHitT = s.time; }   // the ratio bar sticks to it (phones can't hover)
    if (mods?.ratio) effect({ kind: 'ratio', x: e.x, y: e.y, r: radius(e) });
    const sk = skill();
    if (sk?.type === 'lava' && !auto) {
      s.kit.hits++;
      if (s.kit.hits % 6 === 0) addLava(e.x, e.y, K(sk.radius) * 0.6, sk.dur * 0.7, sk.dps);
    }
    // Jerry: every Nth hit repels. A hit that kills keeps the repel for the next one;
    // bosses (and other heavy things) can't be thrown, so they take half the crush instead
    if (sk?.type === 'infinity' && !auto && !(e.down > 0)) {
      const every = Math.max(2, Math.round(sk.every ?? 4));
      s.kit.repelN = Math.min(every, s.kit.repelN + 1);
      if (s.kit.repelN >= every && e.hp > 0 && s.enemies.includes(e)) {
        const P = s.player.pos ?? { x: e.x, y: e.y };
        if (launch(e, P)) sfx('shield');
        else { crushHit(e, (sk.crush ?? 2) * 0.5, false); effect({ kind: 'burst', x: e.x, y: e.y, r: radius(e), color: '#93c5fd' }); }
        s.kit.repelN = 0;
      }
    }
  }
  // true = swallow the click (you're suspended while Mahoraga fights)
  function onPointerDown(x, y) {
    if (s.mahoraga) return true;
    const act = s.ult.active;
    if (act?.type === 'distortion') {
      const L = Math.hypot(s.W, s.H);
      let any = false;
      for (let i = 0; i < act.slashes; i++) {
        const a = rand(0, Math.PI);
        const x1 = x - Math.cos(a) * L, y1 = y - Math.sin(a) * L, x2 = x + Math.cos(a) * L, y2 = y + Math.sin(a) * L;
        effect({ kind: 'slash', x1, y1, x2, y2, life: 0.3 });
        foes().forEach(e => {
          if (distToSegment(e.x, e.y, x1, y1, x2, y2) <= K(30) + radius(e) * 0.7) { if (kitHit(e, act.mult, { color: '#d8b4fe', label: '✂' }) > 0) any = true; }
        });
      }
      if (any) sfx('crit');
    }
    return false;
  }

  // ── Kills & combo ────────────────────────────────────────────────────────
  function onKill(e) {
    if (e.tier === 'treasure') return;
    const sk = skill();
    s.kit.kills++;
    // Sorcerer Killer charges from kills, not damage
    const u = s.stats.ult;
    if (u?.chargeOn === 'kills' && !s.ult.active) {
      const pts = e.tier === 'elite' ? 3 : e.tier === 'boss' ? 2 : 1;
      s.ult.charge = Math.min(1, s.ult.charge + pts / u.killsNeeded);
    }
    if (!sk) return;
    if (sk.type === 'souls') {
      const add = e.tier === 'elite' ? 3 : 1;
      s.kit.souls = Math.min(Math.round(sk.cap), s.kit.souls + add);
    } else if (sk.type === 'transfig' && e.tier !== 'boss') {
      const big = e.tier === 'elite';
      const every = Math.max(2, Math.round(sk.every));
      if ((big || s.kit.kills % every === 0) && s.allies.filter(a => a.kind === 'crawler').length < MAX_CRAWLERS) {
        s.allies.push({ id: nextId(), kind: 'crawler', x: e.x, y: e.y, img: e.img, size: e.size * (big ? 0.85 : 0.65), big,
          pct: sk.pct * (big ? 2 : 1), r: K(sk.radius) * (big ? 1.4 : 1), life: 6, target: null });
        floater('TRANSFIGURED', e.x, e.y - K(30), '#c084fc');
      }
    } else if (sk.type === 'lava') {
      addLava(e.x, e.y, K(sk.radius), sk.dur, sk.dps);
    }
  }
  function onCombo(m) {
    const sk = skill();
    if (sk?.type !== 'shadows') return;
    const P = s.player.pos ?? center();
    const kind = SHIKI[m];
    const shiki = s.allies.filter(a => SHIKI.includes(a.kind));
    if (shiki.length >= MAX_SHIKI) s.allies = s.allies.filter(a => a !== shiki[0]);
    const base = { id: nextId(), kind, x: P.x, y: P.y, pct: sk.pct };
    if (kind === 'dog')  s.allies.push({ ...base, life: 15, biteT: 0, target: null });
    if (kind === 'toad') s.allies.push({ ...base, life: 25 });
    if (kind === 'nue')  s.allies.push({ ...base, life: 12, ang: 0, zapT: 0.6 });
    floater({ dog: '🐺 DIVINE DOG', toad: '🐸 TOAD', nue: '🦅 NUE' }[kind], P.x, P.y - K(50), '#a5b4fc', true);
  }

  function addLava(x, y, r, life, dps, big = false) {
    if (!big) {
      const small = s.zones.filter(z => z.kind === 'lava' && !z.big);
      if (small.length >= MAX_LAVA) s.zones = s.zones.filter(z => z !== small[0]);
    }
    s.zones.push({ id: nextId(), kind: 'lava', x, y, r, t: 0, life, dps, big });
  }

  // ── Ult ──────────────────────────────────────────────────────────────────
  // Why the ult can't fire right now (shown on the orb), or null
  function ultBlocked() {
    const u = s.stats.ult;
    if (u?.type === 'uzumaki' && s.kit.souls < u.min) return `${u.min}👻`;
    return null;
  }
  // Returns true if this ult is one of ours
  function activateUlt(u) {
    const P = s.player.pos ?? center();
    switch (u.type) {
      case 'overtime':
        s.ult.active = { type: 'overtime', t: u.dur, dur: u.dur, mult: u.mult, collapse: u.collapse };
        api.announce('OVERTIME', '#22d3ee');
        return true;
      case 'distortion':
        s.ult.active = { type: 'distortion', t: u.dur, dur: u.dur, slashes: u.slashes, mult: u.mult };
        api.announce('SELF-EMBODIMENT OF PERFECTION', '#c084fc');
        return true;
      case 'meteor':
        s.kit.meteor = { x: P.x, y: P.y, r: K(u.radius), t: 0, tele: 1.2, mult: u.mult };
        api.announce('MAXIMUM: METEOR', '#f97316');
        return true;
      case 'fuga': {
        const tgt = strongest();
        s.allies.push({ id: nextId(), kind: 'arrow', x: P.x, y: P.y, targetId: tgt?.id ?? null, mult: u.mult, burn: u.burn, life: 3, ang: 0 });
        api.announce('OPEN — FUGA', '#fb923c');
        return true;
      }
      case 'uzumaki': {
        const n = s.kit.souls;
        const mult = u.base + u.perSpirit * n;
        effect({ kind: 'spiral', x: P.x, y: P.y, r: Math.max(s.W, s.H) * 0.6, life: 0.9 });
        effect({ kind: 'flash', color: '#d946ef', life: 0.5 });
        [...s.enemies].forEach(e => ultHit(e, mult, '#e879f9', '🌀'));
        s.kit.souls = 0;
        api.announce(`UZUMAKI ×${n}`, '#e879f9');
        shake(0.5);
        return true;
      }
      case 'purple':
        s.kit.purple = { t: 0.4, dur: 0.4, width: K(u.width), mult: u.mult };
        api.announce('HOLLOW PURPLE', '#a855f7');
        return true;
      case 'sorcerer':
        s.ult.active = { type: 'sorcerer', t: u.dur, dur: u.dur, speed: u.speed, mult: u.mult ?? 1, threshold: u.threshold };
        api.announce('SORCERER KILLER', '#fb7185');
        return true;
      case 'ora': {
        const opts = [];
        const pool = COPY_POOL.slice();
        while (opts.length < 3 && pool.length) opts.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        s.ult.active = { type: 'ora', t: u.dur, dur: u.dur, punches: u.punches, pct: u.pct, acc: 0 };
        s.choosing = { options: opts };        // the game waits for your pick
        return true;
      }
      case 'mahoraga': {
        const hp = s.player.maxHp * u.hp;
        s.mahoraga = { x: P.x, y: P.y, hp, maxHp: hp, mult: u.mult, slamT: 0.9, target: null, adapt: {}, wheel: 0, turns: 0, turnT: 6, invuln: 1, t: 0, timeout: 150 };
        s.ult.active = { type: 'mahoraga', t: 1e9, dur: 1e9 };
        s.combo.n = 0;
        effect({ kind: 'flash', color: '#fde047', life: 0.6 });
        api.announce('WITH THIS TREASURE I SUMMON…', '#fde047');
        shake(0.5); sfx('bigKill');
        return true;
      }
      default: return false;
    }
  }
  // An ult that lasted a while ran out
  function endUlt(act) {
    if (act.type === 'overtime') {
      effect({ kind: 'flash', color: '#22d3ee', life: 0.4 });
      [...s.enemies].forEach(e => ultHit(e, act.collapse, '#67e8f9', '🏚'));
      api.announce('COLLAPSE', '#22d3ee'); shake(0.4); sfx('boom');
    }
    if (act.type === 'ora') s.kit.oraSkill = null;
  }
  // Room 16's ult: you picked one of the three skills
  function choose(i) {
    const id = s.choosing?.options?.[i];
    if (!id) return;
    s.kit.oraSkill = { ...scaleKit(SKILLS[id], s.stats.si ?? 0), name: SKILL_NAMES[id] ?? id, effect: id };
    s.choosing = null;
    api.announce(`ORA ORA ORA — ${SKILL_NAMES[id] ?? id}`, '#f472b6');
  }
  const strongest = () => foes().reduce((b, e) => (!b || (e.tier === 'boss') > (b.tier === 'boss') || ((e.tier === 'boss') === (b.tier === 'boss') && e.hp > b.hp) ? e : b), null);

  // ── Every frame ──────────────────────────────────────────────────────────
  function update(dt) {
    const sk = skill(), P = s.player.pos, kit = s.kit;
    const live = fighting();

    // Room 16: switch the copied skill every so often
    if (s.stats.skill?.type === 'copy') {
      kit.copyT -= dt;
      if (!kit.copied || kit.copyT <= 0) {
        const pool = COPY_POOL.filter(id => id !== kit.copied?.effect);
        const id = pick(pool);
        kit.copied = { ...scaleKit(weakKit(SKILLS[id]), 0), name: SKILL_NAMES[id] ?? id, effect: id };
        kit.copyT = Math.round(s.stats.skill.every);
        if (P && s.time > 1) floater(`⧉ ${kit.copied.name}`, P.x, P.y - K(50), '#f472b6', true);
      }
    }

    // Nanami's bar + what's under your cursor
    if (sk?.type === 'ratio' || s.ult.active?.type === 'overtime') {
      if (sk?.type === 'ratio') { kit.ratioU = ratioU(sk); kit.ratioWin = sk.window; }
      const under = P ? api.enemyAt(P.x, P.y) : null;
      const recent = s.time - (kit.lastHitT ?? -9) < 2.5 && s.enemies.some(e => e.id === kit.lastHitId) ? kit.lastHitId : null;
      s.hoverId = under?.id ?? recent;
    } else s.hoverId = null;

    // Astrec: remember where the cursor has been
    if (sk?.type === 'phantom' && P) {
      kit.posHist.push({ t: s.time, x: P.x, y: P.y });
      while (kit.posHist.length && kit.posHist[0].t < s.time - 2) kit.posHist.shift();
    }

    // Infinity refills when it hasn't blocked anything for a second
    if (sk?.type === 'infinity' && s.time - kit.infUsed > 1) kit.inf = Math.min(100, kit.inf + 30 * dt);

    // Doro: moving fast leaves fire behind the cursor
    if (sk?.type === 'firetrail' && P && live) {
      if (!kit.trailPt) { kit.trailPt = { x: P.x, y: P.y }; kit.trailT = s.time; }
      const d = dist(kit.trailPt.x, kit.trailPt.y, P.x, P.y);
      if (d > K(140)) { kit.trailPt = { x: P.x, y: P.y }; kit.trailT = s.time; }   // a jump (tap somewhere else): no wall
      else if (d >= K(22)) {
        const speed = d / Math.max(0.001, s.time - kit.trailT);
        if (speed >= K(300)) {
          s.fire.push({ id: nextId(), x1: kit.trailPt.x, y1: kit.trailPt.y, x2: P.x, y2: P.y, t: 0, life: sk.dur, dps: sk.pct });
          if (s.fire.length > MAX_FIRE) s.fire.shift();
        }
        kit.trailPt = { x: P.x, y: P.y }; kit.trailT = s.time;
      }
    }
    s.fire.forEach(f => { f.t += dt; });
    s.fire = s.fire.filter(f => f.t < f.life);
    s.zones.forEach(z => { z.t += dt; });
    s.zones = s.zones.filter(z => z.t < z.life);

    // Lava, fire and Ivy's spirits deal their damage a couple of times a second
    kit.tickT -= dt;
    if (kit.tickT <= 0 && live) {
      kit.tickT = ZONE_TICK;
      kit.tickN = (kit.tickN ?? 0) + 1;
      const quiet = kit.tickN % 2 === 0;   // damage numbers once a second, not twice (fewer floaters = smoother)
      for (const e of foes()) {
        let lava = 0;
        for (const z of s.zones) if (dist(e.x, e.y, z.x, z.y) <= z.r + radius(e) * 0.6) lava = Math.max(lava, z.dps);
        if (lava) kitHit(e, lava * ZONE_TICK, { color: '#fb923c', label: '🌋', quiet });
        if (e.hp <= 0 || !s.enemies.includes(e)) continue;
        let fire = 0;
        for (const f of s.fire) if (distToSegment(e.x, e.y, f.x1, f.y1, f.x2, f.y2) <= K(14) + radius(e) * 0.7) fire = Math.max(fire, f.dps);
        if (fire) kitHit(e, fire * ZONE_TICK, { color: '#fdba74', label: '🔥', quiet });
      }
      if (sk?.type === 'souls' && kit.souls > 0 && P && !s.mahoraga) {
        const R = K(75) + K(26);
        foes().filter(e => dist(e.x, e.y, P.x, P.y) <= R + radius(e) * 0.8)
          .forEach(e => kitHit(e, kit.souls * sk.perSoul * ZONE_TICK, { color: '#e879f9', label: '👻', quiet }));
      }
    }

    // Astrec: rapid auto-attacks on the nearest enemy (much faster during Sorcerer Killer)
    if (sk?.type === 'phantom' && live && !s.mahoraga) {
      const act = s.ult.active?.type === 'sorcerer' ? s.ult.active : null;
      const rate = sk.autoRate * (act ? act.speed : 1);
      kit.phantomT -= dt;
      let guard = 0;
      while (kit.phantomT <= 0 && guard++ < 20) {
        kit.phantomT += 1 / rate;
        const from = P ?? center();
        const e = nearest(from.x, from.y);
        if (!e) { kit.phantomT = 0; break; }
        kitHit(e, sk.autoPct * (act ? act.mult : 1), { color: '#fda4af', label: '🗡', charge: BAL.AUTO_CHARGE_WEIGHT, quiet: !!act && guard > 1 });
        effect({ kind: 'stab', x: e.x, y: e.y, r: radius(e), life: 0.2 });
        if (act && e.hp > 0 && s.enemies.includes(e) && e.tier !== 'boss' && !e.group && e.hp / e.maxHp < act.threshold) {
          floater('EXECUTE', e.x, e.y - K(30), '#fb7185', true);
          api.killEnemy(e);
        }
      }
    }

    // Room 16's punch barrage
    const act = s.ult.active;
    if (act?.type === 'ora' && live) {
      act.acc += dt * act.punches;
      while (act.acc >= 1) {
        act.acc -= 1;
        const list = foes();
        if (!list.length) break;
        const e = pick(list);
        kitHit(e, act.pct, { color: '#f9a8d4', label: 'ORA ', quiet: Math.random() < 0.6 });
        effect({ kind: 'fist', x: e.x + rand(-K(20), K(20)), y: e.y + rand(-K(20), K(20)), life: 0.25 });
      }
    }

    // Ults that land after a moment
    if (kit.meteor) {
      const m = kit.meteor;
      m.t += dt;
      if (m.t >= m.tele) {
        foes().filter(e => dist(e.x, e.y, m.x, m.y) <= m.r + radius(e) * 0.6).forEach(e => ultHit(e, m.mult, '#f97316', '☄'));
        addLava(m.x, m.y, m.r, 6, 0.5, true);
        effect({ kind: 'shards', x: m.x, y: m.y, r: m.r, color: '#f97316', n: 22 });
        effect({ kind: 'flash', color: '#f97316', life: 0.5 });
        shake(0.7); sfx('boom');
        kit.meteor = null;
      }
    }
    if (kit.purple) {
      const pu = kit.purple;
      pu.t -= dt;
      if (pu.t <= 0) {
        const o = origin(), aim = P ?? center();
        let dx = aim.x - o.x, dy = aim.y - o.y;
        const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        const L = Math.hypot(s.W, s.H) * 1.3;
        const x2 = o.x + dx * L, y2 = o.y + dy * L;
        foes().filter(e => distToSegment(e.x, e.y, o.x, o.y, x2, y2) <= pu.width / 2 + radius(e) * 0.7)
          .forEach(e => ultHit(e, pu.mult, '#c084fc', '🟣'));
        s.attacks.forEach(a => {
          if (a.kind === 'shot' && a.phase === 'fly' && distToSegment(a.x, a.y, o.x, o.y, x2, y2) <= pu.width / 2 + K(10)) api.finishAttack(a);
        });
        effect({ kind: 'beam', x1: o.x, y1: o.y, x2, y2, w: pu.width, life: 0.7 });
        effect({ kind: 'flash', color: '#a855f7', life: 0.4 });
        shake(0.6); sfx('boom');
        kit.purple = null;
      }
    }

    updateAllies(dt, live);
    if (s.mahoraga) updateMahoraga(dt);
    s.ult.blocked = ultBlocked();
  }

  function updateAllies(dt, live) {
    const P = s.player.pos ?? center();
    for (const a of s.allies) {
      a.life -= dt;
      if (a.kind === 'crawler') {
        let t = s.enemies.find(e => e.id === a.target);
        if (!t || t.tier === 'treasure' || t.down > 0) { t = nearest(a.x, a.y); a.target = t?.id ?? null; }
        if (t) {
          const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy) || 1;
          const spd = K(a.big ? 210 : 260);
          a.x += dx / d * Math.min(d, spd * dt); a.y += dy / d * Math.min(d, spd * dt);
          if (d <= radius(t) + K(10)) a.life = 0;
        }
        if (a.life <= 0) {   // boom
          foes().filter(e => dist(e.x, e.y, a.x, a.y) <= a.r + radius(e) * 0.6).forEach(e => kitHit(e, a.pct, { color: '#c084fc', label: '✋' }));
          effect({ kind: 'shards', x: a.x, y: a.y, r: a.r, color: '#a855f7', n: a.big ? 16 : 10 });
          effect({ kind: 'burst', x: a.x, y: a.y, r: a.r, color: '#a855f7' });
          sfx('kill'); if (a.big) shake(0.2);
        }
      } else if (a.kind === 'dog') {
        let t = s.enemies.find(e => e.id === a.target);
        if (!t || t.tier === 'treasure' || t.down > 0) { t = nearest(a.x, a.y); a.target = t?.id ?? null; }
        if (t) {
          const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy) || 1;
          const reach = radius(t) + K(14);
          if (d > reach) { a.x += dx / d * Math.min(d - reach, K(330) * dt); a.y += dy / d * Math.min(d - reach, K(330) * dt); }
          a.biteT -= dt;
          if (d <= reach + K(4) && a.biteT <= 0 && live) {
            a.biteT = 0.45;
            kitHit(t, a.pct, { color: '#a5b4fc', label: '🐺' });
            effect({ kind: 'stab', x: t.x, y: t.y, r: radius(t), life: 0.2 });
          }
        }
      } else if (a.kind === 'toad') {
        const tx = P.x - K(46), ty = P.y + K(30);
        a.x += (tx - a.x) * Math.min(1, dt * 8); a.y += (ty - a.y) * Math.min(1, dt * 8);
      } else if (a.kind === 'nue') {
        a.ang += dt * 2.2;
        a.x = P.x + Math.cos(a.ang) * K(110); a.y = P.y + Math.sin(a.ang) * K(70) - K(30);
        a.zapT -= dt;
        if (a.zapT <= 0 && live) {
          a.zapT = 0.8;
          const near = foes().filter(e => dist(e.x, e.y, a.x, a.y) <= K(460));
          if (near.length) {
            const e = pick(near);
            kitHit(e, a.pct * 1.3, { color: '#fde047', label: '⚡' });
            effect({ kind: 'zap', x1: a.x, y1: a.y, x2: e.x, y2: e.y, life: 0.25 });
          }
        }
      } else if (a.kind === 'arrow') {
        let t = s.enemies.find(e => e.id === a.targetId);
        if (!t || t.down > 0) { t = strongest(); a.targetId = t?.id ?? null; }
        const tx = t ? t.x : s.W / 2, ty = t ? t.y : s.H / 2;
        const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy) || 1;
        a.ang = Math.atan2(dy, dx);
        const step = Math.min(d, K(1300) * dt);
        a.x += dx / d * step; a.y += dy / d * step;
        if (d <= (t ? radius(t) : 0) + K(16) || a.life <= 0) {
          const hit = new Set();
          foes().filter(e => dist(e.x, e.y, a.x, a.y) <= K(130) + radius(e) * 0.6).forEach(e => { hit.add(e); ultHit(e, a.mult, '#fb923c', '🏹'); });
          [...s.enemies].forEach(e => { if (!hit.has(e)) ultHit(e, a.burn, '#fdba74', '🔥'); });
          effect({ kind: 'shards', x: a.x, y: a.y, r: K(170), color: '#fb923c', n: 22 });
          effect({ kind: 'burst', x: a.x, y: a.y, r: K(200), color: '#f97316' });
          effect({ kind: 'flash', color: '#f97316', life: 0.6 });
          shake(0.7); sfx('boom');
          a.life = 0;
        }
      }
    }
    s.allies = s.allies.filter(a => a.life > 0);
  }

  // ── Mahoraga ─────────────────────────────────────────────────────────────
  const ADAPT_NAMES = { circle: 'SLAMS', slash: 'SLASHES', shot: 'SHOTS', dash: 'DASHES', bite: 'BITES', poison: 'POISON' };
  function updateMahoraga(dt) {
    const m = s.mahoraga;
    m.t += dt; m.invuln = Math.max(0, m.invuln - dt);
    if (s.phase === 'clear') { endMahoraga('won'); return; }
    const list = foes().filter(e => !(e.down > 0));
    if (!list.length && s.phase !== 'bossIntro' && !s.enemies.some(e => e.down > 0)) { endMahoraga('cleared'); return; }
    if (m.t >= m.timeout) { endMahoraga('left'); return; }   // safety net only
    // the wheel turns on its own too, so a long fight always ends one way or the other
    m.turnT -= dt;
    if (m.turnT <= 0) { m.turnT = 6; m.turns++; m.wheel++; floater('☸', m.x, m.y - K(70), '#fde047', true); }
    let t = list.find(e => e.id === m.target);
    if (!t) {
      // bosses first once they're out, otherwise whatever's closest
      const bosses = list.filter(e => e.tier === 'boss');
      t = nearest(m.x, m.y, bosses.length ? bosses : list);
      m.target = t?.id ?? null;
    }
    if (!t) return;
    const adapts = Object.values(m.adapt).reduce((a, n) => a + Math.min(n, 3), 0) + m.turns;
    const dx = t.x - m.x, dy = t.y - m.y, d = Math.hypot(dx, dy) || 1;
    const reach = radius(t) + K(36);
    if (d > reach) { const st = Math.min(d - reach, K(250) * (1 + adapts * 0.04) * dt); m.x += dx / d * st; m.y += dy / d * st; }
    m.slamT -= dt;
    if (m.slamT <= 0 && d <= reach + K(8)) {
      m.slamT = 0.55;
      const R = K(100);
      foes().filter(e => !(e.down > 0) && dist(e.x, e.y, t.x, t.y) <= R + radius(e) * 0.6)
        .forEach(e => ultHit(e, m.mult * (1 + 0.12 * adapts), '#fde047', '☸'));
      effect({ kind: 'burst', x: t.x, y: t.y, r: R, color: '#fde047' });
      effect({ kind: 'shards', x: t.x, y: t.y, r: R * 0.8, color: '#fde047', n: 8 });
      shake(0.18); sfx('bigKill');
    }
  }
  function hitMahoraga(raw, kind) {
    const m = s.mahoraga;
    if (!m || m.invuln > 0) return;
    const n = m.adapt[kind] ?? 0;
    const dmg = Math.max(1, Math.round(raw * (1 - s.stats.dmgReduction) * Math.pow(0.6, Math.min(n, 3))));
    m.hp -= dmg; m.invuln = 0.3;
    floater(`-${dmg}`, m.x, m.y - K(50), '#ff6b6b', true);
    if (n < 3) {
      m.adapt[kind] = n + 1; m.wheel++;
      floater(`☸ ADAPTED TO ${ADAPT_NAMES[kind] ?? kind.toUpperCase()}`, m.x, m.y - K(78), '#fde047', true);
    }
    if (m.hp <= 0) {
      s.mahoraga = null; s.ult.active = null;
      api.announce('MAHORAGA FELL…', '#ef4444');
      effect({ kind: 'flash', color: '#000000', life: 0.6 });
      api.startDefeat();
    }
  }
  function endMahoraga(reason) {
    if (!s.mahoraga) return;
    const m = s.mahoraga;
    s.mahoraga = null;
    if (s.ult.active?.type === 'mahoraga') s.ult.active = null;
    s.player.invuln = Math.max(s.player.invuln, 1.5);
    if (reason === 'left') floater('Mahoraga lost interest…', m.x, m.y - K(40), '#fde68a', true);
    else if (reason === 'cleared') api.announce('MAHORAGA CLEARED THE FIELD', '#fde047');
  }

  // Stage cleared / lost / (re)loaded: wipe what's on the field
  function reset(why) {
    s.allies = []; s.zones = []; s.fire = [];
    s.kit.meteor = null; s.kit.purple = null; s.kit.trailPt = null; s.kit.posHist = [];
    s.choosing = null;
    if (s.mahoraga) { s.mahoraga = null; if (s.ult.active?.type === 'mahoraga') s.ult.active = null; }
    if (why === 'defeat') s.kit.souls = 0;
  }

  return {
    skill, aimPoint, target, absorbHit, onPlayerHit, shotSpeed, shotBlocked,
    clickMods, afterClick, onPointerDown, onKill, onCombo,
    ultBlocked, activateUlt, endUlt, choose, hitMahoraga,
    update, reset, origin, slide,
  };
}
