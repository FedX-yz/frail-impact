// ─────────────────────────────────────────────────────────────────────────────
// 6★ Ramsf (Platinum Series) — MARIONETTE. Ten porcelain doll arms; a parry character. The
// numbers are in kits.js (marionette / open_arms); kitRuntime.js hands every input to this
// file while he's the main card. What's drawn for it is in RamsfFx.jsx.
//
//   M2          PARRY: tap just before a hit lands. Inside the window (parryWin s) anything
//               that would hit you is parried: the game freezes for a beat (hitstop), eases
//               back in through a moment of slow motion, the attack is cancelled, a shot
//               flies back at whoever fired it, and the attacker is struck by an arm,
//               staggered, and exposed (takes more damage) for a while. A hair late (up to
//               LATE s after it hit) still counts: the damage is given back. A whiff
//               (nothing to parry) and you can't parry again for parryCd s. A ring closing on
//               the cursor shows when the next hit will land (RamsfFx).
//               FOLLOW-THROUGH: for FOLLOW s after a parry you land yourself, other hits that
//               land are parried too (a volley of shots, a flurry), like Deepwoken's. They
//               don't give arms or count toward the streak, freeze only a tick, and don't make
//               the follow-through last longer.
//   passive     TEN ARMS: every perfect parry puts one of his doll arms on your cursor (up to
//               ten). They fight on their own (armsFight). Go armHold s without a parry and
//               they drop off, one at a time. Parries in a row (a streak) freeze harder.
//   drag        STRINGS: hold M1 and move through enemies to tie them with doll strings; let
//               go and they're yanked together into a heap
//   hold M1     WINGBEAT: his arms fold into wings; let go for a gust around the cursor that
//               throws enemies back and blows enemy shots away (stronger the longer you held)
//   Q           TORNADO: his wings spin up a tornado at the cursor. It drifts after you, pulls
//               enemies in, shreds what's inside and swallows shots
//   ult         OPEN ARMS: all ten arms on the cursor for dur s (whatever you'd built up), and
//               anything that touches you is parried by itself
// ─────────────────────────────────────────────────────────────────────────────

const HOLD_MIN = 0.25;      // shorter than this is a click, not a Wingbeat
const DRAG_START = 18;      // design px the cursor has to move while held to string instead
const CUTIN = 1.1;          // seconds the burst art is on screen (the fight goes on)
const LATE = 0.06;          // a parry this late (after the hit landed) still counts
const SLOWMO = 0.22;        // after the freeze: this long easing back in from slow motion
const CUE = 0.7;            // the timing cue shows hits this many seconds away
const FOLLOW = 0.3;         // after a parry you land yourself, other hits this soon are parried too
export const MAX_ARMS = 10;
export const RAMSF_INTRO = CUTIN;
export const RAMSF_EFFECTS = new Set(['parryflash', 'gust', 'yank', 'armhit']);
const PINK = '#f472b6', PORCELAIN = '#f5efe6';

// the HUD chips while he's out: [key, colour, text]
export function ramsfChips(s, sk, mobile = false) {
  const r = s.kit.ramsf, out = [];
  const open = s.ult.active?.type === 'openarms';
  out.push(['arms', '#fbcfe8', `🖐 ${open ? MAX_ARMS : r?.arms ?? 0}/${MAX_ARMS} arms${open ? ' · auto-parry' : (r?.arms ? '' : mobile ? ' · PARRY to gain one' : ' · parry (M2) to gain one')}`]);
  if (r?.streak >= 2) out.push(['st', '#f9a8d4', `⚔ PARRY STREAK ×${r.streak}`]);
  if (s.player.held && r && !s.player.held.ramsf?.drag && s.time - s.player.held.t0 > 0.12) out.push(['wb', '#fce7f3', mobile ? '🪽 WINGS · let go: gust' : '🪽 WINGS · let go of M1: gust']);
  if (r?.tornado) out.push(['tor', '#e9d5ff', `🌪 ${Math.max(0, r.tornado.life - r.tornado.t).toFixed(1)}s`]);
  return out;
}

