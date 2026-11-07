// 5★/6★ kits, keyed by the `effect` id in characters.js.
//
// Each skill has a `style`: how you use it with the mouse (see STYLES below).
//   click   – spam M1; the skill makes every click stronger
//   special – M2 (right-click / Q / the SPECIAL button) fires it, then a cooldown
//   charge  – tap M2 to stock up one charge; hold M2 or M1 for 1s to keep charging, let go to release
//   hold    – hold M1 to charge, let go to fire
//   drag    – hold M1 and drag across enemies
// Every skill also has a smaller always-on `passive` (with its own lv1 / si numbers).
//
// From LV1 you get a weaker
// version (the `lv1` numbers); at LV20 the skill reaches full strength.
// Ults (unlock at LV50) charge up from damage you deal and have a cooldown
// (the `cooldown` in characters.js, in seconds). Press E or tap the orb.
// `charge` scales how much damage the ult needs (1 = normal).
//
// Superimposition (S2–S5) makes each kit stronger — see `si` on each entry:
// every S level adds the `si` values once (S5 = base + 4× si).

import { wheelOn } from '../utils/secrets';

export const SKILL_UNLOCK = 20;   // full-strength skill
export const ULT_UNLOCK   = 50;

export const SKILLS = {
  // ── CLICK: spam M1 ─────────────────────────────────────────────────────
  swag_strike:   { type: 'gun',       style: 'click', pct: 0.35, shots: 1,
                   lv1: { pct: 0.2 },
                   si: { pct: 0.08, shots: 0.5 },
                   desc: 'Every click also fires {shots} homing shot(s) at the nearest enemies for {pct} click DMG each, hit or miss. Spam it.',
                   passive: { type: 'extraShot', chance: 0.1, shots: 2, pct: 0.4,
                              lv1: { chance: 0.06 }, si: { chance: 0.02 },
                              desc: 'Clicks have a {chance} chance to fire {shots} extra shots for {pct} click DMG each.' } },
  reality_slice: { type: 'crit',      style: 'click', rate: 0.12, dmg: 0.8, cut: 0.2,
                   lv1: { rate: 0.06, dmg: 0.4, cut: 0.08 },
                   si: { rate: 0.03, dmg: 0.15, cut: 0.05 },
                   desc: '+{rate} crit rate and +{dmg} crit DMG. Every crit click also slices reality: a line through the target that hits every enemy on it for {cut} click DMG.',
                   passive: { type: 'critCharge', bonus: 0.5,
                              lv1: { bonus: 0.25 }, si: { bonus: 0.1 },
                              desc: 'Crits charge your ult {bonus} faster.' } },
  // ── HOX (6★): an eldritch god. Aura passive that drives enemies MAD, M2 maw that eats the madness.
  abyssal_maw:   { type: 'maw',       style: 'special', cooldown: 6, radius: 125, pct: 4, perStack: 0.5, devour: 0.15, heal: 0.015,
                   lv1: { cooldown: 8, radius: 105, pct: 2, perStack: 0.25, devour: 0.08, heal: 0.008 },
                   si: { cooldown: -0.4, radius: 8, pct: 0.7, perStack: 0.08, devour: 0.015, heal: 0.002 },
                   desc: 'M2: the Abyssal Maw tears open under your cursor and snaps shut: {pct} click DMG to everything inside ({radius} range), plus {perStack} for every Madness stack it eats. Anything left under {devour} HP is DEVOURED whole (not bosses), healing you {heal} max HP each. {cooldown}s cooldown.',
                   passive: { type: 'presence', radius: 115, perSec: 2.5, per: 0.02, maxMad: 10,
                              lv1: { radius: 90, per: 0.015 }, si: { radius: 6, per: 0.003 },
                              desc: 'Eldritch Presence: a void aura with watching eyes follows your cursor. Enemies inside go MAD ({perSec} stacks a second, up to {maxMad}); every stack makes them take {per} more damage from you, and at 5+ they stagger and slow down.' } },
  ratio:         { type: 'ratio',     style: 'click', period: 1.0, window: 0.12, bonus: 1.5, critRateMod: -0.10,
                   lv1: { window: 0.09, bonus: 0.8 },
                   si: { window: 0.01, bonus: 0.25 },
                   desc: 'A 7:3 bar sits on the enemy under your cursor. Click when the red line crosses the mark ({window} window) for a guaranteed crit with +{bonus} crit DMG. Normal crit rate is 10% lower.',
                   passive: { type: 'ratioHeal', heal: 0.004,
                              lv1: { heal: 0.002 }, si: { heal: 0.001 },
                              desc: 'Ratio hits heal you {heal} max HP.' } },

  // ── SPECIAL: M2, then a cooldown ───────────────────────────────────────
  rock_shard:    { type: 'spike',     style: 'special', cooldown: 7, radius: 135, pct: 6, stun: 0.6,
                   lv1: { cooldown: 9, radius: 110, pct: 3 },
                   si: { cooldown: -0.5, radius: 12, pct: 1 },
                   desc: 'M2: rock spikes erupt under your cursor: {pct} click DMG in a {radius} radius and a {stun}s stun. {cooldown}s cooldown.',
                   passive: { type: 'shardProc', chance: 0.12, pct: 0.6, radius: 90,
                              lv1: { chance: 0.07, pct: 0.4 }, si: { chance: 0.02, pct: 0.1 },
                              desc: 'Clicks have a {chance} chance to burst into rock shards that hit enemies near the target for {pct} click DMG ({radius} range).' } },
  quantum_burst: { type: 'entangle',  style: 'special', cooldown: 8, links: 4, share: 0.35, dur: 6, range: 260,
                   lv1: { cooldown: 10, links: 3, share: 0.2, dur: 5 },
                   si: { cooldown: -0.5, links: 0.5, share: 0.05 },
                   desc: 'M2: Quantum Entanglement links the enemy nearest your cursor with up to {links} others nearby ({range} range) for {dur}s. {share} of the damage any of them takes is copied onto all the others. {cooldown}s cooldown.',
                   passive: { type: 'pulseProc', chance: 0.08, pct: 0.8, radius: 90,
                              lv1: { chance: 0.05, pct: 0.5 }, si: { chance: 0.015, pct: 0.15 },
                              desc: 'Clicks have a {chance} chance to set off a small quantum pulse at your cursor: {pct} click DMG ({radius} range).' } },
  infinity:      { type: 'repel',     style: 'special', cooldown: 6, radius: 160, crush: 5,
                   lv1: { cooldown: 9, radius: 120, crush: 3 },
                   si: { cooldown: -0.5, radius: 10, crush: 0.4 },
                   desc: 'M2: Infinity repels everything within {radius} of your cursor. Slam them into a wall to CRUSH them for {crush} click DMG, or into another enemy to hurt both. Bosses are too heavy to move and take half. {cooldown}s cooldown.',
                   passive: { type: 'infinity', radius: 75,
                              lv1: { radius: 55 }, si: { radius: 8 },
                              desc: "Infinity: a {radius} bubble around your cursor slows enemy shots to a crawl and stops dashes and the worm's bite (blocking drains it; it refills when nothing hits it)." } },
  lava:          { type: 'eruption',  style: 'special', cooldown: 9, radius: 115, pct: 2.5, dps: 0.6, dur: 5,
                   lv1: { cooldown: 11, radius: 95, pct: 1.4, dps: 0.35, dur: 4 },
                   si: { cooldown: -0.5, pct: 0.4, dps: 0.1, dur: 0.5 },
                   desc: 'M2: an eruption under your cursor hits for {pct} click DMG ({radius} range) and leaves a lava pool for {dur}s that burns for {dps} click DMG per second. {cooldown}s cooldown.',
                   passive: { type: 'lavaKill', chance: 0.15, radius: 50, dur: 3, dps: 0.25,
                              lv1: { chance: 0.08 }, si: { chance: 0.03, dps: 0.05 },
                              desc: 'Kills have a {chance} chance to leave a lava puddle ({radius} range, {dur}s) that burns for {dps} click DMG per second.' } },
  shadows:       { type: 'dogs',      style: 'special', cooldown: 12, pct: 0.7, dur: 10,
                   lv1: { cooldown: 15, pct: 0.35, dur: 8 },
                   si: { cooldown: -0.5, pct: 0.1, dur: 1 },
                   desc: 'M2: summons two Divine Dogs for {dur}s that hunt enemies for {pct} click DMG a bite. {cooldown}s cooldown.',
                   passive: { type: 'shadows', chance: 0.06, pct: 0.6,
                              lv1: { chance: 0.03, pct: 0.3 }, si: { chance: 0.01, pct: 0.08 },
                              desc: 'Kills have a {chance} chance to summon a shikigami: a Toad that eats the next hit on you, or Nue (hits for {pct} click DMG).' } },
  // Bio's other kit, for devices that unlocked it (utils/secrets.js): it replaces `shadows` there
  tenshadows:    { type: 'tenshadows', style: 'special', barCost: 30, maxBars: 4,
                   dogPct: 0.5, dogDur: 8, toadPct: 4, bind: 3,                    // 1 bar
                   nuePct: 2.2, nueDur: 8, oxPct: 8, deerHeal: 0.25, wardDur: 5,   // 2 bars
                   serpentPct: 40, devour: 0.35, tigerPct: 10,                       // 3 bars
                   elephantPct: 23, stun: 2, floodDur: 6,                           // 4 bars
                   gardenNeed: 4, domainDur: 10,                                    // Chimera Shadow Garden
                   lv1: { dogPct: 0.3, toadPct: 2.4, nuePct: 1.3, oxPct: 4.8, deerHeal: 0.15, serpentPct: 24, tigerPct: 6, elephantPct: 13.5, domainDur: 7 },
                   si: { dogPct: 0.07, toadPct: 0.5, nuePct: 0.3, oxPct: 1, deerHeal: 0.02, serpentPct: 5, tigerPct: 1.2, elephantPct: 3, domainDur: 0.5 },
                   desc: 'THE TEN SHADOWS. Your own hits fill a SHADOW meter ({maxBars} bars) and every kill your shikigami make tops it up. Tap M2 (or Q) to summon the shadow your full bars buy: 1 Divine Dogs, 2 Nue, 3 Great Serpent, 4 Max Elephant. Hold M2 to make a hand sign instead: the world slows, a wheel of all eight shadows opens around your cursor, flick toward one and let go. '
                     + '1 bar · DIVINE DOGS: a white and a black wolf hunt what you point at ({dogPct} click DMG a bite); summon them again while they are out and they fuse into TOTALITY, whose bite tears into everything next to its prey. TOAD: its tongue grabs the enemy you summon it on (or the pest farthest away) for {toadPct}, reels it in and BINDS it for {bind}s (bound enemies take +30% DMG); then it sits by your cursor and swallows one hit meant for you. '
                     + '2 bars · NUE: lightning on what you point at ({nuePct}, chains), and a dive onto its last target when it leaves. PIERCING OX: charges across the whole screen through your summon, {oxPct} to everything in its path and harder the farther it runs, throwing them into walls. ROUND DEER: heals {deerHeal} of your HP, clears debuffs, and for {wardDur}s a ward around your cursor erases enemy shots and stops one hit that would have killed you. '
                     + '3 bars · GREAT SERPENT: rises under its prey ({serpentPct}) and swallows it whole under {devour} HP, or at any HP if it is bound. TIGER FUNERAL: pounces on the strongest enemy near your cursor and mauls it 4 times ({tigerPct}, up to double on hurt prey, +25% on bound or stunned prey); the weak do not get up. '
                     + '4 bars · MAX ELEPHANT: drops out of the sky, {elephantPct} to everything around it, {stun}s stun, and leaves a flood that slows them. '
                     + 'COMBOS: Totality · Thunder Flood (Nue lightning in the flood) · Bound Prey (the Serpent eats what the Toad holds) · Tidal Charge (Ox through the flood) · Pack Hunt (Tiger while the dogs are out) · Leviathan (Serpent out of the water) · Holy Water (Deer into the flood) · Lightning Rod (Nue and bound prey) · Stampede (Ox with Totality) · and a few more to find. '
                     + 'Call {gardenNeed} different shadows to ready DOMAIN EXPANSION: CHIMERA SHADOW GARDEN (hold M2, let go in the middle): {domainDur}s of shadow floor, enemies slowed and taking +15% DMG, the meter fills twice as fast, every shadow costs a bar less, rabbits come three times as often, and your clicks pull shadow hands up out of the floor. Call all eight before you open it for a PERFECT GARDEN.',
                   passive: { type: 'rabbits', chance: 0.15,
                              lv1: { chance: 0.08 }, si: { chance: 0.02 },
                              desc: 'Rabbit Escape: when a hit would land on you, a {chance} chance a burst of shadow rabbits takes it instead (and whatever was on top of you loses you).' } },

  // ── CHARGE: spam M2 to charge, M1 fires ────────────────────────────────
  souls:         { type: 'souls',     style: 'charge', cap: 20, throwPct: 0.62,
                   lv1: { cap: 12, throwPct: 0.4 },
                   si: { cap: 2.5, throwPct: 0.09 },
                   rate: 10,
                   desc: 'Tap M2 to summon a cursed spirit (up to {cap}). Hold M2 (or M1) for 1s to keep summoning, then let go to hurl them all at your cursor: {throwPct} click DMG per spirit to the enemy you aim at, a third of that to everything around it.',
                   passive: { type: 'spirits', chance: 0.3,
                              lv1: { chance: 0.18 }, si: { chance: 0.05 },
                              desc: 'Kills have a {chance} chance to add a cursed spirit to your stock (elites always add 3).' } },
  transfig:      { type: 'crawlers',  style: 'charge', cap: 8, pct: 0.95, radius: 55,
                   lv1: { cap: 5, pct: 0.6 },
                   si: { cap: 0.5, pct: 0.15 },
                   rate: 6,
                   desc: 'Tap M2 to transfigure a crawler (up to {cap}). Hold M2 (or M1) for 1s to keep transfiguring, then let go to set them all loose at the enemies around your cursor: each explodes for {pct} click DMG ({radius} range).',
                   passive: { type: 'transfig', chance: 0.08, pct: 1.0, radius: 60,
                              lv1: { chance: 0.05, pct: 0.6 }, si: { chance: 0.015, pct: 0.15 },
                              desc: 'Kills have a {chance} chance to turn into a crawler that runs at an enemy and explodes for {pct} click DMG. Killed elites always turn.' } },
  copy:          { type: 'platinum',  style: 'charge', cap: 12, pct: 1.1,
                   lv1: { cap: 8, pct: 0.7 },
                   si: { cap: 1, pct: 0.17 },
                   rate: 6,
                   desc: 'Tap M2 to wind up a punch (up to {cap}). Hold M2 (or M1) for 1s to keep winding up, then let go to unleash them all on the enemy nearest your cursor: {pct} click DMG per punch. ORA!',
                   passive: { type: 'copy', every: 20,
                              lv1: { every: 30 }, si: { every: -2 },
                              desc: "Copies another 5★ agent's passive and switches to a new one every {every}s." } },

  // ── PLATINUM (6★ Ice): every style at once — click, hold, drag, Q and M2 (icePlatinum.js) ──
  zero_point:    { type: 'zero',      style: 'platinum',
                   chill: 34, freezeDur: 4,                         // click: Freeze per click (a full meter = FROZEN)
                   full: 0.9, minPct: 3, pct: 9,                    // hold M1: Shatter
                   cooldown: 10, qRadius: 150, qPct: 1.5,           // Q: Flash Freeze
                   cap: 3, figPct: 3, figR: 110, figChill: 35,      // M2: ice figures
                   wallLen: 700, wallDur: 4, wallChill: 140,        // drag: frost line
                   lv1: { chill: 25, minPct: 1.8, pct: 5.4, cooldown: 13, qRadius: 120, qPct: 0.9, cap: 2, figPct: 1.8 },
                   si: { chill: 3, pct: 1.4, minPct: 0.4, cooldown: -0.6, qRadius: 10, qPct: 0.25, figPct: 0.5, wallLen: 60 },
                   desc: 'ZERO POINT. CLICK: every click builds FREEZE on the target ({chill} a click). A full meter FREEZES it solid for {freezeDur}s (elites take twice as many clicks; bosses never freeze, their meter turns into a heavy slow). '
                     + 'HOLD M1 and let go: SHATTER. Every frozen enemy on screen breaks at once for up to {pct} click DMG (full in {full}s); bosses take it scaled by their freeze meter. '
                     + 'DRAG (hold M1 and move): draw a FROST LINE up to {wallLen} long that blocks enemy shots and freezes whatever walks through it, for {wallDur}s. '
                     + 'Q: FLASH FREEZE. Everything within {qRadius} of your cursor freezes on the spot ({qPct} click DMG). {cooldown}s cooldown. '
                     + 'M2: ICE FIGURES. Tap to sculpt an ice figure at your cursor (up to {cap}): it chills everything near it and soaks enemy shots. Hold M2 for 1s and let go to detonate them all ({figPct} click DMG and a burst of Freeze around each). A Shatter sets them off too.',
                   passive: { type: 'subzero', bonus: 0.25, chain: 40,
                              lv1: { bonus: 0.15, chain: 25 }, si: { bonus: 0.04, chain: 6 },
                              desc: 'Sub-Zero: frozen enemies take +{bonus} DMG from everything. Chain Frost: every shattered enemy throws shards that add {chain} Freeze to whatever is near it.' } },
  // 6★ Ramsf (Platinum): ten porcelain doll arms; a parry character (ramsfPlatinum.js)
  marionette:    { type: 'marionette', style: 'platinum',
                   parryWin: 0.27, parryCd: 0.45, hitstop: 0.09, parryPct: 3, reflectPct: 4, stagger: 1.5, exposed: 0.3, exposedDur: 3,   // M2: Parry
                   riftCd: 12, riftDur: 5, riftR: 110, riftPull: 260, riftPct: 2,   // hold M2: Otherworld Rift
                   armR: 80,                                        // how far the doll arms on the cursor reach (Manic Puppeteer; their full stretch, RamsfFx)
                   stringLen: 900, stringPct: 1.5,                  // drag: Strings
                   full: 0.8, minPct: 1, pct: 4, gustR: 220,        // hold M1: Wingbeat
                   cooldown: 16, gunDur: 6, gunPct: 0.6, gunR: 420, clonePct: 0.8, cloneRate: 0.5, cloneR: 130,   // Q: Shadow Gunslinger
                   lv1: { parryWin: 0.23, parryPct: 1.8, reflectPct: 2.4, exposed: 0.18, stringPct: 0.9, minPct: 0.6, pct: 2.4, riftPct: 1.2, cooldown: 20, gunPct: 0.35, clonePct: 0.5 },
                   si: { parryWin: 0.01, parryPct: 0.5, reflectPct: 0.6, exposed: 0.05, stringPct: 0.25, pct: 0.6, minPct: 0.15, riftPct: 0.35, riftDur: 0.4, cooldown: -0.6, gunDur: 0.3, gunPct: 0.1, clonePct: 0.12 },
                   desc: 'HELLFIRE STYLE. M2: PARRY. Tap just before a hit lands ({parryWin}s window): the game freezes for a beat, the attack is cancelled, a shot flies back at whoever fired it ({reflectPct} click DMG), and anything that swung at you is struck ({parryPct} click DMG), staggered, and takes +{exposed} DMG for {exposedDur}s. For a moment after a parry, other hits that land are parried too (a volley, a flurry). Nothing to parry, and you can\'t parry again for {parryCd}s. '
                     + 'HOLD M2: OTHERWORLD RIFT. A rift tears open at your cursor for {riftDur}s: it drags enemies to its centre, burns what\'s inside ({riftPct} click DMG per second) and swallows shots. {riftCd}s cooldown. '
                     + 'HOLD M1 and let go: WINGBEAT. His arms fold into wings: a gust around your cursor ({gustR} range) throws enemies back for up to {pct} click DMG (full in {full}s) and blows enemy shots away. '
                     + 'DRAG (hold M1 and move): STRINGS. Tie up everything you pass through (up to {stringLen} long); let go and they\'re yanked together into a heap ({stringPct} click DMG each). '
                     + 'Q: SHADOW GUNSLINGER. For {gunDur}s a shadow of your cursor goes after the enemies: they attack it instead of you, and it strikes everything around it ({clonePct} click DMG every {cloneRate}s). Meanwhile every click also fires his two guns from the shadows, a bullet each at the enemies nearest your cursor ({gunPct} click DMG each). {cooldown}s cooldown.',
                   passive: { type: 'offering', soulDmg: 0.04, maxSouls: 10, lv2At: 5, lv3At: 10,
                              lv1: { soulDmg: 0.025 }, si: { soulDmg: 0.006 },
                              desc: 'Offering: an enemy you\'ve parried that then dies gives a Soul for his Master (up to {maxSouls}). Every Soul: +{soulDmg} DMG. {lv2At} Souls and his ult becomes Hell Drums; {lv3At} and you can call Ascent of the Master. Souls carry over from stage to stage until you fall.' } },
  // 6★ Astrec (Platinum): sent in first because he can't stay dead (astrecPlatinum.js)
  death_wish:    { type: 'deathwish', style: 'platinum',
                   t1: 0.3, t2: 0.6, t3: 1, cleave: 0.5, cleaveR: 110, shock: 0.6, shockR: 150,   // Death Wish: the tiers
                   reviveHp: 0.4, lockDur: 30,                      // Not Yet
                   drawDur: 4, drawCd: 12,                          // M2: Draw Fire
                   braceDR: 0.6, counterMin: 1, counterPer: 25, counterMax: 15, counterR: 200,   // hold M1: Brace
                   breachLen: 700, breachPct: 1.5, breachCost: 0.02,   // drag: Breach
                   cooldown: 16, heal: 0.3,                         // Q: Second Wind
                   lv1: { t1: 0.18, t2: 0.36, t3: 0.6, cleave: 0.3, shock: 0.35, braceDR: 0.45, counterPer: 15, counterMax: 9, heal: 0.2, cooldown: 20, breachPct: 0.9 },
                   si: { t1: 0.05, t2: 0.1, t3: 0.15, cleave: 0.1, shock: 0.12, counterPer: 4, counterMax: 2, cooldown: -0.8, heal: 0.02, breachPct: 0.25, breachLen: 40 },
                   desc: 'DEATH WISH. The more HP Astrec is missing, the more dangerous he gets. Missing 25%: his hits deal +{t1} DMG. Missing 50%: +{t2}, and every click also cuts the enemies within {cleaveR} of the target for {cleave} click DMG. Missing 75%: +{t3}, and every click is a crit with a shockwave ({shock} click DMG within {shockR}). Too low and he dies like anyone. '
                     + 'NOT YET: the first time he would die in a stage, he gets back up with {reviveHp} of his HP, but Death Wish shuts off for {lockDur}s. '
                     + 'M2: DRAW FIRE. For {drawDur}s every enemy attacks twice as fast: choose when to take the hits. {drawCd}s cooldown. '
                     + 'HOLD M1: BRACE. While you hold, he takes {braceDR} less damage. Let go and everything he soaked up comes back out around your cursor (from {counterMin} click DMG, more the harder he was hit, up to {counterMax}). '
                     + 'DRAG (hold M1 and move): BREACH. He charges along your path, up to {breachLen} long: everything on it takes {breachPct} click DMG and is thrown aside (bosses are too heavy), and each one he plows through hits him back for {breachCost} of his max HP (never the last of it). '
                     + 'Q: SECOND WIND. Heals {heal} of his max HP (and so drops him down the tiers). {cooldown}s cooldown.' },
  // 6★ Bonk (Platinum): Ice's kit turned inside out (bonkPlatinum.js). Bleed instead of Freeze,
  // offence instead of control, paid for in his own HP.
  boiling_point: { type: 'boil',      style: 'platinum',
                   bleed: 34, hemoDur: 4, hemoDps: 0.6,             // click: Bleed per click (a full meter = HEMORRHAGE)
                   full: 0.6, minPct: 3, pct: 8, heal: 0.01,        // hold M1: Rupture (heal: per enemy ruptured, up to 8%)
                   cooldown: 9, cost: 0.1, qRadius: 160, qPct: 1.5, rageDur: 4, rage: 0.5,   // Q: Bloodletting
                   grabCd: 2, grabPct: 1, slamPct: 2.5, slamR: 110, throwPct: 3,           // M2: grab / slam / throw
                   rakeLen: 650, rakePct: 1.2, rakeBleed: 60,       // drag: claw rake
                   lv1: { bleed: 25, hemoDps: 0.35, minPct: 1.8, pct: 4.8, cooldown: 12, qRadius: 130, qPct: 0.9, rage: 0.3, grabPct: 0.6, slamPct: 1.5, throwPct: 1.8, rakePct: 0.7 },
                   si: { bleed: 3, hemoDps: 0.1, pct: 1.3, minPct: 0.4, cooldown: -0.5, qRadius: 10, qPct: 0.25, rage: 0.08, slamPct: 0.4, throwPct: 0.5, rakePct: 0.2 },
                   desc: 'BOILING POINT. CLICK: every claw hit builds BLEED on the target ({bleed} a click). A full meter makes it HEMORRHAGE for {hemoDur}s: it bleeds {hemoDps} click DMG every second (elites take twice as many clicks; bosses never hemorrhage, their meter is an open wound: they take up to 30% more damage the deeper it is). '
                     + 'HOLD M1 and let go: RUPTURE. Every hemorrhaging enemy on screen bursts at once for up to {pct} click DMG (full in {full}s) and heals you {heal} of your max HP each (up to 8%); bosses take it scaled by their wound. '
                     + 'DRAG (hold M1 and move): a CLAW RAKE up to {rakeLen} long. Everything it crosses is slashed for {rakePct} click DMG and gets {rakeBleed} Bleed. '
                     + 'Q: BLOODLETTING. Bonk cuts himself for {cost} of his max HP (never the last of it): everything within {qRadius} of your cursor takes {qPct} click DMG and hemorrhages, and for {rageDur}s your hits deal {rage} more damage. {cooldown}s cooldown. '
                     + 'M2: GRAB. His claw seizes the enemy at your cursor ({grabPct} click DMG, and it hemorrhages). Hold M2 to carry it around; let go while moving to THROW it ({throwPct} click DMG to everything it crashes into, and to itself), or while still to SLAM it down ({slamPct} click DMG, half to everything within {slamR}). Bosses are too heavy to lift: the claw rips into them instead. {grabCd}s cooldown.',
                   passive: { type: 'bloodlust', max: 0.6, bonus: 0.2, splash: 45, feed: 0.02,
                              lv1: { max: 0.35, bonus: 0.12, splash: 30, feed: 0.01 }, si: { max: 0.08, bonus: 0.04, splash: 6, feed: 0.004 },
                              desc: 'Bloodlust: the lower his HP, the harder he hits (up to +{max} DMG at 10% HP). Hemorrhaging enemies take +{bonus} DMG from everything, a rupture splashes {splash} Bleed onto whatever is near it, and anything that dies hemorrhaging heals him {feed} of his max HP.' } },

  // ── HOLD: hold M1, release to fire ─────────────────────────────────────
  frost_bolt:    { type: 'lance',     style: 'hold', full: 1.2, minPct: 2.5, pct: 10, width: 50, freeze: 1.5,
                   lv1: { minPct: 1.4, pct: 5.5, freeze: 1 },
                   si: { pct: 1.6, freeze: 0.25, width: 6 },
                   desc: 'Hold M1 to charge (full in {full}s), release: an ice lance fires through where you pressed, pointing the way you pulled the cursor (no pull: it lines up on the most enemies). It hits everything on its line for up to {pct} click DMG (45% less for each enemy after the first) and freezes it for {freeze}s.',
                   passive: { type: 'frost', chance: 0.06, dur: 1, bonus: 0.2,
                              lv1: { chance: 0.03, bonus: 0.1 }, si: { chance: 0.015, bonus: 0.04 },
                              desc: 'Clicks have a {chance} chance to freeze an enemy for {dur}s. Frozen enemies take +{bonus} DMG.' } },
  healing_tide:  { type: 'tide',      style: 'hold', full: 0.35, dur: 3, dps: 11, width: 46, heal: 0.003, maxHeal: 0.008,
                   lv1: { dps: 6, heal: 0.002, maxHeal: 0.005 },
                   si: { dps: 1.7, heal: 0.0005, maxHeal: 0.0015 },
                   desc: 'Hold M1: after a moment a continuous water beam pours out for up to {dur}s. It pivots on where you pressed and points at your cursor, so sweep it around (keep still: it lines up on the most enemies). It deals {dps} click DMG per second to the enemy nearest your cursor and a third of that to everything else in the beam, and heals you {heal} max HP per enemy hit 4 times a second (up to {maxHeal} each time).',
                   passive: { type: 'lifesteal', pctHp: 0.001, pct: 0.008, maxPctHp: 0.004,
                              lv1: { pct: 0.004, maxPctHp: 0.002 }, si: { pct: 0.003, maxPctHp: 0.0015 },
                              desc: 'Clicks heal you a little: 0.1% max HP + {pct} of the damage dealt (up to {maxPctHp} max HP per click).' } },
  phantom:       { type: 'flashstep', style: 'hold', full: 1.0, targets: 5, minPct: 0.6, pct: 1.7, range: 320,
                   lv1: { targets: 3, minPct: 0.35, pct: 1.0 },
                   si: { targets: 0.5, pct: 0.28 },
                   desc: 'Hold M1 to charge (full in {full}s), release: {targets} flash-step strikes on the nearest enemies around your cursor ({range} range), up to {pct} click DMG each. Fewer enemies = more strikes on each.',
                   passive: { type: 'phantom', lag: 0.3,
                              lv1: { lag: 0.2 }, si: { lag: 0.03 },
                              desc: 'No cursed energy: enemies aim where your cursor was {lag}s ago.' } },

  // ── (Doro, SPECIAL) ────────────────────────────────────────────────────
  fuga_arrow:    { type: 'arrow',     style: 'special', cooldown: 5, pct: 5, radius: 100, burn: 0.5,
                   lv1: { cooldown: 7, pct: 2.5, radius: 85, burn: 0.25 },
                   si: { cooldown: -0.4, pct: 0.9, radius: 8, burn: 0.1 },
                   desc: 'M2: Open — a fire arrow streaks down onto your cursor and explodes for {pct} click DMG ({radius} range), setting everything it hits on fire ({burn} click DMG per second for 3s). Inside Malevolent Shrine it is huge: triple the blast, double the damage. {cooldown}s cooldown.',
                   passive: { type: 'ignite', chance: 0.1, dps: 0.4, dur: 3,
                              lv1: { chance: 0.06, dps: 0.25 }, si: { chance: 0.02, dps: 0.08 },
                              desc: 'Clicks have a {chance} chance to set the target on fire: {dps} click DMG per second for {dur}s.' } },
};

