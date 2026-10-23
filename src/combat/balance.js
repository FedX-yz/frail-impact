// ─────────────────────────────────────────────────────────────────────────────
// Every combat number lives here so balancing is one file.
// Sizes are "design px" — the arena scales them with its size (phone vs PC).
// ─────────────────────────────────────────────────────────────────────────────
export const BAL = {
  // ── Your stats come straight from your cards (see stats.js) ──
  //   ATK = main card ATK + 50% of each support's ATK      → each click deals ATK
  //   HP  = main card HP  + 25% of each support's HP
  //   DEF = main card DEF + 25% of each support's DEF      → damage taken −def/(def+DEF_K)
  SUPPORT_ATK:      0.50,
  SUPPORT_HP:       0.25,
  SUPPORT_DEF:      0.25,
  NO_MAIN: { atk: 10, hp: 700, def: 0 },   // stats when no main card is equipped
  LEVEL_ATK:        0.02,  // main card: +2% ATK per level (LV50 ≈ +98%)
  LEVEL_HP:         0.01,  // …and +1% HP and DEF per level (so you hit harder faster than you get tankier)
  AUTO_PCT:         0.10,  // auto-attack deals 10% of ATK every second
  // (the old Train button is now the HQ: combat/hq.js; old saves turn Train levels into Armory levels)

  BASE_CRIT_RATE:   0.15,
  BASE_CRIT_DMG:    1.00,  // +100% → crits do 2×
  AUTO_INTERVAL:    1.0,   // seconds between auto hits

  // Survival
  DEF_K:            300,   // damage reduction = def / (def + DEF_K)
  MAX_DMG_REDUCTION: 0.70,
  BASE_REGEN_PCT:   0.004, // regenerate 0.4% of max HP per second
  HIT_INVULN:       0.7,   // seconds of invulnerability after being hit

  // Ult: fills from damage you deal; can only fire when it's full AND off cooldown
  ULT_CHARGE_CLICKS: 45,   // ult fills after dealing ~this many clicks' worth of DMG
  AUTO_CHARGE_WEIGHT: 0.5, // auto-attack damage charges the ult at half rate

  // Telegraphs
  TELEGRAPH:        1.0,   // seconds an attack area flashes red before it hits
  STRIKE_FLASH:     0.25,  // seconds the white attack stays on screen

  // Enemies (base numbers in enemies.js are multiplied by these)
  ENEMY_HP_MULT:    2.5,
  ENEMY_DMG_MULT:   12,

  // Stage scaling: enemies get GROWTH× tougher every stage up to GROWTH_TAPER_FROM,
  // then the *_LATE rate, so late stages stay within reach of HQ upgrades and levels
  // (stage 30 ≈ 210× stage-1 HP instead of 1,300×; stage 50 ≈ 4,900×)
  HP_GROWTH:        1.28,
  HP_GROWTH_LATE:   1.17,
  COIN_GROWTH:      1.20,
  DMG_GROWTH:       1.10,  // enemy damage ×1.10 per stage (stage 10 ≈ 2.4×)
  DMG_GROWTH_LATE:  1.06,
  GROWTH_TAPER_FROM: 10,
  XP_GROWTH:        0.10,  // kill XP +10% per stage (stage 21 = 3×), so card levels keep coming
  GEM_GROWTH:       0.15,  // gem rewards +15% per stage (stage 5 = 1.6×, stage 11 = 2.5×)

  // Combo: every hit you land adds a stack (+1% DMG each, up to +50%).
  // Stacks reset if you don't land a hit for COMBO_WINDOW seconds, or if you get hit.
  COMBO_PER:        0.01,
  COMBO_MAX:        50,
  COMBO_WINDOW:     2.5,
  COMBO_MILESTONES: [10, 25, 50],

  // Elite affixes (enemies.js → AFFIXES): chance an elite gets one
  AFFIX_FROM_STAGE: 4,
  AFFIX_CHANCE:     0.2,   // at AFFIX_FROM_STAGE, +AFFIX_CHANCE_GROWTH per stage after
  AFFIX_CHANCE_GROWTH: 0.03,
  AFFIX_CHANCE_MAX: 0.5,
  AFFIX_REWARD:     1.5,   // affixed elites give +50% coins and XP

  // Stage modifiers (stages.js → MODIFIERS)
  MODIFIER_FROM_STAGE: 3,
  MODIFIER_CHANCE:  0.65,  // share of stages that get one

  // Treasure
  TREASURE_EVERY:   12,    // seconds between treasure rolls
  TREASURE_CHANCE:  0.4,
  TREASURE_LIFE:    9,     // seconds before it runs away

  // XP to the main card per kill
  XP: { basic: 100, elite: 300, boss: 1000, treasure: 10 },
};


// Faster enemies get less HP, slow ones get more. speed is 0..1.
export const speedHpMult = (speed) => 1.5 - speed;
