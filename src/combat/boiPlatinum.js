// ─────────────────────────────────────────────────────────────────────────────
// 6★ Boiyoujustgotoofed (Platinum Series): LIMIT BREAKER. He keeps going past where he
// should have stopped. The numbers are in kits.js (limit_breaker / ultra_boi); kitRuntime.js
// hands every input to this file while he's the main card. What's drawn is in BoiFx.jsx.
//
//   Ki          0–100. Clicks build it. Each form above Base burns it every second; at 0 he
//               drops back to Base and is winded for a moment (weaker hits, no Ki gain)
//   Forms       Base → Super → Super 2 → Super 3, each hitting harder. In a form every 3rd
//               click chains lightning; Super 2 and up crackle and zap what's near; Super 3
//               adds a shockwave to every click but he takes more damage
//   hold M1     POWER UP: he screams, the aura shoves the small ones away, rocks lift and
//               Ki fills fast. Let go on a full bar to go to the next form (a shockwave)
//   drag        RUSH: hold M1 and move: he blurs along the path, hitting everything on it
//   M2          tap: KI BLAST (homing). Hold: the chant, BOI… YOU… JUST… GOT… (a word every
//               0.45s, each paid in Ki and each making it bigger); let go: OOFED!!!! and the
//               beam fires from where you pressed toward the cursor (or at the most enemies)
//   Q           SOLAR FLARE: every enemy is blinded (can't move or attack) and open
//   (passive)   SAIYAN BLOOD: survive a hit under 30% HP and he comes back stronger for the
//               rest of the stage (stacks, with a cooldown)
//   ult         ULTRA BOI: dodges every hit and counters, every click is a teleport strike.
//               Kills charge a Spirit Bomb: tap the ult again (or wait) to throw it. Then
//               back to the form he was in, with a full bar
// ─────────────────────────────────────────────────────────────────────────────

const HOLD_MIN = 0.25;      // shorter than this is a click, not powering up
const DRAG_START = 18;      // design px the cursor has to move while held to Rush instead
const BEAM_HOLD = 0.22;     // holding M2 this long is a beam, not a blast
// the chant while M2 is held, one word every CHANT_T; letting go shouts OOFED!!!! and fires
export const CHANT = ['BOI…', 'YOU…', 'JUST…', 'GOT…'];
const CHANT_T = 0.45;
const STAGE_POWER = [0, 0.24, 0.4, 0.6, 1];   // the beam's DMG by how many words you got through (beamPct is the full chant)
const CUTIN = 1.1;          // seconds the burst art is on screen (the fight goes on)
export const BOI_INTRO = CUTIN;
export const BOI_EFFECTS = new Set(['sbNova', 'sbZap', 'sbDash', 'sbFlare', 'sbDodge', 'sbTele', 'sbBlast', 'sbBoom', 'sbDrop', 'sbZen', 'sbPulse']);
export const FORMS = [
  { name: 'BASE', short: 'Base', color: '#67e8f9', aura: null },
  { name: 'SUPER BOI', short: 'Super', color: '#facc15', aura: '#fde047' },
  { name: 'SUPER BOI 2', short: 'Super 2', color: '#fde047', aura: '#fef08a' },
  { name: 'SUPER BOI 3', short: 'Super 3', color: '#f59e0b', aura: '#fbbf24' },
];
export const ULTRA = { name: 'ULTRA BOI', short: 'Ultra', color: '#c7d2fe', aura: '#a5b4fc' };
export const isUltra = s => s.ult.active?.type === 'ultraboi';
export const boiLook = s => (isUltra(s) ? ULTRA : FORMS[s.kit.boi?.form ?? 0]);
// his hair recoloured by the form (the SVG filters are in BoiFx.jsx): gold for Super, silver for Ultra
export const hairFilter = s => (isUltra(s) ? 'url(#sbSilver)' : (s.kit.boi?.form ?? 0) > 0 ? 'url(#sbGold)' : undefined);