// How each style is used, for the UI (main screen, Deck, Records)
export const STYLES = {
  click:   { name: 'CLICK',  how: 'Spam M1',                         phone: 'Spam taps',                         color: '#facc15' },
  special: { name: 'SPECIAL', how: 'M2 (right-click) or Q',          phone: 'The SPECIAL button',                color: '#a78bfa' },
  charge:  { name: 'CHARGE', how: 'Tap M2 to stock up · hold M1 or M2 for 1s to charge, let go to release', phone: 'Tap SPECIAL to stock up · hold anywhere 1s to charge, let go to release', color: '#e879f9' },
  hold:    { name: 'HOLD',   how: 'Hold M1, release to fire',        phone: 'Hold, let go to fire',              color: '#67e8f9' },
  drag:    { name: 'DRAG',   how: 'Hold M1 and drag',                phone: 'Hold and drag',                     color: '#fb923c' },
  platinum:{ name: 'PLATINUM', how: 'Click · hold M1 · drag · Q · M2', phone: 'Tap · hold · drag · SKILL · FIGURE', color: '#e2e8f0' },
};

export const ULTS = {
  tectonic_wrath: { type: 'nuke',      mult: 60, charge: 1,
                    si: { mult: 6 },
                    desc: 'Rock spires hit every enemy for {mult} click DMG.' },
  black_hole:     { type: 'blackhole', mult: 55, stun: 3, charge: 1,
                    si: { mult: 5, stun: 0.5 },
                    desc: 'Pulls every enemy into the centre, stuns them for {stun}s and deals {mult} click DMG.' },
  swag_mode:      { type: 'transform', dur: 10, clickMult: 1.4, autoClicks: 3, charge: 1,
                    si: { dur: 1.5, clickMult: 0.3 },
                    desc: 'SWAG MODE for {dur}s: {clickMult}× click DMG and {autoClicks} automatic clicks per second.' },
  permafrost:     { type: 'timestop',  dur: 6, mult: 55, charge: 1,
                    si: { dur: 1, mult: 5 },
                    desc: 'Stops time for {dur}s — every attack is cancelled — and deals {mult} click DMG to all enemies.' },
  tidal_surge:    { type: 'surge',     mult: 45, coins: 30, charge: 1,
                    si: { mult: 4, coins: 10 },
                    desc: 'Deals {mult} click DMG to all enemies, fully heals you and drops a pile of coins.' },
  reality_break:  { type: 'execute',   dur: 3, mult: 60, threshold: 0.2, charge: 1,
                    si: { mult: 8, threshold: 0.04 },
                    desc: 'Stops time for {dur}s, hits the strongest enemy for {mult} click DMG and executes non-bosses under {threshold} HP.' },
  devourer_wakes: { type: 'devourer', dur: 8, gaze: 4, gazeR: 150, slam: 4, crunch: 14, devour: 0.35, bossPct: 0.1, charge: 1.4,
                    si: { dur: 0.5, gaze: 0.5, crunch: 2, bossPct: 0.015 },
                    desc: 'THE DEVOURER WAKES. A colossal eye opens over the arena for {dur}s. Its gaze follows your cursor and burns everything near it ({gaze} click DMG per second), tentacles burst from the dark to smash the enemies far from you ({slam} click DMG), and everything goes MAD. Then it feeds: every enemy is bitten for {crunch} click DMG plus 1 per Madness stack, anything under {devour} HP is devoured (bosses lose {bossPct} of their max HP instead), and you are fully healed.' },

  // 6★ Ice (Platinum): time stops, then the storm
  absolute_zero:  { type: 'absolutezero', dur: 5, storm: 22, shatter: 32, charge: 1.2,
                    si: { dur: 0.5, storm: 3, shatter: 4 },
                    desc: 'ABSOLUTE ZERO. Time stops for {dur}s: nothing moves, every attack is cancelled, your clicks build Freeze three times as fast and Flash Freeze has no cooldown. Then the ice storm hits: {storm} click DMG to every enemy, and every frozen one shatters for {shatter} click DMG more (bosses by their freeze meter).' },
  no_retreat:     { type: 'noretreat', dur: 8, bonus: 0.3, charge: 1.1,
                    si: { dur: 0.5, bonus: 0.08 },
                    desc: 'NO RETREAT. For {dur}s Astrec is at the top tier of Death Wish whatever his HP (crits, cleave, shockwaves) with +{bonus} DMG on top, and nothing can take him below 1 HP. Not Yet\'s lock doesn\'t apply.' },
  open_arms:      { type: 'openarms', dur: 10, armPct: 0.5, armRate: 0.5,           // lv1 (0+ Souls): Manic Puppeteer
                    drumsDur: 8, gates: 3, gatePull: 230, soulEvery: 0.4, soulPct: 1.2,   // lv2 (5+): Hell Drums
                    masterDur: 5, masterTick: 0.5, masterPct: 2.5, masterFinale: 12, cost: 0.5,   // lv3 (10, tap twice): Ascent of the Master
                    charge: 1.1,
                    si: { dur: 0.8, armPct: 0.08, soulPct: 0.25, masterPct: 0.4, masterFinale: 2 },
                    desc: 'OBEY YOUR MASTER. What it is depends on his Souls. 0+: MANIC PUPPETEER: for {dur}s all ten of his doll arms are on your cursor, striking whatever\'s in their reach by themselves ({armPct} click DMG every {armRate}s each), and anything that touches you is parried by itself. 5+: HELL DRUMS: for {drumsDur}s hell gates open across the arena, drag in the enemies around them and keep letting out wicked souls that hunt enemies down ({soulPct} click DMG each). 10 (tap the ult twice): ASCENT OF THE MASTER: offer half of the HP you have and he comes: for {masterDur}s nothing can attack, everything on the field is purged ({masterPct} click DMG every {masterTick}s) and then burns for {masterFinale} more; he takes the Souls.' },
  red_mist:       { type: 'redmist', dur: 6, steal: 0.006, finale: 18, charge: 1.2,
                    si: { dur: 0.5, steal: 0.001, finale: 3 },
                    desc: 'RED MIST. No time stop: the fight goes on, and for {dur}s every click makes its target hemorrhage on the spot and heals you {steal} of your max HP, no hemorrhage runs out, and Bloodletting is free with no cooldown. When it ends, everything bleeding ruptures at once for {finale} click DMG (bosses by their wound).' },

  // ── Anemic Kaisen ──────────────────────────────────────────────────────
  overtime:        { type: 'overtime',   dur: 8, mult: 1, collapse: 12, charge: 1,
                     si: { dur: 1, collapse: 2 },
                     desc: 'OVERTIME for {dur}s: every click is a ratio hit (a guaranteed crit with bonus crit DMG). When it ends, Collapse hits every enemy for {collapse} click DMG.' },
  distortion:      { type: 'distortion', dur: 10, slashes: 3, mult: 0.42, charge: 1,
                     si: { dur: 1, mult: 0.07 },
                     desc: 'For {dur}s every click also fires {slashes} slashes through your cursor at random angles, each hitting everything on its line for {mult} click DMG.' },
  meteor:          { type: 'meteor',     mult: 65, radius: 170, charge: 1,
                     si: { mult: 7, radius: 10 },
                     desc: 'Maximum: Meteor drops on your cursor after a short warning: {mult} click DMG in a {radius} radius, then leaves a huge lava field.' },
  malevolent_shrine: { type: 'shrine', dur: 10, pct: 1.3, cleave: 5, charge: 1,
                     si: { dur: 1, pct: 0.22, cleave: 0.8 },
                     desc: "Domain Expansion: Malevolent Shrine. For {dur}s Dismantle slashes every enemy on screen 4 times a second for {pct} click DMG each (a sure hit, nothing escapes), and once a second Cleave carves the toughest one for {cleave} click DMG. Doro's Open becomes huge inside the domain." },
  uzumaki:         { type: 'uzumaki',    base: 25, perSpirit: 1.5, min: 5, charge: 1,
                     si: { base: 3, perSpirit: 0.3 },
                     desc: 'Needs {min}+ spirits. Fires every spirit in a spiral: {base} click DMG to all enemies, plus {perSpirit} per spirit spent.' },
  hollow_purple:   { type: 'purple',     mult: 70, width: 90, charge: 1,
                     si: { mult: 10, width: 10 },
                     desc: 'Hollow Purple: press E where the beam should pass, then pull the cursor the way it should point (or keep still and it lines up on the most enemies), {mult} click DMG to everything in its path ({width} wide). Deletes enemy shots it touches.' },
  sorcerer_killer: { type: 'sorcerer',   dur: 8, speed: 5, mult: 1.5, pct: 0.8, threshold: 0.2, killsNeeded: 20, chargeOn: 'kills',
                     si: { dur: 1, pct: 0.06, threshold: 0.03 },
                     desc: 'Charges from kills ({killsNeeded} — elites count 3), not damage. For {dur}s you strike the nearest enemy 10 times a second for {pct} click DMG each and execute non-bosses under {threshold} HP.' },
  ora:             { type: 'ora',        dur: 45, punches: 10, pct: 0.6, charge: 1.3,
                     si: { punches: 1, pct: 0.05 },
                     desc: 'Pick 1 of 3 skills to use at full strength for {dur}s, with a punch barrage: {punches} punches a second for {pct} click DMG each.' },
  mahoraga:        { type: 'mahoraga',   hp: 2.5, mult: 10, charge: 1.4,
                     si: { hp: 0.4, mult: 1.3 },
                     desc: 'Summons Mahoraga ({hp}× your max HP, slams for {mult} click DMG). You are suspended and can only watch. It adapts to every attack that hits it, and its wheel turns every 6s, making it stronger. It must clear the field (boss included). If it dies, you die.' },
  // Bio's other kit's ult (see tenshadows)
  mahoraga2:       { type: 'mahoraga2',  hp: 2.5, mult: 10, dur: 25, berserkAt: 4, gunPct: 0.6, finale: 15, charge: 1.4,
                     si: { hp: 0.4, mult: 1.3, gunPct: 0.08, finale: 2 },
                     desc: 'With this treasure I summon… Eight-Handled Sword Divergent Sila Divine General MAHORAGA for {dur}s ({hp}× your max HP, slams for {mult} click DMG, the shockwave hits the rest for less). Enemies attack it instead of you. Click an enemy and it LEAPS onto it and slams down. It adapts to every kind of attack that hits it (the third time, that kind can no longer hurt it); its wheel turns for every new kind and every 4s, each turn making it stronger. After {berserkAt} turns it goes BERSERK: twin pistols on whatever you point at ({gunPct} click DMG a shot, 6 a second) and a bullet storm with every leap. Summon it with a full SHADOW meter for the full ritual: it takes the whole meter and arrives with its wheel already turned twice. Summon it inside the Chimera Shadow Garden and the garden stays open as long as it stands. When its time is up it leaves with a WORLD-CUTTING SLASH ({finale} click DMG along the line, a third of that to everything else). If it falls, so do you.' },
};

