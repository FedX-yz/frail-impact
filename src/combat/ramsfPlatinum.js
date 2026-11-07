// ─────────────────────────────────────────────────────────────────────────────
// 6★ Ramsf (Platinum Series) — HELLFIRE STYLE. A parry character with porcelain doll arms who
// gathers souls for his Master. The numbers are in kits.js (marionette / open_arms);
// kitRuntime.js hands every input to this file while he's the main card. What's drawn for it
// is in RamsfFx.jsx.
//
//   M1          just a click
//   hold M1     WINGBEAT: his arms fold into wings; let go for a gust around the cursor that
//               throws enemies back and blows enemy shots away (stronger the longer you held)
//   drag        STRINGS: hold M1 and move through enemies to tie them with doll strings; let
//               go and they're yanked together into a heap
//   M2          PARRY: tap just before a hit lands. Inside the window (parryWin s) anything
//               that would hit you is parried: the game freezes for a beat (hitstop), eases
//               back in through a moment of slow motion, the attack is cancelled, a shot
//               flies back at whoever fired it, and the attacker is struck, staggered, and
//               exposed (takes more damage) for a while. A hair late (up to LATE s after it
//               hit) still counts: the damage is given back. A whiff (nothing to parry) and
//               you can't parry again for parryCd s. A ring closing on the cursor shows when
//               the next hit will land (RamsfFx).
//               FOLLOW-THROUGH: for FOLLOW s after a parry you land yourself, other hits that
//               land are parried too (a volley of shots, a flurry), like Deepwoken's.
//   hold M2     OTHERWORLD RIFT: hold M2 for RIFT_HOLD s and a rift tears open at the cursor:
//               it drags enemies to its centre and burns what's inside, and swallows shots
//   Q           SHADOW GUNSLINGER: a shadow copy of your cursor goes after the enemies: they
//               attack it instead of you (aimPoint → decoy), and it strikes what's around it.
//               Meanwhile every click fires his two guns from the shadows, one bullet each,
//               at the enemies nearest the cursor
//   talent      OFFERING: an enemy you've parried that then dies (both, in either order of
//               hits, as long as the parry came first) gives a Soul for his Master (up to
//               maxSouls). Every Soul: more damage. Souls decide the ult. Lost on defeat
//   ult         OBEY YOUR MASTER, by Souls:
//                 0+   MANIC PUPPETEER: all ten doll arms on the cursor (they strike what's in
//                      reach by themselves), and anything that touches you is parried by itself
//                 5+   HELL DRUMS: hell gates across the arena drag enemies in, and keep
//                      letting out wicked souls that hunt enemies down
//                 10   (tap the ult twice) ASCENT OF THE MASTER: offer half your HP and summon
//                      the Master; everything on the field is purged, and the Souls go to him
// ─────────────────────────────────────────────────────────────────────────────

const HOLD_MIN = 0.25;      // shorter than this is a click, not a Wingbeat
const DRAG_START = 18;      // design px the cursor has to move while held to string instead
const CUTIN = 1.1;          // seconds the burst art is on screen (the fight goes on)
const LATE = 0.06;          // a parry this late (after the hit landed) still counts
const SLOWMO = 0.22;        // after the freeze: this long easing back in from slow motion
const CUE = 0.7;            // the timing cue shows hits this many seconds away
const FOLLOW = 0.3;         // after a parry you land yourself, other hits this soon are parried too
const RIFT_HOLD = 0.45;     // hold M2 this long and it's a rift, not (only) a parry
const TAP2 = 0.6;           // with 10 Souls: the second tap on the ult has this long to come
export const MAX_ARMS = 10;
export const RAMSF_INTRO = CUTIN;
export const RAMSF_EFFECTS = new Set(['parryflash', 'gust', 'yank', 'armhit', 'muzzle', 'soulgain', 'pillar', 'shadowpuff']);
export const ULT_NAMES = ['', 'MANIC PUPPETEER', 'HELL DRUMS', 'ASCENT OF THE MASTER'];
const PINK = '#f472b6', PORCELAIN = '#f5efe6', HELL = '#f97316', SOUL = '#c084fc', BLOOD = '#dc2626';

// which ult the Souls would give right now (1, 2 or 3: 3 needs the second tap)
export function ultLevel(souls, pv) { return souls >= (pv?.lv3At ?? 10) ? 3 : souls >= (pv?.lv2At ?? 5) ? 2 : 1; }

