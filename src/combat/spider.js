// ── DADDY HAIRY LEGS ────────────────────────────────────────────────────────
// A big, fast spider. No shield: the whole fight is dodging him.
//   · between attacks he stalks your cursor, darting from spot to spot around it (fast)
//   · his eight legs have HP (the knee is the spot to hit): each one you break makes him attack
//     less often and move slower (they don't grow back)
//   · STAB: a flurry: his front legs take turns rearing up and stabbing where you are
//   · SPIT: web globs: where they land a WEB PATCH slows your cursor down
//   · TRAPS: small WEB TRAPS around you: touch one and your cursor is stuck (click 3× to escape)
//   · LUNGE: he charges straight through you
//   · EGGS: egg sacs along the edges: click anywhere near one and it hatches spiderlings, which
//     don't hurt you but spit webs that drag your cursor back to them
//   · MAIM: a long wind-up (the red ring follows you, then locks): if you're still in it when
//     his hands close, they catch you, drag you to his jaw and he chews (fatal: shake free!)
//   · at half HP he turns VENOMOUS: his stabs, charge and bites poison you, and some spit is venom
// In the stages before his, he ambushes you from the side of the screen (a stab or a spit) and
// runs off again. Drawn by SpiderRig.jsx; his legs walk in spiderKin.js.
import { makeSpiderRig, poseSpider, legReach, handReach, spiderAt, JAW_AT } from './spiderKin';

export const SPIDER = {
  speed: 1.35,                                  // × arena width per second, flat out
  cd: [0.45, 0.85], cdMad: [0.3, 0.6],          // seconds between attacks (frantic)
  stab: { r: 50, tele: 0.44, reps: [3, 5], repsMad: [4, 6] },   // a flurry: several stabs in a row, legs taking turns
  spit: { wind: 0.4, r: 80, life: 8, spread: 150 },
  traps: { n: 3, r: 30, life: 10, ring: [95, 175] },
  lunge: { tele: 0.72, width: 92 },
  maim: { every: [13, 16], everyMad: [10, 12.5], wind: 2.15, lockAt: 1.3, r: 108, track: 230, bites: [0.55, 1.15, 1.75], chew: 2.05, bite: 0.34, need: 1500 },
  eggs: { every: [14, 18], n: 2, max: 4, r: 24, hatchR: 105, adds: 3, maxAdds: 7 },
  slow: 0.3,                                    // your cursor's speed in a web patch
  trapClicks: 3,
  legHurt: { cd: 0.16, speed: 0.07 },           // per broken leg: attacks this much slower, moves this much slower
  web: { hold: 1.3, need: 460, pull: 270 },     // a spiderling's web catching you
  ambush: { first: [5, 8], every: [13, 20] },
  poison: 'poison',
};

