// ─────────────────────────────────────────────────────────────────────────────
// Bio: THE TEN SHADOWS (skill) and MAHORAGA (ult). kitRuntime.js hands every
// Bio hook to this file.
//
//   s.kit.shadow    the shadow meter, in units of your own click damage (barCost a bar);
//                   only hits you land yourself fill it
//   s.kit.sign      M2 being held: { t0, x, y, open, aim, sel }. A tap summons the biggest
//                   default you can afford (1 Dogs · 2 Nue · 3 Serpent · 4 Elephant); held,
//                   the hand-sign wheel opens (the world slows) and you flick toward any of
//                   the eight shadows. The summon happens where you pressed.
//   s.allies        dogs (white / black / Totality), nue2, toad, deer
//   s.kit.*         tongues, oxen, serpents, tigers, drops (Max Elephant), floods,
//                   ward (Round Deer), garden (shadows used toward the domain), domain
//   e.boundT        a Toad-bound enemy: takes +30% DMG; the Serpent eats it at any HP
//   e.slow / e.vuln set here every frame (floods, the domain, bound) and read by the engine
//   s.mahoraga      the ult: enemies attack it instead of you; click to send it leaping
//   s.kit.dives     Nue diving onto its last target as it leaves
//   s.kit.twins     PERFECT GARDEN: every summon's shadow twin, a moment later
//   s.kit.found     a combo found for the first time on this device (the toast)
//   s.kit.byShiki   true while a shikigami's hit lands: its kills top up the meter
// ─────────────────────────────────────────────────────────────────────────────
import { foundCombo, combosFound } from '../utils/secrets';

