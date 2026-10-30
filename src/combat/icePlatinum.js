// ─────────────────────────────────────────────────────────────────────────────
// 6★ Ice (Platinum Series) — ZERO POINT. The numbers are in kits.js (zero_point /
// absolute_zero); kitRuntime.js hands every input to this file while he's the main card.
//
// One loop: build FREEZE → enemies FREEZE solid → SHATTER them.
//   click       every click adds Freeze to the target (e.chill, 0–100). Full = frozen for
//               freezeDur s (e.frozen, which the engine already treats as "can't act").
//               Bosses, worms, hydras and cores never freeze: their meter slows them instead.
//   hold M1     let go: SHATTER every frozen enemy on screen (stronger the longer you held)
//   drag        hold M1 and move: a FROST LINE (s.kit.ice.walls) that blocks shots and
//               freezes what walks through it
//   Q           FLASH FREEZE around the cursor (its own cooldown: ice.qcd)
//   M2          tap: an ICE FIGURE at the cursor (chills around it, soaks shots).
//               hold 1s+ and let go: detonate them all. A Shatter sets them off too.
//   passive     frozen enemies take more damage; shatters throw Freeze onto their neighbours
//   ult         ABSOLUTE ZERO: the burst art, time stops (Freeze ×3, no Q cooldown), then
//               an ice storm that shatters everything frozen
// What's drawn for all of it is in IceFx.jsx.
// ─────────────────────────────────────────────────────────────────────────────

const HOLD_MIN = 0.25;      // shorter than this is a click, not a Shatter
const DRAG_START = 18;      // design px the cursor has to move while held to draw instead
const CUTIN = 1.6;          // seconds the burst art is on screen (time is already stopped)
const MAX_WALLS = 90;
export const ICE_INTRO = CUTIN;
// effect kinds IceFx.jsx draws
export const ICE_EFFECTS = new Set(['iceburst', 'shatter', 'flashfreeze']);
// the HUD chips while he's out: [key, colour, text]
export function iceChips(s, sk, mobile = false) {
  const n = s.enemies.filter(e => e.frozen > 0 && e.tier !== 'boss').length, figs = s.kit.ice?.figures.length ?? 0;
  const out = [['ice', '#bae6fd', `❄ ${n} frozen${s.player.held && !s.player.held.ice?.drag ? ' · let go: SHATTER' : mobile ? ' · hold: Shatter' : ' · hold M1: Shatter'}`]];
  if (figs) out.push(['fig', '#e0f2fe', `🧊 ${figs}/${Math.round(sk.cap)}`]);
  return out;
}

