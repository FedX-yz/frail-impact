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
import { SKILLS, scaleKit } from './kits';
import { CHARACTERS } from '../data/characters';

// Every skill has a main move (its `style`: click / special / charge / hold / drag) and a
// small always-on passive: skill() is the main move, passive() the passive.
//
// skill id → the skill's name on its card (for Room 16's copies)
export const SKILL_NAMES = Object.fromEntries(CHARACTERS.filter(c => c.skill?.effect).map(c => [c.skill.effect, c.skill.name]));
// Room 16 copies 5★ passives (and its ult picks 5★ skills), not the 6★ ones
const COPY_POOL = [...new Set(CHARACTERS.filter(c => c.rarity === 5 && c.skill?.effect && SKILLS[c.skill.effect]).map(c => c.skill.effect))]
  .filter(id => id !== 'copy');

const MAX_LAVA = 6, MAX_FIRE = 50, MAX_CRAWLERS = 10, MAX_SHIKI = 3;
const HOLD_MIN = 0.25;          // shorter than this is just a click, not a charged release
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
      copied: null, copyT: 0,         // Room 16: the copied passive
      punches: 0, crawlN: 0,          // Room 16 / Tyran: charged with M2
      beatN: 0,                       // Swag: hits in a row
      oraSkill: null,
      trailPt: null, trailT: 0,       // Doro's trail
      posHist: [],                    // Astrec: where your cursor was
      phantomT: 0,
      purple: null, meteor: null,     // ults that take a moment to land
      entangle: null,                 // Bio's Quantum Entanglement: { ids, t, share }
      soulPressT: -9,                 // Ivy: when M2 last summoned a spirit
      tickT: ZONE_TICK,
      ratioU: 0, ratioWin: 0,
    };
    s.allies = []; s.zones = []; s.fire = [];
    s.mahoraga = null; s.choosing = null; s.hoverId = null;
  }
  init();

  // The main move right now (Room 16's ult swaps in the skill you picked)
  function skill() {
    const sk = s.stats.skill;
    if (sk?.type === 'platinum' && s.kit.oraSkill) return s.kit.oraSkill;
    return sk;
  }
  // The passive right now: the main card's, the copied one (Room 16), or during
  // Room 16's ult the picked skill's
  function passive() {
    const sk = skill();
    if (sk && sk !== s.stats.skill) return sk.passive ?? null;
    const pv = s.stats.skill?.passive;
    if (pv?.type === 'copy') return s.kit.copied;
    return pv ?? null;
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
  // Beams go straight through your cursor (not out of the portrait in the corner), at the
  // angle that catches the most enemies — bosses count 3, big ones 2. `prev` keeps a beam from
  // flicking between two equally good angles.
  function lineThrough(x, y, a) {
    const L = Math.hypot(s.W, s.H) * 1.2;
    return { x1: x - Math.cos(a) * L, y1: y - Math.sin(a) * L, x2: x + Math.cos(a) * L, y2: y + Math.sin(a) * L };
  }
  function bestAngle(x, y, w, prev = null) {
    const list = foes();
    let best = prev ?? 0, bestScore = -1;
    for (let i = 0; i < 36; i++) {
      const a = (i * Math.PI) / 36, L = lineThrough(x, y, a);
      let sc = 0;
      for (const e of list) if (distToSegment(e.x, e.y, L.x1, L.y1, L.x2, L.y2) <= w / 2 + radius(e) * 0.7) sc += e.tier === 'boss' ? 3 : e.tier === 'elite' ? 2 : 1;
      if (prev != null) { const d = Math.abs(((a - prev) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2); if (d < 0.1) sc += 0.5; }
      if (sc > bestScore) { bestScore = sc; best = a; }
    }
    return best;
  }
  const nearest = (x, y, list = foes()) => list.reduce((b, e) => (!b || dist(x, y, e.x, e.y) < dist(x, y, b.x, b.y) ? e : b), null);

  // ── Who enemies attack ───────────────────────────────────────────────────
  // Mahoraga out → it's the target. Astrec (Heavenly Restriction) → enemies aim
  // where your cursor was a moment ago.
  function aimPoint() {
    if (s.mahoraga) return { x: s.mahoraga.x, y: s.mahoraga.y };
    const pv = passive();
    if (pv?.type === 'phantom' && s.kit.posHist.length) {
      const want = s.time - pv.lag;
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
    const pv = passive();
    if (pv?.type === 'infinity' && P && s.kit.inf >= 10 && (kind === 'shot' || kind === 'dash' || kind === 'bite')) {
      s.kit.inf = Math.max(0, s.kit.inf - 25); s.kit.infUsed = s.time;
      floater('∞', P.x, P.y - K(40), '#93c5fd', true);
      effect({ kind: 'burst', x: P.x, y: P.y, r: K(pv.radius), color: '#60a5fa' });
      if (src) {
        if (src.dashing) api.finishAttack(src.dashing);
        // a dasher gets thrown back hard (into a wall = crushed); the worm is
        // too long to throw, so its head is just shoved out of the bubble
        if (!launch(src, P, 1.3)) {
          const a = Math.atan2(src.y - P.y, src.x - P.x) || 0;
          const d = K(pv.radius) + radius(src) + K(6);
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
    if (s.kit.souls > 0) {
      s.kit.souls--;
      const P = s.player.pos;
      if (P) floater('-1 👻', P.x + K(20), P.y - K(10), '#e879f9');
    }
  }
  // Shots slow to a crawl inside Infinity (draining it a little)
  // Shots slow to a crawl inside Jerry's Infinity bubble (draining it a little)
  function shotSpeed(a, dt) {
    const pv = passive(), P = s.player.pos;
    if (pv?.type !== 'infinity' || !P || s.kit.inf <= 0 || s.mahoraga) return 1;
    if (dist(a.x, a.y, P.x, P.y) > K(pv.radius)) return 1;
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
    if (sk?.type === 'ratio' && Math.abs(ratioU(sk) - 0.7) <= sk.window / 2) return { ratio: true, bonus: sk.bonus, label: 'RATIO ' };
    // Swag's beat: every Nth hit in a row crits
    const pv = passive();
    if (pv?.type === 'beat') {
      s.kit.beatN++;
      if (s.kit.beatN >= Math.max(3, Math.round(pv.every))) { s.kit.beatN = 0; return { forceCrit: true, bonus: pv.bonus, label: '💃 ' }; }
    }
    return undefined;
  }
  const onMiss = () => { s.kit.beatN = 0; };
  function afterClick(e, dmg, auto, mods) {
    if (!auto) { s.kit.lastHitId = e.id; s.kit.lastHitT = s.time; }   // the ratio bar sticks to it (phones can't hover)
    if (mods?.ratio) effect({ kind: 'ratio', x: e.x, y: e.y, r: radius(e) });
    const pv = passive();
    if (mods?.ratio && pv?.type === 'ratioHeal') api.heal(pv.heal * s.player.maxHp);
  }
  // Stephen: a crit click slices a line through the target
  function onCritClick(e) {
    const sk = skill();
    if (sk?.type !== 'crit' || !sk.cut) return;
    const a = rand(0, Math.PI), L = Math.hypot(s.W, s.H);
    const x1 = e.x - Math.cos(a) * L, y1 = e.y - Math.sin(a) * L, x2 = e.x + Math.cos(a) * L, y2 = e.y + Math.sin(a) * L;
    effect({ kind: 'slash', x1, y1, x2, y2, life: 0.25 });
    let n = 0;
    foes().forEach(o => {
      if (o !== e && distToSegment(o.x, o.y, x1, y1, x2, y2) <= K(22) + radius(o) * 0.7) kitHit(o, sk.cut, { color: '#fde047', label: '✂', quiet: n++ >= 3 });
    });
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

  // Something took damage: Bio's entanglement copies a share onto the other linked enemies
  function onDamage(e, dmg, linked) {
    const en = s.kit.entangle;
    if (!en || linked || dmg <= 0 || !en.ids.includes(e.id)) return;
    let n = 0;
    for (const id of en.ids) {
      if (id === e.id) continue;
      const o = s.enemies.find(x => x.id === id);
      if (o) api.damageEnemy(o, dmg * en.share, { color: '#c4b5fd', label: '🔗', quiet: n++ >= 2, linked: true, charge: 0.5 });
    }
  }

  // Main card changed: nothing from the old card's kit carries over
  function switchCard() {
    init();
    s.ult.active = null; s.ult.charge = 0; s.ult.cd = 0; s.timeStop = 0;
    s.special.cd = 0; s.special.cdMax = 0;
    s.player.m2 = null; s.player.held = null;
    s.enemies.forEach(e => { e.burn = null; });
  }

  // ── M2 (special), charge and hold moves ──────────────────────────────────
  // A cooldown special: false (and the seconds left above the cursor) while it's cooling down
  function startCooldown(sk, x, y) {
    if (s.special.cd > 0) { floater(`${Math.ceil(s.special.cd)}s`, x, y - K(30), '#a78bfa'); return false; }
    s.special.cd = s.special.cdMax = sk.cooldown;
    return true;
  }
  // A charge: one per press, at most one every `gap` seconds, up to `cap`
  function addCharge(key, sk, x, y, gap, color) {
    if (s.time - (s.kit.chargeT ?? -9) < gap) return false;
    const cap = Math.round(sk.cap);
    if (s.kit[key] >= cap) { floater('FULL', x, y - K(34), color); return false; }
    s.kit.chargeT = s.time;
    s.kit[key]++;
    effect({ kind: 'burst', x, y, r: K(28), color });
    sfx('hit');
    return true;
  }

  // M2 / Q / SPECIAL button. true = something happened
  function special(x, y) {
    const sk = skill();
    if (!sk || !fighting()) return false;
    switch (sk.type) {
      case 'entangle': {   // Bio: link enemies so damage to one hits them all
        const list = foes(), first = nearest(x, y, list);
        if (!first || dist(x, y, first.x, first.y) > K(sk.range)) { floater('no target', x, y - K(30), '#a78bfa'); return false; }
        if (!startCooldown(sk, x, y)) return false;
        const rest = list.filter(e => e !== first && dist(e.x, e.y, first.x, first.y) <= K(sk.range))
          .sort((a, b) => dist(first.x, first.y, a.x, a.y) - dist(first.x, first.y, b.x, b.y)).slice(0, Math.floor(sk.links));
        s.kit.entangle = { ids: [first.id, ...rest.map(e => e.id)], t: sk.dur, share: sk.share };
        [first, ...rest].forEach(e => effect({ kind: 'implode', x: e.x, y: e.y, r: radius(e) * 2.2, life: 0.4 }));
        floater(`🔗 ENTANGLED ×${rest.length + 1}`, first.x, first.y - K(50), '#c4b5fd', true);
        sfx('shield');
        return true;
      }
      case 'spike': {   // Astrec: rock spikes
        if (!startCooldown(sk, x, y)) return false;
        const R = K(sk.radius);
        let n = 0;
        foes().filter(e => dist(e.x, e.y, x, y) <= R + radius(e) * 0.5).forEach(e => {
          kitHit(e, sk.pct, { color: '#F59E0B', label: '🪨', quiet: n++ >= 4 });
          if (e.hp > 0 && e.tier !== 'boss' && !e.group) e.frozen = Math.max(e.frozen ?? 0, sk.stun);
        });
        effect({ kind: 'spikes', x, y, r: R, life: 0.6 });
        effect({ kind: 'shards', x, y, r: R, color: '#d97706', n: 16 });
        shake(0.3); sfx('boom');
        return true;
      }
      case 'repel': {   // Jerry: Infinity pushes everything away from the cursor
        if (!startCooldown(sk, x, y)) return false;
        const R = K(sk.radius), P = { x, y };
        foes().filter(e => dist(e.x, e.y, x, y) <= R + radius(e) * 0.5).forEach(e => {
          if (!launch(e, P, 1.15)) { crushHit(e, (sk.crush ?? 2) * 0.5, false); effect({ kind: 'burst', x: e.x, y: e.y, r: radius(e), color: '#93c5fd' }); }
        });
        // shots inside are flung away (deleted)
        s.attacks.forEach(a => { if (a.kind === 'shot' && a.phase === 'fly' && dist(a.x, a.y, x, y) <= R) api.finishAttack(a); });
        effect({ kind: 'burst', x, y, r: R, color: '#93c5fd' });
        effect({ kind: 'ring', x, y, r: R, color: '#bfdbfe', life: 0.45 });
        shake(0.2); sfx('shield');
        return true;
      }
      case 'eruption': {   // Ice: lava eruption
        if (!startCooldown(sk, x, y)) return false;
        const R = K(sk.radius);
        let n = 0;
        foes().filter(e => dist(e.x, e.y, x, y) <= R + radius(e) * 0.5).forEach(e => kitHit(e, sk.pct, { color: '#f97316', label: '🌋', quiet: n++ >= 4 }));
        addLava(x, y, R, sk.dur, sk.dps, true);
        effect({ kind: 'shards', x, y, r: R, color: '#f97316', n: 18 });
        effect({ kind: 'burst', x, y, r: R, color: '#fb923c' });
        shake(0.35); sfx('boom');
        return true;
      }
      case 'dogs': {   // Bio (Ten Shadows): two Divine Dogs
        if (!startCooldown(sk, x, y)) return false;
        s.allies = s.allies.filter(a => !(a.kind === 'dog' && a.summoned));   // a fresh pair replaces the old one
        for (let i = 0; i < 2; i++) s.allies.push({ id: nextId(), kind: 'dog', summoned: true, x: x + (i ? K(30) : -K(30)), y, pct: sk.pct, life: sk.dur, biteT: i * 0.2, target: null });
        effect({ kind: 'burst', x, y, r: K(70), color: '#6366f1' });
        floater('🐺🐺 DIVINE DOGS', x, y - K(50), '#a5b4fc', true);
        sfx('shield');
        return true;
      }
      // a tap stocks one (at most ~4 a second — holding is the fast way to charge)
      case 'souls':    return addCharge('souls', sk, x, y, 0.22, '#e879f9');
      case 'crawlers': return addCharge('crawlN', sk, x, y, 0.22, '#c084fc');
      case 'platinum': return addCharge('punches', sk, x, y, 0.22, '#f472b6');
      default: return false;
    }
  }

  // Letting go of M2 after holding it (1s+): release everything charged at the cursor
  const CHARGE_HOLD = 1;   // seconds of holding M2 before it starts charging by itself
  function specialRelease(held, x, y) {
    const sk = skill();
    if (sk?.style !== 'charge' || held < CHARGE_HOLD) return;   // a tap only stocks up (done on press)
    fire(x, y);
  }
  // While M2 is held 1s+: keep charging at the skill's rate
  function chargeWhileHeld(dt) {
    const sk = skill(), m2 = s.player.m2;
    if (sk?.style !== 'charge' || !m2 || s.time - m2.t0 < CHARGE_HOLD || !fighting()) return;
    const key = { souls: 'souls', crawlers: 'crawlN', platinum: 'punches' }[sk.type];
    if (!key) return;
    const cap = Math.round(sk.cap);
    m2.acc = (m2.acc ?? 0) + dt * (sk.rate ?? 6);
    while (m2.acc >= 1) {
      m2.acc -= 1;
      if (s.kit[key] >= cap) { m2.acc = 0; break; }
      s.kit[key]++;
      const P = s.player.pos ?? center();
      effect({ kind: 'burst', x: P.x + rand(-K(20), K(20)), y: P.y + rand(-K(20), K(20)), r: K(22), color: { souls: '#e879f9', crawlN: '#c084fc', punches: '#f472b6' }[key] });
    }
  }

  // Release what's charged at (x, y): aimed at the enemy nearest the cursor
  function fire(x, y) {
    const sk = skill();
    if (!sk || !fighting()) return;
    const list = foes();
    const aim = () => nearest(x, y, list);
    if (sk.type === 'souls' && s.kit.souls > 0) {
      const t = aim();
      if (!t) { floater('no target', x, y - K(30), '#e879f9'); return; }
      const n = s.kit.souls, R = K(120);
      s.kit.souls = 0;
      kitHit(t, sk.throwPct * n, { color: '#f0abfc', label: `👻×${n} ` });
      list.filter(e => e !== t && dist(e.x, e.y, t.x, t.y) <= R + radius(e) * 0.6)
        .forEach((e, i) => kitHit(e, sk.throwPct * n * 0.35, { color: '#e879f9', label: '👻', quiet: i >= 3 }));
      effect({ kind: 'spiral', x: t.x, y: t.y, r: R * 1.3, life: 0.5 });
      effect({ kind: 'burst', x: t.x, y: t.y, r: R, color: '#d946ef' });
      shake(Math.min(0.4, 0.06 + n * 0.015)); sfx(n >= 8 ? 'boom' : 'crit');
    } else if (sk.type === 'crawlers' && s.kit.crawlN > 0) {
      // crawlers pour out of the cursor, each picking a different enemy near the click
      const n = s.kit.crawlN;
      s.kit.crawlN = 0;
      const near = list.slice().sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y));
      for (let i = 0; i < n; i++) {
        const t = near[i % Math.max(1, near.length)];
        s.allies.push({ id: nextId(), kind: 'crawler', x: x + rand(-K(12), K(12)), y: y + rand(-K(12), K(12)), img: t?.img ?? s.enemies[0]?.img, size: 34,
          big: false, pct: sk.pct, r: K(sk.radius), life: 6, target: t?.id ?? null });
      }
      floater(`✋ ×${n}`, x, y - K(40), '#c084fc', true);
      sfx('kill');
    } else if (sk.type === 'platinum' && s.kit.punches > 0) {
      const t = aim();
      if (!t) { floater('no target', x, y - K(30), '#f472b6'); return; }
      const n = s.kit.punches;
      s.kit.punches = 0;
      s.kit.barrage = { target: t.id, left: n, acc: 0, pct: sk.pct, n };
      api.announce(n >= 8 ? 'ORA ORA ORA!' : 'ORA!', '#f472b6');
    }
  }

  // Let go of M1 after holding: charged release moves (how long it was held → strength)
  function release(held, x, y) {
    const sk = skill();
    if (!sk || sk.style !== 'hold' || !fighting() || s.mahoraga || held < HOLD_MIN) return;
    const f = clamp((held - HOLD_MIN) / Math.max(0.01, sk.full - HOLD_MIN), 0, 1);
    const pct = (sk.minPct ?? sk.pct * 0.35) + (sk.pct - (sk.minPct ?? sk.pct * 0.35)) * f;
    const list = foes();
    if (sk.type === 'lance') {   // Ice: through the cursor, lined up on the most enemies
      const w = K(sk.width) * (0.6 + 0.4 * f);
      const ln = lineThrough(x, y, s.kit.aimA ?? bestAngle(x, y, w));
      let n = 0;
      // nearest to the cursor first; each enemy it goes through weakens it (−45% a time, down to 25%)
      list.filter(e => distToSegment(e.x, e.y, ln.x1, ln.y1, ln.x2, ln.y2) <= w / 2 + radius(e) * 0.7)
        .sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y)).forEach(e => {
        kitHit(e, pct * Math.max(0.25, 1 - 0.45 * n), { color: '#67e8f9', label: '❄', quiet: n++ >= 4 });
        if (e.hp > 0) e.frozen = Math.max(e.frozen ?? 0, sk.freeze * (0.5 + 0.5 * f));
      });
      effect({ kind: 'beam', x1: ln.x1, y1: ln.y1, x2: ln.x2, y2: ln.y2, w, life: 0.5, color: 'ice' });
      s.kit.aimA = null;
      shake(0.15 + 0.25 * f); sfx(f >= 1 ? 'boom' : 'crit');
    } else if (sk.type === 'flashstep') {   // Astrec: dash through the nearest enemies
      const near = list.filter(e => dist(e.x, e.y, x, y) <= K(sk.range))
        .sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y)).slice(0, Math.max(1, Math.floor(sk.targets)));
      if (!near.length) return;
      // every strike lands: with fewer enemies than strikes, they go round again
      const strikes = Array.from({ length: Math.max(1, Math.floor(sk.targets)) }, (_, i) => near[i % near.length]);
      let px = x, py = y;
      strikes.forEach((e, i) => {
        if (e.hp <= 0 || !s.enemies.includes(e)) return;
        effect({ kind: 'slash', x1: px, y1: py, x2: e.x, y2: e.y, life: 0.3 + i * 0.04 });
        effect({ kind: 'stab', x: e.x, y: e.y, r: radius(e), life: 0.25 });
        kitHit(e, pct, { color: '#fda4af', label: '⚡', quiet: i >= near.length });
        px = e.x + rand(-K(14), K(14)); py = e.y + rand(-K(14), K(14));
      });
      shake(0.12 + 0.18 * f); sfx('crit');
    }
  }

  // For the UI: what M2 does right now (cooldown, or how much is charged)
  function specialInfo() {
    const sk = skill();
    if (!sk) return null;
    if (sk.style === 'special') return { kind: 'cd', cd: s.special.cd, cdMax: s.special.cdMax || sk.cooldown, color: '#a78bfa' };
    if (sk.type === 'souls')    return { kind: 'count', n: s.kit.souls, max: Math.round(sk.cap), color: '#e879f9' };
    if (sk.type === 'crawlers') return { kind: 'count', n: s.kit.crawlN, max: Math.round(sk.cap), color: '#c084fc' };
    if (sk.type === 'platinum') return { kind: 'count', n: s.kit.punches, max: Math.round(sk.cap), color: '#f472b6' };
    return null;
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
    const pv = passive();
    if (!pv) return;
    if (pv.type === 'spirits') {
      const add = e.tier === 'elite' ? 3 : Math.random() < pv.chance ? 1 : 0;
      if (add) { s.kit.souls = Math.min(Math.round(sk?.type === 'souls' ? sk.cap : 10), s.kit.souls + add); floater(`+${add} 👻`, e.x, e.y - K(30), '#e879f9'); }
    } else if (pv.type === 'transfig' && e.tier !== 'boss') {
      const big = e.tier === 'elite';
      if ((big || Math.random() < pv.chance) && s.allies.filter(a => a.kind === 'crawler').length < MAX_CRAWLERS) {
        s.allies.push({ id: nextId(), kind: 'crawler', x: e.x, y: e.y, img: e.img, size: e.size * (big ? 0.85 : 0.65), big,
          pct: pv.pct * (big ? 2 : 1), r: K(pv.radius) * (big ? 1.4 : 1), life: 6, target: null });
        floater('TRANSFIGURED', e.x, e.y - K(30), '#c084fc');
      }
    } else if (pv.type === 'lavaKill' && Math.random() < pv.chance) {
      addLava(e.x, e.y, K(pv.radius), pv.dur, pv.dps);
    } else if (pv.type === 'shadows' && Math.random() < pv.chance) {
      summonShiki(Math.random() < 0.5 && !s.allies.some(a => a.kind === 'toad') ? 2 : 3, pv);
    } else if (pv.type === 'killHeal') {
      api.heal(pv.heal * s.player.maxHp);
    }
  }
  function onCombo() { /* (Ten Shadows used to summon at combo milestones; now it's a chance on kills) */ }
  // m: index into SHIKI (2 = toad, 3 = nue)
  function summonShiki(m, sk) {
    const P = s.player.pos ?? center();
    const kind = ['dog', 'dog', 'toad', 'nue'][m];
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
        s.kit.purple = { t: 0.6, dur: 0.6, width: K(u.width), mult: u.mult, x: P.x, y: P.y, a: bestAngle(P.x, P.y, K(u.width)) };
        api.announce('HOLLOW PURPLE', '#a855f7');
        return true;
      case 'sorcerer':
        s.ult.active = { type: 'sorcerer', t: u.dur, dur: u.dur, speed: u.speed, pct: u.pct ?? 0.3, threshold: u.threshold };
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

    // Room 16: copy another agent's passive, and switch every so often
    const own = s.stats.skill?.passive;
    if (own?.type === 'copy') {
      kit.copyT -= dt;
      if (!kit.copied || kit.copyT <= 0) {
        const pool = COPY_POOL.filter(id => id !== kit.copied?.effect && SKILLS[id].passive && SKILLS[id].passive.type !== 'spirits');   // (spirits only help Ivy)
        const id = pick(pool);
        kit.copied = { ...scaleKit(SKILLS[id].passive, 0), name: SKILL_NAMES[id] ?? id, effect: id };
        kit.copyT = Math.round(own.every);
        if (P && s.time > 1) floater(`⧉ ${kit.copied.name}`, P.x, P.y - K(50), '#f472b6', true);
      }
    }
    const pv = passive();

    // Nanami's bar + what's under your cursor
    if (sk?.type === 'ratio' || s.ult.active?.type === 'overtime') {
      if (sk?.type === 'ratio') { kit.ratioU = ratioU(sk); kit.ratioWin = sk.window; }
      const under = P ? api.enemyAt(P.x, P.y) : null;
      const recent = s.time - (kit.lastHitT ?? -9) < 2.5 && s.enemies.some(e => e.id === kit.lastHitId) ? kit.lastHitId : null;
      s.hoverId = under?.id ?? recent;
    } else s.hoverId = null;

    // Astrec: remember where the cursor has been
    if (pv?.type === 'phantom' && P) {
      kit.posHist.push({ t: s.time, x: P.x, y: P.y });
      while (kit.posHist.length && kit.posHist[0].t < s.time - 2) kit.posHist.shift();
    }

    // Infinity refills when it hasn't blocked anything for a second

    // Doro: hold M1 and drag → cut everything the cursor passes through, leave fire behind
    if (sk?.type === 'firetrail' && P && live && s.player.held && !s.mahoraga) {
      if (!kit.trailPt) kit.trailPt = { x: P.x, y: P.y };
      const d = dist(kit.trailPt.x, kit.trailPt.y, P.x, P.y);
      if (d > K(260)) kit.trailPt = { x: P.x, y: P.y };   // a jump (lost the pointer): no cut
      else if (d >= K(16)) {
        const a = kit.trailPt;
        s.fire.push({ id: nextId(), x1: a.x, y1: a.y, x2: P.x, y2: P.y, t: 0, life: sk.dur, dps: sk.pct });
        if (s.fire.length > MAX_FIRE) s.fire.shift();
        effect({ kind: 'cut', x1: a.x, y1: a.y, x2: P.x, y2: P.y, life: 0.22 });
        let cut = 0;
        api.asYou(() => {   // your own cuts: a mirrored big enemy sends them back
          for (const e of foes()) {
            if ((e.cutT ?? -9) > s.time - 0.3) continue;   // each enemy at most ~3 cuts a second
            if (distToSegment(e.x, e.y, a.x, a.y, P.x, P.y) > K(12) + radius(e) * 0.75) continue;
            e.cutT = s.time;
            if (kitHit(e, sk.slash, { color: '#fdba74', label: '✂', quiet: cut >= 3 }) > 0) cut++;
          }
        });
        if (cut) { sfx(cut >= 3 ? 'crit' : 'hit'); api.comboHit?.(); }
        kit.trailPt = { x: P.x, y: P.y };
      }
    } else if (sk?.type === 'firetrail') kit.trailPt = null;

    // Room 16: the punch barrage lands over a moment
    if (kit.barrage) {
      const b = kit.barrage;
      const t = s.enemies.find(e => e.id === b.target && !(e.down > 0)) ?? (live ? nearest((P ?? center()).x, (P ?? center()).y) : null);
      if (!t || !live) kit.barrage = null;
      else {
        b.target = t.id;
        b.acc += dt * 24;
        while (b.acc >= 1 && b.left > 0) {
          b.acc -= 1; b.left--;
          kitHit(t, b.pct, { color: '#f9a8d4', label: 'ORA ', quiet: b.left % 3 !== 0 });
          effect({ kind: 'fist', x: t.x + rand(-K(24), K(24)), y: t.y + rand(-K(24), K(24)), life: 0.25 });
          if (b.left % 2 === 0) sfx('hit');
          if (t.hp <= 0 || !s.enemies.includes(t)) break;
        }
        if (b.left <= 0) { shake(Math.min(0.35, 0.05 + b.n * 0.02)); kit.barrage = null; }
      }
    }

    chargeWhileHeld(dt);

    // Ice: while you hold, keep the lance lined up (the dashed preview line)
    if (sk?.type === 'lance' && s.player.held && P) kit.aimA = bestAngle(P.x, P.y, K(sk.width), kit.aimA);
    else if (sk?.type === 'lance' && !s.player.held) kit.aimA = null;

    // refabiba: hold M1 → a continuous water beam through the cursor (Neuvillette-style)
    const held = s.player.held;
    if (sk?.type === 'tide' && held && P && live && !s.mahoraga && s.time - held.t0 >= sk.full && kit.tideHold !== held.t0) {
      const tb = kit.tide ?? (kit.tide = { a: bestAngle(P.x, P.y, K(sk.width)), t: 0, tick: 0 });
      tb.t += dt;
      // the beam swings toward the best line instead of snapping
      const want = bestAngle(P.x, P.y, K(sk.width), tb.a);
      let d = ((want - tb.a) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2;
      tb.a += clamp(d, -4 * dt, 4 * dt);
      tb.x = P.x; tb.y = P.y;
      tb.tick -= dt;
      if (tb.tick <= 0) {
        tb.tick = 0.25;
        const ln = lineThrough(P.x, P.y, tb.a), w = K(sk.width);
        const hit = foes().filter(e => distToSegment(e.x, e.y, ln.x1, ln.y1, ln.x2, ln.y2) <= w / 2 + radius(e) * 0.7)
          .sort((a, b) => dist(P.x, P.y, a.x, a.y) - dist(P.x, P.y, b.x, b.y));
        api.asYou(() => hit.forEach((e, i) => kitHit(e, sk.dps * 0.25 * (i === 0 ? 1 : 0.35), { color: '#38bdf8', label: '💧', quiet: (kit.tideN = (kit.tideN ?? 0) + 1) % 4 !== 0 || i >= 2 })));
        if (hit.length) api.heal(Math.min(sk.maxHeal, sk.heal * hit.length) * s.player.maxHp);
      }
      if (tb.t >= sk.dur) { kit.tideHold = held.t0; kit.tide = null; }   // spent: let go and hold again
    } else if (kit.tide) kit.tide = null;
    // Jerry's bubble refills when it hasn't blocked anything for a second
    if (pv?.type === 'infinity' && s.time - kit.infUsed > 1) kit.inf = Math.min(100, kit.inf + 30 * dt);
    // Bio's entanglement wears off (and forgets enemies that died)
    if (kit.entangle) {
      kit.entangle.t -= dt;
      kit.entangle.ids = kit.entangle.ids.filter(id => s.enemies.some(e => e.id === id));
      if (kit.entangle.t <= 0 || kit.entangle.ids.length < 2) kit.entangle = null;
    }

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
      // set on fire (Doro's passive)
      for (const e of foes()) {
        if (!e.burn) continue;
        e.burn.t -= ZONE_TICK;
        kitHit(e, e.burn.dps * ZONE_TICK, { color: '#fb923c', label: '🔥', quiet });
        if (e.burn && e.burn.t <= 0) e.burn = null;
      }
    }

    // Astrec: rapid auto-attacks on the nearest enemy (much faster during Sorcerer Killer)
    const sorc = s.ult.active?.type === 'sorcerer' ? s.ult.active : null;
    if (sorc && live && !s.mahoraga) {
      const act = sorc;
      const rate = 2 * act.speed;
      kit.phantomT -= dt;
      let guard = 0;
      while (kit.phantomT <= 0 && guard++ < 20) {
        kit.phantomT += 1 / rate;
        const from = P ?? center();
        const e = nearest(from.x, from.y);
        if (!e) { kit.phantomT = 0; break; }
        kitHit(e, act.pct, { color: '#fda4af', label: '🗡', charge: 0, quiet: guard > 1 });
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
      const aim = P ?? center();
      pu.x = aim.x; pu.y = aim.y; pu.a = bestAngle(aim.x, aim.y, pu.width, pu.a);   // the preview follows your cursor
      if (pu.t <= 0) {
        const ln = lineThrough(pu.x, pu.y, pu.a);
        foes().filter(e => distToSegment(e.x, e.y, ln.x1, ln.y1, ln.x2, ln.y2) <= pu.width / 2 + radius(e) * 0.7)
          .forEach(e => ultHit(e, pu.mult, '#c084fc', '🟣'));
        s.attacks.forEach(a => {
          if (a.kind === 'shot' && a.phase === 'fly' && distToSegment(a.x, a.y, ln.x1, ln.y1, ln.x2, ln.y2) <= pu.width / 2 + K(10)) api.finishAttack(a);
        });
        effect({ kind: 'beam', x1: ln.x1, y1: ln.y1, x2: ln.x2, y2: ln.y2, w: pu.width, life: 0.7 });
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
    s.kit.meteor = null; s.kit.purple = null; s.kit.trailPt = null; s.kit.posHist = []; s.kit.tide = null; s.kit.aimA = null;
    s.choosing = null;
    if (s.mahoraga) { s.mahoraga = null; if (s.ult.active?.type === 'mahoraga') s.ult.active = null; }
    s.kit.barrage = null; s.kit.emberPt = null; s.kit.entangle = null;
    if (why === 'defeat') { s.kit.souls = 0; s.kit.crawlN = 0; s.kit.punches = 0; }
  }

  return {
    skill, passive, onDamage, switchCard, aimPoint, target, absorbHit, onPlayerHit, shotSpeed, shotBlocked, special, specialRelease, release, specialInfo,
    clickMods, afterClick, onCritClick, onMiss, onPointerDown, onKill, onCombo,
    ultBlocked, activateUlt, endUlt, choose, hitMahoraga,
    update, reset, origin, slide,
  };
}
