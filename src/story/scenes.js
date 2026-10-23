// ─────────────────────────────────────────────────────────────────────────────
// Cutscene scripts (visual-novel style). A level plays its `intro` scene
// before the battle and its `outro` scene after it (see chapters.js).
//
// A scene is a list of steps, played top to bottom:
//
//   ['astrec', 'Hello.']              someone talks (id from cast.js)
//   'The city was quiet.'             narration (no name box)
//   { bg: 'story/bg/city.png' }       change the background (null = plain dark)
//   { show: 'astrec', at: 'left' }    bring a character in: left / center / right
//                                       optional mood: 'angry' (cast.js → moods)
//   { hide: 'astrec' }                take them out     { hide: 'all' } clears everyone
//   { choice: [                       the player picks one
//       { text: 'Fight', set: { brave: true } },
//       { text: 'Run',   set: { brave: false }, goto: 'ran' },
//     ] }
//   { label: 'ran' }                  a spot to jump to
//   { goto: 'ran' }                   jump
//   { if: 'brave', goto: 'x' }        jump only if the flag is set ('!brave' = not set)
//   { set: { metHox: true } }         set flags without a choice
//   { end: true }                     stop the scene here
//   { shake: true }   { wait: 0.8 }   { sfx: 'ui_warp' }  (a file in public/sounds/)
//   { crawl: ['…', '…'] }             paragraphs of text fading in one by one on black, then fading out
//   { music: 'audio/story/x.mp3' }    music (path in public/), loops until the next { music };
//                                       { music: null } fades it out. It also stops when the scene ends
//
// Flags are saved with the story and can also hide/show map nodes and codec
// lines (`if:` in chapters.js) — that's where "consequences" will hook in.
//
// Also:
//   { application: true }             the job application: the player types their name and
//                                       signs by hand (JobApplication.jsx; edit the terms there)
//   {manager} inside a line           becomes the player's name from the application
//
// Everything below is SAMPLE content to show the format. Replace it freely.
// ─────────────────────────────────────────────────────────────────────────────
export const SCENES = {
  // Story mode's first level: you get hired. PLACEHOLDER lines — rewrite them; keep the
  // { application: true } step (it's skipped on replays once you've signed).
  'c1-briefing': [
    // The opening: black screen, each paragraph fades in, then it all fades out.
    // Music: put a track at public/audio/story/intro.mp3 (it loops until the next { music }).
    { music: 'audio/story/intro.mp3' },
    { crawl: [
      'Decades ago a virus spread throughout the world, mutating humans and other life forms alike into terrifying and powerful creatures. Since then, those creatures have shifted society into chaos, massacring humans in mass to satisfy their hunger.',
      'Only a small percentage of the total human population remain today, lowering with each passing day.',
      'These creatures were called "Havoc", and their claimed territories from humans are assigned as "Frail Environments".',
      'In the face of this merciless enemy, humanity was forced to hasten their technology advancements to get an upper hand against the Havoc. Thanks to those efforts, today fending off Havoc hordes became much more manageable, but still on the edge.',
      'Frail-Initiative is a task force created with the intention to unite the strongest humans alive to delve deep into the source of the virus outbreak. A frail environment notoriously known for its overwhelming amount of powerful Havoc creatures.',
    ] },
    { bg: null },
    'A phone buzzes in the dark. Unknown number.',
    { show: 'stranger', at: 'center' },
    ['stranger', 'Don\'t hang up. You don\'t know me, but I know you.'],
    ['stranger', 'This city has a monster problem. Not the metaphorical kind.'],
    ['stranger', 'There\'s a task force that deals with them. The Frail Initiative. It needs a new manager.'],
    ['stranger', 'Someone to hire the agents, send them out, and bring them back in one piece. That\'s you.'],
    ['stranger', 'Why you? You\'ll find out. Probably.'],
    ['stranger', 'There\'s an application on your desk. Sign it.'],
    { application: true },
    ['stranger', 'Welcome to the Frail Initiative, Manager {manager}. Your handler will take it from here.'],
    { hide: 'all' },
    { bg: 'backgrounds/bg2.png' },
    'Somewhere above the city, a signal comes through.',
    { show: 'handler', at: 'right' },
    ['handler', 'Can you hear me? Good. This is your handler.'],
    ['handler', 'Something big is waking up under the city. Small ones first, then the big one.'],
    { show: 'astrec', at: 'left' },
    ['astrec', 'And you want me to... click on them?'],
    ['handler', 'Very fast. Very hard. Mind the red circles.'],
    { choice: [
      { text: '"Let\'s go."',          set: { eager: true } },
      { text: '"What\'s in it for me?"', set: { eager: false }, goto: 'pay' },
    ] },
    ['handler', 'That\'s the spirit. Head to the outskirts.'],
    { end: true },
    { label: 'pay' },
    ['handler', 'Gems. Shiny ones. You like gems.'],
    ['astrec', '...Fine.'],
  ],

  'c1-outskirts-in': [
    { bg: 'backgrounds/bg1.png' },
    { show: 'astrec', at: 'left' },
    ['astrec', 'Quiet out here.'],
    { show: 'handler', at: 'right' },
    ['handler', 'Not for long. Contacts incoming.'],
  ],
  'c1-outskirts-out': [
    { show: 'handler', at: 'right' },
    { if: 'eager', goto: 'eager' },
    ['handler', 'Done. Your gems are on the way, as promised.'],
    { end: true },
    { label: 'eager' },
    ['handler', 'Clean work. Keep that energy.'],
  ],

  'c1-street-in': [
    { bg: 'backgrounds/bg1.png' },
    { show: 'bio', at: 'center' },
    ['bio', 'You\'re the new one? Try to keep up.'],
  ],

  'c1-rooftops-in': [
    { bg: 'backgrounds/bg2.png' },
    { show: 'stephen', at: 'right' },
    ['stephen', 'Shortcut over the roofs. Everything up here hits twice as hard.'],
    ['stephen', 'So do you, though.'],
  ],

  'c1-sewers-in': [
    { bg: 'backgrounds/bg1.png' },
    { show: 'handler', at: 'right' },
    ['handler', 'The tunnels are full of the nasty ones. Watch for the glowing auras.'],
  ],

  'c1-hall-in': [
    { bg: 'backgrounds/bg2.png' },
    { show: 'handler', at: 'right' },
    ['handler', 'This is it. The thing under City Hall.'],
    { shake: true },
    'The ground shakes.',
    { show: 'astrec', at: 'left' },
    ['astrec', 'erm what the sigma'],
  ],
  'c1-hall-out': [
    { show: 'astrec', at: 'left' },
    { show: 'handler', at: 'right' },
    ['handler', 'It\'s down. For now.'],
    ['handler', 'That was only the first one. More are waking up.'],
    { hide: 'all' },
    'To be continued...',
  ],
};
