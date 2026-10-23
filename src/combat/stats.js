import { BAL } from './balance';
import { hqBonuses } from './hq';
import { SKILLS, ULTS, SKILL_UNLOCK, ULT_UNLOCK, ULT_CD_PER_SI, scaleKit, weakKit } from './kits';
import { CARD_SETS } from './sets';

// Superimposition stat multipliers (ATK, HP and DEF) for S1…S5.
// 5★/6★ grow faster, and their skill/ult also get stronger (kits.js).
export const SI_MULT      = [1, 1.12, 1.25, 1.40, 1.60];
export const SI_MULT_HIGH = [1, 1.15, 1.32, 1.50, 1.75];
const clampSi = (si) => Math.min(Math.max(si ?? 0, 0), 4);
export const siMult = (si = 0, rarity = 4) => (rarity >= 5 ? SI_MULT_HIGH : SI_MULT)[clampSi(si)];
export const levelMult = (level = 1, per = BAL.LEVEL_ATK) => 1 + per * (Math.max(1, level) - 1);

// A card's ATK/HP/DEF as they actually are in battle (level + superimposition)
export function cardBattleStats(card, entry) {
  if (!card?.stats) return { atk: 0, hp: 0, def: 0 };
  const si = siMult(entry?.si, card.rarity);
  const lv = card.rarity >= 5 ? (entry?.level ?? 1) : 1;   // only main cards (5★/6★) level up
  return {
    atk: Math.round(card.stats.atk * si * levelMult(lv, BAL.LEVEL_ATK)),
    hp:  Math.round(card.stats.hp  * si * levelMult(lv, BAL.LEVEL_HP)),
    def: Math.round(card.stats.def * si * levelMult(lv, BAL.LEVEL_HP)),
  };
}

// Which sets are complete in this deck (supports only — main is always 5★/6★)
export function activeSets(deck) {
  const ids = new Set((deck?.supports ?? []).filter(Boolean).map(c => c.id));
  return CARD_SETS.filter(s => s.members.every(m => ids.has(m)));
}

// Everything the battle needs to know about the player, from the deck.
export function computePlayerStats({ deck, cardInventory = {}, hq = {}, multiplier = 1 }) {
  const H = hqBonuses(hq);
  const main     = deck?.main ?? null;
  const supports = (deck?.supports ?? []).filter(Boolean);

  const mainS = main ? cardBattleStats(main, cardInventory[main.id]) : BAL.NO_MAIN;
  const supS  = supports.map(c => cardBattleStats(c, cardInventory[c.id]));
  const sum = key => supS.reduce((a, s) => a + s[key], 0);

  let dmgMult = multiplier, highHpAtkBonus = 0, defBoost = 0, enemyDmgRed = 0, regenPct = 0;
  [main, ...supports].filter(Boolean).forEach(c => {
    const p = c.passive;
    if (!p) return;
    if (p.effect === 'global_dmg_boost')     dmgMult       += p.value;
    if (p.effect === 'atk_boost_high_hp')    highHpAtkBonus += p.value;
    if (p.effect === 'party_def_boost')      defBoost      += p.value;
    if (p.effect === 'enemy_dmg_reduction')  enemyDmgRed   += p.value;
    if (p.effect === 'hp_regen')             regenPct      += p.value;
  });

  // Sub-stats from 3★/4★ supports
  const sub = { atkPct: 0, critRate: 0, critDmg: 0, hpPct: 0, coinPct: 0, ultCharge: 0, dmgRed: 0 };
  supports.forEach(c => (cardInventory[c.id]?.subs ?? []).forEach(s => { if (s.stat in sub) sub[s.stat] += s.value; }));

  // Set bonuses
  const sets = activeSets(deck);
  const has = id => sets.some(s => s.id === id);
  const atkPct = sub.atkPct + (has('endings') ? 0.20 : 0);
  const hpPct  = sub.hpPct + (has('oof') ? 0.25 : 0);
  let critRate = BAL.BASE_CRIT_RATE + sub.critRate + (has('mystery') ? 0.05 : 0) + H.critRate;
  let critDmg  = BAL.BASE_CRIT_DMG  + sub.critDmg  + (has('mystery') ? 0.50 : 0) + H.critDmg;

  // Team stats — the numbers shown in Deck and on the main screen
  const baseAtk = mainS.atk + BAL.SUPPORT_ATK * sum('atk');
  const atk = Math.round(baseAtk * (1 + atkPct) * dmgMult * H.atkMult);
  const maxHp = Math.round((mainS.hp + BAL.SUPPORT_HP * sum('hp')) * (1 + hpPct) * H.hpMult);
  const def = Math.round((mainS.def + BAL.SUPPORT_DEF * sum('def')) * (1 + defBoost));
  const defReduction = def / (def + BAL.DEF_K);

  // Main card level + superimposition → skill / ult
  const entry = main ? cardInventory[main.id] : null;
  const level = entry?.level ?? 1;
  const si = clampSi(entry?.si);
  // skill works from LV1 (weaker), full strength at LV20
  const skillKit = SKILLS[main?.skill?.effect];
  const skill = main?.skill && skillKit
    ? { ...scaleKit(level >= SKILL_UNLOCK ? skillKit : weakKit(skillKit), si), name: main.skill.name, effect: main.skill.effect } : null;
  const ult = main?.ult && level >= ULT_UNLOCK && ULTS[main.ult.effect]
    ? { ...scaleKit(ULTS[main.ult.effect], si), name: main.ult.name, effect: main.ult.effect,
        cooldown: (main.ult.cooldown ?? 30) * (1 - ULT_CD_PER_SI * si) } : null;
  if (skill?.type === 'crit') { critRate += skill.rate; critDmg += skill.dmg; }
  if (skill?.type === 'ratio') critRate = Math.max(0, critRate + (skill.critRateMod ?? 0));   // Nanami crits by timing instead

  const dmgReduction = Math.min(BAL.MAX_DMG_REDUCTION,
    defReduction + sub.dmgRed + enemyDmgRed + (has('showdown') ? 0.15 : 0) + H.dmgRed);

  return {
    atk, maxHp, def, defReduction,
    clickDmg: atk,
    autoDps:  atk * BAL.AUTO_PCT,
    critRate: Math.min(1, critRate),
    critDmg,
    highHpAtkBonus,
    regen:    maxHp * (BAL.BASE_REGEN_PCT + regenPct) * (has('oof') ? 2 : 1),
    dmgReduction,
    coinMult:      1 + sub.coinPct + (has('meme') ? 0.25 : 0) + H.payPct,
    xpMult:        1 + H.payPct,
    ultChargeMult: 1 + sub.ultCharge + (has('broke') ? 0.35 : 0) + H.ultCharge,
    treasureMult:  has('meme') ? 2 : 1,
    telegraphMult: has('showdown') ? 1.3 : 1,
    bossDmgMult:   has('endings') ? 1.3 : 1,
    labubuEvery:   has('labubu') ? 10 : 0,
    hq: H,
    // where the numbers come from, for the Deck screen breakdown
    parts: { main: main ? mainS : null, supports: supS, atkPct, hpPct, dmgMult, defBoost, hqAtk: H.atkMult },
    sets, skill, ult, level, si,
  };
}