export function createIcePlatinum(ctx) {
  const { s, api, K, rand, dist, distToSegment, floater, effect, shake, sfx, nextId, skill, passive, kitHit, ultHit, foes, fighting, radius } = ctx;

  const st = () => s.kit.ice ?? (s.kit.ice = { figures: [], walls: [], shards: [], qcd: 0, qcdMax: 0, figT: -9, tick: 0, cutin: null, storm: null, floats: 0 });
  // can this one freeze solid? (the big ones only slow down)
  const canFreeze = e => e.tier !== 'boss' && e.tier !== 'treasure' && !e.group && e.move !== 'worm' && e.role !== 'hydra' && !e.type?.core && !e.type?.acidOnly;
  const zeroOn = () => s.ult.active?.type === 'absolutezero';
  // a few "FROZEN" labels a frame is plenty
  const label = (text, x, y, color, big = false) => { const ic = st(); if (ic.floats++ < 3) floater(text, x, y, color, big); };

  function freezeIt(e, dur) {
    const sk = skill();
    e.frozen = Math.max(e.frozen ?? 0, dur ?? sk?.freezeDur ?? 4);
    e.chill = 0;
    if (e.dashing) api.finishAttack(e.dashing);
    e.kb = null;
    effect({ kind: 'iceburst', x: e.x, y: e.y, r: radius(e) * 1.2, life: 0.45 });
    label('❄ FROZEN', e.x, e.y - radius(e) - K(14), '#a5f3fc');
  }
  // add Freeze to an enemy (n = meter points, 100 = frozen)
  function chillAdd(e, n) {
    if (!e || e.hp <= 0 || !s.enemies.includes(e) || e.frozen > 0 && canFreeze(e)) return;
    e.chillT = s.time;
    if (!canFreeze(e)) { e.chill = Math.min(100, (e.chill ?? 0) + n * 0.5); return; }   // bosses: a slow, not a freeze
    e.chill = (e.chill ?? 0) + n * (e.tier === 'elite' ? 0.5 : 1);
    if (e.chill >= 100) freezeIt(e);
  }

  // ── click ────────────────────────────────────────────────────────────────
  function onClick(e, auto) {
    const sk = skill();
    if (!sk || !e) return;
    chillAdd(e, sk.chill * (zeroOn() ? 3 : 1) * (auto ? 0.35 : 1));
  }

  // ── hold M1: SHATTER ─────────────────────────────────────────────────────
  function shatter(f, x, y) {
    const sk = skill(), pv = passive(), ic = st();
    const pct = sk.minPct + (sk.pct - sk.minPct) * f;
    const frozen = foes().filter(e => e.frozen > 0 && canFreeze(e));
    const big = foes().filter(e => !canFreeze(e) && (e.chill ?? 0) >= 8);
    const figs = ic.figures.length;
    if (!frozen.length && !big.length && !figs) { floater('nothing frozen', x, y - K(30), '#a5f3fc'); sfx('miss'); return; }
    let n = 0;
    const broke = new Set(frozen.map(e => e.id));
    api.asYou(() => {
      for (const e of frozen) {
        e.frozen = 0;
        effect({ kind: 'shatter', x: e.x, y: e.y, r: radius(e) * 1.3, life: 0.6 });
        kitHit(e, pct, { color: '#e0f2fe', label: '💠 ', quiet: n++ >= 5 });
        // Chain Frost: its shards add Freeze to whatever is near it
        if (pv?.chain) foes().forEach(o => { if (!broke.has(o.id) && dist(o.x, o.y, e.x, e.y) <= K(130) + radius(o) * 0.5) chillAdd(o, pv.chain); });
        shardsFrom(e.x, e.y, radius(e));
      }
      for (const b of big) {
        const m = (b.chill ?? 0) / 100;
        b.chill = 0;
        effect({ kind: 'shatter', x: b.x, y: b.y, r: radius(b), life: 0.6 });
        kitHit(b, pct * 2 * m, { color: '#e0f2fe', label: 'SHATTER ', quiet: false });
      }
    });
    detonateAll(false);
    if (frozen.length >= 3) api.announce(`SHATTER ×${frozen.length}`, '#e0f2fe');
    effect({ kind: 'flash', color: '#e0f2fe', life: 0.18 + 0.12 * f });
    shake(Math.min(0.55, 0.15 + 0.06 * frozen.length + 0.2 * f)); sfx(frozen.length >= 3 || f >= 1 ? 'boom' : 'crit');
  }
  // little ice shards flying out (drawn in IceFx)
  function shardsFrom(x, y, r) {
    const ic = st();
    for (let i = 0; i < 7; i++) {
      const a = rand(0, Math.PI * 2), v = K(rand(260, 560));
      ic.shards.push({ id: nextId(), x: x + Math.cos(a) * r * 0.3, y: y + Math.sin(a) * r * 0.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v - K(120), rot: rand(0, 6), vr: rand(-12, 12), t: 0, life: rand(0.45, 0.8), sz: rand(0.6, 1.3) });
    }
    if (ic.shards.length > 140) ic.shards.splice(0, ic.shards.length - 140);
  }

  // ── Q: FLASH FREEZE ──────────────────────────────────────────────────────
  function flash(x, y) {
    const sk = skill(), ic = st();
    if (!sk || !fighting() || s.mahoraga) return false;
    if (ic.qcd > 0 && !zeroOn()) { floater(`${Math.ceil(ic.qcd)}s`, x, y - K(30), '#67e8f9'); return false; }
    ic.qcd = ic.qcdMax = zeroOn() ? 0 : sk.cooldown;
    const R = K(sk.qRadius);
    let n = 0;
    api.asYou(() => foes().filter(e => dist(e.x, e.y, x, y) <= R + radius(e) * 0.5).forEach(e => {
      kitHit(e, sk.qPct, { color: '#a5f3fc', label: '❄', quiet: n++ >= 3 });
      if (e.hp > 0 && s.enemies.includes(e)) { if (canFreeze(e)) freezeIt(e); else chillAdd(e, 70); }
    }));
    effect({ kind: 'flashfreeze', x, y, r: R, life: 0.7 });
    shake(0.25); sfx('shield');
    return true;
  }

  // ── M2: ICE FIGURES ──────────────────────────────────────────────────────
  function press(x, y) {
    const sk = skill(), ic = st();
    if (!sk || !fighting()) return false;
    if (s.time - ic.figT < 0.2) return false;
    const cap = Math.round(sk.cap);
    if (ic.figures.length >= cap) { floater('FULL', x, y - K(34), '#bae6fd'); return false; }
    ic.figT = s.time;
    ic.figures.push({ id: nextId(), x, y, t: 0, hp: 3, life: 25, flip: x > s.W / 2 });
    effect({ kind: 'iceburst', x, y, r: K(50), life: 0.4 });
    sfx('shield');
    return true;
  }
  // let go of M2 after holding it a second: they all go off
  function m2Release(held) {
    if (held < 1) return;
    if (!st().figures.length) { const P = s.player.pos; if (P) floater('no figures', P.x, P.y - K(30), '#bae6fd'); return; }
    detonateAll(true);
  }
  function detonate(fig) {
    const sk = skill();
    if (!sk) return;
    const R = K(sk.figR);
    let n = 0;
    api.asYou(() => foes().filter(e => dist(e.x, e.y, fig.x, fig.y) <= R + radius(e) * 0.5).forEach(e => {
      kitHit(e, sk.figPct, { color: '#bae6fd', label: '🧊', quiet: n++ >= 3 });
      chillAdd(e, 70);
    }));
    effect({ kind: 'shatter', x: fig.x, y: fig.y, r: R * 0.8, life: 0.6 });
    effect({ kind: 'flashfreeze', x: fig.x, y: fig.y, r: R, life: 0.5 });
    shardsFrom(fig.x, fig.y, K(30));
  }
  function detonateAll(loud) {
    const ic = st();
    if (!ic.figures.length) return;
    ic.figures.forEach(detonate);
    if (loud) { shake(0.3); sfx('boom'); }
    ic.figures = [];
  }

  // ── M1 released ──────────────────────────────────────────────────────────
  function release(held, x, y, press0) {
    const sk = skill();
    if (!sk || !fighting() || s.mahoraga) return;
    if (press0?.ice?.drag) return;   // that was a frost line, not a Shatter
    if (held < HOLD_MIN) return;
    const f = Math.max(0, Math.min(1, (held - HOLD_MIN) / Math.max(0.01, sk.full - HOLD_MIN)));
    shatter(f, x, y);
  }

  // ── enemy shots ──────────────────────────────────────────────────────────
  // a frost line or an ice figure in the way stops it
  function shotBlocked(a) {
    const ic = s.kit.ice;
    if (!ic) return false;
    for (const w of ic.walls) if (distToSegment(a.x, a.y, w.x1, w.y1, w.x2, w.y2) <= (a.r ?? 0) + K(10)) return true;
    for (const fg of ic.figures) {
      if (dist(a.x, a.y, fg.x, fg.y) > (a.r ?? 0) + K(28)) continue;
      fg.hp--; fg.hitT = s.time;
      effect({ kind: 'iceburst', x: fg.x, y: fg.y, r: K(30), life: 0.3 });
      if (fg.hp <= 0) { ic.figures = ic.figures.filter(o => o !== fg); detonate(fg); }
      return true;
    }
    return false;
  }

  // ── ult: ABSOLUTE ZERO ───────────────────────────────────────────────────
  function ult(u) {
    const ic = st();
    s.ult.active = { type: 'absolutezero', t: CUTIN + u.dur, dur: CUTIN + u.dur, storm: u.storm, shatter: u.shatter };
    s.timeStop = CUTIN + u.dur;
    s.attacks.forEach(a => { if (a.phase === 'wait' || a.phase === 'tele') api.finishAttack(a); });
    ic.cutin = { t: 0, life: CUTIN };
    ic.qcd = 0;
    effect({ kind: 'flash', color: '#e0f2fe', life: 0.5 });
    shake(0.5); sfx('boom');
  }
  // time comes back: the storm
  function endUlt(act) {
    st().storm = { t: 0, life: 1.6, hit: false, storm: act.storm, shatter: act.shatter };
    sfx('howl');
  }
  function stormHits(sm) {
    let n = 0;
    const frozen = foes().filter(e => e.frozen > 0 && canFreeze(e));
    for (const e of [...foes()]) {
      if (!s.enemies.includes(e)) continue;
      const wasFrozen = frozen.includes(e);
      if (wasFrozen) { e.frozen = 0; effect({ kind: 'shatter', x: e.x, y: e.y, r: radius(e) * 1.4, life: 0.7 }); shardsFrom(e.x, e.y, radius(e)); }
      const extra = wasFrozen ? sm.shatter : !canFreeze(e) ? sm.shatter * ((e.chill ?? 0) / 100) : 0;
      ultHit(e, sm.storm + extra, '#e0f2fe', wasFrozen ? '💠' : '❄');
      if (!canFreeze(e)) e.chill = 0;
      else if (e.hp > 0 && s.enemies.includes(e)) chillAdd(e, 60);
      n++;
    }
    detonateAll(false);
    api.announce(n ? 'ICE STORM' : 'ABSOLUTE ZERO', '#e0f2fe');
    effect({ kind: 'flash', color: '#ffffff', life: 0.6 });
    shake(0.9); sfx('boom'); sfx('bigKill');
  }

  // ── every frame ──────────────────────────────────────────────────────────
  function update(dt, live) {
    const sk = skill(), ic = st(), P = s.player.pos;
    ic.floats = 0;
    ic.qcd = Math.max(0, ic.qcd - dt);
    if (ic.cutin) { ic.cutin.t += dt; if (ic.cutin.t >= ic.cutin.life) ic.cutin = null; }
    if (ic.storm) {
      ic.storm.t += dt;
      if (!ic.storm.hit && ic.storm.t >= 0.45) { ic.storm.hit = true; if (live) stormHits(ic.storm); }
      if (ic.storm.t >= ic.storm.life) ic.storm = null;
    }
    for (const sh of ic.shards) { sh.t += dt; sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.vy += K(900) * dt; sh.rot += sh.vr * dt; }
    ic.shards = ic.shards.filter(sh => sh.t < sh.life);

    // drag: the frost line (hold M1 and move)
    const held = s.player.held;
    if (sk?.type === 'zero' && held && P && live && !s.mahoraga) {
      const d0 = held.ice ?? (held.ice = { drag: false, last: { x: held.x ?? P.x, y: held.y ?? P.y }, used: 0 });
      if (!d0.drag && dist(P.x, P.y, held.x ?? P.x, held.y ?? P.y) > K(DRAG_START)) d0.drag = true;
      if (d0.drag) {
        const a = d0.last, d = dist(a.x, a.y, P.x, P.y);
        if (d > K(240)) d0.last = { x: P.x, y: P.y };   // a jump (lost the pointer)
        else if (d >= K(14) && d0.used < K(sk.wallLen)) {
          ic.walls.push({ id: nextId(), x1: a.x, y1: a.y, x2: P.x, y2: P.y, t: 0, life: sk.wallDur });
          if (ic.walls.length > MAX_WALLS) ic.walls.shift();
          d0.used += d; d0.last = { x: P.x, y: P.y };
          if (d0.used >= K(sk.wallLen)) floater('frost line: max length', P.x, P.y - K(30), '#a5f3fc');
        }
      }
    }
    ic.walls.forEach(w => { w.t += dt; });
    ic.walls = ic.walls.filter(w => w.t < w.life);
    ic.figures.forEach(f => { f.t += dt; });
    const gone = ic.figures.filter(f => f.t >= f.life);
    if (gone.length) { ic.figures = ic.figures.filter(f => f.t < f.life); gone.forEach(f => effect({ kind: 'iceburst', x: f.x, y: f.y, r: K(40), life: 0.4 })); }

    if (!sk || sk.type !== 'zero') return;
    // figures and frost lines chill what's near them, 4 times a second
    ic.tick -= dt;
    if (ic.tick <= 0 && live) {
      ic.tick = 0.25;
      for (const e of foes()) {
        let add = 0;
        for (const f of ic.figures) if (dist(e.x, e.y, f.x, f.y) <= K(sk.figR) + radius(e) * 0.5) add += sk.figChill * 0.25;
        for (const w of ic.walls) if (distToSegment(e.x, e.y, w.x1, w.y1, w.x2, w.y2) <= K(12) + radius(e) * 0.7) { add += sk.wallChill * 0.25; break; }
        if (add) chillAdd(e, add);
      }
    }
    // Freeze melts off when you stop adding to it; on the big ones it's a slow
    for (const e of s.enemies) {
      if (!(e.chill > 0)) { if (e.iceSlow) { e.slow = undefined; e.iceSlow = false; } continue; }
      if (s.timeStop <= 0 && s.time - (e.chillT ?? -9) > 1.5) e.chill = Math.max(0, e.chill - 18 * dt);
      if (!canFreeze(e)) { e.slow = 1 - 0.5 * e.chill / 100; e.iceSlow = true; }
    }
  }

  // ── for the HUD ──────────────────────────────────────────────────────────
  const m2Info = () => { const sk = skill(); return { kind: 'count', n: st().figures.length, max: Math.round(sk?.cap ?? 3), color: '#bae6fd', label: '🧊', hint: 'Ice figures: tap M2 to sculpt one at your cursor, hold M2 1s and let go to detonate them all' }; };
  const qInfo = () => { const ic = st(), sk = skill(); return { kind: 'cd', cd: zeroOn() ? 0 : ic.qcd, cdMax: ic.qcdMax || sk?.cooldown || 10, color: '#67e8f9', text: 'Q', hint: 'Flash Freeze: Q (phone: the SKILL button)' }; };
  const active = () => { const ic = s.kit.ice; return !!(ic && (ic.figures.length || ic.walls.length || ic.shards.length || ic.cutin || ic.storm)); };
  function reset() {
    const ic = st();
    ic.figures = []; ic.walls = []; ic.shards = []; ic.cutin = null; ic.storm = null; ic.qcd = 0;
    s.enemies.forEach(e => { e.chill = 0; if (e.iceSlow) { e.slow = undefined; e.iceSlow = false; } });
  }

  return { onClick, flash, press, m2Release, release, shotBlocked, ult, endUlt, update, m2Info, qInfo, active, reset, canFreeze };
}