export function createRamsfPlatinum(ctx) {
  const { s, api, K, rand, dist, distToSegment, floater, effect, shake, sfx, nextId, skill, passive, kitHit, foes, fighting, radius, heavy } = ctx;
  const st = () => s.kit.ramsf ?? (s.kit.ramsf = { pw: 0, pcd: 0, arms: 0, armT: 0, dropT: 0, streak: 0, streakT: -9, strikes: [], strings: null, tornado: null, tcd: 0, tcdMax: 0, cutin: null, lastParry: null, floats: 0, tick: 0 });
  const alive = e => e && e.hp > 0 && s.enemies.includes(e);
  const openArms = () => s.ult.active?.type === 'openarms';
  const armsNow = () => (openArms() ? MAX_ARMS : st().arms);
  // where arm i hangs from the cursor (the same fan RamsfFx draws), and the gap between two angles
  const restAngle = (i) => -Math.PI / 2 + (i % 2 ? 1 : -1) * (0.62 + Math.floor(i / 2) * 0.4);
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const label = (text, x, y, color, big = false) => { const r = st(); if (r.floats++ < 3) floater(text, x, y, color, big); };
  const P = () => s.player.pos ?? { x: s.W / 2, y: s.H / 2 };

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
    if (r.pcd > 0) { label('…', x, y - K(30), '#a8a29e'); return false; }
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
  // auto: Open Arms parried it by itself; follow: caught by the follow-through of your last parry
  function parry(sk, kind, src, from, auto, follow = false) {
    const r = st(), pv = passive(), p = P(), light = auto || follow;
    r.pwHit = true;
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
    // who did it: the enemy that swung, or the one that fired the shot
    const owner = src ?? (from?.owner != null ? s.enemies.find(e => e.id === from.owner) : null);
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
    if (owner && alive(owner)) {
      owner.cd = Math.max(owner.cd ?? 0, sk.stagger);   // staggered: its next attack waits
      if (owner.dashing) api.finishAttack(owner.dashing);
      owner.exposedT = s.time + (pv?.exposedDur ?? 3);
    }
    // TEN ARMS: a new arm on the cursor
    if (!light && pv?.type === 'tenarms' && r.arms < MAX_ARMS) { r.arms++; label(`🖐 ${r.arms}/${MAX_ARMS}`, p.x, p.y + K(40), PINK); }
    r.armT = 0; r.dropT = 0;
    r.pcd = 0;
  }

  // ── TEN ARMS: they fight on their own ────────────────────────────────────
  // Every armRate s each arm strikes something within its reach of the cursor (no stretching
  // past it). They spread out: an arm goes for the enemy with the fewest arms on it, then the one
  // on its own side of the cursor, then the nearest. Not while they're folded into wings.
  const wingsOut = () => { const h = s.player.held; return !!(h && !h.ramsf?.drag && s.time - h.t0 > 0.12); };
  function armsFight(dt, live) {
    const r = st(), pv = passive(), sk = skill(), p = P(), n = armsNow();
    const cd = r.armCd ?? (r.armCd = []);
    cd.length = n;   // (arms that dropped off forget their timing)
    if (!n || !pv || !p || !live || !fighting() || s.mahoraga || s.timeStop > 0 || wingsOut()) return;
    const R = K(sk?.armR ?? 80), rate = pv.armRate ?? 0.5;
    let near = null;
    api.asYou(() => {
      for (let i = 0; i < n; i++) {
        if (cd[i] == null) cd[i] = rand(0.1, rate);   // (a new arm joins out of step with the rest)
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
        kitHit(t, pv.armPct, { color: '#fbcfe8', label: '🖐', quiet: r.floats++ >= 2 });
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
  // enemy shots inside a circle are blown away
  function blowShots(x, y, R) {
    let n = 0;
    for (const a of s.attacks) if (a.kind === 'shot' && a.phase === 'fly' && dist(a.x, a.y, x, y) <= R) { api.finishAttack(a); n++; }
    return n;
  }

  // ── Q: TORNADO ───────────────────────────────────────────────────────────
  function tornado(x, y) {
    const sk = skill(), r = st();
    if (!sk || !fighting() || s.mahoraga) return false;
    if (r.tcd > 0) { floater(`${Math.ceil(r.tcd)}s`, x, y - K(30), '#e9d5ff'); return false; }
    r.tcd = r.tcdMax = sk.cooldown;
    r.tornado = { x, y, t: 0, life: sk.torDur };
    effect({ kind: 'gust', x, y, r: K(sk.torR) * 1.4, life: 0.4, f: 0.5 });
    shake(0.2); sfx('gust');
    return true;
  }

  // ── ult: OPEN ARMS ───────────────────────────────────────────────────────
  function ult(u) {
    const r = st();
    s.ult.active = { type: 'openarms', t: u.dur, dur: u.dur };
    r.cutin = { t: 0, life: CUTIN };
    effect({ kind: 'flash', color: '#fdf2f8', life: 0.35 });
    shake(0.4); sfx('parryBig');
  }
  function endUlt() { api.announce('THE ARMS RETURN', '#fbcfe8'); }

  // ── every frame ──────────────────────────────────────────────────────────
  function update(dt, live) {
    const sk = skill(), pv = passive(), r = st(), pl = s.player, p = pl.pos;
    r.floats = 0;
    r.hitstop = Math.max(0, (r.hitstop ?? 0) - dt);
    if (s.timeStop <= 0) r.follow = Math.max(0, (r.follow ?? 0) - dt);   // (game time: it waits out the freeze)
    if (r.slow > 0 && !(r.hitstop > 0)) r.slow = Math.max(0, r.slow - dt / Math.max(0.3, timeScale()));   // (real seconds, not slowed ones)
    r.threat = sk?.type === 'marionette' && p ? nextHit(p) : null;
    if (r.cutin) { r.cutin.t += dt; if (r.cutin.t >= r.cutin.life) r.cutin = null; }
    r.strikes.forEach(k => { k.t += dt; }); r.strikes = r.strikes.filter(k => k.t < k.life);
    r.tcd = Math.max(0, r.tcd - dt);
    // the parry window closes: nothing came → a whiff
    if (r.pw > 0) {
      r.pw -= dt;
      if (r.pw <= 0) { r.pw = 0; if (!r.pwHit && sk) { r.pcd = sk.parryCd; r.streak = 0; } }
    } else r.pcd = Math.max(0, r.pcd - dt);
    // arms fall off when you stop parrying (not during Open Arms)
    if (r.arms > 0 && !openArms() && s.timeStop <= 0) {
      r.armT += dt;
      if (r.armT >= (pv?.armHold ?? 6)) { r.dropT += dt; if (r.dropT >= 1.5) { r.dropT = 0; r.arms--; if (p) label(`🖐 ${r.arms}/${MAX_ARMS}`, p.x, p.y + K(40), '#a8a29e'); } }
    }
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
    // the tornado
    const tn = r.tornado;
    if (tn) {
      tn.t += dt;
      if (tn.t >= tn.life || !sk) r.tornado = null;
      else if (live && s.timeStop <= 0) {
        if (p) { const dx = p.x - tn.x, dy = p.y - tn.y, d = Math.hypot(dx, dy); if (d > 1) { const st2 = Math.min(d, K(150) * dt); tn.x += dx / d * st2; tn.y += dy / d * st2; } }
        const pull = K(sk.torPull), core = K(sk.torR);
        for (const e of foes()) {
          if (heavy(e) || e.kb || e.grabbed || e.down > 0) continue;
          const dx = tn.x - e.x, dy = tn.y - e.y, d = Math.hypot(dx, dy);
          if (d > pull || d < 1) continue;
          const v = K(260) * (1 - d / pull * 0.5) * dt;
          e.x += dx / d * Math.min(d, v); e.y += dy / d * Math.min(d, v);
        }
        blowShots(tn.x, tn.y, core);
        r.tick -= dt;
        if (r.tick <= 0) {
          r.tick = 0.25; r.tickN = (r.tickN ?? 0) + 1;
          let n = 0;
          api.asYou(() => foes().filter(e => dist(e.x, e.y, tn.x, tn.y) <= core + radius(e) * 0.5)
            .forEach(e => kitHit(e, sk.torPct * 0.25, { color: '#e9d5ff', label: '🌪', quiet: r.tickN % 4 !== 0 || n++ >= 3, charge: 0.6 })));
        }
      }
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
  const m2Info = () => { const r = st(), sk = skill(); return { kind: 'cd', cd: r.pw > 0 ? 0 : r.pcd, cdMax: sk?.parryCd || 0.6, color: PINK, text: 'M2', btn: 'PARRY', hint: 'Parry: M2 just before a hit lands' }; };
  const qInfo = () => { const r = st(), sk = skill(); return { kind: 'cd', cd: r.tcd, cdMax: r.tcdMax || sk?.cooldown || 14, color: '#c084fc', text: 'Q', hint: 'Tornado: Q (phone: the SKILL button)' }; };
  const active = () => { const r = s.kit.ramsf; return !!(r && (r.tornado || r.strikes.length || r.cutin || r.arms > 0 || r.pw > 0 || r.pcd > 0 || r.slow > 0)); };
  function reset(why) {
    const r = st();
    r.pw = 0; r.pcd = 0; r.strings = null; r.tornado = null; r.cutin = null; r.strikes = []; r.tcd = 0; r.streak = 0; r.slow = 0; r.lastHurt = null; r.pending = null; r.threat = null; r.follow = 0;
    if (why === 'defeat') r.arms = 0;
  }
  const exposedBonus = e => { const pv = passive(); return pv?.type === 'tenarms' && e.exposedT > s.time ? pv.exposed : 0; };

  return { press, tryParry, onHurt, release, tornado, ult, endUlt, update, m2Info, qInfo, active, reset, exposedBonus, armsNow, timeScale, PORCELAIN };
}
