// ─────────────────────────────────────────────────────────────────────────────
// 6★ Reef (Platinum Series) — LAST RITES. The squad's leader after Bonk: a necromancer who
// takes the souls of what he kills and calls them back up to fight for him, and lives off the
// damage he deals. The numbers are in kits.js (last_rites / legion); kitRuntime.js hands every
// input to this file while he's the main card. What's drawn for it is in ReefFx.jsx.
//
//   passive     SOUL HARVEST: every enemy he kills, its soul is his (kept by kind; up to
//               soulCap). Elites' souls are stronger; a boss's is rare and huge. LIFESTEAL: a
//               share of all damage he deals heals him (up to lsCap of max HP a second)
//   M1          HEX: every click curses what it hits: the curse eats at it for a while
//   hold M1     COMMAND: hold on an enemy and everything you've summoned goes for it; while
//               you hold, he drains it (and that heals twice as much)
//   drag        BLOOD SIGIL: what you draw stays on the ground as a cursed line; whatever
//               crosses it is hexed. Close the loop (come back round to where you started) and
//               it's a PENTAGRAM instead: it burns everything inside at once, then keeps pulsing
//   M2          SUMMON: tap → your chosen soul comes back as its monster at the cursor (costs the
//               soul; up to maxOut at once, for minionLife s or until it's killed). Hold → the
//               SOUL WHEEL: every kind you have and how many; let go on one (or click it)
//   Q           SÉANCE: a ritual circle at the cursor tears a ghost out of every enemy inside
//               (damage, and the ghost comes back to heal you); what dies inside while it's
//               open gives two souls
//   ult         LEGION: every soul you have comes up at once (they aren't spent), twice the
//               size and twice as strong; whatever dies rises on your side; nothing takes you
//               below 1 HP; lifesteal ×3; your hits mark enemies for the army. At the end the
//               army collapses into a pentagram over the whole arena: everything on it is
//               struck (more for every soul and every one in the army) and you're healed full
// ─────────────────────────────────────────────────────────────────────────────

const HOLD_CMD = 0.2;       // hold M1 this long (without moving) and it's a command
const DRAG_START = 18;      // design px the cursor has to move while held to draw instead
const WHEEL_HOLD = 0.22;    // hold M2 this long and the soul wheel opens
const CUTIN = 1.1;          // seconds the burst art is on screen (the fight goes on)
const ARMY_CAP = 30;        // most summons out at once, even in Legion (it's a lot to draw)
export const REEF_INTRO = CUTIN;
export const REEF_EFFECTS = new Set(['claw', 'ghost', 'pentaburst', 'crumble', 'rise', 'drain']);
const MAG = '#e879f9', BONE = '#f5f0e6', VIOLET = '#a78bfa', SICK = '#86efac', BLOOD = '#be123c';
const TIER_RANK = { basic: 1, elite: 2, boss: 3 };

// a soul's kind: the enemy type and how strong it was
const soulKey = (typeId, tier) => `${typeId}|${tier}`;
// can this enemy's soul be taken? (not treasure chests, nor the pieces of a boss)
export function summonable(e) {
  if (!e?.type || e.tier === 'treasure' || e.tier === 'minion' && !e.type.img) return false;
  if (e.role && e.role !== 'head') return false;   // worm segments, hydra heads, hands, legs: the boss's soul is the boss's
  return true;
}

