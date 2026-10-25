// ─────────────────────────────────────────────────────────────────────────────
// Bio's usual kit (the one every save has): M2 calls two Divine Dogs, kills
// sometimes call a Toad or Nue, and the ult is Mahoraga, who fights while you
// watch. kitRuntime.js hands these hooks here. (His other kit is tenShadows.js.)
//
//   s.allies    dog / toad / nue (no `ts` flag: those belong to the other kit)
//   s.mahoraga  the ult (no `v2` flag): you're suspended until it clears the field
// ─────────────────────────────────────────────────────────────────────────────

const SHIKI = ['dog', 'toad', 'nue'];
const MAX_SHIKI = 3;
const ADAPT_NAMES = { circle: 'SLAMS', slash: 'SLASHES', shot: 'SHOTS', dash: 'DASHES', bite: 'BITES', poison: 'POISON' };

export function createBioClassic(c) {
  const { s, api, K, pick, dist, floater, effect, shake, sfx, nextId, kitHit, ultHit, foes, focus, nearest, radius, center, startCooldown } = c;

  // M2: two Divine Dogs (a fresh pair replaces the old one)
  function special(sk, x, y) {
    if (!startCooldown(sk, x, y)) return false;
    s.allies = s.allies.filter(a => !(a.kind === 'dog' && a.summoned));
    for (let i = 0; i < 2; i++) s.allies.push({ id: nextId(), kind: 'dog', summoned: true, x: x + (i ? K(30) : -K(30)), y, pct: sk.pct, life: sk.dur, biteT: i * 0.2, target: null });
    effect({ kind: 'burst', x, y, r: K(70), color: '#6366f1' });
    floater('🐺🐺 DIVINE DOGS', x, y - K(50), '#a5b4fc', true);
    sfx('shield');
    return true;
  }

  // Passive: a kill sometimes calls a Toad (eats the next hit on you) or Nue
  function onKill(pv) {
    if (Math.random() >= pv.chance) return;
    summonShiki(Math.random() < 0.5 && !s.allies.some(a => a.kind === 'toad') ? 2 : 3, pv);
  }
  // m: 2 = toad, 3 = nue
  function summonShiki(m, sk) {
    const P = s.player.pos ?? center();
    const kind = ['dog', 'dog', 'toad', 'nue'][m];
    const shiki = s.allies.filter(a => SHIKI.includes(a.kind));
    if (shiki.length >= MAX_SHIKI) s.allies = s.allies.filter(a => a !== shiki[0]);
    const base = { id: nextId(), kind, x: P.x, y: P.y, pct: sk.pct };
    if (kind === 'dog')  s.allies.push({ ...base, life: 15, biteT: 0, target: null });
    if (kind === 'toad') s.allies.push({ ...base, life: 25 });
    if (kind === 'nue')  s.allies.push({ ...base, life: 12, ang: 0, zapT: 0.6 });
    floater({ dog: '🐺 DIVINE DOG', toad: '🐸 TOAD', nue: '🦅 NUE' }[kind], P.x, P.y - K(50), '#a5b4fc', true);
  }

  // The shikigami (called by kitRuntime's ally loop). true = handled here.
  function updateAlly(a, dt, live, P) {
    if (a.kind === 'dog') {
      // they hunt whatever you point at (the enemy nearest your cursor), otherwise the closest one
      a.lookT = (a.lookT ?? 0) - dt;
      let t = s.enemies.find(e => e.id === a.target);
      if (a.lookT <= 0) { a.lookT = 0.4; const f = focus(320); if (f) { t = f; a.target = f.id; } }
      if (!t || t.tier === 'treasure' || t.down > 0) { t = nearest(a.x, a.y); a.target = t?.id ?? null; }
      if (t) {
        const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy) || 1;
        const reach = radius(t) + K(14);
        if (d > reach) { a.x += dx / d * Math.min(d - reach, K(330) * dt); a.y += dy / d * Math.min(d - reach, K(330) * dt); }
        a.biteT -= dt;
        if (d <= reach + K(4) && a.biteT <= 0 && live) {
          a.biteT = 0.45;
          kitHit(t, a.pct, { color: '#a5b4fc', label: '🐺' });
          effect({ kind: 'stab', x: t.x, y: t.y, r: radius(t), life: 0.2 });
        }
      }
      return true;
    }
    if (a.kind === 'toad') {
      const tx = P.x - K(46), ty = P.y + K(30);
      a.x += (tx - a.x) * Math.min(1, dt * 8); a.y += (ty - a.y) * Math.min(1, dt * 8);
      return true;
    }
    if (a.kind === 'nue') {
      a.ang += dt * 2.2;
      a.x = P.x + Math.cos(a.ang) * K(110); a.y = P.y + Math.sin(a.ang) * K(70) - K(30);
      a.zapT -= dt;
      if (a.zapT <= 0 && live) {
        a.zapT = 0.8;
        const near = foes().filter(e => dist(e.x, e.y, a.x, a.y) <= K(460));
        if (near.length) {
          const e = pick(near);
          kitHit(e, a.pct * 1.3, { color: '#fde047', label: '⚡' });
          effect({ kind: 'zap', x1: a.x, y1: a.y, x2: e.x, y2: e.y, life: 0.25 });
        }
      }
      return true;
    }
    return false;
  }

  // ── Mahoraga: it fights, you watch ───────────────────────────────────────
  function summonMahoraga(u, P) {
    const hp = s.player.maxHp * u.hp;
    s.mahoraga = { x: P.x, y: P.y, hp, maxHp: hp, mult: u.mult, slamT: 0.9, target: null, adapt: {}, wheel: 0, turns: 0, turnT: 6, invuln: 1, t: 0, timeout: 150 };
    s.ult.active = { type: 'mahoraga', t: 1e9, dur: 1e9 };
    s.combo.n = 0;
    effect({ kind: 'flash', color: '#fde047', life: 0.6 });
    api.announce('WITH THIS TREASURE I SUMMON…', '#fde047');
    shake(0.5); sfx('bigKill');
  }
  function updateMahoraga(dt) {
    const m = s.mahoraga;
    m.t += dt; m.invuln = Math.max(0, m.invuln - dt);
    if (s.phase === 'clear') { endMahoraga('won'); return; }
    const list = foes().filter(e => !(e.down > 0));
    if (!list.length && s.phase !== 'bossIntro' && !s.enemies.some(e => e.down > 0)) { endMahoraga('cleared'); return; }
    if (m.t >= m.timeout) { endMahoraga('left'); return; }   // safety net only
    // the wheel turns on its own too, so a long fight always ends one way or the other
    m.turnT -= dt;
    if (m.turnT <= 0) { m.turnT = 6; m.turns++; m.wheel++; floater('☸', m.x, m.y - K(70), '#fde047', true); }
    let t = list.find(e => e.id === m.target);
    // point at an enemy (cursor near it) and Mahoraga goes for it
    m.lookT = (m.lookT ?? 0) - dt;
    if (m.lookT <= 0) { m.lookT = 0.5; const f = focus(200, list); if (f) { t = f; m.target = f.id; } }
    if (!t) {
      // bosses first once they're out, otherwise whatever's closest
      const bosses = list.filter(e => e.tier === 'boss');
      t = nearest(m.x, m.y, bosses.length ? bosses : list);
      m.target = t?.id ?? null;
    }
    if (!t) return;
    const adapts = Object.values(m.adapt).reduce((a, n) => a + Math.min(n, 3), 0) + m.turns;
    const dx = t.x - m.x, dy = t.y - m.y, d = Math.hypot(dx, dy) || 1;
    const reach = radius(t) + K(36);
    if (d > reach) { const st = Math.min(d - reach, K(250) * (1 + adapts * 0.04) * dt); m.x += dx / d * st; m.y += dy / d * st; }
    m.slamT -= dt;
    if (m.slamT <= 0 && d <= reach + K(8)) {
      m.slamT = 0.55;
      const R = K(100);
      foes().filter(e => !(e.down > 0) && dist(e.x, e.y, t.x, t.y) <= R + radius(e) * 0.6)
        .forEach(e => ultHit(e, m.mult * (1 + 0.12 * adapts), '#fde047', '☸'));
      effect({ kind: 'burst', x: t.x, y: t.y, r: R, color: '#fde047' });
      effect({ kind: 'shards', x: t.x, y: t.y, r: R * 0.8, color: '#fde047', n: 8 });
      shake(0.18); sfx('bigKill');
    }
  }
  function hitMahoraga(raw, kind) {
    const m = s.mahoraga;
    if (!m || m.invuln > 0) return;
    const n = m.adapt[kind] ?? 0;
    const dmg = Math.max(1, Math.round(raw * (1 - s.stats.dmgReduction) * Math.pow(0.6, Math.min(n, 3))));
    m.hp -= dmg; m.invuln = 0.3;
    floater(`-${dmg}`, m.x, m.y - K(50), '#ff6b6b', true);
    if (n < 3) {
      m.adapt[kind] = n + 1; m.wheel++;
      floater(`☸ ADAPTED TO ${ADAPT_NAMES[kind] ?? String(kind).toUpperCase()}`, m.x, m.y - K(78), '#fde047', true);
    }
    if (m.hp <= 0) {
      s.mahoraga = null; s.ult.active = null;
      api.announce('MAHORAGA FELL…', '#ef4444');
      effect({ kind: 'flash', color: '#000000', life: 0.6 });
      api.startDefeat();
    }
  }
  function endMahoraga(reason) {
    if (!s.mahoraga) return;
    const m = s.mahoraga;
    s.mahoraga = null;
    if (s.ult.active?.type === 'mahoraga') s.ult.active = null;
    s.player.invuln = Math.max(s.player.invuln, 1.5);
    if (reason === 'left') floater('Mahoraga lost interest…', m.x, m.y - K(40), '#fde68a', true);
    else if (reason === 'cleared') api.announce('MAHORAGA CLEARED THE FIELD', '#fde047');
  }

  return { special, onKill, updateAlly, summonMahoraga, updateMahoraga, hitMahoraga, endMahoraga };
}
