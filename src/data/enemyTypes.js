const BASE = import.meta.env.BASE_URL;

export const ENEMY_TYPES = [
  { name:'Xiao',               image:`${BASE}enemies/xiaoenemy.png`, hp:120,  maxHp:120,  coinReward:40,  speed:4,   isBoss:false, tier:'basic',    attacks:[] },
  { name:'Bonk',               image:`${BASE}enemies/bonkenemy.png`, hp:350,  maxHp:350,  coinReward:90,  speed:1.5, isBoss:false, tier:'elite',    attacks:['sweep'],     attackCooldown:4000 },
  { name:'DEVOURER OF WORLDS', image:`${BASE}enemies/hoxboss.jpg`,   hp:1800, maxHp:1800, coinReward:400, speed:0,   isBoss:true,  tier:'boss',     attacks:['slam','sweep'],      attackCooldown:2200, gemReward:10 },
  { name:'Treasure',           image:`${BASE}enemies/treasure.png`,  hp:50,   maxHp:50,   coinReward:0,   speed:5,   isBoss:false, tier:'treasure', attacks:[],                    pullReward:1, movePattern:'erratic' },
];