// ─────────────────────────────────────────────────────────────────────────────
// Every combat number lives here so balancing is one file.
// Sizes are "design px" — the arena scales them with its size (phone vs PC).
// ─────────────────────────────────────────────────────────────────────────────
export const BAL = {
  // Player damage
  ATK_TO_CLICK:     0.30,  // each point of equipped card ATK adds this much click DMG
  ATK_TO_AUTO:      0.03,  // ...and this much auto DMG per second
  BASE_CRIT_RATE:   0.15,
  BASE_CRIT_DMG:    1.00,  // +100% → crits do 2×
  AUTO_INTERVAL:    1.0,   // seconds between auto hits

  // Player survival
  BASE_HP:          100,
  CARD_HP_TO_HP:    0.02,  // each point of card HP adds this much max HP
  DEF_K:            600,   // damage reduction = def / (def + DEF_K)
  MAX_DMG_REDUCTION: 0.75,
  BASE_REGEN:       0.5,   // HP per second
  HIT_INVULN:       0.7,   // seconds of invulnerability after being hit

  // Ult
  ULT_CHARGE_CLICKS: 45,   // ult fills after dealing ~this many clicks' worth of DMG
  AUTO_CHARGE_WEIGHT: 0.5, // auto-attack damage charges the ult at half rate

  // Telegraphs
  TELEGRAPH:        1.0,   // seconds an attack area flashes red before it hits
  STRIKE_FLASH:     0.25,  // seconds the white attack stays on screen

  // Stage scaling (stage n multiplies by GROWTH^(n-1))
  HP_GROWTH:        1.28,
  COIN_GROWTH:      1.20,
  DMG_GROWTH:       0.12,  // enemy damage +12% per stage

  // Treasure
  TREASURE_EVERY:   12,    // seconds between treasure rolls
  TREASURE_CHANCE:  0.4,
  TREASURE_LIFE:    9,     // seconds before it runs away

  // XP to the main card per kill
  XP: { basic: 100, elite: 300, boss: 1000, treasure: 10 },
};

// Faster enemies get less HP, slow ones get more. speed is 0..1.
export const speedHpMult = (speed) => 1.5 - speed;
