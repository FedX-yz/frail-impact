// ─────────────────────────────────────────────────────────────────────────────
// Story mode (the Tower): chapters → map → nodes.
//
// chapter: {
//   id, name,
//   map:   picture for the map (path inside public/, e.g. 'story/maps/ch1.png');
//          null draws a placeholder. Nodes sit on it by percent, so any size works.
//   after: a node of an earlier chapter that unlocks this chapter (none = open)
//   nodes: [...]
// }
//
// node: {
//   id:    unique, used in saves — don't rename after release
//   name:  shown on the map and as the battle title
//   desc:  one line on the node card
//   x, y:  position on the map in percent (0–100)
//   after: node ids that lead here. It opens when ANY of them is cleared
//          (two paths into one node = two ways in, like Mario worlds). [] = open.
//   if:    optional flag — the node only appears when it's set ('!flag' = not set)
//   intro: scene id (scenes.js) played before the battle
//   outro: scene id played after winning
//   battle: { ... } or leave it out for a cutscene-only node
//     level:    difficulty, same scale as endless stages (1 = easiest)
//     kills:    enemies to defeat (default: the endless stage's number)
//     boss:     'worm' | 'hydra' | 'swarmking' — fought after the kills (default: none)
//     enemies:  basic enemy ids (enemies.js), elites: elite ids ([] = none)
//     hordes:   false = no swarmling hordes
//     affixes:  false = elites never get affixes
//     modifier: a stage modifier id (stages.js), e.g. 'glass'
//     bg:       battle background (path inside public/)
//     goal:     text under the title when the battle starts
//   codec: lines that pop up during the battle:
//     { when: 'start', who: 'handler', text: '...' }
//     when: 'start' | 'kills 5' | 'time 20' (seconds) | 'boss' (boss appears) |
//           'boss half' | 'low hp' | 'hit' (first time you get hit) | 'ult' (first ult)
//     pause: true  → the fight stops until the player taps (for important lines)
//     if:    'flag' → only when that flag is set
//   rewards: { gems, coins } — first clear only
//   steps: [...]  instead of intro/battle/outro, a level can chain any number of each, in order:
//     { scene: 'id' }                                          a cutscene
//     { battle: { ... }, codec: [...], name: 'The Road',       a fight (name: its title, else the level's)
//       play: 37, playLevel: 30 }                              …that hands you this card (id in
//                                                              characters.js) at this level; your
//                                                              deck sits it out (and nothing from
//                                                              endless — upgrades, supports — comes)
//       playStats: { click: 12, hp: 800 }                      …fighting with this click damage and
//                                                              max HP instead of the card's own
// }
//
// Everything below is SAMPLE content to show the format. Replace it freely.
// ─────────────────────────────────────────────────────────────────────────────
// Ground Zero's tutorial fights: the lent 6★ cards fight at a new player's strength (their own
// numbers would one-shot everything there and the kits would never get going). The city has big
// ones (elites) too, so a bit more there
const ROAD = { click: 12, hp: 800 };
const CITY = { click: 20, hp: 1200 };