// The kit a card's effect gives on this device: Bio's other kit replaces his usual one where it's unlocked
const ALT_SKILL = { shadows: 'tenshadows' }, ALT_ULT = { mahoraga: 'mahoraga2' };
export const skillKitFor = (effect) => SKILLS[(wheelOn() && ALT_SKILL[effect]) || effect];
export const ultKitFor = (effect) => ULTS[(wheelOn() && ALT_ULT[effect]) || effect];

// Each S level after S1 also cuts the ult cooldown by this much (S5 = −32%)
export const ULT_CD_PER_SI = 0.08;

// How a number is shown in descriptions
const PCT_KEYS = new Set(['per', 'devour', 'deerHeal', 'share', 'slash', 'cut', 'heal', 'maxHeal', 'pct', 'chance', 'bonus', 'rate', 'dmg', 'threshold', 'bossPct', 'maxPctHp', 'healPctHp',
  'window', 'dps', 'perSoul', 'autoPct', 'cost', 'rage', 'max', 'feed', 'steal', 't1', 't2', 't3', 'reviveHp', 'braceDR', 'breachCost', 'exposed', 'soulDmg']);
const MULT_KEYS = new Set(['qPct', 'figPct', 'storm', 'shatter', 'dogPct', 'toadPct', 'nuePct', 'oxPct', 'serpentPct', 'tigerPct', 'elephantPct', 'gunPct', 'finale', 'perStack', 'gaze', 'slam', 'crunch', 'cleave', 'dps', 'maxBite', 'throwPct', 'minPct', 'mult', 'collapse', 'burn', 'base', 'perSpirit', 'crush', 'hemoDps', 'rakePct', 'grabPct', 'slamPct', 'shock', 'counterMin', 'counterPer', 'counterMax', 'breachPct', 'parryPct', 'reflectPct', 'stringPct', 'torPct', 'armPct', 'riftPct', 'clonePct', 'soulPct', 'masterPct', 'masterFinale']);
function showVal(key, v) {
  if (MULT_KEYS.has(key)) return `${Math.round(v * 100)}%`;
  if (PCT_KEYS.has(key)) return `${+(v * 100).toFixed(1)}%`;
  if (key === 'shots' || key === 'targets' || key === 'links') return String(Math.floor(v));
  if (key === 'chill' || key === 'chain' || key === 'qRadius' || key === 'figR' || key === 'wallLen' || key === 'bleed' || key === 'splash' || key === 'rakeLen' || key === 'rakeBleed' || key === 'slamR' || key === 'cleaveR' || key === 'shockR' || key === 'counterR' || key === 'breachLen' || key === 'stringLen' || key === 'gustR' || key === 'armR' || key === 'riftR' || key === 'riftPull' || key === 'gunR' || key === 'cloneR' || key === 'gatePull' || key === 'maxSouls' || key === 'lv2At' || key === 'lv3At' || key === 'gates') return String(Math.round(v));
  if (key === 'every' || key === 'cap' || key === 'maxMad' || key === 'maxBars' || key === 'berserkAt' || key === 'gardenNeed') return String(Math.round(v));
  if (key === 'cooldown') return String(+v.toFixed(1));
  return String(+v.toFixed(2));
}

