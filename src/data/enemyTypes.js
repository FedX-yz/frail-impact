const BASE = import.meta.env.BASE_URL;

export const ENEMY_TYPES = [
  { name:'Xiao',               image:`${BASE}enemies/xiaoenemy.png`, hp:220,  maxHp:220,  coinReward:50,  isBoss:false, tier:'basic',    attacks:[] },
  { name:'Bonk',               image:`${BASE}enemies/bonkenemy.png`, hp:300,  maxHp:300,  coinReward:80,  isBoss:false, tier:'elite',    attacks:['projectile','sweep','chase'], attackCooldown:4000 },
  { name:'DEVOURER OF WORLDS', image:`${BASE}enemies/hoxboss.jpg`,   hp:1200, maxHp:1200, coinReward:300, isBoss:true,  tier:'boss',     attacks:['projectile','slam'],          attackCooldown:2500, gemReward:10 },
  { name:'Treasure',           image:`${BASE}enemies/treasure.png`,  hp:80,   maxHp:80,   coinReward:0,   isBoss:false, tier:'treasure', attacks:['lure'],                       attackCooldown:3000, pullReward:1, movePattern:'erratic' },
];