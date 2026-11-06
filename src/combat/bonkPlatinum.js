// ─────────────────────────────────────────────────────────────────────────────
// 6★ Bonk (Platinum Series) — BOILING POINT. Ice's kit turned inside out: where Ice freezes
// and controls, Bonk bleeds things out and pays for it in his own blood. The numbers are in
// kits.js (boiling_point / red_mist); kitRuntime.js hands every input to this file while he's
// the main card. What's drawn for it is in BonkFx.jsx.
//
// One loop: build BLEED → enemies HEMORRHAGE → RUPTURE them.
//   click       every claw hit adds Bleed (e.bleed, 0–100). Full = HEMORRHAGE for hemoDur s
//               (e.hemo): it bleeds click DMG every second and takes more damage (Bloodlust).
//               Bosses, worms, hydras and cores never hemorrhage: their meter is an open
//               WOUND instead, and they take more damage the deeper it is.
//   hold M1     let go: RUPTURE every hemorrhaging enemy on screen (stronger the longer you
//               held). Their blood splashes Bleed onto their neighbours, and heals him.
//   drag        hold M1 and move: a CLAW RAKE that slashes everything it crosses and fills its
//               Bleed (Ice's line is a wall; his is all offence)
//   Q           BLOODLETTING: he cuts himself (cost × his max HP), a blood blast around the
//               cursor hemorrhages everything in it, and his clicks hit harder for rageDur s
//   M2          GRAB: his claw arm seizes the enemy at the cursor. Hold M2 to carry it, let go
//               to THROW it the way you're moving (it crashes into the others), or let go
//               while still to SLAM it down. The big ones are too heavy: they get clawed.
//   passive     BLOODLUST: the lower his HP, the more damage he does; hemorrhaging enemies
//               take more damage; anything that dies hemorrhaging heals him
//   ult         RED MIST: no time stop. The burst art flashes across the screen and the fight
//               goes on: for dur s every click hemorrhages on the spot and heals him, no
//               hemorrhage runs out, and Bloodletting is free. When it ends, everything
//               bleeding ruptures at once.
// ─────────────────────────────────────────────────────────────────────────────

const HOLD_MIN = 0.25;      // shorter than this is a click, not a Rupture
const DRAG_START = 18;      // design px the cursor has to move while held to rake instead
const CUTIN = 1.1;          // seconds the burst art crosses the screen (the fight goes on)
const GRAB_MAX = 4;         // seconds he can carry something before he slams it anyway
export const BONK_INTRO = CUTIN;
// effect kinds BonkFx.jsx draws
export const BONK_EFFECTS = new Set(['bloodburst', 'rupture', 'bloodnova', 'bonkslam', 'clawstrike']);
const RED = '#f87171', DARK = '#7f1d1d';

// the HUD chips while he's out: [key, colour, text]
export function bonkChips(s, sk, mobile = false) {
  const bk = s.kit.bonk, n = s.enemies.filter(e => e.hemo > 0).length;
  const out = [['bk', '#fca5a5', `🩸 ${n} hemorrhaging${s.player.held && !s.player.held.bonk?.drag ? ' · let go: RUPTURE' : mobile ? ' · hold: Rupture' : ' · hold M1: Rupture'}`]];
  if (bk?.rage > 0) out.push(['rage', '#ef4444', `😡 RAGE ${bk.rage.toFixed(1)}s`]);
  if (bk?.grab) out.push(['grab', '#fecaca', mobile ? '🦾 let go: move to THROW, still to SLAM' : '🦾 let go of M2: moving = THROW, still = SLAM']);
  return out;
}

