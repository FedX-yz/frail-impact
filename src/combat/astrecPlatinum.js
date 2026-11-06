// ─────────────────────────────────────────────────────────────────────────────
// 6★ Astrec (Platinum Series) — DEATH WISH. The Initiative sends him in first, because he
// can't stay dead. The numbers are in kits.js (death_wish / no_retreat); kitRuntime.js hands
// every input to this file while he's the main card. What's drawn for it is in AstrecFx.jsx.
//
//   Death Wish  the more HP he's missing, the more dangerous he is, in three tiers:
//                 below 75% HP   his hits are heavier
//                 below 50%      …and every click also cuts the enemies around the target
//                 below 25%      …and every click is a crit with a shockwave
//               Too low and he dies, like anyone.
//   Not Yet     the first time he'd die in a stage, he gets back up (reviveHp of his HP),
//               but Death Wish shuts off for lockDur s while his body catches up
//   M2          DRAW FIRE: for drawDur s every enemy attacks twice as fast. Choosing when to
//               take the hits is how he climbs the tiers
//   hold M1     BRACE: while held he takes much less damage; let go and everything he soaked
//               up comes back out around the cursor
//   Q           SECOND WIND: heals a chunk of HP (and so drops him down the tiers): the way
//               out when he's gone too deep
//   ult         NO RETREAT: for dur s he's at the top tier whatever his HP, and nothing can
//               take him below 1 HP
// ─────────────────────────────────────────────────────────────────────────────

const HOLD_MIN = 0.25;      // shorter than this is a click, not a Brace
const BRACE_AFTER = 0.12;   // the guard comes up this long after you press
const CUTIN = 1.0;          // seconds the burst art is on screen (the fight goes on)
export const ASTREC_INTRO = CUTIN;
export const ASTREC_EFFECTS = new Set(['dwcleave', 'dwshock', 'dwcounter', 'dwrevive', 'dwwind']);
export const TIER_COLORS = ['#d4d4d4', '#fdba74', '#f87171', '#fca5a5'];   // (tier III: the brightest, it's the loudest)

// which tier he's in: 0 (none) … 3
export function dwTier(s) {
  const a = s.kit.astrec;
  if (!a) return 0;
  if (s.ult.active?.type === 'noretreat') return 3;
  if (a.lock > 0) return 0;
  const miss = 1 - s.player.hp / Math.max(1, s.player.maxHp);
  return miss >= 0.75 ? 3 : miss >= 0.5 ? 2 : miss >= 0.25 ? 1 : 0;
}

// the HUD chips while he's out: [key, colour, text]
export function astrecChips(s, sk, mobile = false) {
  const a = s.kit.astrec, t = dwTier(s), out = [];
  if (a?.lock > 0 && s.ult.active?.type !== 'noretreat') out.push(['dw', '#a3a3a3', `☠ Death Wish: off for ${Math.ceil(a.lock)}s`]);
  else {
    const what = ['missing 25% HP: tier I', 'heavier hits', '+ cleave', '+ crits, shockwaves'][t];
    out.push(['dw', TIER_COLORS[t], `☠ ${t ? `TIER ${'I'.repeat(t)} · ` : ''}${what}`]);
  }
  out.push(['rv', a?.revived ? '#737373' : '#fecaca', a?.revived ? '✝ Not Yet: used' : '✝ Not Yet: ready']);
  if (a?.draw > 0) out.push(['df', '#fca5a5', `🎯 DRAW FIRE ${a.draw.toFixed(1)}s`]);
  if (s.player.held && a?.bracing) out.push(['br', '#e5e5e5', mobile ? '🛡 BRACING · let go: hit back' : '🛡 BRACING · let go of M1: hit back']);
  return out;
}