export function createSpider(c) {
  const { s, K, rand, dist, clamp, floater, effect, shake, sfx, nextId, spawnEnemy, queueAttack,
    hitPlayer, aimPoint, announce, addDebuff, capture, restScale } = c;
  const SP = SPIDER;
  // his size: the whole spider (legs spread) about the arena's size
  const scale = () => Math.min(s.W * 0.92 / 2800, s.H * 0.64 / 2150);
  const bounds = r => ({ x0: s.W * 0.2, x1: s.W * 0.8, y0: s.H * 0.4 + r.rear * 140 * r.sc, y1: s.H * 0.62 });
  const legOf = (b, e) => b.sp.rig.legs[e.leg];

  // ── the boss ─────────────────────────────────────────────────────────────
  function spawn(typeId) {
    const b = spawnEnemy(typeId, { pos: { x: s.W / 2, y: -s.H } });
    const sc = scale();
    const rig = makeSpiderRig(s.W * 0.5, -900 * sc, sc, { curl: 1 });
    b.sp = { rig, mode: 'enter', t: 0, target: null, wait: null, atk: null, cd: 1.6, maimT: rand(...SP.maim.every) * 0.65, eggT: 7, broken: 0, mad: false, home: { x: s.W * 0.5, y: s.H * 0.5 } };
    b.hidden = true; b.legs = [];
    rig.legs.forEach((leg, i) => {
      const e = spawnEnemy('spiderLeg', { pos: { x: s.W / 2, y: -s.H } });
      e.role = 'leg'; e.owner = b.id; e.leg = i; e.hidden = true;
      b.legs.push(e.id);
    });
    sfx('hiss'); shake(0.3);
    return b;
  }

  function steer(r, target, dt, speedMult = 1) {
    const t = target ?? { x: r.x, y: r.y };
    const dx = t.x - r.x, dy = t.y - r.y, d = Math.hypot(dx, dy);
    const vmax = SP.speed * s.W * speedMult, v = Math.min(vmax, d * 7);
    const wx = d > 0.5 ? dx / d * v : 0, wy = d > 0.5 ? dy / d * v : 0;
    const f = Math.min(1, dt * 11);
    r.vx += (wx - r.vx) * f; r.vy += (wy - r.vy) * f;
    r.x += r.vx * dt; r.y += r.vy * dt;
    return d;
  }
  const clampTo = (r, p) => { const B = bounds(r); return { x: clamp(p.x, B.x0, B.x1), y: clamp(p.y, B.y0, B.y1) }; };
  // between attacks he stalks you: darting to spots around your cursor, never far from it
  function stalkSpot(r) {
    const P = aimPoint(), a = rand(0, Math.PI * 2), d = rand(0.12, 0.3) * s.W;
    return clampTo(r, { x: P.x + Math.cos(a) * d, y: P.y - Math.abs(Math.sin(a)) * d - s.H * 0.15 });
  }

  function update(dt) {
    for (const b of s.enemies) if (b.type.kind === 'spider') updateBoss(b, dt);
    for (const e of s.enemies) if (e.type.kind === 'spiderling' && e.rig) placeAdd(e);
    updateAmbush(dt);
    updateGround(dt);
    if (s.spiderFall) {
      const f = s.spiderFall; f.t += dt;
      f.rig.curl = Math.min(1, f.t / 0.5); f.rig.y += dt * s.H * 0.25 * Math.min(1, f.t); f.rig.vx = f.rig.vy = 0;
      poseSpider(f.rig, dt);
      if (f.t > 2.4) s.spiderFall = null;
    }
  }

  function updateBoss(b, dt) {
    const sp = b.sp, r = sp.rig;
    r.sc = scale();
    if (sp.mode === 'enter') {
      // drops in from the top on a line of silk, then unfolds his legs
      sp.t += dt;
      const u = Math.min(1, sp.t / 1.5), e = 1 - Math.pow(1 - u, 3);
      r.x = sp.home.x; r.y = -900 * r.sc + (sp.home.y + 900 * r.sc) * e; r.vx = 0; r.vy = 0;
      r.curl = clamp(1 - (sp.t - 1.2) / 0.45, 0, 1);
      if (sp.t > 1.7) {
        sp.mode = 'fight'; b.hidden = false; r.curl = 0;
        for (const id of b.legs) { const l = s.enemies.find(x => x.id === id); if (l && !(l.down > 0)) l.hidden = false; }
        announce('DADDY HAIRY LEGS', '#c084fc'); shake(0.5); sfx('roar');
      }
    } else {
      // half HP: venomous
      if (!sp.mad && b.hp < b.maxHp * 0.5) {
        sp.mad = true; shake(0.8); sfx('roar');
        effect({ kind: 'flash', color: '#84cc16', life: 0.5 });
        announce('HE TURNS VENOMOUS', '#a3e635');
      }
      const slowBy = 1 - SP.legHurt.speed * sp.broken;
      if (s.phase === 'boss' && !b.frozen) {
        if (sp.atk) runAttack(b, dt);
        else {
          sp.cd -= dt; sp.maimT -= dt; sp.eggT -= dt;
          if (!sp.target) sp.target = stalkSpot(r);
          if (Math.hypot(sp.target.x - r.x, sp.target.y - r.y) < K(12)) {
            sp.wait = (sp.wait ?? rand(0.08, 0.3)) - dt;
            if (sp.wait <= 0) { sp.target = stalkSpot(r); sp.wait = null; }
          }
          if (sp.cd <= 0) startAttack(b);
        }
      }
      const boost = sp.atk?.dash ? 3.2 : 1;
      steer(r, sp.atk?.hold ? { x: r.x, y: r.y } : sp.target, dt, slowBy * boost);
      r.rear += ((sp.atk?.rear ?? 0) - r.rear) * Math.min(1, dt * 6);
      r.jaw += ((sp.atk?.jaw ?? 0) - r.jaw) * Math.min(1, dt * 12);
    }
    r.stepDur = 0.12 / Math.max(0.5, 1 - SP.legHurt.speed * sp.broken);
    poseSpider(r, dt);
    // hitboxes: his head and body; each leg's knee
    b.x = r.x; b.y = r.y + (-220 + r.bob - r.rear * 140) * r.sc; b.size = 600 * r.sc / 0.55 / s.k;
    for (const id of b.legs) {
      const e = s.enemies.find(x => x.id === id);
      if (!e) continue;
      const leg = r.legs[e.leg];
      if (leg.knee) { e.x = leg.knee.x; e.y = leg.knee.y; }
      e.size = 125 * r.sc / 0.55 / s.k;
      leg.hurt = e.hurt > 0;
    }
  }

  // ── attacks ──────────────────────────────────────────────────────────────
  function nextCd(b) {
    const sp = b.sp;
    return rand(...(sp.mad ? SP.cdMad : SP.cd)) * (1 + SP.legHurt.cd * sp.broken) * restScale();
  }
  function endAttack(b) {
    const sp = b.sp;
    if (sp.atk?.leg) sp.atk.leg.reach = null;
    for (const l of sp.rig.legs) if (!l.broken) l.reach = null;
    sp.atk = null; sp.cd = nextCd(b); sp.target = null;
  }
  function startAttack(b) {
    const sp = b.sp, alive = sp.rig.legs.filter(l => !l.broken);
    const opts = [['stab', alive.length ? 6 : 0], ['spit', 1.4], ['traps', 1], ['lunge', 2.5]];
    if (sp.maimT <= 0 && sp.rig.legs.filter(l => l.idx === 0 && !l.broken).length) opts.push(['maim', 7]);
    if (sp.eggT <= 0 && s.eggs.length < SP.eggs.max) opts.push(['eggs', 4]);
    let tot = opts.reduce((a, o) => a + o[1], 0), x = Math.random() * tot, kind = 'spit';
    for (const [k, w] of opts) { if ((x -= w) <= 0) { kind = k; break; } }
    const [r0, r1] = sp.mad ? SP.stab.repsMad : SP.stab.reps;
    sp.atk = { kind, t: 0, phase: 'start', reps: kind === 'stab' ? Math.floor(rand(r0, r1 + 1)) : 1 };
  }
  const T0 = () => c.target();

  function runAttack(b, dt) {
    const sp = b.sp, r = sp.rig, A = sp.atk, P = aimPoint();
    A.t += dt;
    const k = A.kind;
    if (k === 'stab') {
      if (A.phase === 'start') {
        const legs = r.legs.filter(l => !l.broken);
        if (!legs.length) { endAttack(b); return; }
        const front = legs.filter(l => l.idx <= 1 && l !== A.last);
        const pool = front.length ? front : legs;
        A.leg = pool.reduce((a, l) => (dist(l.hip.x, l.hip.y, P.x, P.y) < dist(a.hip.x, a.hip.y, P.x, P.y) ? l : a), pool[0]);
        A.phase = 'approach'; A.t = 0;
      }
      const leg = A.leg;
      if (leg.broken) { endAttack(b); return; }
      const reach = legReach(r, leg);
      if (A.phase === 'approach') {
        const d = dist(leg.hip.x, leg.hip.y, P.x, P.y);
        if (d > reach * 0.78 && A.t < 0.45) sp.target = clampTo(r, { x: P.x - (leg.hip.x - r.x) - leg.side * reach * 0.4, y: P.y - (leg.hip.y - r.y) - reach * 0.3 });
        else {
          A.phase = 'tele'; A.t = 0; A.hold = true;
          A.a = queueAttack(b, 'circle', { center: { x: P.x, y: P.y }, r: K(SP.stab.r), dmgKey: 'spiderStab', teleMult: SP.stab.tele, debuff: sp.mad ? SP.poison : null });
          leg.reach = { x: leg.hip.x + leg.side * reach * 0.25, y: leg.hip.y - reach * 0.65 }; leg.rate = 9;
          A.rear = 0.25;
        }
      } else if (A.phase === 'tele') {
        const a = A.a;
        leg.reach = { x: leg.hip.x + leg.side * reach * 0.25, y: leg.hip.y - reach * 0.65 };
        if (a.phase === 'strike' || a.phase === 'done') {
          // the stab: the fingertips land on the spot
          const tip = handReach(r, leg), hx = leg.hdir[0], hy = leg.hdir[1];
          leg.reach = { x: (a.cx ?? P.x) - hx * tip, y: (a.cy ?? P.y) - hy * tip }; leg.rate = 45;
          sfx('leap'); shake(0.15);
          A.phase = 'stab'; A.t = 0;
        }
      } else if (A.phase === 'stab' && A.t > 0.16) {
        leg.reach = null; A.last = leg;
        if (--A.reps > 0) { A.phase = 'start'; A.rear = 0; } else { A.hold = false; endAttack(b); }
      }
    } else if (k === 'spit' || k === 'traps') {
      A.hold = true; A.jaw = 1; A.rear = 0.15;
      if (A.phase === 'start' && A.t >= SP.spit.wind) {
        const o = spiderAt(r, JAW_AT);
        if (k === 'spit') {
          const n = sp.mad ? 3 : 2;
          for (let i = 0; i < n; i++) {
            const at = i === 0 ? { x: P.x, y: P.y } : { x: P.x + rand(-1, 1) * K(SP.spit.spread), y: P.y + rand(-1, 1) * K(SP.spit.spread) };
            s.globs.push({ id: nextId(), x0: o.x, y0: o.y, x: at.x, y: at.y, t: -i * 0.15, dur: 0.7, r: K(SP.spit.r), life: SP.spit.life, web: true, venom: sp.mad && i === n - 1 });
          }
        } else {
          const a0 = rand(0, Math.PI * 2);
          for (let i = 0; i < SP.traps.n; i++) {
            const a = a0 + i * Math.PI * 2 / SP.traps.n + rand(-0.3, 0.3), d = K(rand(...SP.traps.ring));
            const at = { x: clamp(P.x + Math.cos(a) * d, K(20), s.W - K(20)), y: clamp(P.y + Math.sin(a) * d, K(20), s.H - K(20)) };
            s.globs.push({ id: nextId(), x0: o.x, y0: o.y, x: at.x, y: at.y, t: -i * 0.1, dur: 0.6, r: K(SP.traps.r), life: SP.traps.life, web: true, trap: true });
          }
        }
        sfx('hiss'); A.phase = 'after'; A.t = 0;
      } else if (A.phase === 'after' && A.t > 0.45) { A.hold = false; endAttack(b); }
    } else if (k === 'lunge') {
      if (A.phase === 'start') {
        const ang = Math.atan2(P.y - r.y, P.x - r.x);
        A.a = queueAttack(b, 'slash', { at: { x: P.x, y: P.y }, angle: ang, width: SP.lunge.width, dmgKey: 'spiderLunge', teleMult: SP.lunge.tele, debuff: sp.mad ? SP.poison : null });
        A.ang = ang; A.phase = 'tele'; A.hold = true; A.rear = -0.15; A.jaw = 0.5;
      } else if (A.phase === 'tele' && (A.a.phase === 'strike' || A.a.phase === 'done')) {
        // he charges along the line, through where you were
        const dd = Math.hypot(P.x - r.x, P.y - r.y) + s.W * 0.25;
        sp.target = clampTo(r, { x: r.x + Math.cos(A.ang) * dd, y: r.y + Math.sin(A.ang) * dd });
        A.phase = 'dash'; A.t = 0; A.hold = false; A.dash = true; sfx('leap'); shake(0.3);
      } else if (A.phase === 'dash' && A.t > 0.45) { A.dash = false; endAttack(b); }
    } else if (k === 'eggs') {
      A.hold = true; A.rear = -0.2;
      if (A.phase === 'start' && A.t > 0.35) {
        const o = spiderAt(r, [-80, -900]);
        for (let i = 0; i < SP.eggs.n; i++) {
          const m = K(46), side = Math.floor(rand(0, 4));
          const at = side === 0 ? { x: m, y: rand(s.H * 0.2, s.H * 0.85) } : side === 1 ? { x: s.W - m, y: rand(s.H * 0.2, s.H * 0.85) }
            : side === 2 ? { x: rand(s.W * 0.15, s.W * 0.85), y: s.H - m } : { x: rand(s.W * 0.15, s.W * 0.85), y: s.H * 0.16 };
          s.globs.push({ id: nextId(), x0: o.x, y0: o.y, x: at.x, y: at.y, t: -i * 0.2, dur: 0.9, egg: true, r: K(SP.eggs.r) });
        }
        sfx('splash'); A.phase = 'after'; A.t = 0;
        sp.eggT = rand(...SP.eggs.every);
      } else if (A.phase === 'after' && A.t > 0.5) { A.hold = false; endAttack(b); }
    } else if (k === 'maim') runMaim(b, dt);
  }

  // MAIM: rears up, hands high and wide, the ring follows you … then locks, and they close
  function runMaim(b, dt) {
    const sp = b.sp, r = sp.rig, A = sp.atk, P = aimPoint();
    const fronts = r.legs.filter(l => l.idx === 0 && !l.broken);
    if (A.phase === 'start') {
      A.phase = 'approach'; A.t = 0;
      const jaw = JAW_AT[1] * r.sc;
      sp.target = clampTo(r, { x: P.x, y: P.y - jaw - K(130) });
    }
    if (A.phase === 'approach') {
      if (A.t > 0.55 || Math.hypot(sp.target.x - r.x, sp.target.y - r.y) < K(20)) {
        A.phase = 'wind'; A.t = 0; A.hold = true; A.rear = 1; A.jaw = 0.6;
        s.spiderMaim = { x: P.x, y: P.y, r: K(SP.maim.r), t: 0, dur: SP.maim.wind, lockAt: SP.maim.lockAt, owner: b.id };
        sfx('charge'); floater('MAIM!', P.x, P.y - K(130), '#f87171', true);
      }
    } else if (A.phase === 'wind') {
      const m = s.spiderMaim;
      if (!m) { endAttack(b); return; }
      m.t += dt;
      if (m.t < m.lockAt) {
        const dx = P.x - m.x, dy = P.y - m.y, d = Math.hypot(dx, dy) || 1, st = Math.min(d, K(SP.maim.track) * dt);
        m.x += dx / d * st; m.y += dy / d * st;
      }
      for (const l of fronts) { const R = legReach(r, l); l.reach = { x: l.hip.x + l.side * R * 0.6, y: l.hip.y - R * 0.55 }; l.rate = 8; }
      if (m.t >= m.dur) {
        // they close
        for (const l of fronts) { l.reach = { x: m.x + l.side * K(26) - l.hdir[0] * handReach(r, l) * 0.6, y: m.y - l.hdir[1] * handReach(r, l) * 0.6 }; l.rate = 40; }
        shake(0.5); sfx('boom');
        const T = T0();
        s.spiderMaim = null;
        if (T && !s.mahoraga && dist(T.x, T.y, m.x, m.y) <= m.r + T.r && !s.dev.god) {
          s.player.stuck = null;
          capture(b, {
            kind: 'maim', dur: SP.maim.chew, need: K(SP.maim.need), pull: K(900), stopAt: K(8),
            mouth: () => spiderAt(r, [JAW_AT[0], JAW_AT[1] - 60]), bites: [...SP.maim.bites],
            tick: (cc) => {
              if (cc.bites.length && cc.t >= cc.bites[0]) { cc.bites.shift(); bite(b); }
            },
            end: () => {},
          });
          floater('CAUGHT! SHAKE FREE!', P.x, P.y - K(60), '#f87171', true);
          A.phase = 'chew'; A.t = 0;
        } else {
          floater('DODGED', m.x, m.y - K(40), '#a7f3d0', true);
          A.phase = 'recover'; A.t = 0;
        }
      }
    } else if (A.phase === 'chew') {
      const held = s.player.caught?.by === b.id;
      A.jaw = 0.55 + 0.45 * Math.sin(A.t * 16);
      const Pp = s.player.pos;
      if (held && Pp) for (const l of fronts) { l.reach = { x: Pp.x + l.side * K(30) - l.hdir[0] * handReach(r, l) * 0.5, y: Pp.y - l.hdir[1] * handReach(r, l) * 0.5 }; l.rate = 25; }
      if (!held) { A.phase = 'recover'; A.t = 0; }
    } else if (A.phase === 'recover') {
      A.rear = 0; A.jaw = 0;
      for (const l of fronts) l.reach = null;
      if (A.t > 0.6) { A.hold = false; sp.maimT = rand(...(sp.mad ? SP.maim.everyMad : SP.maim.every)); endAttack(b); }
    }
  }
  // a bite while he has you: a third of your HP, whatever your defence
  function bite(b) {
    const pl = s.player, P = pl.pos ?? { x: b.x, y: b.y };
    const raw = pl.maxHp * SP.maim.bite / Math.max(0.05, 1 - s.stats.dmgReduction);
    pl.invuln = 0;
    hitPlayer(raw, 'circle', b);
    pl.invuln = 0;
    if (b.sp.mad) addDebuff(SP.poison);
    effect({ kind: 'burst', x: P.x, y: P.y, r: K(70), color: '#ef4444' });
    effect({ kind: 'shards', x: P.x, y: P.y, r: K(60), color: '#fca5a5', n: 10 });
    shake(0.45); sfx('crit');
  }

  // a leg at 0 HP is broken for good: he attacks less often and moves slower
  function legDown(e) {
    const b = s.enemies.find(x => x.id === e.owner);
    e.hp = 0; e.down = 1e9; e.hidden = true;
    if (!b?.sp) return;
    const leg = legOf(b, e);
    leg.broken = true; leg.reach = null; b.sp.broken++;
    if (b.sp.atk?.leg === leg) endAttack(b);
    effect({ kind: 'shards', x: e.x, y: e.y, r: K(80), color: '#c084fc', n: 14 });
    effect({ kind: 'burst', x: e.x, y: e.y, r: K(70), color: '#a855f7' });
    shake(0.35); sfx('bigKill');
    announce(`LEG BROKEN · ${b.sp.broken}/8 · HE SLOWS DOWN`, '#d8b4fe');
  }

  function died(b) {
    if (b.sp) { b.sp.rig.legs.forEach(l => { l.reach = null; }); s.spiderFall = { rig: b.sp.rig, t: 0 }; }
    s.spiderMaim = null;
  }

  // ── spiderlings: they don't hurt you, they spit webs that drag your cursor back ──
  function spawnAdd(x, y) {
    if (s.enemies.filter(e => e.type.kind === 'spiderling').length >= SP.eggs.maxAdds) return null;
    const e = spawnEnemy('spiderling', { pos: { x, y }, armed: true });
    e.rig = makeSpiderRig(x, y, scale() * 0.2, { stepDur: 0.08 });
    e.cd = rand(1.6, 2.8);
    return e;
  }
  function moveAdd(e, dt) {
    const r = e.rig;
    if (!r) return;
    r.sc = scale() * 0.2;
    if (e.frozen > 0) { r.vx = r.vy = 0; poseSpider(r, 0); return; }
    if (!e.target || Math.hypot(e.target.x - r.x, e.target.y - r.y) < K(10)) e.target = { x: rand(s.W * 0.08, s.W * 0.92), y: rand(s.H * 0.2, s.H * 0.9) };
    const vmax = s.W * 0.32, go = e.busy > 0 ? { x: r.x, y: r.y } : e.target;
    const dx = go.x - r.x, dy = go.y - r.y, d = Math.hypot(dx, dy) || 1, v = Math.min(vmax, d * 6);
    const f = Math.min(1, dt * 9);
    r.vx += ((d > 1 ? dx / d * v : 0) - r.vx) * f; r.vy += ((d > 1 ? dy / d * v : 0) - r.vy) * f;
    r.x += r.vx * dt; r.y += r.vy * dt;
    poseSpider(r, dt);
  }
  function placeAdd(e) {
    const r = e.rig;
    e.x = r.x; e.y = r.y - 150 * r.sc; e.size = 560 * r.sc / 0.55 / s.k;
  }
  // its web shot hit you: it reels you in for a moment
  function webHit(owner) {
    if (!owner) return;
    if (capture(owner, { kind: 'web', dur: SP.web.hold, need: K(SP.web.need), pull: K(SP.web.pull), stopAt: K(50), mouth: h => ({ x: h.x, y: h.y }), end: () => {} })) {
      const P = s.player.pos ?? owner;
      floater('WEBBED! SHAKE FREE', P.x, P.y - K(40), '#e2e8f0', true);
      sfx('tongue');
    }
  }

  // ── the ambush (the stages before his) ───────────────────────────────────
  function updateAmbush(dt) {
    if (!s.stage.spiderNear || s.phase !== 'fight') { s.ambush = null; return; }
    const am = s.ambush;
    if (!am) {
      s.ambushT = (s.ambushT ?? rand(...SP.ambush.first)) - dt;
      if (s.ambushT <= 0) startAmbush();
      return;
    }
    const r = am.rig;
    r.sc = scale();
    am.t += dt;
    const P = aimPoint();
    if (am.mode === 'in') {
      if (steerAmbush(r, am.spot, dt) < K(10) || am.t > 1.6) { am.mode = 'act'; am.t = 0; }
    } else if (am.mode === 'act') {
      if (!am.act) {
        const inner = r.legs.filter(l => l.side === -am.side && l.idx <= 1);
        const leg = inner.reduce((a, l) => (dist(l.hip.x, l.hip.y, P.x, P.y) < dist(a.hip.x, a.hip.y, P.x, P.y) ? l : a), inner[0]);
        if (dist(leg.hip.x, leg.hip.y, P.x, P.y) < legReach(r, leg) * 0.95) {
          am.act = 'stab'; am.leg = leg;
          am.a = queueAttack(null, 'circle', { center: { x: P.x, y: P.y }, r: K(48), dmgKey: 'spiderStab', teleMult: 0.75 });
        } else {
          am.act = 'spit'; r.jaw = 1;
          const o = spiderAt(r, JAW_AT);
          for (let i = 0; i < 2; i++) {
            const at = i === 0 ? { x: P.x, y: P.y } : { x: P.x + rand(-1, 1) * K(120), y: P.y + rand(-1, 1) * K(120) };
            s.globs.push({ id: nextId(), x0: o.x, y0: o.y, x: at.x, y: at.y, t: -0.35 - i * 0.15, dur: 0.7, r: K(SP.spit.r), life: SP.spit.life * 0.8, web: true });
          }
          sfx('hiss');
        }
      }
      if (am.act === 'stab') {
        const leg = am.leg, R = legReach(r, leg), a = am.a;
        if (a.phase === 'wait' || a.phase === 'tele') { leg.reach = { x: leg.hip.x + leg.side * R * 0.2, y: leg.hip.y - R * 0.6 }; leg.rate = 9; }
        else if (!am.struck) {
          const tip = handReach(r, leg);
          leg.reach = { x: a.cx - leg.hdir[0] * tip, y: a.cy - leg.hdir[1] * tip }; leg.rate = 45;
          am.struck = am.t; sfx('leap'); shake(0.15);
        } else if (am.t - am.struck > 0.35) { leg.reach = null; out(am); }
      } else if (am.act === 'spit' && am.t > 0.9) { r.jaw = 0; out(am); }
    } else if (am.mode === 'out') {
      if (steerAmbush(r, am.away, dt, 1.4) < K(30) || am.t > 2) { s.ambush = null; s.ambushT = rand(...SP.ambush.every); }
    }
    poseSpider(r, dt);
  }
  function out(am) { am.mode = 'out'; am.t = 0; sfx('hiss'); }
  function steerAmbush(r, to, dt, mult = 1) {
    const dx = to.x - r.x, dy = to.y - r.y, d = Math.hypot(dx, dy) || 1, v = Math.min(SP.speed * s.W * mult, d * 6);
    const f = Math.min(1, dt * 10);
    r.vx += (dx / d * v - r.vx) * f; r.vy += (dy / d * v - r.vy) * f;
    r.x += r.vx * dt; r.y += r.vy * dt;
    return d;
  }
  function startAmbush() {
    const P = aimPoint(), sc = scale();
    const side = Math.random() < 0.65 ? (P.x < s.W / 2 ? -1 : 1) : (Math.random() < 0.5 ? -1 : 1);
    const y = clamp(P.y + rand(-0.15, 0.1) * s.H, s.H * 0.35, s.H * 0.72);
    const off = side < 0 ? -1700 * sc : s.W + 1700 * sc;
    const rig = makeSpiderRig(off, y, sc);
    s.ambush = { rig, side, mode: 'in', t: 0, spot: { x: side < 0 ? s.W * 0.02 : s.W * 0.98, y }, away: { x: off, y: y + rand(-0.1, 0.1) * s.H } };
    sfx('hiss');
  }

  // ── on the ground: webs (slow your cursor), traps (stick it), eggs (hatch when you click near) ──
  function landed(g) {
    if (g.egg) { s.eggs.push({ id: nextId(), x: g.x, y: g.y, r: g.r, hatchR: K(SP.eggs.hatchR), t: 0 }); return true; }
    if (g.venom) { s.hazards.push({ id: nextId(), x: g.x, y: g.y, r: g.r * 0.8, t: 0, grow: 0.3, life: 6 }); effect({ kind: 'burst', x: g.x, y: g.y, r: g.r, color: '#84cc16' }); return true; }
    if (g.web) {
      s.webs.push({ id: nextId(), x: g.x, y: g.y, r: g.r, t: 0, life: g.life, trap: !!g.trap });
      effect({ kind: 'burst', x: g.x, y: g.y, r: g.r, color: '#e2e8f0' });
      return true;
    }
    return false;
  }
  function updateGround(dt) {
    const pl = s.player;
    s.eggs.forEach(e => { e.t += dt; });
    s.webs.forEach(w => { w.t += dt; });
    s.webs = s.webs.filter(w => w.t < w.life);
    if (pl.stuck && !s.webs.some(w => w.id === pl.stuck.id)) pl.stuck = null;
    pl.slow = 1;
    const P = pl.pos;
    if (!P || pl.caught || s.phase === 'clear' || s.phase === 'defeat') { pl.stuck = null; return; }
    for (const w of s.webs) {
      if (w.t < 0.3 || dist(P.x, P.y, w.x, w.y) > w.r) continue;
      if (w.trap) {
        if (!pl.stuck) {
          pl.stuck = { id: w.id, clicks: 0, need: SP.trapClicks };
          floater(`STUCK! CLICK ×${SP.trapClicks}`, P.x, P.y - K(40), '#fde047', true); sfx('tongue');
        }
      } else pl.slow = SP.slow;
    }
  }
  // a click while stuck in a trap: tearing free (returns true: the click was used up)
  function stuckClick() {
    const pl = s.player, st = pl.stuck;
    if (!st) return false;
    st.clicks++;
    const P = pl.pos ?? { x: 0, y: 0 };
    if (st.clicks >= st.need) {
      s.webs = s.webs.filter(w => w.id !== st.id); pl.stuck = null;
      floater('FREE!', P.x, P.y - K(40), '#a7f3d0', true);
      effect({ kind: 'burst', x: P.x, y: P.y, r: K(40), color: '#f8fafc' });
    } else floater(`${st.need - st.clicks}…`, P.x, P.y - K(34), '#fde047');
    sfx('miss');
    return true;
  }
  // a click near an egg sac hatches it
  function clickNear(x, y) {
    const hatch = s.eggs.filter(e => e.t > 0.4 && dist(x, y, e.x, e.y) <= e.hatchR);
    if (!hatch.length) return;
    s.eggs = s.eggs.filter(e => !hatch.includes(e));
    for (const e of hatch) {
      for (let i = 0; i < SP.eggs.adds; i++) spawnAdd(e.x + rand(-1, 1) * K(30), e.y + rand(-1, 1) * K(30));
      effect({ kind: 'shards', x: e.x, y: e.y, r: K(50), color: '#e7e5e4', n: 10 });
      floater('HATCHED!', e.x, e.y - K(30), '#fca5a5', true);
    }
    sfx('splash');
  }

  return { spawn, update, legDown, died, moveAdd, webHit, landed, stuckClick, clickNear, spawnAdd, scale };
}