export const CHAPTERS = [
  {
    id: 'c1',
    name: 'Chapter 1 — The City',
    map: null,
    nodes: [
      {
        id: 'c1-briefing', name: 'The Interview', desc: 'A top-secret job interview at a run-down hospital.',
        x: 9, y: 72, after: [],
        intro: 'c1-briefing',
        rewards: { gems: 5 },
      },
      {
        id: 'c1-outskirts', name: 'Z District', desc: 'Meet the squad, then the long road to ground zero.',
        x: 24, y: 52, after: ['c1-briefing'],
        intro: 'c1-outskirts-in',   // (a story-only level: it ends on the bus, no fight)
        rewards: { gems: 10, coins: 500 },
      },
      {
        // Ground Zero: the Doctor's briefing, Big Boy, then the road (as Ice, then Bonk: tutorials for
        // their 6★ kits) and the city (as Astrec, Ramsf, then Reef)
        id: 'c1-gz', name: 'Ground Zero', desc: 'The Doctor\'s plan, a tank called Big Boy, and the first of the highest-caliber Havoc.',
        x: 32, y: 62, after: ['c1-outskirts'],
        steps: [
          { scene: 'c1-gz-arrival' },
          { name: 'The Main Road — Ice', play: 37, playLevel: 1, playStats: ROAD,
            battle: { level: 2, kills: 16, elites: [], hordes: false, goal: 'hold them off: defeat 16 enemies' },
            codec: [
              { when: 'start', who: 'ice', pause: true, text: 'Click to build Freeze. Full meter: it freezes solid. Hold M1 and let go to Shatter everything frozen.' },
              { when: 'kills 3', who: 'ice', text: 'Drag to draw a frost line. M2 for ice figures, Q to flash-freeze a crowd.' },
            ] },
          { name: 'The Main Road — Bonk', play: 38, playLevel: 1, playStats: ROAD,
            battle: { level: 2, kills: 16, elites: [], hordes: false, goal: 'hold them off: defeat 16 enemies' },
            codec: [
              { when: 'start', who: 'bonk', pause: true, text: 'Claw \'em! Every hit builds Bleed. Full meter, they hemorrhage. Hold M1 and let go: Rupture pops every bleeder at once!' },
              { when: 'kills 3', who: 'bonk', text: 'M2 grabs one: carry it, slam it or throw it! Drag to rake \'em, Q for Bloodletting.' },
            ] },
          { scene: 'c1-gz-chase' },
          { name: 'The City — Astrec', play: 40, playLevel: 1, playStats: CITY,
            battle: { level: 3, kills: 20, goal: 'the swarm: defeat 20 enemies' },
            codec: [{ when: 'start', who: 'astrec', text: 'The less HP I got, the harder I hit! Hold M1 to brace and hit back, M2 makes \'em go all in, Q patches me up. Bring it!' }] },
          { name: 'The City — Ramsf', play: 39, playLevel: 1, playStats: CITY,
            battle: { level: 3, kills: 20, goal: 'the swarm: defeat 20 enemies' },
            codec: [{ when: 'start', who: 'ramsf', text: 'Tap M2 just before a hit lands to parry it. Hold M2 for a rift. Q sends out my shadow.' }] },
          { name: 'The City — Reef', play: 41, playLevel: 1, playStats: CITY,
            battle: { level: 3, kills: 20, goal: 'the swarm: defeat 20 enemies' },
            codec: [{ when: 'start', who: 'reef', text: 'Whatever we kill, its soul is mine. M2 calls them back up. Hold M2 to choose which.' }] },
          { scene: 'c1-gz-swarm-out' },
          // Astrec alone against the swarm's source, feeding on the giant. Near the end the giant
          // grabs it himself (steal: at 15% HP left the Red Giant's hand comes down on it)
          { name: 'The Source — Astrec', play: 40, playLevel: 1, playStats: CITY,
            battle: { level: 3, kills: 5, elites: [], hordes: false, boss: 'swarmking', steal: 0.15, goal: 'find the source of the swarm',
                      tweak: { giantNear: 3 } },
            codec: [
              { when: 'boss', who: 'astrec', pause: true, text: 'It\'s hiding behind its bugs! Lead the swarms into its own acid and the shield\'s gone. Then it\'s MINE!' },
            ] },
          { scene: 'c1-gz-stolen' },
        ],
        rewards: { gems: 15, coins: 1000 },
      },
      {
        id: 'c1-street', name: 'Main Street', desc: 'Bigger ones show up. Watch their wind-ups.',
        x: 40, y: 70, after: ['c1-gz'],
        intro: 'c1-street-in',
        battle: { level: 2, kills: 12, elites: ['bonk'], goal: 'defeat 12 enemies' },
        codec: [
          { when: 'start',   who: 'bio',     text: 'The big ones telegraph. Don\'t stand in the red.' },
          { when: 'low hp',  who: 'bio',     text: 'You\'re bleeding. Back off for a second.' },
        ],
        rewards: { gems: 10, coins: 800 },
      },
      {
        id: 'c1-market', name: 'Old Market', desc: 'They come in swarms here.',
        x: 56, y: 76, after: ['c1-street'],
        battle: { level: 3, kills: 16, modifier: 'swarm', goal: 'survive the swarm' },
        codec: [
          { when: 'start',    who: 'handler', text: 'Hordes incoming. Sweep them.' },
          { when: 'time 25',  who: 'handler', text: 'Holding steady. Keep it up.' },
        ],
        rewards: { gems: 10, coins: 1200 },
      },
      {
        // optional side path: harder, better reward, and another way to the boss
        id: 'c1-rooftops', name: 'Rooftops', desc: 'Side path. Everyone hits twice as hard — you too.',
        x: 52, y: 30, after: ['c1-street'],
        intro: 'c1-rooftops-in',
        battle: { level: 4, kills: 15, modifier: 'glass', goal: 'defeat 15 enemies' },
        codec: [
          { when: 'start', who: 'stephen', text: 'Glass cannon up here. Don\'t get hit.' },
        ],
        rewards: { gems: 20, coins: 1500 },
      },
      {
        id: 'c1-sewers', name: 'Sewers', desc: 'Elites with nasty affixes.',
        x: 72, y: 60, after: ['c1-market'],
        intro: 'c1-sewers-in',
        battle: { level: 4, kills: 14, elites: ['bonk', 'rusher', 'shielder'], tweak: { affixChance: 0.6, eliteCap: 3 }, goal: 'defeat 14 enemies' },
        codec: [
          { when: 'start',   who: 'handler', text: 'Toxic ones leave puddles. Volatile ones pop when they die.' },
          { when: 'kills 7', who: 'handler', text: 'Halfway through the tunnels.' },
        ],
        rewards: { gems: 15, coins: 1500 },
      },
      {
        id: 'c1-hall', name: 'City Hall', desc: 'Something huge is under the building.',
        x: 88, y: 40, after: ['c1-sewers', 'c1-rooftops'],
        intro: 'c1-hall-in', outro: 'c1-hall-out',
        battle: { level: 5, kills: 10, boss: 'worm', goal: 'defeat 10 enemies, then the boss' },
        codec: [
          { when: 'start',     who: 'handler', text: 'Thin out the small ones first.' },
          { when: 'boss',      who: 'handler', text: 'THERE it is. Hit the middle and it splits!', pause: true },
          { when: 'boss half', who: 'astrec',  text: 'It\'s slowing down!' },
          { when: 'ult',       who: 'handler', text: 'That\'s it. Keep the pressure on.' },
        ],
        rewards: { gems: 40, coins: 3000 },
      },
    ],
  },
  {
    id: 'c2',
    name: 'Chapter 2 — Coming soon',
    map: null,
    after: 'c1-hall',
    nodes: [
      {
        id: 'c2-start', name: '???', desc: 'The story continues here.',
        x: 15, y: 60, after: [],
        battle: { level: 6, kills: 20, goal: 'placeholder level' },
        rewards: { gems: 10 },
      },
    ],
  },
];
