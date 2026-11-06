// ─────────────────────────────────────────────────────────────────────────────
// 6★ Ramsf (Platinum Series) — MARIONETTE. Ten porcelain doll arms; a parry character. The
// numbers are in kits.js (marionette / open_arms); kitRuntime.js hands every input to this
// file while he's the main card. What's drawn for it is in RamsfFx.jsx.
//
//   M2          PARRY: tap just before a hit lands. Inside the window (parryWin s) anything
//               that would hit you is parried: the game freezes for a beat (hitstop), the
//               attack is cancelled, a shot flies back at whoever fired it, and the attacker
//               is struck by an arm, staggered, and exposed (takes more damage) for a while.
//               A whiff (nothing to parry) and you can't parry again for parryCd s.
//   passive     TEN ARMS: every perfect parry puts one of his doll arms on your cursor (up to
//               ten). Every click, each of them strikes too. Go armHold s without a parry and
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
  const label = (text, x, y, color, big = false) => { const r = st(); if (r.floats++ < 3) floater(text, x, y, color, big); };
  const P = () => s.player.pos ?? { x: s.W / 2, y: s.H / 2 };

  // ── M2: PARRY ────────────────────────────────────────────────────────────
  function press(x, y) {
    const sk = skill(), r = st();
    if (!sk || !fighting()) return false;
    if (r.pw > 0) return true;   // already up
    if (r.pcd > 0) { label('…', x, y - K(30), '#a8a29e'); return false; }
    r.pw = sk.parryWin; r.pwHit = false;
    sfx('tick');
    return true;
  }
  // engine.hitPlayer → absorbHit: a hit is about to land. true = parried
  function tryParry(kind, src, from) {
    const sk = skill(), r = st();
    if (sk?.type !== 'marionette' || kind === 'poison') return false;
    const auto = openArms();
    if (!(r.pw > 0) && !auto) return false;
    parry(sk, kind, src, from, auto);
    return true;
  }
  function parry(sk, kind, src, from, auto) {
    const r = st(), pv = passive(), p = P();
    r.pwHit = true;
    // the streak: parries close together
    r.streak = s.time - r.streakT <= 3 ? r.streak + 1 : 1;
    r.streakT = s.time;
    const big = r.streak >= 3;
    // HITSTOP: everything freezes for a beat (longer on a streak; just a tick for the ult's auto-parries)
    const stop = auto ? 0.05 : Math.min(0.17, sk.hitstop + 0.015 * Math.min(5, r.streak - 1));
    s.timeStop = Math.max(s.timeStop, stop);
    r.hitstop = stop;   // (so the arena shows a parry's impact frame, not a time stop)
    s.player.invuln = Math.max(s.player.invuln, stop + 0.25);
    r.lastParry = { x: p.x, y: p.y, t: s.time };
    // who did it: the enemy that swung, or the one that fired the shot
    const owner = src ?? (from?.owner != null ? s.enemies.find(e => e.id === from.owner) : null);
    if (from && from.phase !== 'done') { from.hitDone = true; api.finishAttack(from); }
    effect({ kind: 'parryflash', x: p.x, y: p.y, r: K(big ? 140 : 100), life: auto ? 0.3 : 0.45, big, auto, a: owner ? Math.atan2(owner.y - p.y, owner.x - p.x) : rand(0, 6.28) });
    if (!auto) { effect({ kind: 'flash', color: '#ffffff', life: big ? 0.22 : 0.14 }); shake(big ? 0.45 : 0.3); }
    sfx(big && !auto ? 'parryBig' : 'parry');
    label(auto ? 'PARRY' : big ? `PARRY ×${r.streak}` : 'PARRY!', p.x, p.y - K(46), '#fdf2f8', !auto);
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
    if (!auto && pv?.type === 'tenarms' && r.arms < MAX_ARMS) { r.arms++; label(`🖐 ${r.arms}/${MAX_ARMS}`, p.x, p.y + K(40), PINK); }
    r.armT = 0; r.dropT = 0;
    r.pcd = 0;
  }

  // ── click: the arms strike too ───────────────────────────────────────────
  function onClick(e, auto) {
    const sk = skill(), pv = passive(), r = st(), n = armsNow();
    if (!sk || !e || auto || !n || !pv) return;
    const R = K(sk.armR);
    // nearest first: the target, then whoever's around it
    const pool = foes().filter(o => o === e || dist(o.x, o.y, e.x, e.y) <= R + radius(o) * 0.5)
      .sort((a, b) => dist(a.x, a.y, e.x, e.y) - dist(b.x, b.y, e.x, e.y));
    let q = 0;
    api.asYou(() => {
      for (let i = 0; i < n; i++) {
        const t = pool[i % pool.length];
        if (!alive(t)) continue;
        kitHit(t, pv.armPct, { color: '#fbcfe8', label: '🖐', quiet: q++ >= 2 });
        r.strikes.push({ id: nextId(), arm: i, x: t.x + rand(-0.3, 0.3) * radius(t), y: t.y + rand(-0.3, 0.3) * radius(t), t: 0, life: 0.18 + i * 0.012 });
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

  // ── for the HUD ──────────────────────────────────────────────────────────
  const m2Info = () => { const r = st(), sk = skill(); return { kind: 'cd', cd: r.pw > 0 ? 0 : r.pcd, cdMax: sk?.parryCd || 0.6, color: PINK, text: 'M2', btn: 'PARRY', hint: 'Parry: M2 just before a hit lands' }; };
  const qInfo = () => { const r = st(), sk = skill(); return { kind: 'cd', cd: r.tcd, cdMax: r.tcdMax || sk?.cooldown || 14, color: '#c084fc', text: 'Q', hint: 'Tornado: Q (phone: the SKILL button)' }; };
  const active = () => { const r = s.kit.ramsf; return !!(r && (r.tornado || r.strikes.length || r.cutin || r.arms > 0 || r.pw > 0 || r.pcd > 0)); };
  function reset(why) {
    const r = st();
    r.pw = 0; r.pcd = 0; r.strings = null; r.tornado = null; r.cutin = null; r.strikes = []; r.tcd = 0; r.streak = 0;
    if (why === 'defeat') r.arms = 0;
  }
  const exposedBonus = e => { const pv = passive(); return pv?.type === 'tenarms' && e.exposedT > s.time ? pv.exposed : 0; };

  return { press, tryParry, onClick, release, tornado, ult, endUlt, update, m2Info, qInfo, active, reset, exposedBonus, armsNow, PORCELAIN };
}
