// ─────────────────────────────────────────────────────────────────────────────
// Battle engine — plain JS, no React. BattleArena.jsx calls update(dt) every
// animation frame and draws `engine.state`. Positions are arena pixels; sizes
// are design px × state.k so the same fight works on a phone and a PC.
// ─────────────────────────────────────────────────────────────────────────────
import { BAL, speedHpMult } from './balance';
import { ENEMY_TYPES, ATTACK_DMG } from './enemies';
import { makeEndlessStage } from './stages';

let uid = 1;
const rand  = (a, b) => a + Math.random() * (b - a);
const pick  = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist  = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
  return dist(px, py, x1 + t * dx, y1 + t * dy);
}

export function createBattle({ stageNum = 1, kills = 0, stats, makeStage = makeEndlessStage, callbacks = {} }) {
  const firstStage = makeStage(stageNum);
  const s = {
    W: 0, H: 0, k: 1, time: 0,
    stats,
    stageNum, stage: firstStage,
    phase: 'fight', phaseT: 0, kills: Math.min(kills, firstStage.killTarget),
    banner: { text: `STAGE ${stageNum}`, sub: 'defeat enemies to summon the boss', t: 2 },
    enemies: [], attacks: [], shots: [], effects: [], floaters: [], weakPts: [],
    player: { hp: stats.maxHp, maxHp: stats.maxHp, pos: null, invuln: 0, hitT: 0 },
    ult: { charge: 0, active: null, cd: 0, cdMax: 0 },
    dev: { god: false, timeScale: 1 },   // sandbox menu switches
    timeStop: 0, frenzy: 0, shake: 0,
    clickCount: 0,
    timers: { basic: 0.3, elite: 4, horde: 8, treasure: BAL.TREASURE_EVERY, auto: BAL.AUTO_INTERVAL, pulse: 0, weak: 0.7 },
    floaterVer: 0,
    reserved: null,   // HUD box (status frame) enemies shouldn't stand behind
    bossInfo: null,   // { name, maxHp } for the boss bar
  };

  const cb = (name, ...args) => callbacks.current?.[name]?.(...args);

  // ── Geometry helpers ────────────────────────────────────────────────────
  const K = v => v * s.k;
  // Where enemies may stand: inside the arena, below the stage bar, and
  // (landscape PC layout) away from the status frame in the bottom-left.
  function inSpawnArea(x, y) {
    if (x < s.W * 0.07 || x > s.W * 0.93 || y < s.H * 0.16 || y > s.H * 0.86) return false;
    const r = s.reserved;
    if (r && x > r.x0 - K(30) && x < r.x1 + K(30) && y > r.y0 - K(30) && y < r.y1) return false;
    return true;
  }
  function randomPoint(near = null, radius = 0) {
    for (let i = 0; i < 30; i++) {
      const x = near ? near.x + rand(-radius, radius) : rand(s.W * 0.07, s.W * 0.93);
      const y = near ? near.y + rand(-radius, radius) : rand(s.H * 0.16, s.H * 0.86);
      if (!inSpawnArea(x, y)) continue;
      // don't drop enemies right on top of the player
      if (!near && s.player.pos && dist(x, y, s.player.pos.x, s.player.pos.y) < K(90)) continue;
      return { x, y };
    }
    return { x: s.W * 0.6, y: s.H * 0.45 };
  }
  // Where an attack aims: the player, or somewhere sensible if they haven't moved yet
  const aimPoint = () => s.player.pos ?? { x: s.W * 0.5, y: s.H * 0.5 };

  // ── Floaters & effects ──────────────────────────────────────────────────
  function floater(text, x, y, color = '#fff', big = false, icon = null) {
    s.floaters.push({ id: uid++, text, x, y, color, big, icon, t: 0 });
    if (s.floaters.length > 60) s.floaters.shift();
    s.floaterVer++;   // lets the renderer skip the floater layer when nothing changed
  }
  const effect = (e) => s.effects.push({ id: uid++, t: 0, ...e });

  // ── Spawning ────────────────────────────────────────────────────────────
  function spawnEnemy(typeId, opts = {}) {
    const type = ENEMY_TYPES[typeId];
    const speed = type.speedRange ? rand(...type.speedRange) : (type.speed ?? 0);
    const tierHp = type.tier === 'boss' ? 1 : speedHpMult(speed);
    const hpScale = type.tier === 'treasure' ? Math.sqrt(s.stage.hpScale) : s.stage.hpScale;
    const hp = Math.max(1, Math.round(type.hp * BAL.ENEMY_HP_MULT * hpScale * tierHp));
    const p = opts.pos ?? (type.tier === 'boss' ? { x: s.W * 0.62, y: s.H * 0.42 } : randomPoint());
    const e = {
      id: uid++, typeId, type, tier: type.tier, name: type.name, img: type.img,
      shape: type.shape ?? null, tint: opts.tint ?? type.tint ?? null,
      size: type.size, x: p.x, y: p.y,
      hp, maxHp: hp, speed,
      // linked bosses (worm parts, hydra heads)
      group: opts.group ?? null, role: opts.role ?? null, segIndex: opts.segIndex ?? 0,
      angle: opts.angle ?? Math.PI, wiggle: Math.random() * 6, down: 0,
      shield: type.shield ? { hp: Math.round(hp * type.shield.pct), max: Math.round(hp * type.shield.pct), regenT: 0 } : null,
      // movement: still enemies stay put, others wander between random points
      move: type.kind === 'worm' ? 'worm' : type.horde ? 'swarm' : speed < 0.12 ? 'still' : type.tier === 'treasure' ? 'hop' : 'wander',
      target: null, hopT: 0,
      armed: opts.armed ?? false,
      cd: rand(...(type.cooldown ?? [4, 6])) * (type.tier === 'boss' ? 0.5 : 1),
      busy: 0,          // >0 while it has attacks queued / telegraphing
      flashRed: false,  // body-projectile telegraph
      dashing: null,
      frozen: 0, hurt: 0, life: opts.life ?? null, anchor: opts.anchor ?? null,
      born: s.time,
    };
    s.enemies.push(e);
    return e;
  }

  const countTier = tier => s.enemies.filter(e => e.tier === tier && !e.type.horde).length;

  // Bosses: the Devourer is one enemy; the Worm and Hydra are linked groups
  function spawnBoss(typeId) {
    const t = ENEMY_TYPES[typeId];
    const group = uid++;
    let parts = [];
    if (t.kind === 'worm') {
      const start = { x: s.W * 0.92, y: s.H * 0.3 };
      parts.push(spawnEnemy(typeId, { pos: start, role: 'head', group, segIndex: 0, angle: Math.PI }));
      for (let i = 1; i <= t.segments; i++) {
        parts.push(spawnEnemy(t.segmentType, { pos: { x: start.x + i * K(t.spacing) * 0.6, y: start.y }, role: 'seg', group, segIndex: i }));
      }
      // chain = which worm a part belongs to; killing a middle part splits
      // the chain in two, like Terraria's Eater of Worlds
      const chain = uid++;
      parts.forEach(p => { p.groupType = typeId; p.chain = chain; });
    } else if (t.kind === 'hydra') {
      const cx = s.W * 0.62, cy = s.H * 0.44;
      for (let i = 0; i < t.heads; i++) {
        const off = i - (t.heads - 1) / 2;
        const h = spawnEnemy(typeId, { pos: { x: cx + off * K(130), y: cy + (off === 0 ? -K(45) : K(15)) }, role: 'hydra', group, segIndex: i, tint: t.headTints?.[i] });
        h.cd = 1 + i * 0.9;          // stagger their first attacks
        h.groupType = typeId;
        parts.push(h);
      }
    } else {
      parts.push(spawnEnemy(typeId));
    }
    s.bossInfo = { name: t.name, maxHp: parts.reduce((a, p) => a + p.maxHp, 0), group: parts[0]?.group };
  }

  function spawnHorde() {
    const st = s.stage;
    // burst in from one side of the arena
    const side = Math.random() < 0.5 ? 0.12 : 0.88;
    const center = { x: s.W * side, y: rand(s.H * 0.3, s.H * 0.75) };
    for (let i = 0; i < st.hordeSize; i++) {
      const pos = { x: clamp(center.x + rand(-K(50), K(50)), s.W * 0.05, s.W * 0.95), y: clamp(center.y + rand(-K(60), K(60)), s.H * 0.15, s.H * 0.9) };
      const e = spawnEnemy('swarmling', { pos, armed: Math.random() < st.hordeArmedChance });
      e.swarmOff = { a: rand(0, Math.PI * 2), d: K(rand(70, 130)) };
    }
    floater('⚠ HORDE!', center.x, center.y - K(50), '#ff8c00', true);
  }

  function spawnTreasure() {
    // Spawn it next to something dangerous, so grabbing it is a risk
    const threats = s.enemies.filter(e => e.tier === 'elite' || e.tier === 'boss');
    const anchor = threats.length ? pick(threats) : null;
    const pos = anchor ? randomPoint(anchor, K(150)) : randomPoint();
    spawnEnemy('treasure', { pos, life: BAL.TREASURE_LIFE, anchor: anchor?.id ?? null });
    floater('✨ TREASURE!', pos.x, pos.y - K(40), '#fbbf24', true);
  }

  function updateSpawns(dt) {
    const st = s.stage, T = s.timers;
    if (s.phase === 'fight' || s.phase === 'boss') {
      T.basic -= dt;
      const cap = s.phase === 'boss' ? Math.ceil(st.basicCap / 2) : st.basicCap;
      if (T.basic <= 0) {
        T.basic = st.basicEvery * (s.phase === 'boss' ? 2 : 1);
        if (countTier('basic') < cap) spawnEnemy(pick(st.basics), { armed: Math.random() < st.armedBasicChance });
      }
      T.treasure -= dt;
      if (T.treasure <= 0) {
        T.treasure = BAL.TREASURE_EVERY;
        if (!countTier('treasure') && Math.random() < Math.min(1, BAL.TREASURE_CHANCE * s.stats.treasureMult)) spawnTreasure();
      }
    }
    if (s.phase === 'fight' && st.hordeEvery) {
      T.horde -= dt;
      if (T.horde <= 0) {
        T.horde = st.hordeEvery;
        if (s.enemies.filter(e => e.type.horde).length < 4) spawnHorde();
      }
    }
    if (s.phase === 'fight') {
      T.elite -= dt;
      if (T.elite <= 0) {
        T.elite = st.eliteEvery;
        if (countTier('elite') < st.eliteCap) spawnEnemy(pick(st.elites));
      }
    }
  }

  // ── Movement ────────────────────────────────────────────────────────────
  function moveWorm(e, dt) {
    const t = e.type, P = aimPoint();
    if (e.role === 'head') {
      e.wiggle += dt;
      const headT = ENEMY_TYPES[e.groupType] ?? t;
      // steer toward you, with a wiggle so it swings instead of beelining
      const desired = Math.atan2(P.y - e.y, P.x - e.x) + Math.sin(e.wiggle * 2.2) * 0.7;
      let diff = desired - e.angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      e.angle += clamp(diff, -headT.turnRate * dt, headT.turnRate * dt);
      // turn back in when it gets near the walls
      if (e.x < s.W * 0.05 || e.x > s.W * 0.95 || e.y < s.H * 0.12 || e.y > s.H * 0.95) {
        const back = Math.atan2(s.H / 2 - e.y, s.W / 2 - e.x);
        let d2 = Math.atan2(Math.sin(back - e.angle), Math.cos(back - e.angle));
        e.angle += clamp(d2, -6 * dt, 6 * dt);
      }
      const spd = K(headT.wormSpeed) * (1 + (s.stageNum - 1) * 0.03);
      e.x += Math.cos(e.angle) * spd * dt;
      e.y += Math.sin(e.angle) * spd * dt;
    } else {
      // follow the part in front of it
      const leader = s.enemies
        .filter(o => o.chain === e.chain && o.segIndex < e.segIndex)
        .reduce((a, b) => (!a || b.segIndex > a.segIndex ? b : a), null);
      if (!leader) return;
      const spacing = K(ENEMY_TYPES[e.groupType]?.spacing ?? 40);
      const dx = e.x - leader.x, dy = e.y - leader.y, d = Math.hypot(dx, dy) || 1;
      if (d > spacing) { e.x = leader.x + dx / d * spacing; e.y = leader.y + dy / d * spacing; }
    }
  }

  function moveEnemy(e, dt) {
    if (e.move === 'worm') { moveWorm(e, dt); return; }
    if (e.dashing) return;
    if (e.move === 'swarm' && e.busy === 0) {
      // crowd around you (not on you) at their own spot in the ring
      e.swarmOff.a += dt * 0.6;
      const P = aimPoint();
      e.target = { x: P.x + Math.cos(e.swarmOff.a) * e.swarmOff.d, y: P.y + Math.sin(e.swarmOff.a) * e.swarmOff.d };
    }
    if (e.move === 'still' || e.busy > 0) return;
    if (e.move === 'hop') {            // treasure: skittish hops near its anchor
      e.hopT -= dt;
      // (target is also cleared by window resizes and Black Hole)
      if (e.hopT <= 0 || !e.target) {
        e.hopT = rand(0.6, 1.1);
        const anchor = s.enemies.find(a => a.id === e.anchor);
        const p = anchor ? randomPoint(anchor, K(160)) : randomPoint({ x: e.x, y: e.y }, K(140));
        e.target = p;
      }
    } else if (e.move !== 'swarm' && (!e.target || dist(e.x, e.y, e.target.x, e.target.y) < 4)) {
      e.target = randomPoint({ x: e.x, y: e.y }, K(220));
    }
    if (!e.target) return;
    const spd = K(40 + e.speed * 170) * (e.move === 'hop' ? 2.2 : 1);
    const dx = e.target.x - e.x, dy = e.target.y - e.y, d = Math.hypot(dx, dy) || 1;
    const step = Math.min(d, spd * dt);
    e.x += dx / d * step; e.y += dy / d * step;
  }

  // ── Enemy attacks ───────────────────────────────────────────────────────
  // An attack: wait (delay) → tele (red, ~1s) → strike (white) / fly → done
  function queueAttack(owner, kind, opts = {}) {
    const a = {
      id: uid++, owner: owner.id, kind,
      phase: 'wait', delay: opts.delay ?? 0, t: 0,
      tele: BAL.TELEGRAPH * s.stats.telegraphMult * (opts.teleMult ?? 1),
      dmg: Math.round((ATTACK_DMG[opts.dmgKey ?? kind] ?? 10) * BAL.ENEMY_DMG_MULT * s.stage.dmgScale),
      opts, hitDone: false,
    };
    owner.busy++;
    s.attacks.push(a);
    return a;
  }

  // Lock the attack's area at the moment it starts flashing
  function lockGeometry(a, owner) {
    const o = a.opts, P = o.at ?? aimPoint();
    if (a.kind === 'circle' || a.kind === 'poke') {
      const c = o.center ?? { x: owner.x, y: owner.y };
      a.cx = c.x; a.cy = c.y;
      a.r = o.r ?? (owner.size * s.k * 0.5 + K(a.kind === 'poke' ? 28 : 60));
    } else if (a.kind === 'slash') {
      const ang = o.angle ?? rand(0, Math.PI);
      const L = Math.hypot(s.W, s.H);
      a.x1 = P.x - Math.cos(ang) * L; a.y1 = P.y - Math.sin(ang) * L;
      a.x2 = P.x + Math.cos(ang) * L; a.y2 = P.y + Math.sin(ang) * L;
      a.w = K(o.width ?? 38);
    } else if (a.kind === 'shot') {
      const ang = Math.atan2(P.y - owner.y, P.x - owner.x) + (o.spread ?? 0);
      a.sx = owner.x; a.sy = owner.y; a.ux = Math.cos(ang); a.uy = Math.sin(ang);
      a.x = a.sx; a.y = a.sy; a.r = K(12); a.speed = K(520);
    } else if (a.kind === 'dash') {
      const ang = Math.atan2(P.y - owner.y, P.x - owner.x);
      const d = dist(owner.x, owner.y, P.x, P.y) + K(110);
      a.fx = owner.x; a.fy = owner.y;
      a.tx = clamp(owner.x + Math.cos(ang) * d, s.W * 0.04, s.W * 0.96);
      a.ty = clamp(owner.y + Math.sin(ang) * d, s.H * 0.06, s.H * 0.96);
      owner.flashRed = true;
    }
  }

  function startEnemyAttack(e) {
    const t = e.type;
    if (t.bossPatterns) { startBossPattern(e, pick(t.bossPatterns)); return; }
    const pool = e.armed ? t.armedAttacks : t.attacks;
    if (!pool?.length) return;
    const kind = pick(pool);
    queueAttack(e, kind);
  }

  function startBossPattern(boss, pattern) {
    const P = aimPoint();
    const near = r => randomPoint(P, K(r));
    if (pattern === 'slamRing') {
      queueAttack(boss, 'circle', { r: boss.size * s.k * 0.5 + K(110), dmgKey: 'slam' });
      for (let i = 0; i < 3; i++) queueAttack(boss, 'circle', { center: near(170), r: K(60), dmgKey: 'ring', delay: 0.15 * (i + 1) });
    } else if (pattern === 'crossSlash') {
      const a = rand(0, Math.PI);
      queueAttack(boss, 'slash', { at: P, angle: a, dmgKey: 'cross', width: 44 });
      queueAttack(boss, 'slash', { angle: a + Math.PI / 2, dmgKey: 'cross', width: 44, delay: 0.4 });
    } else if (pattern === 'barrage') {
      for (let i = -2; i <= 2; i++) queueAttack(boss, 'shot', { at: P, spread: i * 0.21, dmgKey: 'barrage' });
    } else if (pattern === 'rain') {
      for (let i = 0; i < 6; i++) queueAttack(boss, 'circle', { center: near(230), r: K(55), dmgKey: 'rain', delay: 0.12 * i });
    }
  }

  function finishAttack(a) {
    a.phase = 'done';
    const owner = s.enemies.find(e => e.id === a.owner);
    if (!owner) return;
    owner.busy = Math.max(0, owner.busy - 1);
    if (a.kind === 'dash') { owner.flashRed = false; owner.dashing = null; owner.target = null; }
    if (owner.busy === 0) owner.cd = rand(...(owner.type.cooldown ?? [4, 6])) * (owner.tier === 'boss' ? s.stage.bossCooldownMult : 1);
  }

  function updateAttacks(dt) {
    const P = s.player.pos;
    for (const a of s.attacks) {
      if (a.phase === 'done') continue;
      const owner = s.enemies.find(e => e.id === a.owner);
      // Owner died or got frozen mid-telegraph → attack fizzles
      if (!owner || (owner.frozen > 0 && (a.phase === 'wait' || a.phase === 'tele'))) {
        if (owner) finishAttack(a); else a.phase = 'done';
        continue;
      }
      if (a.phase === 'wait') {
        a.delay -= dt;
        if (a.delay <= 0) { a.phase = 'tele'; a.t = 0; lockGeometry(a, owner); }
      } else if (a.phase === 'tele') {
        a.t += dt;
        if (a.t >= a.tele) {
          a.t = 0;
          if (a.kind === 'circle' || a.kind === 'poke') {
            a.phase = 'strike';
            if (P && dist(P.x, P.y, a.cx, a.cy) <= a.r) hitPlayer(a.dmg);
          } else if (a.kind === 'slash') {
            a.phase = 'strike';
            if (P && distToSegment(P.x, P.y, a.x1, a.y1, a.x2, a.y2) <= a.w / 2) hitPlayer(a.dmg);
          } else if (a.kind === 'shot') {
            a.phase = 'fly';
          } else if (a.kind === 'dash') {
            a.phase = 'fly'; owner.dashing = a; owner.flashRed = false;
          }
        }
      } else if (a.phase === 'strike') {
        a.t += dt;
        if (a.t >= BAL.STRIKE_FLASH) finishAttack(a);
      } else if (a.phase === 'fly') {
        if (a.kind === 'shot') {
          a.x += a.ux * a.speed * dt; a.y += a.uy * a.speed * dt;
          if (!a.hitDone && P && dist(P.x, P.y, a.x, a.y) <= a.r + K(6)) { a.hitDone = true; hitPlayer(a.dmg); }
          if (a.x < -50 || a.y < -50 || a.x > s.W + 50 || a.y > s.H + 50 || a.hitDone) finishAttack(a);
        } else if (a.kind === 'dash') {
          const spd = K(950);
          const dx = a.tx - owner.x, dy = a.ty - owner.y, d = Math.hypot(dx, dy);
          const step = Math.min(d, spd * dt);
          if (d > 0) { owner.x += dx / d * step; owner.y += dy / d * step; }
          if (!a.hitDone && P && dist(P.x, P.y, owner.x, owner.y) <= owner.size * s.k * 0.5) { a.hitDone = true; hitPlayer(a.dmg); }
          if (d <= 1) finishAttack(a);
        }
      }
    }
    s.attacks = s.attacks.filter(a => a.phase !== 'done');
  }

  // ── Player getting hit ──────────────────────────────────────────────────
  function hitPlayer(raw) {
    const pl = s.player;
    if (pl.invuln > 0 || s.dev.god || s.phase === 'defeat' || s.phase === 'clear') return;
    const dmg = Math.max(1, Math.round(raw * (1 - s.stats.dmgReduction)));
    pl.hp = Math.max(0, pl.hp - dmg);
    pl.invuln = BAL.HIT_INVULN; pl.hitT = 0.35; s.shake = 0.3;
    const p = pl.pos ?? { x: s.W / 2, y: s.H / 2 };
    floater(`-${dmg} HP`, p.x, p.y - K(24), '#ff4444', true);
    cb('onPlayerHit', dmg);
    if (pl.hp <= 0) startDefeat();
  }

  function heal(amount) {
    const pl = s.player;
    if (amount <= 0 || pl.hp <= 0) return;
    pl.hp = Math.min(pl.maxHp, pl.hp + amount);
  }

  // ── Damaging enemies ────────────────────────────────────────────────────
  function chargeUlt(dmg, weight = 1) {
    if (!s.stats.ult || s.ult.active) return;
    const need = s.stats.clickDmg * BAL.ULT_CHARGE_CLICKS * (s.stats.ult.charge ?? 1) / s.stats.ultChargeMult;
    s.ult.charge = Math.min(1, s.ult.charge + dmg * weight / Math.max(1, need));
  }

  function rollClick(mult = 1) {
    const st = s.stats;
    s.clickCount++;
    let crit = Math.random() < st.critRate;
    let critMult = 1 + st.critDmg;
    if (st.labubuEvery && s.clickCount % st.labubuEvery === 0) { crit = true; critMult = Math.max(critMult, 3); }
    let dmg = st.clickDmg * mult * rand(0.9, 1.1);
    if (st.highHpAtkBonus && s.player.hp > s.player.maxHp / 2) dmg *= 1 + st.highHpAtkBonus;
    if (s.frenzy > 0) dmg *= 2;
    if (s.ult.active?.type === 'transform') dmg *= s.ult.active.clickMult;
    if (crit) dmg *= critMult;
    return { dmg, crit };
  }

  function damageEnemy(e, rawDmg, { crit = false, color, label = '', charge = 1, quiet = false } = {}) {
    if (e.hp <= 0 || e.down > 0 || !s.enemies.includes(e)) return 0; // dead / downed / cleared
    let dmg = rawDmg;
    const sk = s.stats.skill;
    if (e.frozen > 0 && sk?.type === 'frost') dmg *= 1 + sk.bonus;
    if (e.tier === 'boss') dmg *= s.stats.bossDmgMult;
    dmg = Math.max(1, Math.round(dmg));

    // A shield bubble (its own or a nearby Shield Bonk's) soaks the hit
    const sh = s.enemies.find(o => o.shield?.hp > 0 && dist(o.x, o.y, e.x, e.y) <= K(o.type.shield.radius));
    if (sh) {
      sh.shield.hp = Math.max(0, sh.shield.hp - dmg);
      sh.shield.regenT = sh.type.shield.regen; sh.hurt = 0.08;
      if (!quiet) floater(`🛡-${fmt(dmg)}`, e.x + rand(-10, 10), e.y - e.size * s.k * 0.5, '#7dd3fc');
      if (sh.shield.hp === 0) floater('SHIELD BROKEN!', sh.x, sh.y - K(60), '#7dd3fc', true);
      chargeUlt(dmg, charge);
      return dmg;
    }

    e.hp -= dmg; e.hurt = 0.12;
    if (!quiet) floater(`${crit ? 'CRIT ' : ''}${label}-${fmt(dmg)}`, e.x + rand(-10, 10), e.y - e.size * s.k * 0.5, color ?? (crit ? '#ff4444' : '#ffd84a'), crit);
    chargeUlt(dmg, charge);
    if (e.hp <= 0) {
      if (e.role === 'hydra') headDown(e);
      else killEnemy(e);
    }
    return dmg;
  }

  // Hydra: a head at 0 HP goes down; all heads down at once = dead
  function headDown(h) {
    const t = h.type;
    h.hp = 0; h.down = t.downTime;
    s.attacks.forEach(a => { if (a.owner === h.id && (a.phase === 'wait' || a.phase === 'tele')) finishAttack(a); });
    const heads = s.enemies.filter(x => x.group === h.group);
    const up = heads.filter(x => !(x.down > 0)).length;
    if (up === 0) { heads.forEach(x => killEnemy(x)); return; }
    floater(`HEAD DOWN! ${up} left`, h.x, h.y - K(60), '#facc15', true);
  }

  function killEnemy(e, { silent = false } = {}) {
    e.hp = 0;
    s.enemies = s.enemies.filter(x => x.id !== e.id);
    // cancel everything this enemy had queued
    s.attacks.forEach(a => { if (a.owner === e.id) a.phase = 'done'; });
    effect({ kind: 'poof', x: e.x, y: e.y, r: e.size * s.k * 0.6 });
    if (silent) return;
    const t = e.type;
    const coins = Math.round((t.coin ?? 0) * s.stage.coinScale * s.stats.coinMult);
    const gems  = t.gems ? Math.round(t.gems * s.stage.gemScale) : 0;
    if (coins) floater(`+${fmt(coins)}`, e.x, e.y + K(14), '#f0c040', false, 'coin');
    if (gems)  floater(`+${gems}`, e.x, e.y + K(30), '#7aa2ff', false, 'gem');
    cb('onReward', { coins, gems, xp: t.xp ?? BAL.XP[e.tier] ?? 0, kill: e.tier !== 'treasure' && !e.group });

    // Linked boss parts: the boss only dies when every part is gone
    if (e.group) {
      const left = s.enemies.filter(x => x.group === e.group).sort((a, b) => a.segIndex - b.segIndex);
      if (left.length) {
        if (e.move === 'worm') splitWorm(e);
        return;
      }
      const gt = ENEMY_TYPES[e.groupType], r = gt?.groupReward;
      if (r) {
        const c = Math.round(r.coin * s.stage.coinScale * s.stats.coinMult);
        const g = Math.round((r.gems ?? 0) * s.stage.gemScale);
        floater(`+${fmt(c)}`, e.x, e.y + K(14), '#f0c040', true, 'coin');
        if (g) floater(`+${g}`, e.x, e.y + K(34), '#7aa2ff', true, 'gem');
        cb('onReward', { coins: c, gems: g, xp: r.xp ?? 0, kill: true });
      }
      if (e.tier === 'boss') stageClear();
      return;
    }

    if (e.tier === 'treasure') treasurePowerUp(e);
    if (e.tier === 'boss') { stageClear(); return; }
    if (s.phase === 'fight' && e.tier !== 'treasure') {
      s.kills++;
      cb('onProgress', { stage: s.stageNum, kills: s.kills });
      if (s.kills >= s.stage.killTarget) startBossIntro();
    }
  }

  // Worm part died. Head → the next part grows a head. Middle → everything
  // behind it breaks off into a separate worm with its own head.
  function splitWorm(dead) {
    const behind = s.enemies.filter(x => x.chain === dead.chain && x.segIndex > dead.segIndex)
      .sort((a, b) => a.segIndex - b.segIndex);
    if (!behind.length) return;
    const makeHead = (nh, angle) => {
      const ht = ENEMY_TYPES[nh.groupType];
      nh.role = 'head'; nh.shape = null; nh.img = ht.img; nh.size = ht.size;
      nh.angle = angle; nh.wiggle = rand(0, 6);
    };
    if (dead.role === 'head') {
      makeHead(behind[0], dead.angle);
      floater('NEW HEAD!', behind[0].x, behind[0].y - K(40), '#ff4444', true);
    } else {
      const chain = uid++;
      behind.forEach(x => { x.chain = chain; });
      // the new worm peels off sideways
      makeHead(behind[0], dead.angle + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2);
      floater('SPLIT!', behind[0].x, behind[0].y - K(40), '#ff4444', true);
    }
  }

  function treasurePowerUp(e) {
    const options = ['frenzy', 'heal'];
    if (s.stats.ult && !s.ult.active) options.push('charge');
    const p = pick(options);
    if (p === 'frenzy') { s.frenzy = 8; floater('FRENZY! 2× DMG', e.x, e.y - K(40), '#ff8c00', true); }
    if (p === 'heal')   { heal(s.player.maxHp * 0.35); floater('+35% HP', e.x, e.y - K(40), '#4ade80', true); }
    if (p === 'charge') { s.ult.charge = Math.min(1, s.ult.charge + 0.3); floater('+30% ULT', e.x, e.y - K(40), '#c084fc', true); }
  }

  // ── Player input ────────────────────────────────────────────────────────
  function pointerMove(x, y) { s.player.pos = { x, y }; }

  function enemyAt(x, y) {
    // topmost first (later = drawn on top); generous hitbox for fingers
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i];
      if (dist(x, y, e.x, e.y) <= e.size * s.k * 0.55 + K(6)) return e;
    }
    return null;
  }

  function nearestEnemy(x, y) {
    let best = null, bd = Infinity;
    for (const e of s.enemies) { const d = dist(x, y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  function clickEnemy(e, mult = 1, auto = false) {
    const sk = s.stats.skill;
    const { dmg, crit } = rollClick(mult);
    damageEnemy(e, dmg, { crit });
    if (!sk) return;
    if (sk.type === 'splash') {
      effect({ kind: 'burst', x: e.x, y: e.y, r: K(sk.radius), color: '#F59E0B' });
      s.enemies.filter(o => o !== e && dist(o.x, o.y, e.x, e.y) <= K(sk.radius))
        .forEach(o => damageEnemy(o, dmg * sk.pct, { color: '#F59E0B', label: '🪨' }));
    } else if (sk.type === 'frost' && e.hp > 0 && Math.random() < sk.chance) {
      e.frozen = sk.dur; floater('❄ FROZEN', e.x, e.y - K(36), '#67e8f9');
    } else if (sk.type === 'lifesteal' && !auto) {
      const mx = s.player.maxHp;
      heal(Math.min(sk.maxPctHp * mx, sk.pctHp * mx + dmg * sk.pct));
    } else if (sk.type === 'devour' && e.hp > 0) {
      damageEnemy(e, e.hp * sk.pct, { color: '#ff3355', label: '👁' });
      if (!auto) heal(sk.healPctHp * s.player.maxHp);
    }
  }

  function pointerDown(x, y) {
    s.player.pos = { x, y };
    if (s.phase === 'defeat' || s.phase === 'clear') return;
    // boss weak points first
    for (const wp of s.weakPts) {
      const boss = s.enemies.find(e => e.id === wp.boss);
      if (!boss) continue;
      const wx = boss.x + wp.rx * boss.size * s.k, wy = boss.y + wp.ry * boss.size * s.k;
      if (dist(x, y, wx, wy) <= K(22)) {
        s.weakPts = s.weakPts.filter(w => w !== wp);
        const { dmg } = rollClick(wp.mult);
        damageEnemy(boss, dmg, { crit: true, color: '#ffff44', label: '⚡WEAK ' });
        return;
      }
    }
    const e = enemyAt(x, y);
    if (e) { clickEnemy(e); return; }
    // Gun skill: clicking empty space fires a homing shot
    const sk = s.stats.skill;
    if (sk?.type === 'gun') {
      const targets = [...s.enemies].sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y)).slice(0, sk.shots ?? 1);
      targets.forEach(t => s.shots.push({ id: uid++, x, y, target: t.id, speed: K(900), mult: sk.pct }));
    }
  }

  function updateShots(dt) {
    for (const sh of s.shots) {
      let t = s.enemies.find(e => e.id === sh.target);
      if (!t) { t = nearestEnemy(sh.x, sh.y); if (!t) { sh.dead = true; continue; } sh.target = t.id; }
      const dx = t.x - sh.x, dy = t.y - sh.y, d = Math.hypot(dx, dy) || 1;
      if (d <= t.size * s.k * 0.4) {
        const { dmg, crit } = rollClick(sh.mult);
        damageEnemy(t, dmg, { crit, color: '#c084fc', label: '💃' });
        sh.dead = true; continue;
      }
      const step = Math.min(d, sh.speed * dt);
      sh.x += dx / d * step; sh.y += dy / d * step;
    }
    s.shots = s.shots.filter(sh => !sh.dead);
  }

  // ── Ult ─────────────────────────────────────────────────────────────────
  function activateUlt() {
    const u = s.stats.ult;
    if (!u || s.ult.charge < 1 || s.ult.cd > 0 || s.ult.active || s.phase === 'defeat' || s.phase === 'clear') return false;
    s.ult.charge = 0;
    s.ult.cd = s.ult.cdMax = u.cooldown ?? 30;
    const base = s.stats.clickDmg;
    const all = [...s.enemies];
    const hitAll = (mult, color, label) => all.forEach(e => damageEnemy(e, base * mult, { color, label, charge: 0 }));
    effect({ kind: 'ult', color: '#ffffff', t: 0 });
    cb('onUlt', u);

    switch (u.type) {
      case 'nuke':      hitAll(u.mult, '#F59E0B', '🗿'); break;
      case 'blackhole': {
        const c = { x: s.W * 0.6, y: s.H * 0.48 };
        all.forEach(e => { if (e.tier !== 'boss') { e.x = c.x + rand(-40, 40) * s.k; e.y = c.y + rand(-40, 40) * s.k; e.target = null; } e.frozen = Math.max(e.frozen, u.stun); });
        effect({ kind: 'burst', x: c.x, y: c.y, r: K(200), color: '#8B5CF6' });
        hitAll(u.mult, '#8B5CF6', '🌌');
        break;
      }
      case 'transform': s.ult.active = { type: 'transform', t: u.dur, dur: u.dur, clickMult: u.clickMult, autoClicks: u.autoClicks, acc: 0 }; break;
      case 'timestop':
        s.timeStop = u.dur; s.attacks.forEach(a => { if (a.phase === 'wait' || a.phase === 'tele') finishAttack(a); });
        hitAll(u.mult, '#67e8f9', '❄');
        break;
      case 'surge': {
        hitAll(u.mult, '#3B82F6', '💧');
        heal(s.player.maxHp);
        const coins = Math.round(u.coins * 15 * s.stage.coinScale * s.stats.coinMult);
        floater(`+${fmt(coins)}`, s.W / 2, s.H * 0.3, '#f0c040', true, 'coin');
        cb('onReward', { coins, gems: 0, xp: 0, kill: false });
        break;
      }
      case 'execute': {
        s.timeStop = u.dur; s.attacks.forEach(a => { if (a.phase === 'wait' || a.phase === 'tele') finishAttack(a); });
        const strongest = all.reduce((a, b) => (a && a.hp > b.hp ? a : b), null);
        if (strongest) damageEnemy(strongest, base * u.mult, { color: '#EAB308', label: '✨', crit: true, charge: 0 });
        s.enemies.filter(e => e.tier !== 'boss' && e.hp / e.maxHp < u.threshold)
          .forEach(e => { floater('EXECUTE', e.x, e.y - K(30), '#EAB308', true); killEnemy(e); });
        break;
      }
      case 'hox': {
        all.filter(e => e.tier !== 'boss').forEach(e => { if (e.hp > 0) { floater('EATEN', e.x, e.y - K(30), '#ff0000', true); killEnemy(e); } });
        all.filter(e => e.tier === 'boss' && e.hp > 0).forEach(b => damageEnemy(b, b.maxHp * u.bossPct, { color: '#ff0000', label: '👁', crit: true, charge: 0 }));
        heal(s.player.maxHp);
        break;
      }
      default: hitAll(5, '#cc44ff', '✦');
    }
    return true;
  }

  // ── Phases ──────────────────────────────────────────────────────────────
  function startBossIntro() {
    s.phase = 'bossIntro'; s.phaseT = 2.4;
    s.banner = { text: '⚠ BOSS ⚠', sub: 'INCOMING!', t: 2.4, boss: true };
  }
  function stageClear() {
    s.phase = 'clear'; s.phaseT = 3;
    s.enemies.forEach(e => effect({ kind: 'poof', x: e.x, y: e.y, r: e.size * s.k * 0.6 }));
    s.enemies = []; s.attacks = []; s.shots = []; s.weakPts = []; s.bossInfo = null;
    const r = s.stage.clearReward;
    s.banner = { text: `STAGE ${s.stageNum} CLEAR!`, sub: `+${fmt(r.coins)} coins · +${r.gems} gem${r.gems === 1 ? '' : 's'}`, t: 3, good: true };
    cb('onReward', { coins: r.coins, gems: r.gems, xp: 0, kill: false });
  }
  function startDefeat() {
    s.phase = 'defeat'; s.phaseT = 2.6;
    s.attacks = []; s.shots = [];
    s.banner = { text: 'DEFEATED', sub: `retrying stage ${s.stageNum}…`, t: 2.6, bad: true };
    cb('onDefeat', s.stageNum);
  }
  function loadStage(n) {
    s.stageNum = n; s.stage = makeStage(n);
    s.phase = 'fight'; s.kills = 0; s.bossInfo = null;
    s.enemies = []; s.attacks = []; s.shots = []; s.weakPts = [];
    s.player.hp = s.player.maxHp; s.player.invuln = 1;
    s.timers.basic = 0.3; s.timers.elite = 4; s.timers.horde = 8;
    s.banner = { text: `STAGE ${n}`, sub: 'defeat enemies to summon the boss', t: 2 };
    for (let i = 0; i < 3; i++) spawnEnemy(pick(s.stage.basics));
    cb('onProgress', { stage: n, kills: 0 });
  }

  function updatePhase(dt) {
    if (s.phase === 'bossIntro') {
      s.phaseT -= dt;
      if (s.phaseT <= 0) { s.phase = 'boss'; spawnBoss(s.stage.boss); }
    } else if (s.phase === 'clear') {
      s.phaseT -= dt;
      if (s.phaseT <= 0) { const next = s.stageNum + 1; cb('onStageClear', next); loadStage(next); }
    } else if (s.phase === 'defeat') {
      s.phaseT -= dt;
      if (s.phaseT <= 0) loadStage(s.stageNum);
    }
  }

  // ── Main tick ───────────────────────────────────────────────────────────
  function update(rawDt) {
    if (!s.W) return;
    const dt = Math.min(rawDt, 0.05) * s.dev.timeScale;
    s.time += dt;
    const pl = s.player;
    s.ult.cd = Math.max(0, s.ult.cd - dt);

    pl.invuln = Math.max(0, pl.invuln - dt);
    pl.hitT   = Math.max(0, pl.hitT - dt);
    s.shake   = Math.max(0, s.shake - dt);
    s.frenzy  = Math.max(0, s.frenzy - dt);
    if (s.banner) { s.banner.t -= dt; if (s.banner.t <= 0) s.banner = null; }
    let expired = false;
    s.floaters.forEach(f => { f.t += dt; if (f.t >= 1.1) expired = true; });
    if (expired) { s.floaters = s.floaters.filter(f => f.t < 1.1); s.floaterVer++; }
    s.effects.forEach(f => { f.t += dt; });
    s.effects = s.effects.filter(f => f.t < 0.5);
    s.enemies.forEach(e => { e.hurt = Math.max(0, e.hurt - dt); });

    if (s.phase !== 'defeat' && pl.hp > 0) heal(s.stats.regen * dt);

    // Transformation ult
    const act = s.ult.active;
    if (act) {
      act.t -= dt;
      if (act.type === 'transform') {
        act.acc += dt * act.autoClicks;
        while (act.acc >= 1) {
          act.acc -= 1;
          const targets = s.enemies.filter(e => e.tier !== 'treasure');
          if (targets.length) clickEnemy(pick(targets), 1, true);
        }
      }
      if (act.t <= 0) s.ult.active = null;
    }

    updatePhase(dt);
    updateShots(dt);

    // Pulse skill
    const sk = s.stats.skill;
    if (sk?.type === 'pulse' && pl.pos && s.phase !== 'defeat' && s.phase !== 'clear') {
      s.timers.pulse -= dt;
      if (s.timers.pulse <= 0) {
        s.timers.pulse = sk.interval;
        const R = K(sk.radius);
        effect({ kind: 'burst', x: pl.pos.x, y: pl.pos.y, r: R, color: '#8B5CF6' });
        s.enemies.filter(e => dist(e.x, e.y, pl.pos.x, pl.pos.y) <= R + e.size * s.k * 0.5)
          .forEach(e => { const { dmg, crit } = rollClick(sk.pct); damageEnemy(e, dmg, { crit, color: '#a78bfa', label: '⚛' }); });
      }
    }

    // Time stop: enemies, their attacks and spawns are frozen; you keep hitting
    if (s.timeStop > 0) { s.timeStop -= dt; return; }

    updateSpawns(dt);

    // Auto-attack
    s.timers.auto -= dt;
    if (s.timers.auto <= 0) {
      s.timers.auto = BAL.AUTO_INTERVAL;
      const targets = s.enemies.filter(e => e.tier !== 'treasure');
      if (targets.length && s.phase !== 'clear' && s.phase !== 'defeat') {
        const e = pick(targets);
        damageEnemy(e, s.stats.autoDps * BAL.AUTO_INTERVAL * rand(0.85, 1.15), { color: '#ffffff', charge: BAL.AUTO_CHARGE_WEIGHT });
      }
    }

    // Enemies
    const P = pl.pos;
    for (const e of [...s.enemies]) {
      if (e.shield && e.shield.hp < e.shield.max) {
        e.shield.regenT -= dt;
        if (e.shield.regenT <= 0) { e.shield.hp = e.shield.max; floater('SHIELD UP', e.x, e.y - K(60), '#7dd3fc'); }
      }
      if (e.down > 0) {
        e.down -= dt;
        if (e.down <= 0) {
          e.down = 0; e.hp = Math.round(e.maxHp * e.type.regrowPct);
          floater('REGROWN!', e.x, e.y - K(60), '#ff4444', true);
        }
        continue;
      }
      if (e.frozen > 0) { e.frozen -= dt; continue; }
      // worm head bites your cursor
      if (e.move === 'worm' && e.role === 'head' && P && dist(P.x, P.y, e.x, e.y) <= e.size * s.k * 0.45) {
        hitPlayer(Math.round(ATTACK_DMG.bite * BAL.ENEMY_DMG_MULT * s.stage.dmgScale));
      }
      if (e.life != null) {
        e.life -= dt;
        if (e.life <= 0) { s.enemies = s.enemies.filter(x => x !== e); floater('it got away…', e.x, e.y - K(20), '#aaa'); continue; }
      }
      moveEnemy(e, dt);
      if (e.busy === 0 && !e.dashing && s.phase !== 'clear' && s.phase !== 'defeat') {
        const canAttack = e.tier === 'boss' || e.tier === 'elite' || e.armed;
        if (canAttack) {
          e.cd -= dt;
          // brand-new spawns get a moment before their first attack
          if (e.cd <= 0 && s.time - e.born > 1.2) startEnemyAttack(e);
        }
      }
    }
    updateAttacks(dt);

    // Boss weak points
    const bosses = s.enemies.filter(e => e.type.weakPoints);
    s.weakPts = s.weakPts.filter(w => (w.t -= dt) > 0 && bosses.some(b => b.id === w.boss));
    s.timers.weak -= dt;
    if (s.timers.weak <= 0) {
      s.timers.weak = 0.7;
      bosses.forEach(b => {
        if (s.weakPts.filter(w => w.boss === b.id).length < 3 && Math.random() < 0.65) {
          s.weakPts.push({ id: uid++, boss: b.id, rx: rand(-0.36, 0.36), ry: rand(-0.36, 0.36), t: rand(1.2, 2.1), mult: 3 + Math.floor(Math.random() * 3) });
        }
      });
    }
  }

  function resize(W, H) {
    if (!W || !H) return;
    if (s.W) {
      const fx = W / s.W, fy = H / s.H;
      s.enemies.forEach(e => { e.x *= fx; e.y *= fy; e.target = null; });
      if (s.player.pos) s.player.pos = { x: s.player.pos.x * fx, y: s.player.pos.y * fy };
    }
    const first = !s.W;
    s.W = W; s.H = H;
    s.k = clamp(Math.min(W, H) / 560, 0.55, 1.35);
    if (first) {
      for (let i = 0; i < 3; i++) spawnEnemy(pick(s.stage.basics));
      if (s.kills >= s.stage.killTarget) startBossIntro();
      else if (s.kills > 0) s.banner = { text: `STAGE ${s.stageNum}`, sub: `${s.kills}/${s.stage.killTarget} kills — keep going`, t: 1.6 };
    }
  }

  function setStats(st) {
    const ratio = s.player.hp / s.player.maxHp;
    s.stats = st;
    s.player.maxHp = st.maxHp;
    s.player.hp = Math.round(st.maxHp * ratio);
    if (!st.ult) { s.ult.charge = 0; s.ult.cd = 0; }
  }

  // Big text in the middle of the arena (level-ups etc.)
  // Several at once (level-up + "ULT UNLOCKED!") stack instead of overlapping
  let lastAnnounce = { t: -1, n: 0 };
  const announce = (text, color = '#facc15') => {
    lastAnnounce = s.time - lastAnnounce.t < 1 ? { t: s.time, n: lastAnnounce.n + 1 } : { t: s.time, n: 0 };
    floater(text, s.W / 2, s.H * 0.32 + lastAnnounce.n * 28 * s.k, color, true);
  };

  const setReserved = (r) => { s.reserved = r; };

  // ── Sandbox / dev menu ──────────────────────────────────────────────────
  const dev = {
    spawn: (typeId, n = 1) => {
      const t = ENEMY_TYPES[typeId];
      if (!t) return;
      if (t.tier === 'boss') { s.phase = 'boss'; spawnBoss(typeId); return; }
      if (typeId === 'swarmling') { spawnHorde(); return; }
      for (let i = 0; i < n; i++) typeId === 'treasure' ? spawnTreasure() : spawnEnemy(typeId, { armed: true });
    },
    summonBoss: () => { s.enemies = s.enemies.filter(e => e.tier !== 'boss'); s.kills = s.stage.killTarget; startBossIntro(); },
    killAll: () => { [...s.enemies].forEach(e => { if (s.enemies.includes(e)) { if (e.role === 'hydra') { e.hp = 0; e.down = 0; } killEnemy(e); } }); },
    clearEnemies: () => {
      s.enemies = []; s.attacks = []; s.shots = []; s.weakPts = []; s.bossInfo = null;
      // boss removed → back to the fight, one kill short of summoning it again
      if (s.phase === 'boss' || s.phase === 'bossIntro') { s.phase = 'fight'; s.kills = Math.min(s.kills, s.stage.killTarget - 1); }
    },
    fillUlt: () => { s.ult.charge = 1; s.ult.cd = 0; },
    heal: () => { s.player.hp = s.player.maxHp; },
    setGod: (on) => { s.dev.god = !!on; },
    setTimeScale: (x) => { s.dev.timeScale = x; },
    gotoStage: (n) => loadStage(Math.max(1, Math.round(n))),
  };

  return { state: s, update, resize, pointerMove, pointerDown, activateUlt, setStats, loadStage, announce, setReserved, dev };
}

export const fmt = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.floor(n));