// the HUD chips while he's out: [key, colour, text]
export function reefChips(s, sk, mobile = false) {
  const r = s.kit.reef, out = [];
  if (!r) return out;
  const total = soulsTotal(r), pick = r.souls.find(x => x.key === r.pick) ?? r.souls[0];
  out.push(['souls', MAG, `👻 ${total}/${sk?.soulCap ?? 20} souls${pick ? ` · M2: ${pick.name}${pick.tier !== 'basic' ? ` (${pick.tier})` : ''} ×${pick.n}` : ' · kill to take them'}`]);
  const out_ = r.minions.length;
  if (out_) out.push(['army', BONE, `💀 ${out_}${s.ult.active?.type === 'legion' ? '' : `/${sk?.maxOut ?? 5}`} risen`]);
  if (r.command) out.push(['cmd', BLOOD, '🩸 COMMAND: all on it']);
  if (r.seance) out.push(['se', VIOLET, `🕯 SÉANCE ${Math.max(0, r.seance.life - r.seance.t).toFixed(1)}s`]);
  if (r.pcd > 0) out.push(['pc', '#a8a29e', `⛤ ${r.pcd.toFixed(1)}s`]);
  if (s.ult.active?.type === 'legion') out.push(['lg', MAG, mobile ? '⛧ LEGION · undying' : '⛧ LEGION · undying · lifesteal ×3']);
  return out;
}
export const soulsTotal = r => r.souls.reduce((a, x) => a + x.n, 0);

