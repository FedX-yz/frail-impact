import { BAL } from './balance';
import { SKILLS, ULTS, SKILL_UNLOCK, ULT_UNLOCK } from './kits';
import { CARD_SETS } from './sets';

export const SI_MULT = [1, 1.12, 1.25, 1.40, 1.60];
export const siMult = (si = 0) => SI_MULT[Math.min(Math.max(si, 0), SI_MULT.length - 1)];

// Which sets are complete in this deck (supports only — main is always 5★/6★)
export function activeSets(deck) {
  const ids = new Set((deck?.supports ?? []).filter(Boolean).map(c => c.id));
  return CARD_SETS.filter(s => s.members.every(m => ids.has(m)));
}

// Everything the battle needs to know about the player, from the deck.
export function computePlayerStats({ deck, cardInventory = {}, clickPower = 5, cps = 1, multiplier = 1 }) {
  const main     = deck?.main ?? null;
  const supports = (deck?.supports ?? []).filter(Boolean);
  const cards    = [main, ...supports].filter(Boolean);

  let atkSum = 0, hpSum = 0, defSum = 0;
  let dmgMult = multiplier, highHpAtkBonus = 0, defBoost = 0, enemyDmgRed = 0, regenBonus = 0;
  cards.forEach(c => {
    const m = siMult(cardInventory[c.id]?.si);
    atkSum += (c.stats?.atk ?? 0) * m;
    hpSum  += c.stats?.hp ?? 0;
    defSum += c.stats?.def ?? 0;
    const p = c.passive;
    if (!p) return;
    if (p.effect === 'global_dmg_boost')     dmgMult       += p.value;
    if (p.effect === 'atk_boost_high_hp')    highHpAtkBonus += p.value;
    if (p.effect === 'party_def_boost')      defBoost      += p.value;
    if (p.effect === 'enemy_dmg_reduction')  enemyDmgRed   += p.value;
    if (p.effect === 'hp_regen')             regenBonus    += p.value;
  });

  // Sub-stats from 3★/4★ supports
  const sub = { atkPct: 0, critRate: 0, critDmg: 0, hpPct: 0, coinPct: 0, ultCharge: 0, dmgRed: 0 };
  supports.forEach(c => (cardInventory[c.id]?.subs ?? []).forEach(s => { if (s.stat in sub) sub[s.stat] += s.value; }));

  // Set bonuses
  const sets = activeSets(deck);
  const has = id => sets.some(s => s.id === id);
  const atkPct   = sub.atkPct + (has('endings') ? 0.20 : 0);
  let critRate   = BAL.BASE_CRIT_RATE + sub.critRate + (has('mystery') ? 0.05 : 0);
  let critDmg    = BAL.BASE_CRIT_DMG  + sub.critDmg  + (has('mystery') ? 0.50 : 0);

  // Main card level → skill / ult
  const entry = main ? cardInventory[main.id] : null;
  const level = entry?.level ?? 1;
  const skill = main?.skill && level >= SKILL_UNLOCK ? { ...SKILLS[main.skill.effect], name: main.skill.name, effect: main.skill.effect } : null;
  const ult   = main?.ult   && level >= ULT_UNLOCK   ? { ...ULTS[main.ult.effect],     name: main.ult.name,   effect: main.ult.effect }   : null;
  if (skill?.type === 'crit') { critRate += skill.rate; critDmg += skill.dmg; }

  const def = defSum * (1 + defBoost);
  const dmgReduction = Math.min(BAL.MAX_DMG_REDUCTION,
    def / (def + BAL.DEF_K) + sub.dmgRed + enemyDmgRed + (has('showdown') ? 0.15 : 0));

  const base = (clickPower + atkSum * BAL.ATK_TO_CLICK) * (1 + atkPct) * dmgMult;

  return {
    clickDmg: base,
    autoDps:  (cps + atkSum * BAL.ATK_TO_AUTO) * (1 + atkPct) * dmgMult,
    critRate: Math.min(1, critRate),
    critDmg,
    highHpAtkBonus,
    maxHp:    Math.round((BAL.BASE_HP + hpSum * BAL.CARD_HP_TO_HP) * (1 + sub.hpPct + (has('oof') ? 0.25 : 0))),
    regen:    (BAL.BASE_REGEN + regenBonus) * (has('oof') ? 2 : 1),
    dmgReduction,
    coinMult:      1 + sub.coinPct + (has('meme') ? 0.25 : 0),
    ultChargeMult: 1 + sub.ultCharge + (has('broke') ? 0.35 : 0),
    treasureMult:  has('meme') ? 2 : 1,
    telegraphMult: has('showdown') ? 1.3 : 1,
    bossDmgMult:   has('endings') ? 1.3 : 1,
    labubuEvery:   has('labubu') ? 10 : 0,
    sets, skill, ult, level,
  };
}