// the HUD chips while he's out: [key, colour, text]
export function ramsfChips(s, sk, mobile = false) {
  const r = s.kit.ramsf, out = [], pv = sk?.passive ?? s.stats.passive, act = s.ult.active;
  const souls = r?.souls ?? 0, lv = ultLevel(souls, pv);
  out.push(['souls', HELL, `🔥 ${souls}/${pv?.maxSouls ?? 10} souls · +${Math.round(souls * (pv?.soulDmg ?? 0) * 100)}% DMG · ult: ${ULT_NAMES[lv]}${lv === 3 ? (mobile ? ' (tap ULT twice)' : ' (tap twice)') : ''}`]);
  if (r?.ultArm > 0) out.push(['tap', BLOOD, `🩸 TAP AGAIN: ASCENT (costs ½ HP) · ${r.ultArm.toFixed(1)}s`]);
  if (act?.type === 'openarms') out.push(['arms', '#fbcfe8', `🖐 ${MAX_ARMS} arms · auto-parry`]);
  if (r?.streak >= 2) out.push(['st', '#f9a8d4', `⚔ PARRY STREAK ×${r.streak}`]);
  if (s.player.held && r && !s.player.held.ramsf?.drag && s.time - s.player.held.t0 > 0.12) out.push(['wb', '#fce7f3', mobile ? '🪽 WINGS · let go: gust' : '🪽 WINGS · let go of M1: gust']);
  if (r?.rift) out.push(['rift', SOUL, `🕳 RIFT ${Math.max(0, r.rift.life - r.rift.t).toFixed(1)}s`]);
  else if (r?.rcd > 0) out.push(['rcd', '#a8a29e', `🕳 rift ${Math.ceil(r.rcd)}s`]);
  if (r?.gun) out.push(['gun', '#e9d5ff', `🔫 SHADOW GUNSLINGER ${Math.max(0, r.gun.life - r.gun.t).toFixed(1)}s · they're after your shadow`]);
  return out;
}