export function createReefPlatinum(ctx) {
  const { s, api, K, rand, dist, distToSegment, floater, effect, shake, sfx, nextId, skill, kitHit, ultHit, foes, fighting, radius } = ctx;
  const st = () => s.kit.reef ?? (s.kit.reef = { souls: [], pick: null, minions: [], command: null, pents: [], sigils: [], pcd: 0, seance: null, qcd: 0, qcdMax: 0,
    wheel: null, lsBudget: 0, cutin: null, floats: 0, hexT: 0 });
  const alive = e => e && e.hp > 0 && s.enemies.includes(e);
  const legion = () => s.ult.active?.type === 'legion';
  const U = () => s.stats.ult ?? {};
  const P = () => s.player.pos ?? { x: s.W / 2, y: s.H / 2 };
  const label = (text, x, y, color, big = false) => { const r = st(); if (r.floats++ < 3) floater(text, x, y, color, big); };
  const nearestTo = (x, y, list) => list.reduce((b, e) => (!b || dist(x, y, e.x, e.y) < dist(x, y, b.x, b.y) ? e : b), null);

  // ── LIFESTEAL (kitRuntime.onDamage: every bit of damage dealt while he's out) ──
  function onDamage(e, dmg) {
    const sk = skill(), r = st();
    if (sk?.type !== 'necro' || dmg <= 0 || s.player.hp <= 0) return;
    const mult = (legion() ? U().ls ?? 3 : 1) * (r.command && r.command === e.id ? 2 : 1);
    const want = Math.min(dmg, Math.max(0, e.hp + dmg)) * sk.lifesteal * mult;   // (not the overkill)
    const got = Math.min(want, r.lsBudget);
    if (got <= 0) return;
    r.lsBudget -= got;
    s.player.hp = Math.min(s.player.maxHp, s.player.hp + got);
  }

  // ── SOUL HARVEST ─────────────────────────────────────────────────────────
  function addSoul(e, n = 1) {
    const sk = skill(), r = st();
    if (!summonable(e) || !sk) return 0;
    const tier = e.tier === 'boss' ? 'boss' : e.tier === 'elite' ? 'elite' : 'basic';
    const key = soulKey(e.typeId, tier), cap = Math.round(sk.soulCap ?? 20);
    let got = 0;
    for (let i = 0; i < n; i++) {
      if (soulsTotal(r) >= cap) {
        // full: a stronger soul pushes out one of the weakest
        const weak = r.souls.filter(x => TIER_RANK[x.tier] < TIER_RANK[tier]).sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier])[0];
        if (!weak) break;
        weak.n--; if (weak.n <= 0) r.souls.splice(r.souls.indexOf(weak), 1);
      }
      let slot = r.souls.find(x => x.key === key);
      if (!slot) { slot = { key, typeId: e.typeId, tier, n: 0, name: e.type.name ?? e.typeId, img: e.type.img ?? null, size: e.type.size ?? 60, drawScale: e.type.drawScale ?? 1, looks: e.type.looks ?? null }; r.souls.push(slot); }
      slot.n++; got++;
    }
    if (!got) return 0;
    // the first soul you have becomes the M2 one; a boss's always does
    if (!r.pick || tier === 'boss') r.pick = key;
    const p = P();
    effect({ kind: 'ghost', x1: e.x, y1: e.y, x2: p.x, y2: p.y, life: 0.6, boss: tier === 'boss' });
    if (tier !== 'basic' || got > 1) label(`👻 ${tier === 'boss' ? 'BOSS SOUL' : tier === 'elite' ? 'ELITE SOUL' : 'SOUL'}${got > 1 ? ` ×${got}` : ''}`, e.x, e.y - K(34), MAG, tier !== 'basic');
    if (tier === 'boss') api.announce(`${(e.type.name ?? 'ITS').toUpperCase()}'S SOUL IS HIS`, MAG);
    return got;
  }
  function onKill(e) {
    const sk = skill(), r = st();
    if (sk?.type !== 'necro') return;
    const se = r.seance, inSe = se && dist(e.x, e.y, se.x, se.y) <= K(sk.seanceR) + radius(e) * 0.5;
    addSoul(e, inSe ? 2 : 1);
    // Legion: what dies rises on your side, there and then
    if (legion() && summonable(e)) raise({ typeId: e.typeId, tier: e.tier === 'boss' ? 'boss' : e.tier === 'elite' ? 'elite' : 'basic', name: e.type.name, img: e.type.img, size: e.type.size, drawScale: e.type.drawScale, looks: e.type.looks }, e.x, e.y, true);
  }

  // ── summons ──────────────────────────────────────────────────────────────
  function raise(soul, x, y, big = false) {
    const sk = skill(), r = st();
    if (!sk || r.minions.length >= ARMY_CAP) return null;
    const tier = soul.tier, mx = s.player.maxHp;
    const hpF = tier === 'boss' ? sk.bossHp : tier === 'elite' ? sk.eliteHp : sk.basicHp;
    const m = {
      id: nextId(), typeId: soul.typeId, tier, name: soul.name, img: soul.img, size: Math.min(soul.size ?? 60, tier === 'boss' ? 150 : 110), drawScale: soul.drawScale ?? 1, looks: soul.looks,
      x: Math.max(K(20), Math.min(s.W - K(20), x)), y: Math.max(K(20), Math.min(s.H - K(20), y)),
      hp: mx * hpF, maxHp: mx * hpF, pct: tier === 'boss' ? sk.bossSumPct : tier === 'elite' ? sk.elitePct : sk.basicPct,
      cd: rand(0.1, 0.4), target: null, life: sk.minionLife, big, t: 0, face: 1, hitT: -9, hurtT: -9, bite: 0,
    };
    r.minions.push(m);
    effect({ kind: 'rise', x: m.x, y: m.y, r: K(m.size * (big ? 1.4 : 0.8)), life: 0.5 });
    return m;
  }
  // M2 tap / the wheel: one of your souls comes back
  function summon(key, x, y) {
    const sk = skill(), r = st();
    if (!sk || !fighting() || s.mahoraga) return false;
    const slot = r.souls.find(o => o.key === key) ?? r.souls.find(o => o.key === r.pick) ?? r.souls[0];
    if (!slot) { label('no souls · kill something', x, y - K(30), MAG); return false; }
    const cap = legion() ? ARMY_CAP : Math.round(sk.maxOut);
    if (r.minions.length >= cap) { label(`${cap} out already`, x, y - K(30), '#a8a29e'); return false; }
    slot.n--; if (slot.n <= 0) r.souls.splice(r.souls.indexOf(slot), 1);
    r.pick = slot.n > 0 ? slot.key : (r.souls.sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.n - a.n)[0]?.key ?? null);
    raise(slot, x, y, legion());
    sfx(slot.tier === 'boss' ? 'boom' : 'shield');
    label(`💀 ${slot.name.toUpperCase()}`, x, y - K(46), BONE, slot.tier !== 'basic');
    return true;
  }

  // ── M2: tap = summon, hold = the soul wheel ──────────────────────────────
  function press() {
    if (!skill() || !fighting()) return false;
    return true;   // (what it does is decided on release / by holding: update, release)
  }
  // the wheel's slots around (cx, cy)
  function wheelSlots(cx, cy) {
    const r = st(), n = r.souls.length, R = K(n > 6 ? 105 : 90);
    return r.souls.map((o, i) => { const a = -Math.PI / 2 + i / Math.max(1, n) * Math.PI * 2; return { o, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a }; });
  }
  function wheelPick(x, y, byClick) {
    const w = st().wheel;
    if (!w) return null;
    const slots = wheelSlots(w.x, w.y);
    if (!slots.length) return null;
    if (byClick) { const s0 = slots.reduce((b, q) => (!b || dist(x, y, q.x, q.y) < dist(x, y, b.x, b.y) ? q : b), null); return dist(x, y, s0.x, s0.y) <= K(50) ? s0.o.key : null; }
    if (dist(x, y, w.x, w.y) < K(28)) return null;   // still in the middle: nothing chosen
    const a = Math.atan2(y - w.y, x - w.x);
    return slots.reduce((b, q) => { const d = Math.abs(Math.atan2(Math.sin(a - q.a), Math.cos(a - q.a))); return !b || d < b.d ? { d, key: q.o.key } : b; }, null).key;
  }
  function m2Release(held, x, y) {
    const r = st(), w = r.wheel;
    if (w) {
      r.wheel = null;
      const key = w.sel ?? wheelPick(x, y, false);
      if (key) { r.pick = key; summon(key, w.x, w.y); }
      return;
    }
    if (held < WHEEL_HOLD + 0.05) summon(r.pick, x, y);
  }
  // a click while the wheel is open picks from it (true = it took the click)
  function onPointerDown(x, y) {
    const r = st();
    if (!r.wheel) return false;
    const key = wheelPick(x, y, true);
    if (key) { r.wheel.sel = key; const w = r.wheel; r.wheel = null; r.pick = key; summon(key, w.x, w.y); }
    return true;
  }

  // ── M1: HEX ──────────────────────────────────────────────────────────────
  function hex(e, dur) {
    if (!alive(e)) return;
    const fresh = !(e.reefHex > s.time);
    e.reefHex = Math.max(e.reefHex ?? 0, s.time + dur);
    if (fresh) e.reefHexTick = 0.5;
  }
  function onClick(e) {
    const sk = skill();
    if (!sk || !alive(e)) return;
    hex(e, sk.hexDur);
    if (legion()) e.reefMark = s.time + 3;   // the army's mark
  }

  // ── M1 released: the end of a command, or a Blood Sigil ──────────────────
  function release(held, x, y, press0) {
    const sk = skill(), r = st();
    r.command = r.cmdHold ? r.command : r.command;   // (the summons keep at it until it dies)
    r.cmdHold = false;
    const d = press0?.reef;
    if (!sk || !d?.drag) return;
    // the line you drew (if it never closed) stays as a sigil
    // (the last sigilLen of what you drew)
    const pts = d.pts.filter(q => d.L - (q.c ?? 0) <= K(sk.sigilLen));
    let L = 0; for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    if (pts.length >= 3 && L >= K(60)) { r.sigils.push({ id: nextId(), pts: pts.slice(), t: 0, life: sk.sigilDur }); if (r.sigils.length > 4) r.sigils.shift(); sfx('tick'); }
  }
  // the drawn loop closed: a pentagram, fitted to it
  function pentagram(pts) {
    const sk = skill(), r = st();
    const cx = pts.reduce((a, q) => a + q.x, 0) / pts.length, cy = pts.reduce((a, q) => a + q.y, 0) / pts.length;
    const R = Math.max(K(sk.pentMin), Math.min(K(sk.pentMax), pts.reduce((a, q) => a + dist(q.x, q.y, cx, cy), 0) / pts.length));
    r.pcd = r.pcdMax = sk.pentCd;
    const pg = { id: nextId(), x: cx, y: cy, R, t: 0, life: sk.pentDur, tick: 0.5, a: rand(0, Math.PI * 2) };
    r.pents.push(pg);
    let n = 0;
    api.asYou(() => foes().filter(e => inPoly(e.x, e.y, pts) || dist(e.x, e.y, cx, cy) <= R * 0.9).forEach(e => { kitHit(e, sk.pentPct, { color: MAG, label: '⛤', quiet: n++ >= 3 }); hex(e, sk.hexDur); }));
    effect({ kind: 'pentaburst', x: cx, y: cy, r: R, life: 0.55, a: pg.a });
    shake(0.3); sfx('boom');
    if (n >= 3) api.announce(`PENTAGRAM ×${n}`, MAG);
  }
  const inPoly = (x, y, pts) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y || 1e-6) + a.x) c = !c;
    }
    return c;
  };

  // ── Q: SÉANCE ────────────────────────────────────────────────────────────
  function seance(x, y) {
    const sk = skill(), r = st();
    if (!sk || !fighting() || s.mahoraga) return false;
    if (r.qcd > 0) { floater(`${Math.ceil(r.qcd)}s`, x, y - K(30), VIOLET); return false; }
    r.qcd = r.qcdMax = sk.cooldown;
    r.seance = { x, y, t: 0, life: sk.seanceDur };
    const R = K(sk.seanceR), p = P();
    let n = 0;
    api.asYou(() => foes().filter(e => dist(e.x, e.y, x, y) <= R + radius(e) * 0.5).forEach(e => {
      kitHit(e, sk.seancePct, { color: VIOLET, label: '🕯', quiet: n++ >= 3 });
      effect({ kind: 'ghost', x1: e.x, y1: e.y, x2: p.x, y2: p.y, life: 0.5 + rand(0, 0.25), pale: true });
    }));
    shake(0.25); sfx('shield');
    api.announce(n ? `SÉANCE ×${n}` : 'SÉANCE', VIOLET);
    return true;
  }

  // ── ult: LEGION ──────────────────────────────────────────────────────────
  function ult(u) {
    const r = st(), p = P();
    r.cutin = { t: 0, life: CUTIN };
    s.ult.active = { type: 'legion', t: u.dur + CUTIN, dur: u.dur + CUTIN };
    // every soul comes up (they aren't spent), in rings around you
    const list = r.souls.flatMap(o => Array.from({ length: o.n }, () => o)).sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier]);
    r.minions.forEach(m => { m.big = true; });
    list.slice(0, Math.max(0, ARMY_CAP - r.minions.length)).forEach((o, i) => {
      const ring = Math.floor(i / 8), a = (i % 8) / 8 * Math.PI * 2 + ring * 0.4, d = K(90 + ring * 70);
      raise(o, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, true);
    });
    effect({ kind: 'flash', color: '#4a044e', life: 0.6 });
    shake(0.5); sfx('boom');
  }
  function endUlt(act) {
    if (act.type !== 'legion') return;
    const r = st(), u = U(), army = r.minions.length, souls = soulsTotal(r);
    // the army collapses into a pentagram over the whole arena
    r.minions.forEach(m => effect({ kind: 'crumble', x: m.x, y: m.y, r: K(m.size * 0.7), life: 0.5 }));
    r.minions = [];
    const pct = (u.finale ?? 10) + (u.finaleSoul ?? 0.6) * souls + (u.finaleArmy ?? 0.4) * army;
    let n = 0;
    [...foes()].forEach(e => ultHit(e, pct, MAG, n++ < 3 ? '⛧ ' : ''));
    effect({ kind: 'pentaburst', x: s.W / 2, y: s.H / 2, r: Math.max(s.W, s.H) * 0.48, life: 1.1, a: -Math.PI / 2, huge: true });
    effect({ kind: 'flash', color: '#f5d0fe', life: 0.5 });
    s.player.hp = s.player.maxHp;
    floater('HEALED IN FULL', P().x, P().y - K(40), SICK, true);
    shake(0.8); sfx('boom');
    api.announce(`LEGION · ${army} RISEN`, MAG);
  }
  const cheatDeath = () => skill()?.type === 'necro' && legion();   // nothing takes him below 1 HP while it lasts

  // ── every frame ──────────────────────────────────────────────────────────
  function update(dt, live) {
    const sk = skill(), r = st(), pl = s.player, p = pl.pos, u = U();
    r.floats = 0;
    if (r.cutin) { r.cutin.t += dt; if (r.cutin.t >= r.cutin.life) r.cutin = null; }
    r.pcd = Math.max(0, r.pcd - dt);
    r.qcd = Math.max(0, r.qcd - dt);
    // lifesteal's budget fills a little every second
    if (sk) { const cap = sk.lsCap * pl.maxHp * (legion() ? u.ls ?? 3 : 1); r.lsBudget = Math.min(cap, r.lsBudget + cap * dt); }
    if (!sk || sk.type !== 'necro') return;
    const going = live && s.timeStop <= 0;
    // hold M2: the wheel
    const m2 = pl.m2;
    if (m2 && !m2.viaM1 && !r.wheel && !m2.reefDone && p && fighting() && s.time - m2.t0 >= WHEEL_HOLD) {
      m2.reefDone = true;
      if (r.souls.length) r.wheel = { x: p.x, y: p.y, t: 0, sel: null };
      else label('no souls yet', p.x, p.y - K(30), MAG);
    }
    if (r.wheel) { r.wheel.t += dt; if (!m2) r.wheel = null; }
    // hold M1: COMMAND (still) or draw (moving)
    const held = pl.held;
    if (held && p && live && !s.mahoraga) {
      const d0 = held.reef ?? (held.reef = { drag: false, pts: [{ x: held.x ?? p.x, y: held.y ?? p.y, c: 0 }], L: 0 });
      if (!d0.drag && dist(p.x, p.y, held.x ?? p.x, held.y ?? p.y) > K(DRAG_START)) { d0.drag = true; r.cmdHold = false; }
      if (d0.drag) {
        const last = d0.pts[d0.pts.length - 1], d = dist(last.x, last.y, p.x, p.y);
        if (d >= K(8)) {
          d0.L += d; d0.pts.push({ x: p.x, y: p.y, c: d0.L });
          if (d0.pts.length > 400) d0.pts.shift();
          // the cursor came back across what it drew earlier (far enough back along the path): a loop
          let at = -1;
          for (let i = 0; i < d0.pts.length && d0.L - (d0.pts[i].c ?? 0) > K(220); i++) if (dist(p.x, p.y, d0.pts[i].x, d0.pts[i].y) < K(40)) { at = i; break; }
          if (at >= 0) {
            const loop = d0.pts.slice(at), xs = loop.map(q => q.x), ys = loop.map(q => q.y);
            const span = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
            if (span > K(70)) {
              if (r.pcd > 0) { if (!d0.warned) { label(`⛤ ${r.pcd.toFixed(1)}s`, p.x, p.y - K(30), '#a8a29e'); d0.warned = true; } }
              else { pentagram(loop); d0.pts = [{ x: p.x, y: p.y, c: 0 }]; d0.L = 0; d0.warned = false; }
            }
          }
        }
      } else if (s.time - held.t0 >= HOLD_CMD) {
        // COMMAND: the enemy under the cursor (kept while it lives and stays near)
        let t = r.command != null ? s.enemies.find(e => e.id === r.command) : null;
        if (!alive(t) || !r.cmdHold || dist(t.x, t.y, p.x, p.y) > radius(t) + K(120)) {
          const c = nearestTo(p.x, p.y, foes());
          t = c && dist(c.x, c.y, p.x, p.y) <= radius(c) + K(40) ? c : (r.cmdHold ? null : t);
          if (t && t.id !== r.command) { label('🩸 ALL ON IT', t.x, t.y - K(40), BLOOD, true); sfx('tick'); }
          r.command = t?.id ?? r.command;
        }
        r.cmdHold = !!t;
        if (t && going) {
          r.drainT = (r.drainT ?? 0) - dt;
          if (r.drainT <= 0) { r.drainT = 0.25; api.asYou(() => kitHit(t, sk.drainPct * 0.25, { color: BLOOD, label: '🩸', quiet: (r.drainN = (r.drainN ?? 0) + 1) % 4 !== 0, charge: 0.5 })); effect({ kind: 'drain', x1: t.x, y1: t.y, x2: p.x, y2: p.y, life: 0.25 }); }
        }
      }
    } else r.cmdHold = false;
    if (r.command != null && !alive(s.enemies.find(e => e.id === r.command))) r.command = null;
    // hexes eat away
    r.hexT -= dt;
    if (going && r.hexT <= 0) {
      r.hexT = 0.5;
      let n = 0;
      api.asYou(() => foes().forEach(e => { if (e.reefHex > s.time) kitHit(e, sk.hexPct * 0.5, { color: VIOLET, label: '☽', quiet: n++ >= 1 || r.floats > 2, charge: 0.3 }); }));
    }
    // sigils: whatever crosses one is hexed
    r.sigils.forEach(g => { g.t += dt; });
    r.sigils = r.sigils.filter(g => g.t < g.life);
    if (going) for (const g of r.sigils) for (const e of foes()) {
      if (e.reefHex > s.time + sk.hexDur * 0.5) continue;
      for (let i = 1; i < g.pts.length; i++) if (distToSegment(e.x, e.y, g.pts[i - 1].x, g.pts[i - 1].y, g.pts[i].x, g.pts[i].y) <= K(14) + radius(e) * 0.6) { hex(e, sk.hexDur); break; }
    }
    // pentagrams keep pulsing
    for (const pg of r.pents) {
      pg.t += dt;
      if (!going) continue;
      pg.tick -= dt;
      if (pg.tick <= 0 && pg.t < pg.life) {
        pg.tick = 0.5;
        let n = 0;
        api.asYou(() => foes().filter(e => dist(e.x, e.y, pg.x, pg.y) <= pg.R + radius(e) * 0.3).forEach(e => kitHit(e, sk.pentTick, { color: MAG, label: '⛤', quiet: n++ >= 1, charge: 0.5 })));
      }
    }
    r.pents = r.pents.filter(pg => pg.t < pg.life + 0.3);
    // the séance
    if (r.seance) { r.seance.t += dt; if (r.seance.t >= r.seance.life) r.seance = null; }
    // the summons: go for the commanded one (or the nearest), strike, take hits back
    const L = legion(), cmd = r.command != null ? s.enemies.find(e => e.id === r.command) : null, list = going ? foes() : [];
    for (const m of r.minions) {
      m.t += dt;
      if (!going) continue;
      if (!L) m.life -= dt;
      const sc = m.big ? (u.bigMult ?? 2) : 1, mr = K(m.size) * 0.5 * (m.big ? 1.35 : 1);
      let t = alive(cmd) ? cmd : (m.target != null ? s.enemies.find(e => e.id === m.target) : null);
      if (!alive(t) || (!alive(cmd) && m.t % 1 < dt)) t = nearestTo(m.x, m.y, list);
      m.target = t?.id ?? null;
      if (!t) { m.x += Math.sin(m.t * 1.3 + m.id) * K(20) * dt; continue; }
      const dx = t.x - m.x, dy = t.y - m.y, d = Math.hypot(dx, dy) || 1, reach = radius(t) + mr * 0.7;
      if (Math.abs(dx) > 2) m.face = dx > 0 ? 1 : -1;
      if (d > reach) { const v = Math.min(d - reach, K(m.tier === 'boss' ? 160 : 240) * dt); m.x += dx / d * v; m.y += dy / d * v; }
      m.cd -= dt;
      if (d <= reach + K(6) && m.cd <= 0) {
        m.cd = sk.atkRate * rand(0.85, 1.15); m.hitT = s.time;
        const bonus = t.reefMark > s.time ? 1 + (u.markBonus ?? 0.25) : 1;
        api.asYou(() => {
          if (m.tier === 'boss') {
            let n = 0;
            list.filter(e => dist(e.x, e.y, t.x, t.y) <= K(90) + radius(e) * 0.5).forEach(e => kitHit(e, m.pct * sc * bonus, { color: BONE, label: '💀', quiet: n++ >= 1 || r.floats++ >= 2, charge: 0.5 }));
          } else kitHit(t, m.pct * sc * bonus, { color: BONE, label: '💀', quiet: r.floats++ >= 2, charge: 0.5 });
        });
        effect({ kind: 'claw', x: t.x, y: t.y, r: radius(t) * 0.8, life: 0.2, a: Math.atan2(dy, dx) });
      }
      // what it's fighting hits back (not while Legion holds them up)
      if (!L) {
        m.bite -= dt;
        if (m.bite <= 0) {
          m.bite = 1;
          const touching = list.filter(e => dist(e.x, e.y, m.x, m.y) <= radius(e) + mr + K(8)).slice(0, 3);
          const dmg = touching.reduce((a, e) => a + pl.maxHp * (e.tier === 'boss' ? 0.12 : e.tier === 'elite' ? 0.06 : 0.03), 0);
          if (dmg > 0) { m.hp -= dmg; m.hurtT = s.time; }
        }
      }
    }
    // the dead stay dead
    r.minions = r.minions.filter(m => {
      if (m.hp > 0 && m.life > 0) return true;
      effect({ kind: 'crumble', x: m.x, y: m.y, r: K(m.size * 0.6), life: 0.5 });
      return false;
    });
  }

  // ── for the HUD ──────────────────────────────────────────────────────────
  const m2Info = () => { const r = st(); const pick = r.souls.find(x => x.key === r.pick) ?? r.souls[0]; return { kind: 'cd', cd: 0, cdMax: 1, color: MAG, text: 'M2', btn: pick ? `💀 ${pick.n}` : 'SUMMON', hint: 'Summon: tap M2 · hold M2: the soul wheel' }; };
  const qInfo = () => { const r = st(), sk = skill(); return { kind: 'cd', cd: r.qcd, cdMax: r.qcdMax || sk?.cooldown || 14, color: VIOLET, text: 'Q', hint: 'Séance: Q (phone: the SKILL button)' }; };
  const active = () => { const r = s.kit.reef; return !!(r && (r.minions.length || r.pents.length || r.sigils.length || r.seance || r.cutin || r.wheel || r.pcd > 0 || r.qcd > 0)); };
  function reset(why) {
    const r = st();
    r.minions = []; r.command = null; r.cmdHold = false; r.pents = []; r.sigils = []; r.pcd = 0; r.seance = null; r.qcd = 0; r.wheel = null; r.cutin = null;
    if (why === 'defeat') { r.souls = []; r.pick = null; }   // (souls carry over from stage to stage, until you fall)
  }

  return { onDamage, onKill, press, m2Release, onPointerDown, onClick, release, seance, ult, endUlt, cheatDeath, update, m2Info, qInfo, active, reset, wheelSlots, summon, addSoul };
}