// Skill before LV20: the weaker `lv1` numbers replace the base ones
export const weakKit = (kit) => (kit?.lv1 ? { ...kit, ...kit.lv1, weak: true } : kit?.passive ? { ...kit, weak: true } : kit);

// The kit at a given superimposition (si = 0 for S1 … 4 for S5)
export function scaleKit(kit, si = 0) {
  if (!kit) return kit;
  const out = { ...kit };
  const n = Math.max(0, Math.min(4, si));
  // weak (pre-LV20) skills still get their superimposition steps, at half size
  Object.entries(kit.si ?? {}).forEach(([k, step]) => { out[k] = kit[k] + step * n * (kit.weak ? 0.5 : 1); });
  if (out.shots) out.shots = Math.floor(out.shots);
  if (out.targets) out.targets = Math.floor(out.targets);
  // the passive scales the same way (and is weaker too before LV20)
  if (kit.passive) out.passive = scaleKit(kit.weak && kit.passive.lv1 ? { ...kit.passive, ...kit.passive.lv1, weak: true } : kit.passive, n);
  return out;
}

// Description with this superimposition's numbers filled in
export function describeKit(kit, si = 0) {
  if (!kit) return '';
  const k = scaleKit(kit, si);
  return kit.desc.replace(/\{(\w+)\}/g, (_, key) => (key in k ? showVal(key, k[key]) : key))
    // "{every}th" → 1st / 2nd / 3rd / 4th…
    .replace(/\b(\d+)th\b/g, (_, n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'));
}

// A skill's passive, with this superimposition's numbers (`weak` = before LV20)
export function describePassive(kit, si = 0, weak = false) {
  if (!kit?.passive) return '';
  const p = weak && kit.passive.lv1 ? { ...kit.passive, ...kit.passive.lv1, weak: true } : kit.passive;
  return describeKit(p, si);
}

// What a card's skill or ult does, with the real numbers (the `description` text in
// characters.js is older and can be out of date, so it's only the fallback)
export function abilityText(ability, si = 0) {
  if (!ability) return '';
  const kit = skillKitFor(ability.effect) ?? ultKitFor(ability.effect);
  if (!kit) return ability.description ?? '';
  return describeKit(kit, si) + (kit.passive ? `\nPassive: ${describePassive(kit, si)}` : '');
}

// One line saying what the next superimposition improves, e.g. "range 110 → 128, DMG 50% → 62%"
const LABELS = { radius: 'range', pct: 'DMG', interval: 'every', shots: 'shots', chance: 'chance', dur: 'duration', bonus: 'bonus',
  rate: 'crit rate', dmg: 'crit DMG', mult: 'DMG', stun: 'stun', clickMult: 'click ×', coins: 'coins', threshold: 'execute',
  bossPct: 'boss bite', maxPctHp: 'max heal', healPctHp: 'heal',
  window: 'ratio window', dps: 'burn', cap: 'max spirits', perSoul: 'per spirit', lag: 'aim lag', autoPct: 'auto DMG',
  collapse: 'collapse', burn: 'burn', perSpirit: 'per spirit', cooldown: 'cooldown', dogPct: 'dog bite', toadPct: 'tongue', nuePct: 'Nue', oxPct: 'Ox', deerHeal: 'Deer heal', serpentPct: 'Serpent', tigerPct: 'Tiger', elephantPct: 'Elephant', gunPct: 'pistols', finale: 'world slash', domainDur: 'garden', perStack: 'per stack', devour: 'devour under', per: 'per stack', gaze: 'gaze', crunch: 'bite', links: 'links', share: 'shared', slash: 'cut', throwPct: 'throw', cut: 'slice', heal: 'heal', maxHeal: 'max heal', freeze: 'freeze', targets: 'targets', width: 'width', punches: 'punches/s', hp: 'HP', crush: 'crush', chill: 'freeze/click', qPct: 'Q DMG', qRadius: 'Q range', figPct: 'figure blast', wallLen: 'frost line', chain: 'chain frost', storm: 'storm', shatter: 'shatter',
  bleed: 'bleed/click', hemoDps: 'hemorrhage', rage: 'rage', rakePct: 'rake', slamPct: 'slam', max: 'bloodlust', splash: 'splash', feed: 'feed', steal: 'lifesteal', t1: 'tier I', t2: 'tier II', t3: 'tier III', shock: 'shockwave', counterPer: 'hit back', counterMax: 'max hit back', braceDR: 'brace', breachPct: 'breach', breachLen: 'breach length', parryWin: 'parry window', parryPct: 'parry strike', reflectPct: 'reflect', stringPct: 'strings', torPct: 'tornado', torDur: 'tornado time', armPct: 'per arm', exposed: 'exposed', riftPct: 'rift', riftDur: 'rift time', clonePct: 'shadow', gunDur: 'gunslinger time', soulDmg: 'per soul', soulPct: 'wicked soul', masterPct: 'purge', masterFinale: 'finale' };
export function describeSiStep(kit, si) {
  if (!kit?.si || si >= 4) return '';
  const a = scaleKit(kit, si), b = scaleKit(kit, si + 1);
  return Object.keys(kit.si)
    .filter(k => showVal(k, a[k]) !== showVal(k, b[k]))
    .map(k => `${LABELS[k] ?? k} ${showVal(k, a[k])} → ${showVal(k, b[k])}`).join(', ');
}