export function createRamsfPlatinum(ctx) {
  const { s, api, K, rand, dist, distToSegment, floater, effect, shake, sfx, nextId, skill, passive, kitHit, ultHit, foes, fighting, radius, heavy } = ctx;
  const st = () => s.kit.ramsf ?? (s.kit.ramsf = { pw: 0, pcd: 0, streak: 0, streakT: -9, strikes: [], strings: null, cutin: null, lastParry: null, floats: 0, tick: 0,
    souls: 0, rift: null, rcd: 0, gun: null, gcd: 0, gcdMax: 0, bullets: [], wisps: [], gates: null, ultArm: 0 });
  const alive = e => e && e.hp > 0 && s.enemies.includes(e);
  const openArms = () => s.ult.active?.type === 'openarms';
  const armsNow = () => (openArms() ? MAX_ARMS : 0);
  const U = () => s.stats.ult ?? {};
  // where arm i hangs from the cursor (the same fan RamsfFx draws), and the gap between two angles
  const restAngle = (i) => -Math.PI / 2 + (i % 2 ? 1 : -1) * (0.62 + Math.floor(i / 2) * 0.4);
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const label = (text, x, y, color, big = false) => { const r = st(); if (r.floats++ < 3) floater(text, x, y, color, big); };
  const P = () => s.player.pos ?? { x: s.W / 2, y: s.H / 2 };
  const nearestTo = (x, y, list) => list.reduce((b, e) => (!b || dist(x, y, e.x, e.y) < dist(x, y, b.x, b.y) ? e : b), null);

  // ── M2: PARRY ────────────────────────────────────────────────────────────
  function press(x, y) {
    const sk = skill(), r = st();
    if (!sk || !fighting()) return false;
    if (r.pw > 0) return true;   // already up
    // a hair late: it hit a moment ago → it still counts (and the damage comes back)
    const lh = r.lastHurt;
    if (lh && s.time - lh.t <= LATE && s.phase !== 'defeat') {
      r.lastHurt = null;
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + lh.dmg);
      s.combo.n = Math.max(s.combo.n, lh.combo);
      parry(sk, lh.kind, lh.src && s.enemies.includes(lh.src) ? lh.src : null, lh.from, false);
      return true;
    }
    if (r.pcd > 0) { label('…', x, y - K(30), '#a8a29e'); return true; }   // (still true: holding on can still open a rift)
    r.pw = sk.parryWin; r.pwHit = false;
    sfx('tick');
    return true;
  }
  // engine.hitPlayer → absorbHit: a hit is about to land. true = parried
  function tryParry(kind, src, from) {
    const sk = skill(), r = st();
    if (sk?.type !== 'marionette' || kind === 'poison') return false;
    const auto = openArms(), follow = !(r.pw > 0) && r.follow > 0;
    if (!(r.pw > 0) && !auto && !follow) { r.pending = { t: s.time, kind, src, from, combo: s.combo.n }; return false; }   // (in case you parry a hair late)
    parry(sk, kind, src, from, auto, follow && !auto);
    return true;
  }
  // the hit landed (engine → kitRuntime.onPlayerHit): remember it for a late parry
  function onHurt(dmg) {
    const r = st();
    if (r.pending && s.time - r.pending.t < 0.02) r.lastHurt = { ...r.pending, dmg, t: s.time };
    r.pending = null;
  }
  // auto: Manic Puppeteer parried it by itself; follow: caught by the follow-through of your last parry
  function parry(sk, kind, src, from, auto, follow = false) {
    const r = st(), p = P(), light = auto || follow;
    r.pwHit = true;
    // who did it: the enemy that swung, or the one that fired the shot
    const owner = src ?? (from?.owner != null ? s.enemies.find(e => e.id === from.owner) : null);
    // the same enemy again within a moment, and not a shot (a worm or a swarm still biting through
    // your cursor): cancelled, but no counter, streak or freeze, or overlapping one would farm
    // them. A bite (contact, every frame it touches you) only counts once every 1.5s. (A worm's
    // segments count as one enemy: whichever part of it is touching you.)
    const foe = owner ? (owner.group != null ? `g${owner.group}` : owner.id) : null;
    if (foe != null && kind !== 'shot' && r.lastFoe === foe && s.time - r.lastFoeT < (kind === 'bite' ? 1.5 : 0.35)) {
      if (from && from.phase !== 'done') { from.hitDone = true; api.finishAttack(from); }
      s.player.invuln = Math.max(s.player.invuln, 0.12);
      return;
    }
    r.lastFoe = foe; r.lastFoeT = s.time;
    r.parryN = (r.parryN ?? 0) + 1;
    if (!light) {
      r.pw = 0;              // this press is spent (what comes next is the follow-through's)
      r.follow = FOLLOW;
      // the streak: parries close together
      r.streak = s.time - r.streakT <= 3 ? r.streak + 1 : 1;
      r.streakT = s.time;
    }
    const big = !light && r.streak >= 3;
    // HITSTOP: everything freezes for a beat (longer on a streak; just a tick for auto and follow-through parries)
    const stop = auto ? 0.05 : follow ? 0.035 : Math.min(0.17, sk.hitstop + 0.015 * Math.min(5, r.streak - 1));
    s.timeStop = Math.max(s.timeStop, stop);
    r.hitstop = stop;   // (so the arena shows a parry's impact frame, not a time stop)
    if (!light) r.slow = SLOWMO;   // …then a moment of slow motion, easing back to full speed
    s.player.invuln = Math.max(s.player.invuln, stop + 0.04);   // (short: what comes next is the follow-through's to parry)
    r.lastParry = { x: p.x, y: p.y, t: s.time };
    if (from && from.phase !== 'done') { from.hitDone = true; api.finishAttack(from); }
    effect({ kind: 'parryflash', x: p.x, y: p.y, r: K(big ? 140 : light ? 80 : 100), life: light ? 0.3 : 0.45, big, auto: light, a: owner ? Math.atan2(owner.y - p.y, owner.x - p.x) : rand(0, 6.28) });
    if (!light) { effect({ kind: 'flash', color: '#ffffff', life: big ? 0.22 : 0.14 }); shake(big ? 0.45 : 0.3); }
    else shake(0.1);
    sfx(big ? 'parryBig' : 'parry');
    label(light ? 'PARRY' : big ? `PARRY ×${r.streak}` : 'PARRY!', p.x, p.y - K(46), '#fdf2f8', !light);
    if (big && !auto && r.streak % 3 === 0) api.announce(`PARRY ×${r.streak}`, '#f9a8d4');
    // the counter
    if (kind === 'shot' && owner && alive(owner)) {
      // it goes back where it came from
      s.shots.push({ id: nextId(), x: p.x, y: p.y, target: owner.id, speed: K(1500), mult: sk.reflectPct, you: true, color: '#fbcfe8', label: '↩ ' });
    } else if (owner && alive(owner)) {
      api.asYou(() => kitHit(owner, sk.parryPct, { color: '#fbcfe8', label: '⚔ ' }));
      effect({ kind: 'armhit', x1: p.x, y1: p.y, x2: owner.x, y2: owner.y, life: 0.25 });
    }
    if (owner) {
      owner.rfMark = true;   // OFFERING: once it dies, its soul is his Master's (onKill)
      if (owner.group != null) s.enemies.forEach(e => { if (e.group === owner.group) e.rfMark = true; });   // (a worm: all of it)
    }
    if (owner && alive(owner)) {
      owner.cd = Math.max(owner.cd ?? 0, sk.stagger);   // staggered: its next attack waits
      if (owner.dashing) api.finishAttack(owner.dashing);
      owner.exposedT = s.time + (sk.exposedDur ?? 3);
    }
    r.pcd = 0;
  }

  // ── OFFERING: parried, then killed → a Soul ──────────────────────────────
  function onKill(e) {
    const r = st(), pv = passive();
    if (!e.rfMark || pv?.type !== 'offering' || e.tier === 'treasure') return;
    // a worm's soul is one soul (its segments die with it)
    if (e.group != null) { if (r.soulGroups?.includes(e.group)) return; (r.soulGroups ??= []).push(e.group); if (r.soulGroups.length > 20) r.soulGroups.shift(); }
    const max = pv.maxSouls ?? 10;
    if (r.souls >= max) return;
    r.souls++;
    const p = P();
    effect({ kind: 'soulgain', x1: e.x, y1: e.y, x2: p.x, y2: p.y, life: 0.7 });
    floater(`🔥 SOUL ${r.souls}/${max}`, e.x, e.y - K(30), HELL, true);
    sfx('kill');
    if (r.souls === (pv.lv2At ?? 5)) api.announce('THE DRUMS OF HELL ARE READY', HELL);
    if (r.souls === (pv.lv3At ?? 10)) api.announce('THE MASTER STIRS', BLOOD);
  }
  const soulMult = () => { const pv = passive(), r = s.kit.ramsf; return pv?.type === 'offering' && r?.souls ? 1 + pv.soulDmg * r.souls : 1; };

  // ── MANIC PUPPETEER: the arms fight on their own ─────────────────────────
  // Every armRate s each arm strikes something within its reach of the cursor (no stretching
  // past it). They spread out: an arm goes for the enemy with the fewest arms on it, then the one
  // on its own side of the cursor, then the nearest. Not while they're folded into wings.
  const wingsOut = () => { const h = s.player.held; return !!(h && !h.ramsf?.drag && s.time - h.t0 > 0.12); };
  function armsFight(dt, live) {
    const r = st(), u = U(), sk = skill(), p = P(), n = armsNow();
    const cd = r.armCd ?? (r.armCd = []);
    cd.length = n;   // (when the ult ends they forget their timing)
    if (!n || !p || !live || !fighting() || s.mahoraga || s.timeStop > 0 || wingsOut()) return;
    const R = K(sk?.armR ?? 80), rate = u.armRate ?? 0.5;
    let near = null;
    api.asYou(() => {
      for (let i = 0; i < n; i++) {
        if (cd[i] == null) cd[i] = rand(0.1, rate);   // (out of step with each other)
        cd[i] -= dt;
        if (cd[i] > 0) continue;
        near ??= foes().filter(e => dist(e.x, e.y, p.x, p.y) <= R + radius(e) * 0.6);
        if (!near.length) { cd[i] = 0.05; continue; }
        const side = restAngle(i);
        let t = null, tk = null;
        for (const e of near) {
          if (!alive(e)) continue;
          const k = [r.strikes.reduce((c, x) => c + (x.foe === e.id), 0), Math.round(Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), side)) * 2), dist(e.x, e.y, p.x, p.y)];
          if (!tk || k[0] < tk[0] || (k[0] === tk[0] && (k[1] < tk[1] || (k[1] === tk[1] && k[2] < tk[2])))) { t = e; tk = k; }
        }
        if (!t) { cd[i] = 0.05; continue; }
        cd[i] = rate * rand(0.85, 1.15);
        kitHit(t, u.armPct ?? 0.5, { color: '#fbcfe8', label: '🖐', quiet: r.floats++ >= 2 });
        r.strikes.push({ id: nextId(), arm: i, foe: t.id, x: t.x + rand(-0.25, 0.25) * radius(t), y: t.y + rand(-0.25, 0.25) * radius(t), t: 0, life: 0.22 });
      }
    });
    if (r.strikes.length > 40) r.strikes.splice(0, r.strikes.length - 40);
  }

  // ── M1 released: Strings (after a drag) or Wingbeat ──────────────────────
  function release(held, x, y, press0) {
    const sk = skill(), r = st();
    if (!sk || !fighting() || s.mahoraga) { r.strings = null; return; }
    if (press0?.ramsf?.drag) { yank(sk); return; }
    if (held < HOLD_MIN) return;
    const f = Math.max(0, Math.min(1, (held - HOLD_MIN) / Math.max(0.01, sk.full - HOLD_MIN)));
    wingbeat(sk, f, x, y);
  }
  function yank(sk) {
    const r = st(), list = (r.strings?.ids ?? []).map(id => s.enemies.find(e => e.id === id)).filter(alive);
    r.strings = null;
    if (!list.length) return;
    const cx = list.reduce((a, e) => a + e.x, 0) / list.length, cy = list.reduce((a, e) => a + e.y, 0) / list.length;
    let n = 0;
    api.asYou(() => list.forEach(e => {
      kitHit(e, sk.stringPct, { color: '#fbcfe8', label: '🧵', quiet: n++ >= 3 });
      effect({ kind: 'yank', x1: e.x, y1: e.y, x2: cx, y2: cy, life: 0.35 });
      if (!alive(e) || heavy(e) || e.down > 0) return;
      const dx = cx - e.x, dy = cy - e.y, d = Math.hypot(dx, dy);
      if (d < K(10)) return;
      const v = Math.min(K(2200), d * 5.5);
      if (e.dashing) api.finishAttack(e.dashing);
      e.kb = { vx: dx / d * v, vy: dy / d * v, hit: [], crush: sk.stringPct * 0.5 };
      e.target = null;
    }));
    if (list.length >= 3) api.announce(`STRUNG ×${list.length}`, PINK);
    shake(0.25); sfx('leap');
  }
  function wingbeat(sk, f, x, y) {
    const R = K(sk.gustR) * (0.75 + 0.35 * f), pct = sk.minPct + (sk.pct - sk.minPct) * f;
    let n = 0;
    api.asYou(() => foes().filter(e => dist(e.x, e.y, x, y) <= R + radius(e) * 0.5).forEach(e => {
      kitHit(e, pct, { color: '#fce7f3', label: '🪽', quiet: n++ >= 3 });
      if (!alive(e) || heavy(e) || e.down > 0) return;
      const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1, v = K(1200) * (0.6 + 0.6 * f);
      if (e.dashing) api.finishAttack(e.dashing);
      e.kb = { vx: dx / d * v, vy: dy / d * v, hit: [], crush: pct * 0.5 };
      e.target = null;
    }));
    const blown = blowShots(x, y, R * 1.3);
    effect({ kind: 'gust', x, y, r: R, life: 0.5, f });
    if (blown) label(`${blown} shot${blown > 1 ? 's' : ''} blown away`, x, y + R * 0.6, '#fce7f3');
    shake(0.15 + 0.2 * f); sfx('gust');
  }
  // enemy shots inside a circle are blown away / swallowed
  function blowShots(x, y, R) {
    let n = 0;
    for (const a of s.attacks) if (a.kind === 'shot' && a.phase === 'fly' && dist(a.x, a.y, x, y) <= R) { api.finishAttack(a); n++; }
    return n;
  }

  // ── hold M2: OTHERWORLD RIFT ─────────────────────────────────────────────
  function openRift(x, y) {
    const sk = skill(), r = st();
    if (r.rcd > 0) { floater(`rift ${Math.ceil(r.rcd)}s`, x, y - K(30), '#a8a29e'); return false; }
    r.rcd = r.rcdMax = sk.riftCd;
    r.rift = { x, y, t: 0, life: sk.riftDur };
    // holding on wasn't a parry attempt that missed: no whiff lockout for it
    r.pw = 0; r.pcd = 0;
    effect({ kind: 'shadowpuff', x, y, r: K(sk.riftR) * 1.6, life: 0.5, color: SOUL });
    shake(0.3); sfx('boom');
    return true;
  }

  // ── Q: SHADOW GUNSLINGER ─────────────────────────────────────────────────
  function gunslinger(x, y) {
    const sk = skill(), r = st();
    if (!sk || !fighting() || s.mahoraga) return false;
    if (r.gcd > 0) { floater(`${Math.ceil(r.gcd)}s`, x, y - K(30), '#e9d5ff'); return false; }
    r.gcd = r.gcdMax = sk.cooldown;
    r.gun = { t: 0, life: sk.gunDur, clone: { x, y, tick: 0.2, hitT: -9 }, lastShot: -9, side: 0 };
    effect({ kind: 'shadowpuff', x, y, r: K(70), life: 0.45, color: '#1e1b4b' });
    // everything that was coming for you loses you
    s.enemies.forEach(e => { e.target = null; });
    api.announce('SHADOW GUNSLINGER', '#e9d5ff');
    sfx('shield');
    return true;
  }
  // where the enemies think you are (kitRuntime.aimPoint): your shadow, while it's out
  const decoy = () => { const g = s.kit.ramsf?.gun; return g && skill()?.type === 'marionette' ? { x: g.clone.x, y: g.clone.y } : null; };
  // every click while it's out: one bullet from each gun, at the enemies nearest the cursor
  function onPointerDown(x, y) {
    const r = st(), g = r.gun, sk = skill();
    if (!g || !sk || !fighting() || s.mahoraga || s.time - g.lastShot < 0.08) return;
    const list = foes().filter(e => dist(e.x, e.y, x, y) <= K(sk.gunR) + radius(e)).sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y));
    if (!list.length) return;
    g.lastShot = s.time;
    [-1, 1].forEach((side, i) => {
      const t = list[Math.min(i, list.length - 1)], sx = x + side * K(16), sy = y + K(4);
      r.bullets.push({ id: nextId(), x: sx, y: sy, x0: sx, y0: sy, target: t.id, side });
      effect({ kind: 'muzzle', x: sx, y: sy, a: Math.atan2(t.y - sy, t.x - sx), life: 0.12 });
    });
    g.recoil = s.time;
    sfx('crit');
  }

  // ── ult: OBEY YOUR MASTER ────────────────────────────────────────────────
  // engine.activateUlt asks first (kitRuntime.ultTap). With 10 Souls the first tap waits TAP2 s
  // for a second one (Ascent); none → Hell Drums. 'wait' = don't fire yet.
  function ultTap() {
    const r = st(), pv = passive();
    if (s.stats.ult?.type !== 'openarms') return null;
    const lv = ultLevel(r.souls, pv);
    if (lv < 3) { r.ultPick = lv; return null; }
    if (r.ultGo) { r.ultGo = false; r.ultPick = 2; return null; }       // no second tap: Hell Drums
    if (r.ultArm > 0) { r.ultArm = 0; r.ultPick = 3; return null; }     // the second tap: the Master
    r.ultArm = TAP2;
    const p = P();
    floater('TAP AGAIN: ASCENT', p.x, p.y - K(60), BLOOD, true);
    sfx('tick');
    return 'wait';
  }
  function ult(u) {
    const r = st(), lv = r.ultPick ?? 1, p = P();
    r.ultPick = null; r.ultArm = 0;
    r.cutin = { t: 0, life: CUTIN, lv };
    if (lv === 1) {
      s.ult.active = { type: 'openarms', t: u.dur, dur: u.dur, lv };
      effect({ kind: 'flash', color: '#fdf2f8', life: 0.35 });
      sfx('parryBig');
    } else if (lv === 2) {
      s.ult.active = { type: 'helldrums', t: u.drumsDur + CUTIN, dur: u.drumsDur + CUTIN, lv };
      // the gates: spread across the arena, nudged toward where the enemies are
      const spots = [[0.24, 0.34], [0.76, 0.34], [0.5, 0.74]];
      const list = foes();
      r.gates = spots.slice(0, Math.round(u.gates ?? 3)).map(([fx, fy], i) => {
        let x = s.W * fx, y = s.H * fy;
        const e = nearestTo(x, y, list);
        if (e && dist(x, y, e.x, e.y) < s.W * 0.3) { x += (e.x - x) * 0.4; y += (e.y - y) * 0.4; }
        return { id: nextId(), x, y, t: -0.15 * i, emit: 0.5 + 0.15 * i };
      });
      effect({ kind: 'flash', color: '#7c2d12', life: 0.5 });
      sfx('boom');
    } else {
      // the offering: half of what HP you have
      const pl = s.player, cost = Math.floor(pl.hp * (u.cost ?? 0.5));
      pl.hp = Math.max(1, pl.hp - cost);
      floater(`-${cost} HP · 🩸 OFFERED`, p.x, p.y - K(30), BLOOD, true);
      s.ult.active = { type: 'ascent', t: u.masterDur + CUTIN, dur: u.masterDur + CUTIN, lv, tick: CUTIN + 0.5, n: 0 };
      // nothing gets to finish what it started
      s.attacks.forEach(a => { if (a.phase !== 'done') api.finishAttack(a); });
      effect({ kind: 'flash', color: '#450a0a', life: 0.9 });
      s.banner = { text: 'ASCENT OF THE MASTER', sub: 'obey.', t: 2, bad: true };
      sfx('boom');
    }
    shake(0.5);
  }
  function endUlt(act) {
    const r = st();
    if (act.type === 'openarms') api.announce('THE ARMS RETURN', '#fbcfe8');
    if (act.type === 'helldrums') { r.gates = null; api.announce('THE DRUMS FALL QUIET', HELL); }
    if (act.type === 'ascent') {
      // the finale, and he takes his Souls
      const u = U();
      let n = 0;
      [...foes()].forEach(e => { effect({ kind: 'pillar', x: e.x, y: e.y, r: radius(e) * 1.3, life: 0.6, big: true }); ultHit(e, u.masterFinale ?? 12, BLOOD, n++ < 3 ? '🔥 ' : ''); });
      effect({ kind: 'flash', color: '#fecaca', life: 0.5 });
      shake(0.7); sfx('boom');
      r.souls = 0; r.soulGroups = [];
      api.announce('THE MASTER IS SATISFIED', BLOOD);
    }
  }

  // ── every frame ──────────────────────────────────────────────────────────
  function update(dt, live) {
    const sk = skill(), r = st(), pl = s.player, p = pl.pos, u = U(), act = s.ult.active;
    r.floats = 0;
    r.hitstop = Math.max(0, (r.hitstop ?? 0) - dt);
    if (s.timeStop <= 0) r.follow = Math.max(0, (r.follow ?? 0) - dt);   // (game time: it waits out the freeze)
    if (r.slow > 0 && !(r.hitstop > 0)) r.slow = Math.max(0, r.slow - dt / Math.max(0.3, timeScale()));   // (real seconds, not slowed ones)
    r.threat = sk?.type === 'marionette' && p ? nextHit(p) : null;
    if (r.cutin) { r.cutin.t += dt; if (r.cutin.t >= r.cutin.life) r.cutin = null; }
    r.strikes.forEach(k => { k.t += dt; }); r.strikes = r.strikes.filter(k => k.t < k.life);
    r.rcd = Math.max(0, r.rcd - dt);
    r.gcd = Math.max(0, r.gcd - dt);
    // the ult's second tap didn't come: Hell Drums
    if (r.ultArm > 0) { r.ultArm -= dt; if (r.ultArm <= 0) { r.ultArm = 0; r.ultGo = true; if (!api.activateUlt?.()) r.ultGo = false; } }
    // the parry window closes: nothing came → a whiff
    if (r.pw > 0) {
      r.pw -= dt;
      if (r.pw <= 0) { r.pw = 0; if (!r.pwHit && sk) { r.pcd = sk.parryCd; r.streak = 0; } }
    } else r.pcd = Math.max(0, r.pcd - dt);
    // hold M2: the rift
    const m2 = pl.m2;
    if (sk?.type === 'marionette' && m2 && !m2.viaM1 && !m2.rf && p && live && fighting() && !s.mahoraga && s.time - m2.t0 >= RIFT_HOLD) { m2.rf = true; openRift(p.x, p.y); }
    armsFight(dt, live);
    // drag: STRINGS (hold M1 and move through enemies)
    const held = pl.held;
    if (sk?.type === 'marionette' && held && p && live && !s.mahoraga) {
      const d0 = held.ramsf ?? (held.ramsf = { drag: false, last: { x: held.x ?? p.x, y: held.y ?? p.y }, used: 0 });
      if (!d0.drag && dist(p.x, p.y, held.x ?? p.x, held.y ?? p.y) > K(DRAG_START)) { d0.drag = true; r.strings = { ids: [], pts: [{ x: held.x ?? p.x, y: held.y ?? p.y }] }; }
      if (d0.drag && r.strings) {
        const a = d0.last, d = dist(a.x, a.y, p.x, p.y);
        if (d > K(240)) d0.last = { x: p.x, y: p.y };
        else if (d >= K(10) && d0.used < K(sk.stringLen)) {
          foes().forEach(e => {
            if (r.strings.ids.includes(e.id) || distToSegment(e.x, e.y, a.x, a.y, p.x, p.y) > K(14) + radius(e) * 0.6) return;
            r.strings.ids.push(e.id);
            effect({ kind: 'armhit', x1: a.x, y1: a.y, x2: e.x, y2: e.y, life: 0.15 });
            sfx('tick');
          });
          d0.used += d; d0.last = { x: p.x, y: p.y };
          r.strings.pts.push({ x: p.x, y: p.y });
          if (r.strings.pts.length > 60) r.strings.pts.shift();
          if (d0.used >= K(sk.stringLen)) floater('strings: max length', p.x, p.y - K(30), PINK);
        }
      }
    }
    if (!held && r.strings) r.strings = null;
    const going = live && s.timeStop <= 0;
    // the rift: stays where it opened, drags enemies to its centre, burns what's inside
    const rf = r.rift;
    if (rf) {
      rf.t += dt;
      if (rf.t >= rf.life || !sk) r.rift = null;
      else if (going) {
        pull(rf.x, rf.y, K(sk.riftPull), K(320), dt);
        blowShots(rf.x, rf.y, K(sk.riftR));
        r.tick -= dt;
        if (r.tick <= 0) {
          r.tick = 0.25; r.tickN = (r.tickN ?? 0) + 1;
          let n = 0;
          api.asYou(() => foes().filter(e => dist(e.x, e.y, rf.x, rf.y) <= K(sk.riftR) + radius(e) * 0.5)
            .forEach(e => kitHit(e, sk.riftPct * 0.25, { color: SOUL, label: '🕳', quiet: r.tickN % 4 !== 0 || n++ >= 3, charge: 0.6 })));
        }
      }
    }
    // Shadow Gunslinger: the shadow goes after them and strikes what's around it
    const g = r.gun;
    if (g) {
      g.t += dt;
      if (g.t >= g.life || !sk || sk.type !== 'marionette') { if (g.t >= g.life) effect({ kind: 'shadowpuff', x: g.clone.x, y: g.clone.y, r: K(60), life: 0.4, color: '#1e1b4b' }); r.gun = null; }
      else if (going) {
        const c = g.clone, e = nearestTo(c.x, c.y, foes());
        if (e) {
          const d = dist(c.x, c.y, e.x, e.y), keep = radius(e) + K(26);
          if (d > keep) { const v = Math.min(d - keep, K(260) * dt); c.x += (e.x - c.x) / d * v; c.y += (e.y - c.y) / d * v; }
        }
        c.tick -= dt;
        if (c.tick <= 0) {
          c.tick = sk.cloneRate;
          const near = foes().filter(o => dist(o.x, o.y, c.x, c.y) <= K(sk.cloneR) + radius(o) * 0.5);
          if (near.length) {
            c.hitT = s.time;
            let n = 0;
            api.asYou(() => near.forEach(o => kitHit(o, sk.clonePct, { color: '#a5b4fc', label: '🌑', quiet: n++ >= 2 })));
          }
        }
      }
    }
    // the bullets: fast, and they don't miss
    for (const b of r.bullets) {
      const t = s.enemies.find(e => e.id === b.target);
      if (!t || !alive(t)) { b.dead = true; continue; }
      const dx = t.x - b.x, dy = t.y - b.y, d = Math.hypot(dx, dy), v = K(2400) * dt;
      if (d <= v + radius(t) * 0.4) { b.dead = true; if (sk) api.asYou(() => kitHit(t, sk.gunPct, { color: '#e9d5ff', label: '🔫', quiet: r.floats++ >= 2 })); continue; }
      b.x += dx / d * v; b.y += dy / d * v;
    }
    r.bullets = r.bullets.filter(b => !b.dead);
    // HELL DRUMS: the gates drag enemies in and let out wicked souls that hunt them down
    if (act?.type === 'helldrums' && r.gates && going && !r.cutin) {
      for (const gt of r.gates) {
        gt.t += dt;
        if (gt.t < 0) continue;
        pull(gt.x, gt.y, K(u.gatePull ?? 230), K(280), dt);
        gt.emit -= dt;
        if (gt.emit <= 0) {
          gt.emit = u.soulEvery ?? 0.4;
          const list = foes();
          if (!list.length) continue;
          // the nearest one that isn't already being hunted by most of the souls
          const hunted = id => r.wisps.reduce((c, w) => c + (w.target === id), 0);
          const t = list.slice().sort((a, b) => hunted(a.id) - hunted(b.id) || dist(a.x, a.y, gt.x, gt.y) - dist(b.x, b.y, gt.x, gt.y))[0];
          const a0 = rand(0, Math.PI * 2);
          r.wisps.push({ id: nextId(), x: gt.x, y: gt.y, vx: Math.cos(a0) * K(300), vy: Math.sin(a0) * K(300), target: t.id, t: 0 });
        }
      }
    }
    for (const w of r.wisps) {
      w.t += dt;
      let t = s.enemies.find(e => e.id === w.target);
      if (!t || !alive(t)) { t = nearestTo(w.x, w.y, foes()); if (!t) { w.dead = true; continue; } w.target = t.id; }
      if (w.t > 4) { w.dead = true; continue; }
      if (!going) continue;
      // steer toward it (they curve in, faster the longer they've been out)
      const dx = t.x - w.x, dy = t.y - w.y, d = Math.hypot(dx, dy) || 1, sp = K(420 + 500 * Math.min(1, w.t));
      w.vx += (dx / d * sp - w.vx) * Math.min(1, dt * 5); w.vy += (dy / d * sp - w.vy) * Math.min(1, dt * 5);
      w.x += w.vx * dt; w.y += w.vy * dt;
      if (d <= radius(t) * 0.6 + K(8)) { w.dead = true; ultHit(t, u.soulPct ?? 1.2, SOUL, r.floats++ < 2 ? '👻 ' : ''); effect({ kind: 'shadowpuff', x: w.x, y: w.y, r: K(26), life: 0.3, color: SOUL }); }
    }
    r.wisps = r.wisps.filter(w => !w.dead);
    if (act?.type !== 'helldrums' && r.gates) r.gates = null;
    // ASCENT OF THE MASTER: everything on the field is purged, again and again
    if (act?.type === 'ascent' && going) {
      // nothing gets to attack while he's here
      s.attacks.forEach(a => { if (a.phase !== 'done' && !a.free) api.finishAttack(a); });
      act.tick -= dt;
      if (act.tick <= 0) {
        act.tick = u.masterTick ?? 0.5; act.n++;
        let n = 0;
        foes().forEach(e => {
          effect({ kind: 'pillar', x: e.x, y: e.y, r: radius(e), life: 0.45 });
          ultHit(e, u.masterPct ?? 2.5, BLOOD, n++ < 2 && act.n % 2 === 1 ? '🔥 ' : '');
        });
        shake(0.25);
        if (act.n % 2 === 1) sfx('boom');
      }
    }
  }
  // enemies within R are dragged toward (x, y)
  function pull(x, y, R, speed, dt) {
    for (const e of foes()) {
      if (heavy(e) || e.kb || e.grabbed || e.down > 0) continue;
      const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
      if (d > R || d < 1) continue;
      const v = speed * (1 - d / R * 0.5) * dt;
      e.x += dx / d * Math.min(d, v); e.y += dy / d * Math.min(d, v);
    }
  }

  // the slow motion after a parry: 0.3 → 1 (kitRuntime.timeScale → the engine's dt)
  function timeScale() {
    const r = st();
    if (!(r.slow > 0) || r.hitstop > 0) return 1;
    const u = 1 - r.slow / SLOWMO;   // 0 → 1 as it wears off
    return 0.3 + 0.7 * u * u;
  }
  // how soon the next enemy attack aimed at you lands (seconds), for the timing cue; null = none coming
  function nextHit(p) {
    const T = { x: p.x, y: p.y, r: K(10) };
    let best = null;
    const take = eta => { if (eta >= 0 && eta <= CUE && (best == null || eta < best)) best = eta; };
    for (const a of s.attacks) {
      if (a.phase === 'done' || a.hitDone) continue;
      const left = a.phase === 'tele' ? a.tele - a.t : a.phase === 'wait' ? a.delay + a.tele : 0;
      if (a.kind === 'shot') {
        if (a.phase === 'fly') {
          const dx = T.x - a.x, dy = T.y - a.y, along = dx * a.ux + dy * a.uy;
          if (along > 0 && Math.abs(dx * a.uy - dy * a.ux) <= (a.r ?? 0) + K(6) + T.r) take((along - (a.r ?? 0) - T.r) / Math.max(1, a.speed));
        } else if (a.phase === 'tele' && a.sx != null) take(left + dist(a.sx, a.sy, T.x, T.y) / Math.max(1, a.speed ?? K(600)));
      } else if (a.phase === 'tele' && (a.kind === 'circle' || a.kind === 'poke')) {
        if (a.cx != null && dist(T.x, T.y, a.cx, a.cy) <= a.r + T.r) take(left);
      } else if (a.phase === 'tele' && (a.kind === 'slash' || a.kind === 'tongue')) {
        if (a.x1 != null && distToSegment(T.x, T.y, a.x1, a.y1, a.x2, a.y2) <= (a.w ?? 0) / 2 + T.r) take(left);
      } else if (a.phase === 'tele' && a.kind === 'dash') {
        const o = s.enemies.find(e => e.id === a.owner);
        if (o) take(left + Math.max(0, dist(o.x, o.y, T.x, T.y) - radius(o)) / K(950));
      }
    }
    return best;
  }

  // ── for the HUD ──────────────────────────────────────────────────────────
  const m2Info = () => { const r = st(), sk = skill(); return { kind: 'cd', cd: r.pw > 0 ? 0 : r.pcd, cdMax: sk?.parryCd || 0.6, color: PINK, text: 'M2', btn: 'PARRY', hint: 'Parry: tap M2 just before a hit lands · hold M2: Otherworld Rift' }; };
  const qInfo = () => { const r = st(), sk = skill(); return { kind: 'cd', cd: r.gcd, cdMax: r.gcdMax || sk?.cooldown || 16, color: '#a5b4fc', text: 'Q', hint: 'Shadow Gunslinger: Q (phone: the SKILL button)' }; };
  const active = () => { const r = s.kit.ramsf; return !!(r && (r.rift || r.gun || r.bullets.length || r.wisps.length || r.gates || r.strikes.length || r.cutin || r.pw > 0 || r.pcd > 0 || r.slow > 0 || r.rcd > 0 || r.gcd > 0)); };
  function reset(why) {
    const r = st();
    r.pw = 0; r.pcd = 0; r.strings = null; r.cutin = null; r.strikes = []; r.streak = 0; r.slow = 0; r.lastHurt = null; r.pending = null; r.threat = null; r.follow = 0; r.lastFoe = null; r.armCd = [];
    r.rift = null; r.rcd = 0; r.gun = null; r.gcd = 0; r.bullets = []; r.wisps = []; r.gates = null; r.ultArm = 0; r.ultGo = false; r.ultPick = null;
    if (why === 'defeat') { r.souls = 0; r.soulGroups = []; }   // (Souls carry over from stage to stage, until you fall)
  }
  const exposedBonus = e => { const sk = skill(); return sk?.type === 'marionette' && e.exposedT > s.time ? (sk.exposed ?? 0) : 0; };

  return { press, tryParry, onHurt, onKill, onPointerDown, release, gunslinger, decoy, soulMult, ultTap, ult, endUlt, update, m2Info, qInfo, active, reset, exposedBonus, armsNow, timeScale, PORCELAIN };
}