export function createAstrecPlatinum(ctx) {
  const { s, api, K, dist, floater, effect, shake, sfx, skill, kitHit, foes, fighting, radius } = ctx;
  const st = () => s.kit.astrec ?? (s.kit.astrec = { lock: 0, revived: false, draw: 0, dcd: 0, dcdMax: 0, qcd: 0, qcdMax: 0, soak: 0, bracing: false, bonus: 0, tier: 0, cutin: null, floats: 0 });
  const label = (text, x, y, color, big = false) => { const a = st(); if (a.floats++ < 3) floater(text, x, y, color, big); };

  // ── click: what the tiers add ────────────────────────────────────────────
  function onClick(e, auto) {
    const sk = skill(), t = dwTier(s);
    if (!sk || !e || auto || t < 2) return;
    let n = 0;
    if (t >= 2) {   // cleave: the enemies around the target get cut too
      const R = K(sk.cleaveR);
      const near = foes().filter(o => o !== e && dist(o.x, o.y, e.x, e.y) <= R + radius(o) * 0.5);
      if (near.length) {
        effect({ kind: 'dwcleave', x: e.x, y: e.y, r: R, life: 0.3, a: Math.random() * Math.PI });
        api.asYou(() => near.forEach(o => kitHit(o, sk.cleave, { color: '#fca5a5', label: '⚔', quiet: n++ >= 2 })));
      }
    }
    if (t >= 3) {   // shockwave
      const R = K(sk.shockR);
      effect({ kind: 'dwshock', x: e.x, y: e.y, r: R, life: 0.4 });
      api.asYou(() => foes().filter(o => o !== e && dist(o.x, o.y, e.x, e.y) <= R + radius(o) * 0.5)
        .forEach(o => kitHit(o, sk.shock, { color: '#f87171', label: '💥', quiet: n++ >= 3 })));
      shake(0.08);
    }
  }
  // tier III: every click a crit (kitRuntime.clickMods)
  const forceCrit = () => dwTier(s) >= 3;

  // ── Not Yet ──────────────────────────────────────────────────────────────
  // the hit that would kill him: the first one in a stage, he gets back up
  function cheatDeath() {
    const sk = skill(), a = st(), pl = s.player;
    if (sk?.type !== 'deathwish') return false;
    if (s.ult.active?.type === 'noretreat') { pl.hp = 1; return true; }   // (No Retreat: never below 1)
    if (a.revived) return false;
    a.revived = true;
    pl.hp = Math.round(pl.maxHp * sk.reviveHp);
    pl.invuln = Math.max(pl.invuln, 1.5);
    a.lock = sk.lockDur;
    a.draw = 0;
    const P = pl.pos ?? { x: s.W / 2, y: s.H / 2 };
    effect({ kind: 'dwrevive', x: P.x, y: P.y, r: K(220), life: 1.1 });
    effect({ kind: 'flash', color: '#000000', life: 0.5 });
    api.announce('NOT YET', '#fecaca');
    floater(`Death Wish off for ${sk.lockDur}s`, P.x, P.y + K(40), '#a3a3a3', true);
    shake(0.6); sfx('roar');
    return true;
  }

  // ── M2: DRAW FIRE ────────────────────────────────────────────────────────
  function drawFire(x, y) {
    const sk = skill(), a = st();
    if (!sk || !fighting() || s.mahoraga) return false;
    if (a.dcd > 0) { floater(`${Math.ceil(a.dcd)}s`, x, y - K(30), '#fca5a5'); return false; }
    a.dcd = a.dcdMax = sk.drawCd;
    a.draw = sk.drawDur;
    // they turn on him: everyone that's waiting to attack gets on with it
    for (const e of s.enemies) if (e.cd > 0.6) e.cd = Math.min(e.cd, 0.6 + Math.random() * 0.5);
    effect({ kind: 'ring', x, y, r: K(260), color: '#ef4444', life: 0.6 });
    api.announce('DRAW FIRE', '#fca5a5');
    shake(0.2); sfx('roar');
    return true;
  }

  // ── hold M1: BRACE, let go: hit back ─────────────────────────────────────
  // how much of a hit gets through (engine.hitPlayer)
  function hurtMult() {
    const sk = skill(), a = st();
    return sk?.type === 'deathwish' && a.bracing ? 1 - sk.braceDR : 1;
  }
  function onHit(dmg) {
    const a = st(), sk = skill();
    if (sk?.type === 'deathwish' && a.bracing) a.soak += dmg / Math.max(0.05, 1 - sk.braceDR);   // the whole hit, not just what got through
  }
  function release(held, x, y) {
    const sk = skill(), a = st();
    const soak = a.soak;
    a.bracing = false; a.soak = 0;
    if (!sk || !fighting() || s.mahoraga || held < HOLD_MIN) return;
    const frac = soak / Math.max(1, s.player.maxHp);
    const pct = Math.min(sk.counterMax, sk.counterMin + frac * sk.counterPer);
    const R = K(sk.counterR) * (soak > 0 ? 1 : 0.6);
    let n = 0;
    api.asYou(() => foes().filter(e => dist(e.x, e.y, x, y) <= R + radius(e) * 0.5)
      .forEach(e => kitHit(e, pct, { color: '#fecaca', label: soak > 0 ? '🛡 ' : '', quiet: n++ >= 4 })));
    effect({ kind: 'dwcounter', x, y, r: R, life: 0.55, big: soak > 0 });
    if (soak > 0) { label(`HIT BACK ×${pct.toFixed(1)}`, x, y - R * 0.6, '#fecaca', true); shake(Math.min(0.6, 0.2 + frac)); sfx('boom'); }
    else sfx('hit');
  }

  // ── Q: SECOND WIND ───────────────────────────────────────────────────────
  function secondWind(x, y) {
    const sk = skill(), a = st();
    if (!sk || !fighting() || s.mahoraga) return false;
    if (a.qcd > 0) { floater(`${Math.ceil(a.qcd)}s`, x, y - K(30), '#86efac'); return false; }
    a.qcd = a.qcdMax = sk.cooldown;
    api.heal(sk.heal * s.player.maxHp);
    const P = s.player.pos ?? { x, y };
    effect({ kind: 'dwwind', x: P.x, y: P.y, r: K(120), life: 0.7 });
    floater(`+${Math.round(sk.heal * 100)}% HP`, P.x, P.y - K(40), '#86efac', true);
    sfx('shield');
    return true;
  }

  // ── ult: NO RETREAT ──────────────────────────────────────────────────────
  function ult(u) {
    const a = st();
    s.ult.active = { type: 'noretreat', t: u.dur, dur: u.dur, bonus: u.bonus };
    a.cutin = { t: 0, life: CUTIN };
    effect({ kind: 'flash', color: '#7f1d1d', life: 0.4 });
    shake(0.5); sfx('roar'); sfx('boom');
  }
  function endUlt() {
    api.announce('…STILL STANDING', '#fecaca');
    shake(0.3);
  }

  // ── every frame ──────────────────────────────────────────────────────────
  function update(dt, live) {
    const sk = skill(), a = st(), pl = s.player;
    a.floats = 0;
    a.lock = Math.max(0, a.lock - dt);
    a.draw = Math.max(0, a.draw - dt);
    a.dcd = Math.max(0, a.dcd - dt);
    a.qcd = Math.max(0, a.qcd - dt);
    if (a.cutin) { a.cutin.t += dt; if (a.cutin.t >= a.cutin.life) a.cutin = null; }
    const held = pl.held;
    a.bracing = !!(sk?.type === 'deathwish' && held && live && !s.mahoraga && s.time - held.t0 >= BRACE_AFTER);
    if (!held && a.soak) a.soak = 0;
    // the damage bonus the engine reads (rollClick)
    const t = sk?.type === 'deathwish' ? dwTier(s) : 0;
    if (t > a.tier && sk) {   // going deeper: you feel it
      const P = pl.pos;
      if (P) label(`TIER ${'I'.repeat(t)}`, P.x, P.y - K(54), TIER_COLORS[t], true);
      sfx(t === 3 ? 'roar' : 'crit'); shake(0.12 * t);
    }
    a.tier = t;
    a.bonus = !sk ? 0 : (t ? sk[`t${t}`] : 0) + (s.ult.active?.type === 'noretreat' ? s.ult.active.bonus : 0);
  }

  // ── for the HUD ──────────────────────────────────────────────────────────
  const m2Info = () => { const a = st(), sk = skill(); return { kind: 'cd', cd: a.dcd, cdMax: a.dcdMax || sk?.drawCd || 12, color: '#f87171', text: 'M2', btn: 'DRAW', hint: 'Draw Fire: M2. For a few seconds every enemy attacks twice as fast' }; };
  const qInfo = () => { const a = st(), sk = skill(); return { kind: 'cd', cd: a.qcd, cdMax: a.qcdMax || sk?.cooldown || 16, color: '#86efac', text: 'Q', hint: 'Second Wind: Q (phone: the SKILL button). Heals, and drops you down the Death Wish tiers' }; };
  const active = () => { const a = s.kit.astrec; return !!(a && (a.cutin || a.draw > 0 || a.lock > 0)); };
  // a new stage: Not Yet is back
  function reset(why) {
    const a = st();
    a.bracing = false; a.soak = 0; a.draw = 0; a.cutin = null;
    if (why !== 'defeat') a.revived = false;
    else { a.revived = false; a.lock = 0; }
    a.dcd = 0; a.qcd = 0;
  }
  const attackRate = () => (st().draw > 0 ? 2 : 1);

  return { onClick, forceCrit, cheatDeath, drawFire, hurtMult, onHit, release, secondWind, ult, endUlt, update, m2Info, qInfo, active, reset, attackRate };
}