// The hand-sign wheel, clockwise from the top. icon = a silhouette in data/gameIcons.js
export const SHADOWS = [
  { id: 'dogs',     name: 'DIVINE DOGS',   short: 'DOGS',     cost: 1, icon: 'dog' },
  { id: 'toad',     name: 'TOAD',          short: 'TOAD',     cost: 1, icon: 'toad' },
  { id: 'nue',      name: 'NUE',           short: 'NUE',      cost: 2, icon: 'nue' },
  { id: 'ox',       name: 'PIERCING OX',   short: 'OX',       cost: 2, icon: 'ox' },
  { id: 'deer',     name: 'ROUND DEER',    short: 'DEER',     cost: 2, icon: 'deer' },
  { id: 'serpent',  name: 'GREAT SERPENT', short: 'SERPENT',  cost: 3, icon: 'serpent' },
  { id: 'tiger',    name: 'TIGER FUNERAL', short: 'TIGER',    cost: 3, icon: 'tiger' },
  { id: 'elephant', name: 'MAX ELEPHANT',  short: 'ELEPHANT', cost: 4, icon: 'elephant' },
];
export const SHADOW_BY_ID = Object.fromEntries(SHADOWS.map(x => [x.id, x]));
export const TAP_SUMMON = [null, 'dogs', 'nue', 'serpent', 'elephant'];   // a tap with that many bars
// effect kinds TenShadowsFx draws
export const TS_EFFECTS = new Set(['puddle', 'rabbits', 'bolt', 'hand', 'claws', 'wisp', 'saved']);
// The combos. Each one is announced the first time it goes off on this device (utils/secrets.js
// remembers which); icons: silhouettes from data/gameIcons.js ('wheel' = Mahoraga's wheel)
export const COMBOS = [
  { id: 'totality',     name: 'TOTALITY',              icons: ['dog', 'dog'] },
  { id: 'thunderflood', name: 'THUNDER FLOOD',         icons: ['nue', 'elephant'] },
  { id: 'boundprey',    name: 'BOUND PREY',            icons: ['toad', 'serpent'] },
  { id: 'tidal',        name: 'TIDAL CHARGE',          icons: ['ox', 'elephant'] },
  { id: 'packhunt',     name: 'PACK HUNT',             icons: ['tiger', 'dog'] },
  { id: 'leviathan',    name: 'LEVIATHAN',             icons: ['serpent', 'elephant'] },
  { id: 'holywater',    name: 'HOLY WATER',            icons: ['deer', 'elephant'] },
  { id: 'lightningrod', name: 'LIGHTNING ROD',         icons: ['nue', 'toad'] },
  { id: 'stampede',     name: 'STAMPEDE',              icons: ['ox', 'dog'] },
  { id: 'ritual',       name: 'THE FULL RITUAL',       icons: ['wheel'] },
  { id: 'general',      name: 'GENERAL OF THE GARDEN', icons: ['wheel', 'grasp'] },
  { id: 'perfect',      name: 'PERFECT GARDEN',        icons: ['dog', 'toad', 'nue', 'ox', 'deer', 'serpent', 'tiger', 'elephant'] },
];
// the ones this device has found (read once; foundCombo writes them back)
let known = null;
const knownSet = () => { if (!known) known = new Set(combosFound()); return known; };
export const combosKnown = () => COMBOS.filter(c => knownSet().has(c.id)).length;
export const SIGN_HOLD = 0.22;   // held longer than this → the wheel opens
const SIGN_MAX = 0.9;            // game seconds the wheel stays open (3s of real time): then the sign breaks
const SLOW = 0.3;                // how fast the world runs while the wheel is open
const CUTIN_SLOW = 0.2;          // …and while a cut-in covers the screen
export const WHEEL_DEAD = 26;    // design px from the middle before a slice is picked (mouse)
export const THUMB_DEAD = 14;    // screen px the thumb slides on the phone's SPECIAL button
// which slice a direction points at (0 = top, clockwise)
export const sliceAt = (dx, dy) => ((Math.round((Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;
// what a shadow costs (in the garden everything costs a bar less), and what a tap buys
export const costFor = (id, domain) => Math.max(1, SHADOW_BY_ID[id].cost - (domain ? 1 : 0));
export function tapFor(bars, domain) {
  for (let n = Math.min(4, bars + (domain ? 1 : 0)); n >= 1; n--) if (costFor(TAP_SUMMON[n], domain) <= bars) return TAP_SUMMON[n];
  return null;
}
const ADAPT_NAMES = { circle: 'SLAMS', slash: 'SLASHES', shot: 'SHOTS', dash: 'DASHES', bite: 'BITES', poison: 'POISON', hit: 'HITS' };

export function createTenShadows(c) {
  const { s, api, K, rand, dist, distToSegment, clamp, floater, effect, shake, sfx, nextId,
    skill, kitHit, ultHit, foes, radius, center, focus, nearest, bestAngle, lineThrough, launch, heavy } = c;

  const arr = key => { if (!s.kit[key]) s.kit[key] = []; return s.kit[key]; };
  const domainOn = () => !!s.kit.domain;
  const cap = sk => Math.round(sk.maxBars) * sk.barCost;
  const bars = sk => Math.min(Math.round(sk.maxBars), Math.floor((s.kit.shadow ?? 0) / sk.barCost));
  const cost = id => costFor(id, domainOn());
  const gardenReady = sk => !domainOn() && (s.kit.garden?.length ?? 0) >= Math.round(sk.gardenNeed);
  const rank = e => (e.tier === 'boss' ? 3 : e.tier === 'elite' ? 2 : 1);
  // bound / frozen / downed prey
  const helpless = e => e.boundT > 0 || e.frozen > 0;
  const floodAt = (x, y) => (s.kit.floods ?? []).find(f => dist(x, y, f.x, f.y) <= f.r) ?? null;
  // a shikigami's hit (or kill): what it kills tops up your meter (onKill)
  function sHit(e, mult, opts) { s.kit.byShiki = true; try { return kitHit(e, mult, opts); } finally { s.kit.byShiki = false; } }
  function sKill(e) { s.kit.byShiki = true; try { api.killEnemy(e); } finally { s.kit.byShiki = false; } }
  // a combo went off: the first time on this device it's announced as found
  function combo(id) {
    const set = knownSet();
    if (set.has(id)) return;
    const c = COMBOS.find(x => x.id === id);
    if (!c) return;
    set.add(id); foundCombo(id);
    s.kit.found = { id, name: c.name, icons: c.icons, n: combosKnown(), of: COMBOS.length, t: 0 };
    sfx('discover');
  }

  // ── The meter ────────────────────────────────────────────────────────────
  function onDamage(sk, dmg) {
    if (!s.direct || dmg <= 0) return;
    s.kit.shadow = Math.min(cap(sk), (s.kit.shadow ?? 0) + dmg / Math.max(1, s.stats.clickDmg) * (domainOn() ? 2 : 1));
  }
  // A kill one of your shikigami made: a wisp of shadow comes back to you
  function onKill(sk, e) {
    if (!s.kit.byShiki || e.tier === 'treasure' || e.tier === 'boss') return;
    s.kit.shadow = Math.min(cap(sk), (s.kit.shadow ?? 0) + (e.tier === 'elite' ? 6 : 2) * (domainOn() ? 2 : 1));
    const P = s.player.pos;
    if (P && s.time - (s.kit.wispT ?? -9) > 0.06) { s.kit.wispT = s.time; effect({ kind: 'wisp', x: e.x, y: e.y, x1: P.x, y1: P.y, life: 0.5 }); }
  }
  // For the UI (the SPECIAL circle): full bars, and the whole meter as a fraction
  function info(sk) {
    const sh = s.kit.shadow ?? 0;
    return { kind: 'count', n: bars(sk), max: Math.round(sk.maxBars), fill: sh / cap(sk), color: '#818cf8', hint: 'Ten Shadows: tap M2 / Q to summon for your full bars · hold M2 to pick a shadow on the wheel' };
  }
  // What a tap would summon right now (for the chip)
  const tapPick = sk => tapFor(bars(sk), domainOn());

  // ── The hand sign (M2) ───────────────────────────────────────────────────
  function press(sk, x, y) {
    if (s.kit.sign) return false;
    s.kit.sign = { t0: s.time, x, y, open: false, aim: null, sel: -1 };
    return true;
  }
  // phone: how far the thumb has slid on the SPECIAL button (screen px)
  function signAim(dx, dy) { if (s.kit.sign) s.kit.sign.aim = { dx, dy }; }
  // the slice the hand sign points at (-1 = the middle)
  function signSel(sign) {
    let dx, dy, dead;
    if (sign.aim) { dx = sign.aim.dx; dy = sign.aim.dy; dead = THUMB_DEAD; }
    else { const P = s.player.pos ?? sign; dx = P.x - sign.x; dy = P.y - sign.y; dead = K(WHEEL_DEAD); }
    return Math.hypot(dx, dy) < dead ? -1 : sliceAt(dx, dy);
  }
  function release(sk) {
    const sign = s.kit.sign;
    if (!sign) return;
    s.kit.sign = null;
    if (!c.fighting()) return;
    if (!sign.open) { quick(sk, sign.x, sign.y); return; }
    const i = signSel(sign);
    if (i < 0) { if (gardenReady(sk)) expand(sk, sign.x, sign.y); return; }   // the middle: cancel (or the domain)
    cast(sk, SHADOWS[i].id, sign.x, sign.y);
  }
  // a tap: the biggest default the bars can buy
  function quick(sk, x, y) {
    if (s.time - (s.kit.summonT ?? -9) < 0.3) return;
    const id = tapPick(sk);
    if (!id) { floater('not enough shadow', x, y - K(30), '#a5b4fc'); sfx('miss'); return; }
    cast(sk, id, x, y);
  }
  function cast(sk, id, x, y) {
    const sh = SHADOW_BY_ID[id], n = cost(id);
    if (bars(sk) < n) { floater(`${sh.short} needs ${n} bar${n > 1 ? 's' : ''}`, x, y - K(30), '#a5b4fc'); sfx('miss'); return false; }
    s.kit.shadow -= n * sk.barCost; s.kit.summonT = s.time;
    effect({ kind: 'puddle', x, y, r: K(55 + sh.cost * 22), life: 0.8 });
    floater(sh.name, x, y - K(64), '#c7d2fe', true);
    SUMMON[id](sk, x, y);
    sfx('summon');
    // PERFECT GARDEN: every shadow comes with its twin
    if (s.kit.domain?.perfect) arr('twins').push({ id: nextId(), shadow: id, x, y, t: 0.35, sk });
    // Chimera Shadow Garden: call enough different shadows and the domain is ready (all eight: it'll be perfect)
    if (!domainOn()) {
      const g = arr('garden');
      if (!g.includes(id)) {
        g.push(id);
        if (g.length === Math.round(sk.gardenNeed)) { api.announce('CHIMERA SHADOW GARDEN · READY', '#a5b4fc'); sfx('sign'); }
        if (g.length === SHADOWS.length) { api.announce('ALL EIGHT · THE GARDEN WILL BE PERFECT', '#fef3c7'); sfx('sign'); }
      }
    }
    return true;
  }

  // ── The eight shadows ────────────────────────────────────────────────────
  // a Toad-bound enemy: stuck (unless it's a boss or part of one) and takes +30% DMG
  function bind(e, sec) {
    e.boundT = Math.max(e.boundT ?? 0, sec);
    if (e.tier !== 'boss' && !e.group) e.frozen = Math.max(e.frozen ?? 0, sec);
    if (e.dashing) api.finishAttack(e.dashing);
  }
  const SUMMON = {
    // 1 · two dogs, white and black; again while they're out → they fuse into Totality
    dogs(sk, x, y) {
      const dogs = s.allies.filter(a => a.kind === 'dog' && a.ts);
      const tot = dogs.find(d => d.totality);
      if (tot) {   // Totality is already out: it howls (shoving the small ones back) and stays longer
        tot.life += sk.dogDur * 0.5; tot.howl = 0.6;
        foes().filter(e => !heavy(e) && dist(e.x, e.y, tot.x, tot.y) <= K(190)).forEach(e => launch(e, tot, 0.55));
        effect({ kind: 'ring', x: tot.x, y: tot.y, r: K(190), color: '#e2e8f0', life: 0.5 });
        floater('TOTALITY HOWLS', tot.x, tot.y - K(50), '#e2e8f0', true);
        sfx('howl');
        return;
      }
      if (dogs.length) {   // the two dogs become one
        const life = Math.max(...dogs.map(d => d.life)) + 4;
        s.allies = s.allies.filter(a => !(a.kind === 'dog' && a.ts));
        s.allies.push({ id: nextId(), kind: 'dog', ts: true, summoned: true, totality: true, x, y, pct: sk.dogPct * 2.4, life, biteT: 0, target: null, howl: 0.8 });
        api.announce('DIVINE DOG: TOTALITY', '#e2e8f0');
        combo('totality');
        effect({ kind: 'ring', x, y, r: K(110), color: '#e2e8f0', life: 0.5 });
        shake(0.3); sfx('howl');
        return;
      }
      for (let i = 0; i < 2; i++) s.allies.push({ id: nextId(), kind: 'dog', ts: true, summoned: true, white: i === 0, x: x + (i ? K(30) : -K(30)), y, pct: sk.dogPct, life: sk.dogDur, biteT: i * 0.2, target: null });
      sfx('bark');
    },
    // 1 · the tongue grabs the enemy you summoned it on (or the pest farthest away), binds it and
    //     reels it in; then the toad sits by your cursor and swallows one hit meant for you
    toad(sk, x, y, twin) {
      const taken = new Set((s.kit.tongues ?? []).map(tg => tg.target));   // a tongue's already on its way there
      const free = foes().filter(e => !taken.has(e.id));
      const near = nearest(x, y, free);
      let t = near && dist(x, y, near.x, near.y) <= K(twin ? 320 : 220) + radius(near) ? near : null;
      if (!t) {
        const kiters = free.filter(e => e.move === 'kite');
        t = kiters.length ? kiters.reduce((b, e) => (dist(x, y, e.x, e.y) > dist(x, y, b.x, b.y) ? e : b)) : near;
      }
      if (!twin) s.allies = s.allies.filter(a => a.kind !== 'toad');
      const tx = clamp(x + (twin ? K(70) : 0), K(40), s.W - K(40)), ty = clamp(y + K(20), K(50), s.H - K(30));
      const toad = { id: nextId(), kind: 'toad', ts: true, x: tx, y: ty, life: 14, sit: t ? 0.6 : 0, slot: twin ? 1 : 0 };
      s.allies.push(toad);
      if (t) arr('tongues').push({ id: nextId(), toad: toad.id, x: tx, y: ty - K(12), target: t.id, t: 0, out: 0.16, pull: 0.3, pct: sk.toadPct, bind: sk.bind, hit: false, from: null, tx: t.x, ty: t.y });
      sfx('tongue');
    },
    // 2 · circles above your cursor, lightning on what you point at
    nue(sk, x, y, twin) {
      if (!twin) s.allies = s.allies.filter(a => a.kind !== 'nue2');
      const other = s.allies.find(a => a.kind === 'nue2');
      s.allies.push({ id: nextId(), kind: 'nue2', ts: true, x, y: y - K(60), pct: sk.nuePct, life: sk.nueDur, zapT: twin ? 0.6 : 0.3, ang: other ? other.ang + Math.PI : 0, last: null });
      sfx('thunder');
    },
    // 2 · charges across the whole screen through where you summoned it, along the line that
    //     catches the most; harder the farther it has run; throws them (walls crush)
    ox(sk, x, y, twin) {
      const prev = twin ? (s.kit.oxen ?? []).at(-1) : null;   // its twin charges across it: an X
      const a0 = prev ? prev.a + Math.PI / 2 : bestAngle(x, y, K(110));
      const a = Math.cos(a0) >= -0.01 ? a0 : a0 + Math.PI;   // left → right (or top → bottom)
      const L = Math.hypot(s.W, s.H) * 0.75;
      // STAMPEDE: Totality runs with it (wider, harder, and the dog stays longer)
      const tot = s.allies.find(d => d.kind === 'dog' && d.ts && d.totality);
      arr('oxen').push({ id: nextId(), a, x0: x - Math.cos(a) * L, y0: y - Math.sin(a) * L, x1: x + Math.cos(a) * L, y1: y + Math.sin(a) * L,
        x: x - Math.cos(a) * L, y: y - Math.sin(a) * L, t: 0, dur: 0.72, hit: [], pct: sk.oxPct, wet: false, stampede: !!tot });
      if (tot && !twin) {
        tot.life += 3; tot.howl = 0.6;
        floater('STAMPEDE', x, y - K(96), '#e2e8f0', true);
        combo('stampede'); sfx('howl');
      }
      shake(0.2); sfx('ox');
    },
    // 2 · heals you, clears debuffs, and its ward around your cursor erases enemy shots
    deer(sk, x, y, twin) {
      if (!twin) s.allies = s.allies.filter(a => a.kind !== 'deer');
      s.allies.push({ id: nextId(), kind: 'deer', ts: true, x, y, life: sk.wardDur + 0.4, heal: sk.deerHeal * s.player.maxHp / 1.5 * (twin ? 0.5 : 1), healT: 1.5, slot: twin ? 1 : 0 });
      const w = s.kit.ward;
      if (twin && w) { w.dur = w.t + sk.wardDur; w.r = K(190); }   // two deer: a wider ward
      else s.kit.ward = { t: 0, dur: sk.wardDur, r: K(150), tick: 0.5, saved: false };
      if (Object.keys(s.player.debuffs ?? {}).length) { s.player.debuffs = {}; floater('CLEANSED', x, y - K(90), '#bbf7d0', true); }
      // HOLY WATER: the deer blesses the flood — it heals you while your cursor is in it, burns them, lasts longer
      const floods = s.kit.floods ?? [];
      if (!twin && floods.length) {
        floods.forEach(f => { if (!f.holy) { f.holy = true; f.burnT = 0; } f.dur += 3; });
        api.announce('HOLY WATER', '#fef9c3');
        combo('holywater');
      }
      sfx('deer');
    },
    // 3 · rises under its prey and swallows it if it's weak (or bound) — bound prey nearby first
    serpent(sk, x, y, twin) {
      const taken = new Set(twin ? (s.kit.serpents ?? []).map(sp => sp.target) : []);
      const pool = foes().filter(e => !taken.has(e.id));
      const bound = pool.filter(e => e.boundT > 0 && dist(x, y, e.x, e.y) <= K(300) + radius(e));
      const t = (bound.length ? nearest(x, y, bound) : null)
        ?? (() => { const e = nearest(x, y, pool); return e && dist(x, y, e.x, e.y) <= K(twin ? 360 : 220) + radius(e) ? e : null; })()
        ?? (twin ? nearest(x, y) : focus(170));
      const at = { x: t?.x ?? x, y: t?.y ?? y };
      // LEVIATHAN: out of the flood it comes up bigger, swallows more, and thrashes the whole water
      const fl = floodAt(at.x, at.y);
      arr('serpents').push({ id: nextId(), x: at.x, y: at.y, t: 0, life: 1.5, target: t?.id ?? null, struck: false, sk, lev: fl ? { x: fl.x, y: fl.y, r: fl.r } : null });
      if (fl) { floater('LEVIATHAN', at.x, at.y - K(120), '#7dd3fc', true); combo('leviathan'); sfx('splash'); }
      sfx('hiss');
    },
    // 3 · pounces on the strongest enemy near you and mauls it; the weak don't get up
    tiger(sk, x, y, twin) {
      const taken = new Set(twin ? (s.kit.tigers ?? []).map(tg => tg.target) : []);
      const all = foes().filter(e => !taken.has(e.id));
      const near = all.filter(e => dist(x, y, e.x, e.y) <= K(360) + radius(e));
      const pool = near.length ? near : all.length ? all : foes();
      const score = e => rank(e) + (helpless(e) ? 0.5 : 0);   // the strongest — helpless prey breaks a tie
      const t = pool.reduce((b, e) => (!b || score(e) > score(b) || (score(e) === score(b) && e.hp > b.hp) ? e : b), null);
      const tg = { id: nextId(), x, y, x0: x, y0: y, target: t?.id ?? null, t: 0, leap: 0.3, mauls: 4, mT: 0, pct: sk.tigerPct, phase: t ? 'leap' : 'gone', fade: 0, face: t && t.x < x ? -1 : 1, pack: false };
      arr('tigers').push(tg);
      // PACK HUNT: the dogs join in — they go for its prey and bite twice as fast while it mauls
      const pack = s.allies.filter(a => a.kind === 'dog' && a.ts);
      if (t && pack.length) {
        tg.pack = true;
        if (!twin) {
          pack.forEach(d => { d.pack = tg.id; d.target = t.id; });
          floater('PACK HUNT', x, y - K(90), '#fdba74', true);
          combo('packhunt'); sfx('howl');
        }
      }
      sfx('roar');
    },
    // 4 · drops out of the sky, floods everything around it (stun, knock back, water stays)
    elephant(sk, x, y, twin) {
      let at = { x, y };
      if (twin) {   // its twin drops on the biggest crowd the first one missed (or right next to it)
        const R = K(230), first = (s.kit.drops ?? []).at(-1) ?? { x, y };
        const rest = foes().filter(e => dist(e.x, e.y, first.x, first.y) > R);
        let best = null, bn = 0;
        for (const e of rest) { const n = rest.filter(o => dist(o.x, o.y, e.x, e.y) <= K(200)).length + rank(e); if (n > bn) { bn = n; best = e; } }
        at = best ? { x: best.x, y: best.y } : { x: clamp(x + (x < s.W / 2 ? 1 : -1) * K(260), K(60), s.W - K(60)), y };
      }
      arr('drops').push({ id: nextId(), x: at.x, y: at.y, t: 0, fall: 0.6, r: K(230), landed: false, sk });
      sfx('trumpet');
    },
  };

  // ── Chimera Shadow Garden ────────────────────────────────────────────────
  function expand(sk, x, y) {
    const perfect = (s.kit.garden?.length ?? 0) >= SHADOWS.length;   // all eight called first: half as long again, and twins
    s.kit.domain = { t: 0, dur: sk.domainDur * (perfect ? 1.5 : 1), x, y, perfect };
    s.kit.garden = [];
    s.kit.cutin = { kind: 'domain', t: 0, life: 1.5, perfect };
    if (perfect) combo('perfect');
    effect({ kind: 'flash', color: '#000000', life: 0.9 });
    shake(0.6); sfx('domain');
  }
  // your clicks pull shadow hands up out of the floor
  function afterClick(e, auto) {
    if (!domainOn() || auto || !e || !s.enemies.includes(e) || e.refl?.state === 'on') return;
    kitHit(e, 0.4, { color: '#a5b4fc', quiet: true });
    if (s.time - (s.kit.handT ?? -9) > 0.07) { s.kit.handT = s.time; effect({ kind: 'hand', x: e.x + rand(-K(10), K(10)), y: e.y + radius(e) * 0.55, r: radius(e), life: 0.5 }); }
  }

  // ── Every frame ──────────────────────────────────────────────────────────
  function timeScale() {
    if (s.kit.sign?.open) return SLOW;
    if (s.kit.cutin) return CUTIN_SLOW;
    return 1;
  }
  function update(sk, dt, live) {
    const kit = s.kit, P = s.player.pos;
    const scale = timeScale();
    // cut-ins (Mahoraga, the garden) and the combo toast run on real time, the world crawls under them
    if (kit.cutin) { kit.cutin.t += dt / scale; if (kit.cutin.t >= kit.cutin.life) kit.cutin = null; }
    if (kit.found) { kit.found.t += dt / scale; if (kit.found.t >= 3) kit.found = null; }

    const sign = kit.sign;
    if (sign) {
      if (sk?.type !== 'tenshadows' || s.mahoraga) kit.sign = null;   // switched card / the ult went off
      else {
        if (!sign.open && s.time - sign.t0 >= SIGN_HOLD) { sign.open = true; sfx('sign'); }
        if (sign.open) { const sel = signSel(sign); if (sel !== sign.sel) { sign.sel = sel; if (sel >= 0) sfx('tick'); } }
        // you can't hold the world slow forever
        if (sign.open && s.time - sign.t0 >= SIGN_HOLD + SIGN_MAX) { kit.sign = null; floater('the sign breaks', sign.x, sign.y - K(30), '#a5b4fc'); }
      }
    }

    // the garden
    const dom = kit.domain;
    if (dom) {
      if (!s.mahoraga?.general) dom.t += dt;   // GENERAL OF THE GARDEN: it stays open while Mahoraga stands
      if (dom.t >= dom.dur) {
        kit.domain = null;
        effect({ kind: 'flash', color: '#1e1b4b', life: 0.5 });
        if (P) floater('THE GARDEN DRAINS', P.x, P.y - K(70), '#a5b4fc', true);
      }
    }
    // floods (Max Elephant's water)
    if (kit.floods?.length) {
      for (const f of kit.floods) {
        f.t += dt; if (f.zap > 0) f.zap -= dt;
        if (!f.holy) continue;
        // HOLY WATER: it heals you while your cursor is in it, and burns everything standing in it
        if (P && dist(P.x, P.y, f.x, f.y) <= f.r) api.heal(s.player.maxHp * 0.02 * dt);
        f.burnT -= dt;
        if (f.burnT <= 0 && live) {
          f.burnT = 0.5;
          let n = 0;
          foes().filter(e => dist(e.x, e.y, f.x, f.y) <= f.r).forEach(e => sHit(e, 0.4, { color: '#fef9c3', quiet: n++ > 1 }));
        }
      }
      kit.floods = kit.floods.filter(f => f.t < f.dur);
    }
    // PERFECT GARDEN: the shadow twins arrive
    if (kit.twins?.length) {
      for (const tw of kit.twins) {
        tw.t -= dt;
        if (tw.t > 0) continue;
        if (!c.fighting()) continue;
        effect({ kind: 'puddle', x: tw.x, y: tw.y, r: K(70), life: 0.7 });
        floater('SHADOW TWIN', tw.x, tw.y - K(40), '#fef3c7');
        SUMMON[tw.shadow](tw.sk, tw.x, tw.y, true);
      }
      kit.twins = kit.twins.filter(tw => tw.t > 0);
    }
    // Nue diving onto its last target as it leaves
    if (kit.dives?.length) {
      for (const dv of kit.dives) {
        dv.t += dt;
        const e = s.enemies.find(o => o.id === dv.target && !(o.down > 0));
        if (e && !dv.hit) { dv.tx = e.x; dv.ty = e.y; }
        const p = Math.min(1, dv.t / dv.dur), q = p * p;
        dv.x = dv.x0 + (dv.tx - dv.x0) * q; dv.y = dv.y0 + (dv.ty - dv.y0) * q;
        if (!dv.hit && p >= 1) {
          dv.hit = true;
          if (e && live) lightning(e, dv.pct, dv.tx, dv.ty - K(420), true);
          effect({ kind: 'ring', x: dv.tx, y: dv.ty, r: K(120), color: '#fde047', life: 0.4 });
          shake(0.3);
        }
      }
      kit.dives = kit.dives.filter(dv => dv.t < dv.dur + 0.3);
    }
    // Round Deer's ward: positive energy around your cursor
    const w = kit.ward;
    if (w) {
      w.t += dt; w.tick -= dt;
      if (w.tick <= 0 && P && live) {
        w.tick = 0.5;
        let n = 0;
        foes().filter(e => dist(e.x, e.y, P.x, P.y) <= w.r + radius(e) * 0.5).forEach(e => sHit(e, 0.3, { color: '#bbf7d0', quiet: n++ > 0 }));
      }
      if (w.t >= w.dur) kit.ward = null;
    }
    // slowed by water / the garden, bound prey and the garden make them take more
    if (dom || kit.floods?.length || kit.slowing) {
      let any = false;
      for (const e of s.enemies) {
        if (e.boundT > 0) e.boundT -= dt;
        let slow = 1, vuln = 1;
        if (dom) { slow *= 0.6; vuln *= 1.15; }
        if (kit.floods?.length && floodAt(e.x, e.y)) slow *= 0.65;
        if (e.boundT > 0) vuln *= 1.3;
        e.slow = slow < 1 ? slow : undefined;
        e.vuln = vuln > 1 ? vuln : undefined;
        if (e.slow || e.vuln) any = true;
      }
      kit.slowing = any;
    }

    // the Toad's tongue: out, grab, reel in
    if (kit.tongues?.length) {
      for (const tg of kit.tongues) {
        tg.t += dt;
        const e = s.enemies.find(o => o.id === tg.target);
        const toad = s.allies.find(a => a.id === tg.toad);
        if (toad) { tg.x = toad.x; tg.y = toad.y - K(12); }
        if (!e) { tg.done = true; continue; }
        tg.tx = e.x; tg.ty = e.y;
        if (!tg.hit && tg.t >= tg.out) {
          tg.hit = true;
          if (live && !(e.down > 0)) sHit(e, tg.pct, { color: '#86efac', label: 'TONGUE ' });
          if (!s.enemies.includes(e)) { tg.done = true; continue; }
          bind(e, tg.bind);
          kit.slowing = true;
          floater('BOUND', e.x, e.y - radius(e) - K(16), '#86efac');
          if (!heavy(e) && e.tier !== 'boss') { tg.from = { x: e.x, y: e.y }; e.kb = null; }
          sfx('hit');
        }
        if (tg.hit && tg.from) {
          const p = Math.min(1, (tg.t - tg.out) / tg.pull), q = 1 - (1 - p) ** 2;
          const side = tg.from.x >= tg.x ? 1 : -1, toX = tg.x + side * K(52), toY = tg.y + K(8);
          e.x = tg.from.x + (toX - tg.from.x) * q; e.y = tg.from.y + (toY - tg.from.y) * q;
          if (p >= 1) tg.done = true;
        } else if (tg.hit && tg.t >= tg.out + 0.15) tg.done = true;
      }
      kit.tongues = kit.tongues.filter(tg => !tg.done);
    }

    // Piercing Ox
    if (kit.oxen?.length) {
      for (const ox of kit.oxen) {
        const p0 = Math.min(1, ox.t / ox.dur);
        ox.t += dt;
        const p = Math.min(1, ox.t / ox.dur);
        const px = ox.x, py = ox.y;
        ox.x = ox.x0 + (ox.x1 - ox.x0) * p; ox.y = ox.y0 + (ox.y1 - ox.y0) * p;
        if (!ox.wet && floodAt(ox.x, ox.y)) { ox.wet = true; floater('TIDAL CHARGE', ox.x, ox.y - K(60), '#7dd3fc', true); combo('tidal'); sfx('splash'); }
        if (live) {
          const ux = Math.cos(ox.a), uy = Math.sin(ox.a);
          for (const e of foes()) {
            if (ox.hit.includes(e.id)) continue;
            if (distToSegment(e.x, e.y, px, py, ox.x, ox.y) > K(ox.stampede ? 102 : 64) + radius(e) * 0.6) continue;
            ox.hit.push(e.id);
            // the farther it has run, the harder it hits (the water makes it a wave, Totality a stampede)
            sHit(e, ox.pct * (1 + 0.5 * (p0 + p) / 2) * (ox.wet ? 1.5 : 1) * (ox.stampede ? 1.3 : 1), { color: ox.stampede ? '#e2e8f0' : '#fca5a5', label: 'OX ', quiet: ox.hit.length > 4 });
            if (s.enemies.includes(e) && !heavy(e)) {
              // thrown forward and off the line
              const side = (e.x - ox.x) * -uy + (e.y - ox.y) * ux >= 0 ? 1 : -1;
              launch(e, { x: e.x - (ux - uy * side * 0.7) * K(40), y: e.y - (uy + ux * side * 0.7) * K(40) }, ox.wet ? 1.5 : 1.15);
            }
            effect({ kind: 'shards', x: e.x, y: e.y, r: radius(e), color: '#fca5a5', n: 6 });
            shake(0.12);
          }
        }
        if (p >= 1) ox.done = true;
      }
      kit.oxen = kit.oxen.filter(ox => !ox.done);
    }

    // the Great Serpent rises, strikes, sinks back
    if (kit.serpents?.length) {
      for (const sp of kit.serpents) {
        sp.t += dt;
        const t = s.enemies.find(e => e.id === sp.target);
        if (t && !sp.struck) { sp.x = t.x; sp.y = t.y; }
        if (!sp.struck && sp.t >= 0.4) {
          sp.struck = true;
          const sk2 = sp.sk;
          const lev = sp.lev;
          if (t && !(t.down > 0) && live) {
            const bound = t.boundT > 0;
            sHit(t, sk2.serpentPct * (lev ? 1.5 : 1), { color: lev ? '#7dd3fc' : '#a5b4fc', label: lev ? 'LEVIATHAN ' : 'SERPENT ' });
            if (t.hp > 0 && s.enemies.includes(t) && t.tier !== 'boss' && !t.group && (bound || t.hp / t.maxHp <= (lev ? Math.max(sk2.devour, 0.5) : sk2.devour))) {
              floater(bound ? 'BOUND PREY · SWALLOWED' : 'SWALLOWED', t.x, t.y - K(40), '#c7d2fe', true);
              if (bound) combo('boundprey');
              sKill(t);
            } else if (t.hp > 0 && t.tier !== 'boss') t.frozen = Math.max(t.frozen ?? 0, 1.5);
          }
          let n = 0;
          if (lev) {   // it thrashes: everything in the water
            foes().filter(e => e !== t && dist(e.x, e.y, lev.x, lev.y) <= lev.r + radius(e) * 0.5)
              .forEach(e => { sHit(e, sk2.serpentPct * 0.5, { color: '#7dd3fc', quiet: n++ >= 3 }); if (s.enemies.includes(e) && !heavy(e)) launch(e, sp, 0.6); });
            [0, 0.1].forEach((d, i) => effect({ kind: 'ring', x: sp.x, y: sp.y, r: lev.r * (0.6 + 0.4 * i), color: '#7dd3fc', life: 0.5 + d }));
            effect({ kind: 'shards', x: sp.x, y: sp.y, r: K(150), color: '#7dd3fc', n: 18 });
            sfx('splash');
          } else foes().filter(e => e !== t && dist(e.x, e.y, sp.x, sp.y) <= K(115) + radius(e) * 0.5)
            .forEach(e => sHit(e, sk2.serpentPct * 0.25, { color: '#a5b4fc', quiet: n++ >= 3 }));
          effect({ kind: 'shards', x: sp.x, y: sp.y, r: K(110), color: '#312e81', n: 14 });
          shake(lev ? 0.6 : 0.4); sfx('bigKill');
        }
      }
      kit.serpents = kit.serpents.filter(sp => sp.t < sp.life);
    }

    // Tiger Funeral: leap, maul ×4 (harder the more it's already hurt, +25% on helpless prey)
    if (kit.tigers?.length) {
      for (const tg of kit.tigers) {
        tg.t += dt;
        let e = s.enemies.find(o => o.id === tg.target && !(o.down > 0));
        if (tg.phase !== 'gone' && !e) {
          // its prey is gone: the next one close by (or it's done)
          const next = nearest(tg.x, tg.y);
          if (next && tg.mauls > 0 && dist(tg.x, tg.y, next.x, next.y) <= K(280)) { e = next; tg.target = next.id; tg.phase = 'leap'; tg.t = 0; tg.x0 = tg.x; tg.y0 = tg.y; tg.face = next.x < tg.x ? -1 : 1; }
          else tg.phase = 'gone';
        }
        if (tg.phase === 'leap') {
          const p = Math.min(1, tg.t / tg.leap);
          tg.x = tg.x0 + (e.x - tg.x0) * p; tg.y = tg.y0 + (e.y - tg.y0) * p - Math.sin(p * Math.PI) * K(90);
          if (p >= 1) { tg.phase = 'maul'; tg.mT = 0; }
        } else if (tg.phase === 'maul') {
          tg.x = e.x; tg.y = e.y;
          tg.mT -= dt;
          if (tg.mT <= 0 && tg.mauls > 0 && live) {
            tg.mT = 0.22; tg.mauls--;
            const missing = 1 - Math.max(0, e.hp) / e.maxHp;
            sHit(e, tg.pct * (1 + missing) * (helpless(e) ? 1.25 : 1) * (tg.pack ? 1.2 : 1), { color: '#fdba74', label: 'TIGER ' });
            effect({ kind: 'claws', x: e.x, y: e.y, r: radius(e), a: rand(-0.7, 0.7), life: 0.32 });
            shake(0.12); sfx('crit');
            if (tg.mauls === 0 && s.enemies.includes(e) && e.tier !== 'boss' && !e.group && e.hp / e.maxHp <= 0.25) {
              floater('FUNERAL', e.x, e.y - K(44), '#fdba74', true);
              sKill(e);
            }
          }
          if (tg.mauls === 0 && tg.mT <= 0) tg.phase = 'gone';
        } else if (tg.phase === 'gone') {
          tg.fade += dt;
          if (tg.fade > 0.45) tg.done = true;
        }
      }
      kit.tigers = kit.tigers.filter(tg => !tg.done);
    }

    // Max Elephant lands: flood, stun, knock back — and the water stays a while
    if (kit.drops?.length) {
      for (const dp of kit.drops) {
        dp.t += dt;
        if (!dp.landed && dp.t >= dp.fall) {
          dp.landed = true;
          const sk2 = dp.sk;
          let n = 0;
          if (live) foes().filter(e => dist(e.x, e.y, dp.x, dp.y) <= dp.r + radius(e) * 0.5).forEach(e => {
            sHit(e, sk2.elephantPct, { color: '#93c5fd', label: 'FLOOD ', quiet: n++ >= 4 });
            if (e.hp > 0 && s.enemies.includes(e) && e.tier !== 'boss' && !e.group) {
              e.frozen = Math.max(e.frozen ?? 0, sk2.stun);
              launch(e, { x: dp.x, y: dp.y }, 0.55);
            }
          });
          arr('floods').push({ id: nextId(), x: dp.x, y: dp.y, r: dp.r * 0.95, t: 0, dur: sk2.floodDur, zap: 0 });
          [0, 0.12, 0.24].forEach((d, i) => effect({ kind: 'ring', x: dp.x, y: dp.y, r: dp.r * (0.55 + 0.25 * i), color: '#60a5fa', life: 0.6 + d }));
          effect({ kind: 'shards', x: dp.x, y: dp.y, r: dp.r * 0.7, color: '#93c5fd', n: 26 });
          effect({ kind: 'flash', color: '#1d4ed8', life: 0.45 });
          shake(0.85); sfx('boom'); sfx('splash');
        }
      }
      kit.drops = kit.drops.filter(dp => dp.t < dp.fall + 1.2);
    }
  }

  // Nue's lightning on t: it chains to the two closest — or, on bound prey, to everything around it
  // (LIGHTNING ROD) — and runs through the whole flood if it lands in the water (THUNDER FLOOD)
  function lightning(t, pct, x0, y0, big) {
    const rod = t.boundT > 0, tx = t.x, ty = t.y;
    effect({ kind: 'bolt', x: tx, y: ty, x0, y0, life: big ? 0.45 : 0.3, big });
    sHit(t, pct, { color: '#fde047', label: big ? 'DIVE ⚡' : '⚡' });
    const chain = foes().filter(e => e !== t && dist(e.x, e.y, tx, ty) <= K(rod ? 220 : 170));
    (rod ? chain : chain.sort((p, q) => dist(tx, ty, p.x, p.y) - dist(tx, ty, q.x, q.y)).slice(0, 2))
      .forEach((e, i) => { if (i < 8) effect({ kind: 'zap', x1: tx, y1: ty, x2: e.x, y2: e.y, life: 0.25 }); sHit(e, pct * (rod ? 0.6 : 0.5), { color: '#fde047', quiet: true }); });
    if (rod) {
      combo('lightningrod');
      if (s.time - (s.kit.rodT ?? -9) > 1.5) { s.kit.rodT = s.time; floater('LIGHTNING ROD', tx, ty - K(70), '#fde047', true); }
    }
    const fl = floodAt(tx, ty);
    if (fl) {
      const wet = foes().filter(e => e !== t && dist(e.x, e.y, fl.x, fl.y) <= fl.r);
      wet.forEach((e, i) => { sHit(e, pct * 0.6, { color: '#fde047', quiet: i > 2 }); if (i < 6) effect({ kind: 'zap', x1: tx, y1: ty, x2: e.x, y2: e.y, life: 0.25 }); });
      fl.zap = 0.3;
      if (!fl.thunder) { fl.thunder = true; api.announce('THUNDER FLOOD', '#fde047'); combo('thunderflood'); }
    }
    sfx('thunder');
  }
  // Nue leaves by diving onto the last thing it struck (2.5× a bolt)
  function dive(a, live) {
    if (a.dived) return;
    a.dived = true;
    const t = (live && (s.enemies.find(e => e.id === a.last && !(e.down > 0) && e.tier !== 'treasure') ?? focus(300))) || null;
    if (!t) { effect({ kind: 'puddle', x: a.x, y: a.y + K(70), r: K(40), life: 0.6 }); return; }
    arr('dives').push({ id: nextId(), x0: a.x, y0: a.y, x: a.x, y: a.y, tx: t.x, ty: t.y, target: t.id, t: 0, dur: 0.3, pct: a.pct * 2.5, hit: false });
    sfx('dive');
  }

  // The summoned allies (called by kitRuntime's ally loop). true = handled here.
  function updateAlly(a, dt, live, P) {
    if (a.kind === 'dog') {
      // they hunt whatever you point at (the enemy nearest your cursor), otherwise the closest one
      if (a.howl > 0) a.howl -= dt;
      a.lookT = (a.lookT ?? 0) - dt;
      let t = s.enemies.find(e => e.id === a.target);
      if (a.lookT <= 0) { a.lookT = 0.4; const f = focus(320); if (f) { t = f; a.target = f.id; } }
      // PACK HUNT: while the Tiger mauls, the pack goes for its prey
      const hunt = a.pack ? (s.kit.tigers ?? []).find(g => g.id === a.pack && g.phase !== 'gone') : null;
      if (a.pack && !hunt) a.pack = null;
      if (hunt) { const pe = s.enemies.find(e => e.id === hunt.target && !(e.down > 0)); if (pe) { t = pe; a.target = pe.id; } }
      if (!t || t.tier === 'treasure' || t.down > 0) { t = nearest(a.x, a.y); a.target = t?.id ?? null; }
      if (t) {
        const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy) || 1;
        const reach = radius(t) + K(14), spd = K(a.totality ? 380 : 330) * (hunt ? 1.3 : 1) * dt;
        if (d > reach) { a.x += dx / d * Math.min(d - reach, spd); a.y += dy / d * Math.min(d - reach, spd); }
        a.biteT -= dt;
        if (d <= reach + K(4) && a.biteT <= 0 && live) {
          a.biteT = (a.totality ? 0.4 : 0.45) * (hunt ? 0.5 : 1);
          sHit(t, a.pct, { color: a.totality ? '#e2e8f0' : hunt ? '#fdba74' : '#a5b4fc', label: '🐺' });
          effect({ kind: 'stab', x: t.x, y: t.y, r: radius(t), life: 0.2 });
          if (a.totality) {   // Totality's jaws are big enough to catch what's next to it too
            const R = radius(t) + K(60);
            let n = 0;
            foes().filter(e => e !== t && dist(e.x, e.y, t.x, t.y) <= R + radius(e) * 0.5).forEach(e => sHit(e, a.pct * 0.35, { color: '#e2e8f0', quiet: n++ >= 2 }));
            effect({ kind: 'ring', x: t.x, y: t.y, r: R, color: '#e2e8f0', life: 0.25 });
          }
        }
      }
      if (a.life <= 0) effect({ kind: 'puddle', x: a.x, y: a.y + K(10), r: K(a.totality ? 60 : 36), life: 0.6 });
      return true;
    }
    if (a.kind === 'nue2') {
      // circles above your cursor, calls lightning on what you point at
      a.ang += dt * 2;
      a.x += (P.x + Math.cos(a.ang) * K(70) - a.x) * Math.min(1, dt * 5);
      a.y += (P.y - K(90) + Math.sin(a.ang) * K(25) - a.y) * Math.min(1, dt * 5);
      a.zapT -= dt;
      if (a.zapT <= 0 && live) {
        a.zapT = 0.6;
        // bound prey draws it (LIGHTNING ROD), then whatever you point at, then the closest
        const bound = foes().filter(e => e.boundT > 0 && dist(P.x, P.y, e.x, e.y) <= K(420) + radius(e));
        const t = (bound.length ? nearest(P.x, P.y, bound) : null) ?? focus(260)
          ?? (() => { const e = nearest(P.x, P.y); return e && dist(P.x, P.y, e.x, e.y) <= K(420) ? e : null; })();
        if (t) { a.last = t.id; lightning(t, a.pct, a.x, a.y, false); }
      }
      if (a.life <= 0) dive(a, live);
      return true;
    }
    if (a.kind === 'toad') {
      // sits where it was summoned while its tongue works, then hops along by your cursor
      if (a.sit > 0) { a.sit -= dt; return true; }
      const tx = P.x - K(46 + 42 * (a.slot ?? 0)), ty = P.y + K(30 + 26 * (a.slot ?? 0));
      a.x += (tx - a.x) * Math.min(1, dt * 8); a.y += (ty - a.y) * Math.min(1, dt * 8);
      return true;
    }
    if (a.kind === 'deer') {
      if (a.healT > 0) { const d = Math.min(dt, a.healT); api.heal(a.heal * d); a.healT -= d; }
      const tx = P.x + K(a.slot ? 40 : 58), ty = P.y + K(a.slot ? -66 : 26);
      a.x += (tx - a.x) * Math.min(1, dt * 6); a.y += (ty - a.y) * Math.min(1, dt * 6);
      return true;
    }
    return false;
  }

  // Rabbit Escape: a burst of shadow rabbits takes the hit
  function absorb(pv, kind) {
    const P = s.player.pos;
    if (pv?.type !== 'rabbits' || !P || kind === 'poison' || Math.random() >= Math.min(0.6, pv.chance * (domainOn() ? 3 : 1))) return false;
    effect({ kind: 'rabbits', x: P.x, y: P.y, life: 0.9 });
    floater('RABBIT ESCAPE', P.x, P.y - K(40), '#e2e8f0', true);
    // they scatter: whatever was right on top of you loses you for a moment
    foes().filter(e => !heavy(e) && dist(e.x, e.y, P.x, P.y) <= K(120)).forEach(e => { e.target = null; });
    return true;
  }
  // Round Deer: while its ward is up, the first hit that would have killed you doesn't
  function cheatDeath() {
    const w = s.kit.ward, P = s.player.pos ?? center();
    if (!w || w.saved) return false;
    w.saved = true;
    s.player.invuln = Math.max(s.player.invuln, 1.2);
    api.heal(s.player.maxHp * 0.1);
    effect({ kind: 'saved', x: P.x, y: P.y, life: 1.1 });
    effect({ kind: 'flash', color: '#bbf7d0', life: 0.5 });
    api.announce('ROUND DEER · NOT TODAY', '#bbf7d0');
    shake(0.3); sfx('saved');
    return true;
  }
  // Round Deer's ward erases enemy shots that fly into it
  function shotBlocked(a) {
    const w = s.kit.ward, P = s.player.pos;
    if (!w || !P || dist(a.x, a.y, P.x, P.y) > w.r) return false;
    effect({ kind: 'burst', x: a.x, y: a.y, r: K(16), color: '#bbf7d0' });
    return true;
  }

  // ── Mahoraga ─────────────────────────────────────────────────────────────
  function summonMahoraga(u, P) {
    const hp = s.player.maxHp * u.hp;
    s.mahoraga = { x: P.x, y: P.y, hp, maxHp: hp, mult: u.mult, slamT: 1.6, target: null, adapt: {}, wheel: 0, turns: 0, turnT: 4, invuln: 1.6, t: 0,
      timeout: u.dur ?? 25, berserkAt: u.berserkAt ?? 4, gunPct: u.gunPct ?? 0.6, finaleMult: u.finale ?? 15, berserk: false, gunT: 0, gunSide: 1, rush: 0,
      leap: null, leapCd: 0, storm: 0, stormT: 0, finale: null, turnFx: 0, v2: true };
    s.ult.active = { type: 'mahoraga', t: 1e9, dur: 1e9 };
    s.combo.n = 0;
    s.kit.sign = null;
    // the full ritual: summoned with a full shadow meter, it takes all of it and arrives with its wheel already turning
    const sk = skill();
    if (sk?.type === 'tenshadows' && bars(sk) >= Math.round(sk.maxBars)) {
      s.kit.shadow = 0;
      s.mahoraga.wheel = 2; s.mahoraga.turns = 2;
      api.announce('THE RITUAL IS COMPLETE ☸☸', '#fde047');
      combo('ritual');
    }
    // GENERAL OF THE GARDEN: summoned inside the domain, it holds the garden open
    if (domainOn()) {
      s.mahoraga.general = true;
      api.announce('GENERAL OF THE GARDEN', '#e0e7ff');
      combo('general');
    }
    s.kit.cutin = { kind: 'summon', t: 0, life: 1.6 };   // Bio's card art slams in
    effect({ kind: 'flash', color: '#fde047', life: 0.6 });
    effect({ kind: 'puddle', x: P.x, y: P.y, r: K(120), life: 1.2 });
    shake(0.5); sfx('bigKill');
  }
  // the wheel turns
  function turn(m) {
    m.wheel++; m.turnFx = 0.45;
    effect({ kind: 'ring', x: m.x, y: m.y - K(70), r: K(46), color: m.berserk ? '#f87171' : '#fde047', life: 0.4 });
    sfx('wheel');
  }
  // You click while it's out: it charges what you clicked — leaping onto it when it can
  function commandMahoraga(x, y) {
    const m = s.mahoraga;
    if (!m || m.finale) return true;
    const list = foes();
    const e = api.enemyAt(x, y) ?? (() => { const n = nearest(x, y, list); return n && dist(x, y, n.x, n.y) <= K(130) ? n : null; })();
    if (!e) return true;
    m.target = e.id; m.lookT = 1.2;
    effect({ kind: 'ring', x: e.x, y: e.y, r: radius(e) * 1.4, color: m.berserk ? '#f87171' : '#fde047', life: 0.35 });
    if (m.leapCd <= 0 && !m.leap) {
      m.leap = { t: 0, dur: 0.42, x0: m.x, y0: m.y, tx: e.x, ty: e.y, target: e.id };
      m.leapCd = 1.1; m.invuln = Math.max(m.invuln, 0.45);
      if (m.berserk) { m.storm = 12; m.stormT = 0; }   // and a bullet storm on the way down
      sfx('leap');
    } else m.rush = 0.7;
    return true;
  }
  function slam(m, t, mult, R, color) {
    const adapts = Object.values(m.adapt).reduce((a, n) => a + Math.min(n, 3), 0) + m.turns;
    const hit = foes().filter(e => !(e.down > 0) && dist(e.x, e.y, t.x, t.y) <= R + radius(e) * 0.6);
    // in its garden, shadow hands hold them up for the blow
    if (m.general && s.kit.domain) hit.slice(0, 4).forEach(e => effect({ kind: 'hand', x: e.x, y: e.y + radius(e) * 0.55, r: radius(e), life: 0.5 }));
    hit.forEach(e => ultHit(e, m.mult * mult * (1 + 0.12 * adapts) * (m.berserk ? 1.25 : 1) * (e === t ? 1 : 0.3), color, '☸'));   // the shockwave catches the rest for less
    effect({ kind: 'burst', x: t.x, y: t.y, r: R, color: '#fde047' });
    effect({ kind: 'shards', x: t.x, y: t.y, r: R * 0.8, color: '#fde047', n: 8 });
  }
  function updateMahoraga(dt) {
    const m = s.mahoraga;
    m.t += dt; m.invuln = Math.max(0, m.invuln - dt); m.leapCd -= dt;
    if (m.turnFx > 0) m.turnFx -= dt;
    if (s.phase === 'clear') { endMahoraga('won'); return; }
    // time's up: it leaves with a WORLD-CUTTING SLASH
    if (m.t >= m.timeout && !m.finale) {
      m.finale = { t: 0, a: bestAngle(m.x, m.y, K(140)), cut: false };
      m.invuln = 9; m.leap = null; m.storm = 0;
      api.announce('WORLD-CUTTING SLASH', '#fecaca');
      sfx('charge');
    }
    if (m.finale) {
      const f = m.finale;
      f.t += dt;
      if (!f.cut && f.t >= 0.55) {
        f.cut = true;
        const L = lineThrough(m.x, m.y, f.a);
        f.line = L;
        effect({ kind: 'worldcut', x1: L.x1, y1: L.y1, x2: L.x2, y2: L.y2, life: 1.2 });
        foes().forEach(e => {
          const on = distToSegment(e.x, e.y, L.x1, L.y1, L.x2, L.y2) <= K(70) + radius(e) * 0.7;
          ultHit(e, m.finaleMult * (on ? 1 : 1 / 3), on ? '#fecaca' : '#fca5a5', on ? 'WORLD SLASH ' : '');
        });
        effect({ kind: 'flash', color: '#ffffff', life: 0.5 });
        shake(1); sfx('worldslash');
      }
      if (f.t >= 1.3) endMahoraga('left');
      return;
    }
    const list = foes().filter(e => !(e.down > 0));
    m.rush = Math.max(0, m.rush - dt);
    // the wheel has turned enough: BERSERK (twin pistols, harder hits)
    if (!m.berserk && m.wheel >= m.berserkAt) {
      m.berserk = true; m.invuln = 1.2; m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.3);
      s.kit.cutin = { kind: 'berserk', t: 0, life: 1.7 };
      effect({ kind: 'flash', color: '#dc2626', life: 0.7 });
      shake(0.8); sfx('boom');
    }
    // a commanded leap: an arc onto its target, a big slam on landing
    if (m.leap) {
      const lp = m.leap;
      lp.t += dt;
      const t = s.enemies.find(e => e.id === lp.target);
      if (t) { lp.tx = t.x; lp.ty = t.y; }
      const p = Math.min(1, lp.t / lp.dur), q = 1 - (1 - p) ** 2;
      m.x = lp.x0 + (lp.tx - lp.x0) * q; m.y = lp.y0 + (lp.ty - lp.y0) * q;
      m.lift = Math.sin(p * Math.PI);
      if (m.storm > 0 && t) {   // berserk: both pistols empty on the way down
        m.stormT -= dt;
        while (m.stormT <= 0 && m.storm > 0) {
          m.stormT += 0.02; m.storm--; m.gunSide *= -1;
          s.shots.push({ id: nextId(), x: m.x + m.gunSide * K(48), y: m.y - K(20), target: t.id, speed: K(1300), mult: m.gunPct, color: '#f87171', label: '', maho: true });
          m.flashT = 0.06; m.flashSide = m.gunSide;
          sfx('gun');
        }
      }
      if (p >= 1) {
        m.leap = null; m.lift = 0; m.slamT = 0.55;
        const at = t ?? { x: lp.tx, y: lp.ty };
        if (t && !(t.down > 0)) slam(m, t, 1.5, K(120), m.berserk ? '#f87171' : '#fde047');
        foes().filter(e => e.tier !== 'boss' && !e.group && dist(e.x, e.y, at.x, at.y) <= K(120) + radius(e) * 0.5).forEach(e => { e.frozen = Math.max(e.frozen ?? 0, 0.6); });
        effect({ kind: 'crack', x: at.x, y: at.y + K(30), a: -Math.PI / 2, r: K(90), life: 0.8 });
        shake(0.45); sfx('boom');
      }
      if (m.flashT > 0) m.flashT -= dt;
      return;
    }
    if (!list.length) {   // nothing to fight: it comes back to you and waits
      const P = s.player.pos ?? center(), dx = P.x - m.x, dy = P.y - m.y, d = Math.hypot(dx, dy) || 1;
      if (d > K(60)) { const st = Math.min(d - K(60), K(200) * dt); m.x += dx / d * st; m.y += dy / d * st; }
      return;
    }
    // the wheel turns on its own too, so a long fight always ends one way or the other
    m.turnT -= dt;
    if (m.turnT <= 0) { m.turnT = 4; m.turns++; turn(m); }
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
    if (d > reach) { const st = Math.min(d - reach, K(250) * (1 + adapts * 0.04) * (m.rush > 0 ? 3 : 1) * dt); m.x += dx / d * st; m.y += dy / d * st; }
    // berserk: the twin pistols, 6 shots a second at whatever you point at
    if (m.berserk && s.time > 0) {
      m.gunT -= dt;
      while (m.gunT <= 0) {
        m.gunT += 1 / 6;
        m.gunSide *= -1;
        const gx = m.x + m.gunSide * K(48), gy = m.y + K(10);
        // the pistols go for whatever you point at (its fists already have the one in front of it)
        const P = s.player.pos, others = list.filter(e => e !== t), g = P && others.length ? nearest(P.x, P.y, others) : t;
        s.shots.push({ id: nextId(), x: gx, y: gy, target: g.id, speed: K(1100), mult: m.gunPct, color: '#f87171', label: '', maho: true });
        m.flashT = 0.08; m.flashSide = m.gunSide;
        sfx('gun');
      }
    }
    if (m.flashT > 0) m.flashT -= dt;
    m.slamT -= dt;
    if (m.slamT <= 0 && d <= reach + K(8)) {
      m.slamT = 0.55;
      slam(m, t, 1, K(100), m.berserk ? '#f87171' : '#fde047');
      shake(0.18); sfx('bigKill');
    }
  }
  // Something hit Mahoraga: it adapts (the third time, that kind can't touch it any more)
  function hitMahoraga(raw, kind) {
    const m = s.mahoraga;
    if (!m || m.invuln > 0) return;
    const n = m.adapt[kind] ?? 0;
    if (n >= 3) {
      m.invuln = 0.2;
      floater('☸ NULLIFIED', m.x, m.y - K(60), '#fde047', true);
      return;
    }
    const dmg = Math.max(1, Math.round(raw * (1 - s.stats.dmgReduction) * Math.pow(0.6, n)));
    m.hp -= dmg; m.invuln = 0.3;
    floater(`-${dmg}`, m.x, m.y - K(50), '#ff6b6b', true);
    m.adapt[kind] = n + 1;
    // something new: the wheel turns (hits of a kind it already knows only make it tougher)
    if (n === 0) { turn(m); floater(`☸ ADAPTED TO ${ADAPT_NAMES[kind] ?? String(kind).toUpperCase()}`, m.x, m.y - K(78), '#fde047', true); }
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
    effect({ kind: 'puddle', x: m.x, y: m.y, r: K(120), life: 1 });
    if (reason === 'left') floater('The General returns to the shadows…', m.x, m.y - K(40), '#fde68a', true);
  }

  // Stage cleared / lost / (re)loaded: everything goes back into the shadows
  function reset() {
    Object.assign(s.kit, { serpents: [], drops: [], oxen: [], tigers: [], tongues: [], floods: [], dives: [], twins: [], ward: null, cutin: null, sign: null, domain: null, slowing: false, byShiki: false });
    s.enemies.forEach(e => { e.slow = undefined; e.vuln = undefined; e.boundT = 0; });
    if (s.mahoraga) { s.mahoraga = null; if (s.ult.active?.type === 'mahoraga') s.ult.active = null; }
  }

  // while your hands make the sign, clicks don't hit anything
  const busy = () => !!s.kit.sign?.open;
  // anything of this kit still on the field (it keeps going after a card switch)
  const active = () => {
    const k = s.kit;
    return !!(k.cutin || k.found || k.sign || k.ward || k.domain || k.slowing || k.oxen?.length || k.serpents?.length || k.tigers?.length || k.drops?.length
      || k.tongues?.length || k.floods?.length || k.dives?.length || k.twins?.length);
  };

  return {
    onDamage, onKill, info, tapPick, cost, bars, gardenReady, busy, active,
    press, release, signAim, signSel, timeScale, update, updateAlly, afterClick, absorb, cheatDeath, shotBlocked,
    summonMahoraga, commandMahoraga, updateMahoraga, hitMahoraga, endMahoraga, reset,
  };
}