export function createBonkPlatinum(ctx) {
  const { s, api, K, rand, dist, distToSegment, floater, effect, shake, sfx, nextId, skill, passive, kitHit, foes, fighting, radius, heavy } = ctx;

  const st = () => s.kit.bonk ?? (s.kit.bonk = { qcd: 0, qcdMax: 0, gcd: 0, rage: 0, grab: null, rakes: [], drops: [], cutin: null, finale: null, tick: 0, floats: 0, hist: [] });
  // can this one hemorrhage? (the big ones get a wound instead)
  const canBleed = e => e.tier !== 'boss' && e.tier !== 'treasure' && !e.group && e.move !== 'worm' && e.role !== 'hydra' && !e.type?.core && !e.type?.acidOnly;
  const mistOn = () => s.ult.active?.type === 'redmist';
  const label = (text, x, y, color, big = false) => { const bk = st(); if (bk.floats++ < 3) floater(text, x, y, color, big); };
  const alive = e => e && e.hp > 0 && s.enemies.includes(e);

  function hemorrhage(e) {
    const sk = skill();
    e.hemo = Math.max(e.hemo ?? 0, sk?.hemoDur ?? 4);
    e.bleed = 0;
    effect({ kind: 'bloodburst', x: e.x, y: e.y, r: radius(e) * 1.1, life: 0.45 });
    dropsFrom(e.x, e.y, radius(e) * 0.6, 5);
    label('🩸 HEMORRHAGE', e.x, e.y - radius(e) - K(14), RED);
  }
  // add Bleed to an enemy (n = meter points, 100 = hemorrhage)
  function bleedAdd(e, n) {
    if (!alive(e) || (e.hemo > 0 && canBleed(e))) return;
    e.bleedT = s.time;
    if (!canBleed(e)) { e.bleed = Math.min(100, (e.bleed ?? 0) + n * 0.5); return; }   // the big ones: a wound
    e.bleed = (e.bleed ?? 0) + n * (e.tier === 'elite' ? 0.5 : 1);
    if (e.bleed >= 100) hemorrhage(e);
  }
  const heal = (pct, x, y) => { if (pct <= 0) return; api.heal(pct * s.player.maxHp); if (x != null) label(`+${Math.round(pct * 100)}% HP`, x, y, '#86efac'); };
  // blood drops flying out (drawn in BonkFx)
  function dropsFrom(x, y, r, n = 7) {
    const bk = st();
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = K(rand(180, 460));
      bk.drops.push({ id: nextId(), x: x + Math.cos(a) * r * 0.3, y: y + Math.sin(a) * r * 0.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v - K(160), t: 0, life: rand(0.4, 0.75), sz: rand(0.6, 1.4) });
    }
    if (bk.drops.length > 160) bk.drops.splice(0, bk.drops.length - 160);
  }

  // ── click ────────────────────────────────────────────────────────────────
  function onClick(e, auto) {
    const sk = skill();
    if (!sk || !e) return;
    if (mistOn()) {   // Red Mist: every hit opens them up, and feeds him
      bleedAdd(e, auto ? 50 : 100);
      if (!auto) heal(s.ult.active.steal);
      return;
    }
    bleedAdd(e, sk.bleed * (auto ? 0.35 : 1));
  }

  // ── hold M1: RUPTURE ─────────────────────────────────────────────────────
  function rupture(f, x, y, pctOverride = null) {
    const sk = skill(), pv = passive();
    const pct = pctOverride ?? (sk.minPct + (sk.pct - sk.minPct) * f);
    const open = foes().filter(e => e.hemo > 0 && canBleed(e));
    const big = foes().filter(e => !canBleed(e) && (e.bleed ?? 0) >= 8);
    if (!open.length && !big.length) { if (x != null) { floater('nothing bleeding', x, y - K(30), '#fca5a5'); sfx('miss'); } return 0; }
    let n = 0;
    const burst = new Set(open.map(e => e.id));
    api.asYou(() => {
      for (const e of open) {
        e.hemo = 0;
        effect({ kind: 'rupture', x: e.x, y: e.y, r: radius(e) * 1.4, life: 0.6 });
        dropsFrom(e.x, e.y, radius(e), 8);
        kitHit(e, pct, { color: '#fca5a5', label: '🩸 ', quiet: n++ >= 5 });
        // the blood splashes onto whatever is near it
        if (pv?.splash) foes().forEach(o => { if (!burst.has(o.id) && dist(o.x, o.y, e.x, e.y) <= K(130) + radius(o) * 0.5) bleedAdd(o, pv.splash); });
      }
      for (const b of big) {
        const m = (b.bleed ?? 0) / 100;
        b.bleed = 0;
        effect({ kind: 'rupture', x: b.x, y: b.y, r: radius(b), life: 0.6 });
        dropsFrom(b.x, b.y, radius(b), 10);
        kitHit(b, pct * 2 * m, { color: '#fca5a5', label: 'RUPTURE ', quiet: false });
      }
    });
    heal(Math.min(0.08, (sk.heal ?? 0.01) * (open.length + big.length)), s.player.pos?.x, (s.player.pos?.y ?? 0) - K(40));
    if (open.length >= 3) api.announce(`RUPTURE ×${open.length}`, RED);
    effect({ kind: 'flash', color: '#7f1d1d', life: 0.16 + 0.12 * f });
    shake(Math.min(0.6, 0.18 + 0.06 * open.length + 0.2 * f)); sfx(open.length >= 3 || f >= 1 ? 'boom' : 'crit');
    return open.length + big.length;
  }

  // ── Q: BLOODLETTING ──────────────────────────────────────────────────────
  function bloodletting(x, y) {
    const sk = skill(), bk = st(), pl = s.player;
    if (!sk || !fighting() || s.mahoraga) return false;
    if (bk.qcd > 0 && !mistOn()) { floater(`${Math.ceil(bk.qcd)}s`, x, y - K(30), RED); return false; }
    bk.qcd = bk.qcdMax = mistOn() ? 0 : sk.cooldown;
    // the price (never the last of it; free in Red Mist)
    if (!mistOn()) {
      const cost = Math.min(sk.cost * pl.maxHp, Math.max(0, pl.hp - 1));
      pl.hp -= cost;
      if (cost > 0) floater(`-${Math.round(sk.cost * 100)}% HP`, x, y + K(34), '#ef4444', true);
    }
    const R = K(sk.qRadius);
    let n = 0;
    api.asYou(() => foes().filter(e => dist(e.x, e.y, x, y) <= R + radius(e) * 0.5).forEach(e => {
      kitHit(e, sk.qPct, { color: '#fca5a5', label: '🩸', quiet: n++ >= 3 });
      if (alive(e)) { if (canBleed(e)) hemorrhage(e); else bleedAdd(e, 70); }
    }));
    bk.rage = sk.rageDur;
    effect({ kind: 'bloodnova', x, y, r: R, life: 0.7 });
    dropsFrom(x, y, R * 0.4, 14);
    shake(0.3); sfx('crit'); sfx('boom');
    return true;
  }

  // ── M2: GRAB ─────────────────────────────────────────────────────────────
  function press(x, y) {
    const sk = skill(), bk = st();
    if (!sk || !fighting()) return false;
    if (bk.grab) { slam(); return true; }
    if (bk.gcd > 0) { floater(`${bk.gcd.toFixed(1)}s`, x, y - K(30), RED); return false; }
    const near = foes().filter(e => !e.hidden && dist(e.x, e.y, x, y) <= radius(e) + K(60))
      .sort((a, b) => dist(a.x, a.y, x, y) - radius(a) - (dist(b.x, b.y, x, y) - radius(b)))[0];
    if (!near) { floater('nothing to grab', x, y - K(30), '#fca5a5'); sfx('miss'); return false; }
    bk.gcd = sk.grabCd;
    if (heavy(near) || near.down > 0) {
      // too heavy to lift: the claw rips into it instead
      api.asYou(() => kitHit(near, sk.slamPct, { color: '#fca5a5', label: '🦾 ' }));
      bleedAdd(near, 60);
      effect({ kind: 'clawstrike', x: near.x, y: near.y, r: radius(near) * 0.9, life: 0.45 });
      dropsFrom(near.x, near.y, radius(near) * 0.5, 6);
      shake(0.25); sfx('crit');
      return true;
    }
    if (near.dashing) api.finishAttack(near.dashing);
    near.grabbed = true; near.kb = null; near.target = null;
    bk.grab = { id: near.id, t: 0 };
    bk.hist = [];
    api.asYou(() => kitHit(near, sk.grabPct, { color: '#fca5a5', label: '🦾 ' }));
    if (alive(near)) bleedAdd(near, 100);
    effect({ kind: 'clawstrike', x: near.x, y: near.y, r: radius(near) * 0.9, life: 0.35 });
    sfx('hit');
    if (!alive(near)) { near.grabbed = false; bk.grab = null; }
    return true;
  }
  const grabbed = () => { const bk = st(); return bk.grab ? s.enemies.find(e => e.id === bk.grab.id) : null; };
  function letGo(e) { if (e) e.grabbed = false; st().grab = null; }
  // let go of M2: moving → throw it that way; still → slam it down
  function m2Release() {
    const bk = st(), e = grabbed();
    if (!bk.grab) return;
    if (!alive(e)) { letGo(e); return; }
    const h = bk.hist, a = h[0], b = h[h.length - 1];
    const dt = b && a ? b.t - a.t : 0;
    const vx = dt > 0.02 ? (b.x - a.x) / dt : 0, vy = dt > 0.02 ? (b.y - a.y) / dt : 0, v = Math.hypot(vx, vy);
    if (v > K(450)) throwIt(e, vx, vy, v);
    else slam();
  }
  function throwIt(e, vx, vy, v) {
    const sk = skill();
    letGo(e);
    const sp = Math.max(K(1300), Math.min(K(2600), v * 1.3));
    e.kb = { vx: vx / v * sp, vy: vy / v * sp, hit: [], crush: sk.throwPct };
    effect({ kind: 'bloodburst', x: e.x, y: e.y, r: radius(e) * 1.2, life: 0.35 });
    label('THROWN', e.x, e.y - radius(e) - K(18), '#fecaca', true);
    shake(0.2); sfx('leap');
  }
  function slam() {
    const sk = skill(), e = grabbed();
    letGo(e);
    if (!alive(e)) return;
    const R = K(sk.slamR);
    let n = 0;
    api.asYou(() => {
      kitHit(e, sk.slamPct, { color: '#fca5a5', label: '💥 ' });
      foes().filter(o => o !== e && dist(o.x, o.y, e.x, e.y) <= R + radius(o) * 0.5).forEach(o => {
        kitHit(o, sk.slamPct * 0.5, { color: '#fca5a5', label: '💥', quiet: n++ >= 3 });
        bleedAdd(o, 40);
      });
    });
    effect({ kind: 'bonkslam', x: e.x, y: e.y, r: R, life: 0.55 });
    dropsFrom(e.x, e.y, radius(e), 9);
    shake(0.4); sfx('boom');
  }

  // ── M1 released ──────────────────────────────────────────────────────────
  function release(held, x, y, press0) {
    const sk = skill();
    if (!sk || !fighting() || s.mahoraga) return;
    if (press0?.bonk?.drag) { const n = press0.bonk.hit?.size ?? 0; if (n >= 3) api.announce(`RAKE ×${n}`, RED); return; }   // that was a claw rake
    if (held < HOLD_MIN) return;
    const f = Math.max(0, Math.min(1, (held - HOLD_MIN) / Math.max(0.01, sk.full - HOLD_MIN)));
    rupture(f, x, y);
  }

  // ── ult: RED MIST ────────────────────────────────────────────────────────
  function ult(u) {
    const bk = st();
    s.ult.active = { type: 'redmist', t: u.dur, dur: u.dur, steal: u.steal, finale: u.finale };
    bk.cutin = { t: 0, life: CUTIN };
    bk.qcd = 0;
    effect({ kind: 'flash', color: '#dc2626', life: 0.45 });
    shake(0.5); sfx('roar'); sfx('boom');
  }
  // it ends: everything that's bleeding bursts at once
  function endUlt(act) {
    const n = rupture(1, null, null, act.finale);
    api.announce(n ? `RED HARVEST ×${n}` : 'THE MIST CLEARS', '#ef4444');
    effect({ kind: 'flash', color: '#450a0a', life: 0.6 });
    st().finale = { t: 0, life: 1 };
    shake(0.8); if (n) sfx('bigKill');
  }

  // ── kills ────────────────────────────────────────────────────────────────
  function onKill(e) {
    const pv = passive();
    if (pv?.type === 'bloodlust' && e.hemo > 0) heal(pv.feed, e.x, e.y - K(20));
  }

  // ── every frame ──────────────────────────────────────────────────────────
  function update(dt, live) {
    const sk = skill(), bk = st(), P = s.player.pos;
    bk.floats = 0;
    bk.qcd = Math.max(0, bk.qcd - dt);
    bk.gcd = Math.max(0, bk.gcd - dt);
    bk.rage = Math.max(0, bk.rage - dt);
    if (bk.cutin) { bk.cutin.t += dt; if (bk.cutin.t >= bk.cutin.life) bk.cutin = null; }
    if (bk.finale) { bk.finale.t += dt; if (bk.finale.t >= bk.finale.life) bk.finale = null; }
    for (const d of bk.drops) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += K(1100) * dt; }
    bk.drops = bk.drops.filter(d => d.t < d.life);
    bk.rakes.forEach(r => { r.t += dt; });
    bk.rakes = bk.rakes.filter(r => r.t < r.life);

    // carrying something: it hangs off the claw at your cursor
    if (bk.grab) {
      const e = grabbed();
      if (!alive(e) || !P || !live || s.mahoraga) letGo(e);
      else {
        bk.grab.t += dt;
        const f = 1 - Math.exp(-dt * 18);
        e.x += (P.x - e.x) * f; e.y += (P.y - e.y) * f;
        bk.hist.push({ t: s.time, x: P.x, y: P.y });
        while (bk.hist.length > 2 && s.time - bk.hist[0].t > 0.09) bk.hist.shift();
        if (bk.grab.t >= GRAB_MAX) slam();
      }
    }

    // drag: the claw rake (hold M1 and move)
    const held = s.player.held;
    if (sk?.type === 'boil' && held && P && live && !s.mahoraga) {
      const d0 = held.bonk ?? (held.bonk = { drag: false, last: { x: held.x ?? P.x, y: held.y ?? P.y }, used: 0, hit: new Set() });
      if (!d0.drag && dist(P.x, P.y, held.x ?? P.x, held.y ?? P.y) > K(DRAG_START)) d0.drag = true;
      if (d0.drag) {
        const a = d0.last, d = dist(a.x, a.y, P.x, P.y);
        if (d > K(240)) d0.last = { x: P.x, y: P.y };   // a jump (lost the pointer)
        else if (d >= K(14) && d0.used < K(sk.rakeLen)) {
          bk.rakes.push({ id: nextId(), x1: a.x, y1: a.y, x2: P.x, y2: P.y, t: 0, life: 0.7 });
          if (bk.rakes.length > 90) bk.rakes.shift();
          let n = 0;
          api.asYou(() => foes().forEach(e => {
            if (d0.hit.has(e.id) || distToSegment(e.x, e.y, a.x, a.y, P.x, P.y) > K(16) + radius(e) * 0.6) return;
            d0.hit.add(e.id);
            kitHit(e, sk.rakePct, { color: '#fca5a5', label: '🩸', quiet: n++ >= 3 });
            bleedAdd(e, sk.rakeBleed);
            dropsFrom(e.x, e.y, radius(e) * 0.5, 3);
            if (n === 1) sfx('hit');
          }));
          d0.used += d; d0.last = { x: P.x, y: P.y };
          if (d0.used >= K(sk.rakeLen)) floater('rake: max length', P.x, P.y - K(30), RED);
        }
      }
    }

    if (!sk || sk.type !== 'boil') return;
    // hemorrhaging enemies bleed, 4 times a second (a number once a second)
    bk.tick -= dt;
    if (bk.tick <= 0 && live) {
      bk.tick = 0.25; bk.tickN = (bk.tickN ?? 0) + 1;
      const show = bk.tickN % 4 === 0;
      let n = 0;
      for (const e of [...s.enemies]) {
        if (!(e.hemo > 0) || !alive(e)) continue;
        api.damageEnemy(e, s.stats.clickDmg * sk.hemoDps * 0.25, { color: '#ef4444', label: '🩸', charge: 0.5, quiet: !show || n++ >= 3 });
        if (alive(e) && Math.random() < 0.5) bk.drops.push({ id: nextId(), x: e.x + rand(-0.3, 0.3) * radius(e), y: e.y, vx: rand(-40, 40), vy: K(40), t: 0, life: 0.5, sz: 0.7 });
      }
    }
    for (const e of s.enemies) {
      if (e.hemo > 0 && !e.grabbed && !mistOn()) e.hemo = Math.max(0, e.hemo - dt);   // (Red Mist keeps every wound open for the harvest)
      // Bleed closes up when you stop opening it
      if (e.bleed > 0 && s.time - (e.bleedT ?? -9) > 1.5) e.bleed = Math.max(0, e.bleed - 18 * dt);
    }
  }

  // ── for the HUD ──────────────────────────────────────────────────────────
  const m2Info = () => { const bk = st(), sk = skill(); return { kind: 'cd', cd: bk.grab ? 0 : bk.gcd, cdMax: sk?.grabCd || 2, color: RED, text: 'M2', btn: bk.grab ? 'THROW' : 'GRAB', hint: 'Grab: M2 seizes the enemy at your cursor. Hold to carry it, let go while moving to THROW it, while still to SLAM it' }; };
  const qInfo = () => { const bk = st(), sk = skill(); return { kind: 'cd', cd: mistOn() ? 0 : bk.qcd, cdMax: bk.qcdMax || sk?.cooldown || 9, color: '#ef4444', text: 'Q', hint: `Bloodletting: Q (phone: the SKILL button). Costs ${Math.round((sk?.cost ?? 0.1) * 100)}% of your HP` }; };
  const active = () => { const bk = s.kit.bonk; return !!(bk && (bk.grab || bk.rakes.length || bk.drops.length || bk.cutin || bk.finale || bk.rage > 0)); };
  function reset() {
    const bk = st();
    letGo(grabbed());
    bk.rakes = []; bk.drops = []; bk.cutin = null; bk.finale = null; bk.qcd = 0; bk.gcd = 0; bk.rage = 0;
    s.enemies.forEach(e => { e.bleed = 0; e.hemo = 0; e.grabbed = false; });
  }

  return { onClick, bloodletting, press, m2Release, release, ult, endUlt, onKill, update, m2Info, qInfo, active, reset, canBleed, RED, DARK };
}
