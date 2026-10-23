// Frail Initiative HQ: rooms you upgrade with coins (replaces the old Train button).
// Every level costs cost × growth^level. Effects stack per level:
//   mult: the stat is multiplied by (1 + per) every level (ATK ×1.10, ×1.21, ×1.33 …)
//   add:  `per` is added every level
// max: highest level (none = no limit). Balance them here.
export const FACILITIES = [
  { id: 'armory',    name: 'ARMORY',    room: 'B1-01', flavor: 'Better gear for the agents.',
    stat: 'atk',   mode: 'mult', per: 0.10,  cost: 150, growth: 1.32 },
  { id: 'infirmary', name: 'INFIRMARY', room: 'B1-02', flavor: 'Somebody has to patch them up.',
    stat: 'hp',    mode: 'mult', per: 0.08,  cost: 120, growth: 1.32 },
  { id: 'security',  name: 'SECURITY',  room: 'B1-03', flavor: 'Locks, cameras, a guy named Dave.',
    stat: 'dmgRed', mode: 'add', per: 0.01,  cost: 300, growth: 1.42, max: 20 },
  { id: 'analytics', name: 'ANALYTICS', room: '2F-04', flavor: 'Spreadsheets about where to hit things.',
    stat: 'crit',  mode: 'add', per: 0.01,   cost: 250, growth: 1.38, max: 30 },
  { id: 'ops',       name: 'OPS ROOM',  room: '2F-05', flavor: 'Big screens, bigger plans.',
    stat: 'ult',   mode: 'add', per: 0.04,   cost: 300, growth: 1.40, max: 25 },
  { id: 'payroll',   name: 'PAYROLL',   room: '3F-06', flavor: 'Overtime is paid. Mostly.',
    stat: 'pay',   mode: 'add', per: 0.05,   cost: 400, growth: 1.42, max: 30 },
];

export const facilityCost = (f, level) => Math.round(f.cost * Math.pow(f.growth, level));
export const maxed = (f, level) => f.max != null && level >= f.max;

// What a room gives at a level (0 = not built)
export function facilityEffect(f, level) {
  const v = f.mode === 'mult' ? Math.pow(1 + f.per, level) - 1 : f.per * level;
  return v;
}

// "+33% ATK", "+12% crit rate, +60% crit DMG" …
export function describeEffect(f, level) {
  const v = facilityEffect(f, level), pct = x => `+${Math.round(x * 100)}%`;
  switch (f.stat) {
    case 'atk':    return `${pct(v)} ATK`;
    case 'hp':     return `${pct(v)} max HP`;
    case 'dmgRed': return `−${Math.round(v * 100)}% damage taken`;
    case 'crit':   return `${pct(v)} crit rate, ${pct(v * 5)} crit DMG`;
    case 'ult':    return `${pct(v)} ult charge`;
    case 'pay':    return `${pct(v)} coins and XP`;
    default:       return '';
  }
}

// All rooms together → what the battle stats need
export function hqBonuses(hq = {}) {
  const lv = id => Math.max(0, hq[id] ?? 0);
  const f = id => FACILITIES.find(x => x.id === id);
  const eff = id => facilityEffect(f(id), lv(id));
  return {
    atkMult:   1 + eff('armory'),
    hpMult:    1 + eff('infirmary'),
    dmgRed:    eff('security'),
    critRate:  eff('analytics'),
    critDmg:   eff('analytics') * 5,
    ultCharge: eff('ops'),
    payPct:    eff('payroll'),
  };
}
