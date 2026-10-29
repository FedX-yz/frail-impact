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
//     boss:     'devourer' | 'worm' | 'hydra' — fought after the kills (default: none)
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
// }
//
// Everything below is SAMPLE content to show the format. Replace it freely.
// ─────────────────────────────────────────────────────────────────────────────
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
        id: 'c1-outskirts', name: 'Outskirts', desc: 'Clear the stragglers at the edge of town.',
        x: 24, y: 52, after: ['c1-briefing'],
        intro: 'c1-outskirts-in', outro: 'c1-outskirts-out',
        battle: { level: 1, kills: 8, elites: [], hordes: false, goal: 'defeat 8 enemies' },
        codec: [
          { when: 'start',   who: 'handler', text: 'Click them. Hard.' },
          { when: 'kills 4', who: 'handler', text: 'Halfway. Keep the combo going.' },
          { when: 'hit',     who: 'handler', text: 'Red means move. Get out of the red.' },
        ],
        rewards: { gems: 10, coins: 500 },
      },
      {
        id: 'c1-street', name: 'Main Street', desc: 'Bigger ones show up. Watch their wind-ups.',
        x: 40, y: 70, after: ['c1-outskirts'],
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
          { when: 'time 25',  who: 'handler', text: 'You\'re doing fine. Probably.' },
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
          { when: 'ult',       who: 'handler', text: 'Now THAT\'S what I\'m talking about.' },
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
