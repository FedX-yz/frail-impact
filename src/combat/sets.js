// 3★ / 4★ cards: sets of 3 and relic-style sub-stats.
//
// Sets: equip all 3 members (support slots) to switch the bonus on.
// Sub-stats: each 3★ card rolls 2, each 4★ rolls 3, the first time you own it.
// Every fusion (S2…S5) upgrades one of them at random.

export const CARD_SETS = [
  { id: 'labubu',   name: 'Labubu Gang', members: [5, 7, 18],   color: '#f472b6',
    desc: 'Every 10th click is a guaranteed crit that deals at least 3× DMG.' },
  { id: 'meme',     name: 'Meme Lords',  members: [19, 16, 15], color: '#facc15',
    desc: 'Treasures show up twice as often. +25% coins.' },
  { id: 'broke',    name: 'Broke Boys',  members: [4, 3, 21],   color: '#a3a3a3',
    desc: '+35% ult charge rate.' },
  { id: 'oof',      name: 'Oof Squad',   members: [14, 17, 20], color: '#4ade80',
    desc: '+25% max HP and regenerate twice as fast.' },
  { id: 'endings',  name: 'Endings',     members: [11, 27, 23], color: '#c084fc',
    desc: '+20% ATK and +30% damage to bosses.' },
  { id: 'mystery',  name: 'Mysteries',   members: [12, 13, 26], color: '#60a5fa',
    desc: '+5% crit rate and +50% crit DMG.' },
  { id: 'showdown', name: 'Showdown',    members: [24, 25, 8],  color: '#fb923c',
    desc: 'Enemy attacks flash red 30% longer. Take 15% less damage.' },
];

export const setOfCard = (cardId) => CARD_SETS.find(s => s.members.includes(Number(cardId))) ?? null;

export const SUB_STATS = {
  atkPct:    { label: 'ATK',        roll: [0.03, 0.06],  pct: true },
  critRate:  { label: 'Crit Rate',  roll: [0.015, 0.035], pct: true },
  critDmg:   { label: 'Crit DMG',   roll: [0.05, 0.10],  pct: true },
  hpPct:     { label: 'Max HP',     roll: [0.04, 0.08],  pct: true },
  coinPct:   { label: 'Coins',      roll: [0.05, 0.10],  pct: true },
  ultCharge: { label: 'Ult Charge', roll: [0.04, 0.08],  pct: true },
  dmgRed:    { label: 'DMG Taken',  roll: [0.02, 0.04],  pct: true, negative: true },
};

const rollValue = (key, rarity) => {
  const [a, b] = SUB_STATS[key].roll;
  const v = a + Math.random() * (b - a);
  return +(v * (rarity >= 4 ? 1.25 : 1)).toFixed(4);
};

export function rollSubs(rarity) {
  const keys = Object.keys(SUB_STATS).sort(() => Math.random() - 0.5);
  return keys.slice(0, rarity >= 4 ? 3 : 2).map(stat => ({ stat, value: rollValue(stat, rarity) }));
}

// One fusion = one sub-stat gets another roll added to it
export function upgradeSubs(subs, rarity) {
  if (!subs?.length) return subs;
  const i = Math.floor(Math.random() * subs.length);
  return subs.map((s, j) => j === i ? { ...s, value: +(s.value + rollValue(s.stat, rarity)).toFixed(4), ups: (s.ups ?? 0) + 1 } : s);
}

export const formatSub = ({ stat, value }) => {
  const d = SUB_STATS[stat];
  if (!d) return '';
  return `${d.label} ${d.negative ? '−' : '+'}${(value * 100).toFixed(1)}%`;
};