// the HUD chips while he's out: [key, colour, text]
export function boiChips(s, sk, mobile = false) {
  const a = s.kit.boi, out = [];
  if (!a) return out;
  const look = boiLook(s);
  out.push(['ki', look.color, `⚡ KI ${Math.floor(a.ki)} · ${look.short}${!isUltra(s) && a.ki >= 100 && a.form < 3 ? (mobile ? ' · hold, let go' : ' · hold M1, let go') : ''}`]);
  if (a.wind > 0) out.push(['wd', '#94a3b8', `😮‍💨 winded ${a.wind.toFixed(1)}s`]);
  if (a.zenkai > 0) out.push(['zk', '#fca5a5', `🩸 Saiyan Blood ×${a.zenkai} (+${Math.round(a.zenkai * (sk?.zenkai ?? 0) * 100)}%)`]);
  if (isUltra(s) && !a.thrown) out.push(['sb', '#bfdbfe', `◯ Spirit Bomb ${a.bombN} · ${mobile ? 'ULT again' : 'ult again'}: throw`]);
  return out;
}

export function createBoiPlatinum(ctx) {
  const { s, api, K, rand, dist, distToSegment, floater, effect, shake, sfx, skill, kitHit, foes, fighting, radius, heavy, launch } = ctx;
  const st = () => s.kit.boi ?? (s.kit.boi = {
    ki: 0, form: 0, prevForm: 0, wind: 0, hits: 0, zenkai: 0, zcd: 0, qcd: 0, qcdMax: 0, bcd: 0,
    charging: false, pulse: 0, roar: 0, rocks: [], cutin: null, m2: null, beam: null, blasts: [], sparkT: 0,
    bomb: null, bombN: 0, thrown: true, trail: [], trailT: 0, mult: 1, floats: 0, peak: 0,
  });
  const label = (text, x, y, color, big = false) => { const a = st(); if (a.floats++ < 3) floater(text, x, y, color, big); };
  const P = () => s.player.pos ?? { x: s.W / 2, y: s.H / 2 };
  const look = () => boiLook(s);
  const gainKi = n => { const a = st(); if (a.wind > 0 || isUltra(s)) return; a.ki = Math.min(100, a.ki + n); };
  const others = (e, R, list = foes()) => list.filter(o => o !== e && dist(o.x, o.y, e.x, e.y) <= R + radius(o) * 0.5);

  // ── click ────────────────────────────────────────────────────────────────
  function onClick(e, auto) {
    const sk = skill(), a = st();
    if (!sk || !e) return;
    gainKi(auto ? sk.kiClick * 0.4 : sk.kiClick);
    const ultra = isUltra(s);
    if (auto) return;
    // in a form: every 3rd hit, lightning jumps from it to the ones around
    if (a.form >= 1 || ultra) {
      a.hits++;
      if (a.hits % 3 === 0) chain(e, sk, Math.round(sk.chainN) + (ultra ? 3 : a.form - 1));
    }
    // Super 3: every hit lands with a shockwave
    if (a.form >= 3 && !ultra) {
      const R = K(sk.quakeR);
      effect({ kind: 'sbPulse', x: e.x, y: e.y, r: R, life: 0.3, color: FORMS[3].aura });
      let n = 0;
      api.asYou(() => others(e, R).forEach(o => kitHit(o, sk.quakePct, { color: '#fbbf24', quiet: n++ >= 1 })));
    }
    // Ultra: he's already behind the next one, and the one after
    if (ultra) {
      const near = others(e, K(420)).sort((p, q) => dist(p.x, p.y, e.x, e.y) - dist(q.x, q.y, e.x, e.y)).slice(0, 2);
      let from = e, n = 0;
      api.asYou(() => near.forEach(o => {
        effect({ kind: 'sbTele', x1: from.x, y1: from.y, x2: o.x, y2: o.y, life: 0.3 });
        kitHit(o, sk.telePct, { color: '#c7d2fe', label: '✦', quiet: n++ >= 1 });
        from = o;
      }));
      if (near.length) sfx('dive');
    }
  }
  function chain(e, sk, n) {
    const pts = [[e.x, e.y]], hit = new Set([e.id]);
    let cur = e, k = 0;
    api.asYou(() => {
      for (let i = 0; i < n; i++) {
        const next = foes().filter(o => !hit.has(o.id) && dist(o.x, o.y, cur.x, cur.y) <= K(sk.chainR) + radius(o) * 0.5)
          .reduce((b, o) => (!b || dist(o.x, o.y, cur.x, cur.y) < dist(b.x, b.y, cur.x, cur.y) ? o : b), null);
        if (!next) break;
        hit.add(next.id); pts.push([next.x, next.y]);
        kitHit(next, sk.chainPct, { color: '#fde68a', label: '⚡', quiet: k++ >= 2 });
        cur = next;
      }
    });
    if (pts.length > 1) { effect({ kind: 'sbZap', pts, life: 0.28, color: '#fef9c3' }); sfx('thunder'); }
  }

  // ── hold M1: POWER UP, let go on a full bar: the next form ───────────────
  function powerUp(dt, sk, p) {
    const a = st();
    if (!a.charging) { a.charging = true; a.pulse = 0.2; a.roar = 0; }
    gainKi(sk.kiHold * dt);
    // the aura shoves the small ones away, every so often
    a.pulse -= dt;
    if (a.pulse <= 0) {
      a.pulse = 0.5;
      const R = K(sk.auraR);
      let n = 0;
      effect({ kind: 'sbPulse', x: p.x, y: p.y, r: R, life: 0.4, color: look().aura ?? '#a5f3fc' });
      api.asYou(() => foes().filter(e => dist(e.x, e.y, p.x, p.y) <= R + radius(e) * 0.5).forEach(e => {
        kitHit(e, sk.auraPct, { color: '#e0f2fe', quiet: n++ >= 1 });
        if (e.hp > 0) launch(e, p, 0.55);
      }));
    }
    a.roar -= dt;
    if (a.roar <= 0) { a.roar = 0.6; sfx('powerUp'); }
    shake(0.03 + 0.05 * (a.ki / 100));
    // rocks lift off the ground around him
    if (a.rocks.length < 16 && Math.random() < dt * 14) {
      const ang = rand(0, Math.PI * 2), d = K(rand(34, 110));
      a.rocks.push({ x: Math.cos(ang) * d, y: Math.sin(ang) * d * 0.55 + K(20), vy: -K(rand(40, 110)), r: K(rand(2.5, 6)), rot: rand(0, 6), t: 0, life: rand(0.9, 1.6) });
    }
  }
  function release(held, x, y, press0) {
    const a = st();
    a.charging = false;
    if (press0?.boi?.drag) { const n = press0.boi.hit?.size ?? 0; if (n >= 4) label(`×${n}`, x, y - K(30), '#e0f2fe', true); return; }   // that was a Rush
    if (!skill() || !fighting() || s.mahoraga || held < HOLD_MIN || isUltra(s)) return;
    if (a.ki >= 99.5 && a.form < 3) transform(a.form + 1);
  }
  function transform(to) {
    const sk = skill(), a = st(), p = P();
    a.form = to; a.ki = sk.kiAfter; a.hits = 0; a.peak = Math.max(a.peak, to);
    a.cutin = { t: 0, life: CUTIN, name: FORMS[to].name, color: FORMS[to].color, form: to };
    // the shockwave as he goes up: hits and throws everything around him
    const R = K(sk.novaR) * (1 + 0.2 * (to - 1));
    let n = 0;
    api.asYou(() => foes().filter(e => dist(e.x, e.y, p.x, p.y) <= R + radius(e) * 0.5).forEach(e => {
      kitHit(e, sk.novaPct, { color: FORMS[to].color, label: '💥', quiet: n++ >= 3 });
      if (e.hp > 0) launch(e, p, 1.3);
    }));
    effect({ kind: 'sbNova', x: p.x, y: p.y, r: R, life: 0.8, color: FORMS[to].aura, form: to });
    effect({ kind: 'flash', color: '#fef08a', life: 0.35 });
    s.player.invuln = Math.max(s.player.invuln, 0.6);
    shake(0.35 + 0.15 * to); sfx('transform'); sfx('boom');
  }
  // out of Ki: back to Base, winded
  function drop() {
    const sk = skill(), a = st(), p = P();
    a.form = 0; a.ki = 0; a.wind = sk.windDur; a.charging = false;
    effect({ kind: 'sbDrop', x: p.x, y: p.y, r: K(70), life: 0.7 });
    sfx('hurt');
  }

  // ── drag: RUSH ───────────────────────────────────────────────────────────
  function rush(sk, d0, p) {
    const a0 = d0.last, d = dist(a0.x, a0.y, p.x, p.y);
    if (d > K(260)) { d0.last = { x: p.x, y: p.y }; return; }   // a jump (lost the pointer)
    if (d < K(14) || d0.used >= K(sk.dashLen)) return;
    effect({ kind: 'sbDash', x1: a0.x, y1: a0.y, x2: p.x, y2: p.y, life: 0.45, color: look().color });
    let n = 0;
    api.asYou(() => foes().forEach(e => {
      if (d0.hit.has(e.id) || distToSegment(e.x, e.y, a0.x, a0.y, p.x, p.y) > K(26) + radius(e) * 0.6) return;
      d0.hit.add(e.id);
      kitHit(e, sk.dashPct, { color: '#e0f2fe', label: '💨', quiet: n++ >= 2 });
      gainKi(2);
      if (n === 1) { sfx('hit'); shake(0.08); }
    }));
    d0.used += d; d0.last = { x: p.x, y: p.y };
  }

  // ── M2: tap KI BLAST, hold KA-ME-HA-ME-BOI ───────────────────────────────
  function press(x, y) {
    const a = st();
    if (!skill() || !fighting() || s.mahoraga) return false;
    a.m2 = { t0: s.time, x, y };
    return true;
  }
  function m2Release(held) {
    const a = st(), sk = skill();
    const m2 = a.m2; a.m2 = null;
    if (a.beam) { if (!a.beam.firing) fireBeam(); return; }   // let go mid-chant: OOFED!!!!
    if (!sk || !m2 || held >= BEAM_HOLD || !fighting()) return;
    if (a.bcd > 0) return;
    a.bcd = 0.28;
    const p = P(), n = isUltra(s) ? 3 : a.form >= 2 ? 2 : 1;
    const targets = foes().sort((q, r) => dist(q.x, q.y, p.x, p.y) - dist(r.x, r.y, p.x, p.y));
    if (!targets.length) return;
    for (let i = 0; i < n; i++) {
      const t = targets[i % targets.length], ang = Math.atan2(t.y - p.y, t.x - p.x) + (i - (n - 1) / 2) * 0.9;
      a.blasts.push({ x: p.x, y: p.y, vx: Math.cos(ang) * K(700), vy: Math.sin(ang) * K(700), target: t.id, t: 0, r: K(9 + 3 * a.form) });
    }
    sfx('kiBlast');
  }
  // the chant: one word every CHANT_T while you hold, each paid in Ki and each making it bigger.
  // Let go whenever you like: OOFED!!!! fires it at the size it got to.
  function payWord() {
    const a = st(), sk = skill();
    if (!isUltra(s) && a.ki < sk.stageCost) return false;
    if (!isUltra(s)) a.ki -= sk.stageCost;
    return true;
  }
  function startBeam() {
    const a = st();
    if (!payWord()) { const p = P(); label('no Ki', p.x, p.y - K(36), '#94a3b8'); a.m2 = null; return; }
    a.beam = { x: a.m2.x, y: a.m2.y, t: 0, ang: aimFrom(a.m2.x, a.m2.y, null), stage: 1, stageT: 0, firing: false, fireT: 0, fireDur: 0, tick: 0, hit: 0 };
    chantWord(a.beam);
  }
  function chantWord(b) {
    b.stageT = 0;
    effect({ kind: 'sbPulse', x: b.x, y: b.y, r: K(40 + 22 * b.stage), life: 0.35, color: '#7dd3fc' });
    shake(0.05 + 0.05 * b.stage); sfx('chant', b.stage);
  }
  function fireBeam() {
    const a = st(), b = a.beam;
    b.firing = true; b.fireT = 0; b.fireDur = 0.5 + 0.4 * b.stage; b.tick = 0;
    a.oof = { t: 0, life: 1.1, x: b.x, y: b.y, stage: b.stage };   // the shout (drawn over the beam: BoiFx)
    effect({ kind: 'sbNova', x: b.x, y: b.y, r: K(60 + 30 * b.stage), life: 0.5, color: '#bae6fd', form: 1 });
    if (b.stage >= 4) effect({ kind: 'flash', color: '#e0f2fe', life: 0.3 });
    shake(0.25 + 0.12 * b.stage); sfx('beam'); sfx('boom');
  }
  // which way the beam goes: toward the cursor once it's moved off the start, else at the most enemies
  function aimFrom(x, y, prev) {
    const p = s.player.pos;
    if (p && dist(p.x, p.y, x, y) > K(40)) return Math.atan2(p.y - y, p.x - x);
    const w = beamW() / 2, list = foes();
    let best = prev ?? -Math.PI / 2, score = 0;
    for (let i = 0; i < 90; i++) {
      const ang = (i / 90) * Math.PI * 2, ux = Math.cos(ang), uy = Math.sin(ang);
      let sc = 0;
      for (const e of list) {
        const dx = e.x - x, dy = e.y - y, along = dx * ux + dy * uy, off = Math.abs(dx * uy - dy * ux), reach = w + radius(e) * 0.6;
        if (along > 0 && off <= reach) sc += (e.tier === 'boss' ? 3 : e.tier === 'elite' ? 2 : 1) * (1.5 - off / reach);   // (dead centre counts most)
      }
      if (prev != null && Math.abs(((ang - prev + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.12) sc *= 1.15;   // (it doesn't flick between equals)
      if (sc > score) { score = sc; best = ang; }
    }
    return best;
  }
  // how wide: by form, and by how far into the chant you got
  function beamW() {
    const a = st(), sk = skill(), stg = a.beam?.stage ?? 4;
    return K(sk.beamW) * (isUltra(s) ? 2.4 : [1, 1.3, 1.6, 2.1][a.form]) * (0.55 + 0.15 * stg);
  }
  function updateBeam(dt, sk) {
    const a = st(), b = a.beam;
    b.t += dt;
    // it turns, but it's heavy: it follows the aim, a little behind
    const want = aimFrom(b.x, b.y, b.ang);
    let dA = ((want - b.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    b.ang += dA * Math.min(1, dt * (b.firing ? 4 : 7));
    if (!b.firing) {
      if (!s.player.m2) { fireBeam(); return; }   // (let go some other way)
      b.stageT += dt;
      if (b.stage < CHANT.length && b.stageT >= CHANT_T) {
        if (payWord()) { b.stage++; chantWord(b); }
        else b.stageT = 0;   // out of Ki: stuck on this word until you let go
      }
      if (b.stage >= CHANT.length) shake(0.04);   // at full, the whole screen strains
      return;
    }
    b.fireT += dt;
    if (b.fireT >= b.fireDur) { endBeam(); return; }
    shake(0.03 + 0.02 * b.stage);
    b.tick -= dt;
    if (b.tick > 0) return;
    b.tick = 0.1;
    const ux = Math.cos(b.ang), uy = Math.sin(b.ang), w = beamW(), pct = sk.beamPct * STAGE_POWER[b.stage];
    let n = 0;
    api.asYou(() => foes().forEach(e => {
      const dx = e.x - b.x, dy = e.y - b.y, along = dx * ux + dy * uy;
      if (along < -radius(e) || Math.abs(dx * uy - dy * ux) > w / 2 + radius(e) * 0.6) return;
      kitHit(e, pct, { color: '#bae6fd', quiet: n++ >= 1 || b.hit % 3 !== 0, charge: 0.6 });
      // it pushes them along it
      if (e.hp > 0 && !heavy(e) && !(e.down > 0) && !e.grabbed && s.enemies.includes(e)) { e.x += ux * K(26); e.y += uy * K(26); e.x = Math.max(0, Math.min(s.W, e.x)); e.y = Math.max(0, Math.min(s.H, e.y)); }
    }));
    b.hit++;
  }
  function endBeam() {
    const a = st();
    if (a.beam?.firing) effect({ kind: 'sbBlast', x: a.beam.x, y: a.beam.y, r: K(40), life: 0.3, color: '#bae6fd' });
    a.beam = null; a.bcd = 0.4;
  }
  function updateBlasts(dt, sk) {
    const a = st();
    for (const b of a.blasts) {
      b.t += dt;
      const t = s.enemies.find(e => e.id === b.target && e.hp > 0 && !(e.down > 0)) ?? foes().reduce((q, e) => (!q || dist(e.x, e.y, b.x, b.y) < dist(q.x, q.y, b.x, b.y) ? e : q), null);
      if (!t || b.t > 2) { b.dead = true; continue; }
      b.target = t.id;
      // homing: it curves in
      const dx = t.x - b.x, dy = t.y - b.y, d = Math.hypot(dx, dy) || 1, sp = K(900);
      b.vx += (dx / d * sp - b.vx) * Math.min(1, dt * 6); b.vy += (dy / d * sp - b.vy) * Math.min(1, dt * 6);
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (d <= radius(t) * 0.8 + b.r) {
        api.asYou(() => kitHit(t, sk.blastPct, { color: '#a5f3fc', label: '✺' }));
        effect({ kind: 'sbBlast', x: b.x, y: b.y, r: K(36) + b.r * 2, life: 0.35, color: look().aura ?? '#a5f3fc' });
        b.dead = true; sfx('hit');
      }
    }
    a.blasts = a.blasts.filter(b => !b.dead);
  }

  // ── Q: SOLAR FLARE ───────────────────────────────────────────────────────
  function flare(x, y) {
    const sk = skill(), a = st();
    if (!sk || !fighting() || s.mahoraga) return false;
    if (a.qcd > 0) { floater(`${Math.ceil(a.qcd)}s`, x, y - K(30), '#fef9c3'); return false; }
    a.qcd = a.qcdMax = sk.cooldown;
    const p = P();
    for (const e of foes()) {
      e.blind = Math.max(e.blind ?? 0, sk.flareDur * (e.tier === 'boss' ? 0.5 : 1));
      e.exposedT = s.time + sk.flareDur + 1;
      if (e.dashing) api.finishAttack(e.dashing);
    }
    effect({ kind: 'sbFlare', x: p.x, y: p.y, r: Math.hypot(s.W, s.H), life: 0.7 });
    effect({ kind: 'flash', color: '#ffffff', life: 0.5 });
    shake(0.15); sfx('flare');
    return true;
  }
  const exposedBonus = () => skill()?.exposed ?? 0;

  // ── getting hit: Super 3 takes more, Ultra isn't there, Saiyan Blood ─────
  function hurtMult() {
    const sk = skill(), a = st();
    return sk?.type === 'saiyan' && a.form >= 3 && !isUltra(s) ? 1 + sk.s3Hurt : 1;
  }
  function dodge(kind, src) {
    if (!isUltra(s)) return false;
    const sk = skill(), p = P();
    const ang = rand(0, Math.PI * 2);
    effect({ kind: 'sbDodge', x: p.x, y: p.y, dx: Math.cos(ang) * K(26), dy: Math.sin(ang) * K(26), life: 0.45 });
    // and he's already hitting back
    const who = (src && s.enemies.includes(src) && src.hp > 0 ? src : null) ?? foes().reduce((q, e) => (!q || dist(e.x, e.y, p.x, p.y) < dist(q.x, q.y, p.x, p.y) ? e : q), null);
    if (who && dist(who.x, who.y, p.x, p.y) < K(600)) {
      effect({ kind: 'sbTele', x1: p.x, y1: p.y, x2: who.x, y2: who.y, life: 0.3 });
      api.asYou(() => kitHit(who, sk?.counterPct ?? 1.5, { color: '#c7d2fe', label: '↺' }));
    }
    sfx('dive');
    return true;
  }
  function onHit() {
    const sk = skill(), a = st(), pl = s.player;
    if (sk?.type !== 'saiyan' || pl.hp <= 0 || pl.hp >= pl.maxHp * 0.3 || a.zcd > 0 || a.zenkai >= Math.round(sk.zenkaiMax)) return;
    a.zenkai++; a.zcd = sk.zenkaiCd;
    a.wind = 0; a.ki = Math.min(100, a.ki + 35);
    const p = P();
    effect({ kind: 'sbZen', x: p.x, y: p.y, r: K(120), life: 0.8 });
    label(`+${Math.round(sk.zenkai * a.zenkai * 100)}%`, p.x, p.y - K(56), '#fca5a5', true);
    shake(0.25); sfx('roar');
  }

  // ── ult: ULTRA BOI, then the Spirit Bomb ─────────────────────────────────
  function ult(u) {
    const a = st();
    if (a.beam) endBeam();
    a.m2 = null;
    a.prevForm = a.form;
    a.wind = 0; a.ki = 100; a.bombN = 0; a.thrown = false; a.charging = false;
    s.ult.active = { type: 'ultraboi', t: u.dur, dur: u.dur, bonus: u.bonus, bombBase: u.bombBase, bombPer: u.bombPer, bombR: u.bombR };
    a.cutin = { t: 0, life: CUTIN, name: ULTRA.name, color: ULTRA.color, ultra: true };
    effect({ kind: 'flash', color: '#e0e7ff', life: 0.45 });
    shake(0.5); sfx('transform');
  }
  function onKill(e) {
    const a = st();
    if (!isUltra(s) || a.thrown) return;
    a.bombN += e.tier === 'boss' ? 5 : e.tier === 'elite' ? 3 : 1;
  }
  // tap the ult again while he's in Ultra: throw it now (engine.activateUlt)
  function ultAgain() {
    const a = st(), act = s.ult.active;
    if (act?.type !== 'ultraboi' || a.thrown) return false;
    throwBomb(act);
    act.t = Math.min(act.t, 0.6);   // (Ultra fades as it goes)
    return true;
  }
  function throwBomb(act) {
    const a = st(), p = P();
    a.thrown = true;
    const grow = Math.min(1, a.bombN / 20);
    a.bomb = { t: 0, lift: 0.7, fall: 0.55, x: p.x, y: p.y, r: K(act.bombR) * (0.7 + 0.6 * grow), size: 0.5 + grow, pct: act.bombBase + act.bombPer * a.bombN };
    sfx('kame');
  }
  function updateBomb(dt) {
    const a = st(), b = a.bomb;
    b.t += dt;
    if (b.t < b.lift + b.fall || b.done) return;
    b.done = true;
    let n = 0;
    api.asYou(() => foes().filter(e => dist(e.x, e.y, b.x, b.y) <= b.r + radius(e) * 0.5)
      .forEach(e => kitHit(e, b.pct, { color: '#bfdbfe', label: '◯', quiet: n++ >= 4, charge: 0 })));
    effect({ kind: 'sbBoom', x: b.x, y: b.y, r: b.r, life: 1.1 });
    effect({ kind: 'flash', color: '#dbeafe', life: 0.6 });
    shake(0.9); sfx('boom'); sfx('thunder');
    a.bomb = null;
  }
  function endUlt() {
    const a = st();
    if (!a.thrown) throwBomb(s.ult.active ?? { bombBase: 10, bombPer: 2, bombR: 260 });
    a.form = a.prevForm; a.ki = 100; a.wind = 0;
  }

  // ── every frame ──────────────────────────────────────────────────────────
  function update(dt, live) {
    const sk = skill(), a = st(), pl = s.player;
    a.floats = 0;
    a.wind = Math.max(0, a.wind - dt);
    a.zcd = Math.max(0, a.zcd - dt);
    a.qcd = Math.max(0, a.qcd - dt);
    a.bcd = Math.max(0, a.bcd - dt);
    if (a.cutin) { a.cutin.t += dt; if (a.cutin.t >= a.cutin.life) a.cutin = null; }
    if (a.oof) { a.oof.t += dt; if (a.oof.t >= a.oof.life) a.oof = null; }
    for (const r of a.rocks) { r.t += dt; r.y += r.vy * dt; r.rot += dt * 2; }
    a.rocks = a.rocks.filter(r => r.t < r.life);
    if (a.bomb) updateBomb(dt);
    const mine = sk?.type === 'saiyan';
    const ultra = isUltra(s);
    if (!mine) { a.charging = false; a.beam = null; a.blasts = []; return; }
    const p = pl.pos;
    // the trail he leaves while fast (Ultra, forms): afterimages
    a.trailT -= dt;
    if (p && a.trailT <= 0) { a.trailT = 0.035; a.trail.push({ x: p.x, y: p.y }); if (a.trail.length > 7) a.trail.shift(); }
    // a form burns Ki
    if (live && a.form > 0 && !ultra) {
      a.ki -= sk[`drain${a.form}`] * dt;
      if (a.ki <= 0) drop();
    }
    if (ultra) a.ki = 100;
    // hold M1: power up, or drag: rush
    const held = pl.held;
    if (held && p && live && !s.mahoraga) {
      const d0 = held.boi ?? (held.boi = { drag: false, last: { x: held.x ?? p.x, y: held.y ?? p.y }, used: 0, hit: new Set() });
      if (!d0.drag && !a.charging && dist(p.x, p.y, held.x ?? p.x, held.y ?? p.y) > K(DRAG_START)) d0.drag = true;
      if (d0.drag) { a.charging = false; rush(sk, d0, p); }
      else if (s.time - held.t0 >= HOLD_MIN && !ultra) powerUp(dt, sk, p);
    } else a.charging = false;
    // M2 held: the beam
    if (a.m2 && !a.beam && s.player.m2 && s.time - a.m2.t0 >= BEAM_HOLD && live) startBeam();
    if (a.beam) updateBeam(dt, sk);
    if (a.blasts.length) updateBlasts(dt, sk);
    // Super 2 and up: the aura crackles, and the sparks find what's close
    if ((a.form >= 2 || ultra) && p && live) {
      a.sparkT -= dt;
      if (a.sparkT <= 0) {
        a.sparkT = ultra ? 0.35 : 0.55;
        const R = K(sk.sparkR), list = foes().filter(e => dist(e.x, e.y, p.x, p.y) <= R + radius(e) * 0.5);
        if (list.length) {
          const e = list[Math.floor(Math.random() * list.length)];
          effect({ kind: 'sbZap', pts: [[p.x, p.y], [e.x, e.y]], life: 0.2, color: ultra ? '#e0e7ff' : '#fef08a' });
          api.asYou(() => kitHit(e, sk.sparkPct, { color: '#fde68a', quiet: true }));
          sfx('zap');
        }
      }
    }
    // the damage multiplier the engine reads (rollClick)
    const form = ultra ? s.ult.active.bonus : [0, sk.mult1, sk.mult2, sk.mult3][a.form];
    a.mult = (1 + form) * (1 + a.zenkai * sk.zenkai) * (a.wind > 0 ? 0.75 : 1);
  }

  // ── for the HUD ──────────────────────────────────────────────────────────
  const m2Info = () => { const a = st(); return { kind: 'count', n: Math.floor(a.ki), max: 100, fill: a.ki / 100, label: 'KI ', color: look().color, btn: 'KI', hint: 'M2: tap for a Ki Blast. Hold: BOI… YOU… JUST… GOT… and let go: OOFED!!!! (a beam from where you pressed toward the cursor)' }; };
  const qInfo = () => { const a = st(), sk = skill(); return { kind: 'cd', cd: a.qcd, cdMax: a.qcdMax || sk?.cooldown || 18, color: '#fef9c3', text: 'Q', hint: 'Solar Flare: Q (phone: the SKILL button). Blinds every enemy, and they take more damage' }; };
  const active = () => { const a = s.kit.boi; return !!(a && (a.cutin || a.bomb || a.oof || a.rocks.length)); };
  function reset(why) {
    const a = st();
    a.charging = false; a.beam = null; a.m2 = null; a.blasts = []; a.cutin = null; a.bomb = null; a.oof = null; a.rocks = [];
    a.qcd = 0; a.bcd = 0;
    // he keeps his form and Ki from stage to stage; losing puts him back to Base
    if (why === 'defeat') { a.form = 0; a.ki = 0; a.wind = 0; }
    a.zenkai = 0; a.zcd = 0;   // Saiyan Blood lasts a stage
  }

  return { onClick, release, press, m2Release, flare, exposedBonus, hurtMult, dodge, onHit, ult, onKill, ultAgain, endUlt, update, m2Info, qInfo, active, reset };
}
