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
//   { crawl: ['…', '…'] }             paragraphs of text fading in one by one on black, then fading out;
//                                       {red:words} lights words up (red, havoc, gold, zone, green, title, em, dim, shake)
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
//   { test: true }                    the interview test (InterviewTest.jsx): a nonsense maths page, then 3
//                                       questions; 2+ wrong sets the flag failedTest
//   { ending: { n: 1, title: 'BACK HOME' } }   a bad ending: its card, then back to the map (nothing saved)
//
// Everything below is SAMPLE content to show the format. Replace it freely.
// ─────────────────────────────────────────────────────────────────────────────
export const SCENES = {
  // Story mode's first level: the interview. Keep the { test: true } step (fail it → ENDING 1)
  // and the { application: true } step (skipped on replays once you've signed).
  'c1-briefing': [
    // The opening: black screen, each paragraph fades in, then it all fades out.
    // Music: put a track at public/audio/story/intro.mp3 (it loops until the next { music }).
    { music: 'audio/story/intro.mp3' },
    // {style:words} lights words up: red, havoc (glitchy red), gold, zone (worn gold), green, title, em, dim, shake
    { crawl: [
      '{em:Decades ago} a {green:virus} spread throughout the world, mutating humans and other life forms alike into terrifying and powerful creatures. Since then, those creatures have shifted society into chaos, massacring humans in mass to satisfy their hunger.',
      'Only a small percentage of the total human population remains today, {em:lowering with each passing day.}',
      'These creatures were called {havoc:"Havoc"}, and their claimed territories from humans are assigned as {zone:"Frail Environments"}.',
      'In the face of this merciless enemy, humanity was forced to hasten their technology advancements to get an upper hand against the {havoc:Havoc}. Thanks to those efforts, today fending off Havoc hordes became much more manageable, {em:but still on the edge.}',
    ] },
    { crawl: ['{title:JUNE 9TH 2020}'] },
    { bg: null },
    'You are driving a car heading to the location of your job interview, it\'s a big one.',
    'It\'s a cold morning, the streets are empty as usual. But it\'s a good thing, it means peace, even if temporary.',
    'And you are part of the reason this peace came to be. As the manager of the Anti-Havoc Task Force you helped guide your team to victory in battle against the ferocious Havoc beasts in these very streets.',
    'Given your role as the manager you don\'t get to be on the field, only watch the battlefield from drones above, giving intel to your team. However you are just as important as your reliable field soldiers.',
    'In fact you\'re crucial to the operation, to make sure your comrades don\'t die and to let them know exactly what\'s happening on the field.',
    'This interview you\'re going to is top secret. You\'re not even sure why you were selected, but your employer told you to go anyways, said it\'s a big opportunity.',
    '...',
    'You reach the location. It\'s a run-down hospital, how welcoming. There\'s a single window lit up.',
    'You enter the building and try to go to the lit up room. There\'s no electricity, so you stumble your way over there. Inside that room...',
    'You find balloons with rainbow letters spelling out "Happy Birthday!", and a birthday cake with a candle lit on a table.',
    ['stranger', 'Happy birthday, dear guest.'],
    { show: 'stranger', at: 'center' },
    'You hear a raspy voice coming from behind two hospital ward screens. Thanks to the light from the candle you can see the person\'s ominous figure.',
    { choice: [
      { text: 'What the fuck?', set: { swore: true } },
      { text: 'Thanks!' },
    ] },
    ['stranger', 'Please don\'t be alarmed, I was just so delighted to know you\'d come here. Have a seat.'],
    { choice: [{ text: 'Sit down' }] },
    'You grab a chair near the table and sit down facing the figure behind the screens.',
    ['stranger', 'You are here for a very special reason, do you know why that is?'],
    { choice: [
      { text: 'Yes', goto: 'knows' },
      { text: 'No' },
    ] },
    ['stranger', 'You\'ve been chosen for your excellent skills as a manager of the squadrons you\'ve led throughout your career. That\'s the type of person I\'m looking for to be in charge of a very special mission.'],
    { goto: 'groundzero' },
    { label: 'knows' },
    ['stranger', 'Oh? Then tell me.'],
    { choice: [{ text: 'You want me to become a manager for a special mission.' }] },
    ['stranger', '...How clever, that\'s correct!'],
    { label: 'groundzero' },
    ['stranger', '...Ground zero.'],
    ['stranger', 'I am reuniting a squad to delve deep into the ground zero of the virus outbreak, where it all started.'],
    ['stranger', 'I call it... the Frail Initiative.'],
    { choice: [{ text: 'Ground... zero?!? That\'s not a mission, that\'s a march towards death!!' }] },
    ['stranger', 'Oh? So you\'re calling it quits? Is that what I\'m hearing?'],
    { choice: [{ text: '...No. Tell me more.' }] },
    ['stranger', 'Very well.'],
    ['stranger', 'The Frail Initiative was created to investigate the ground zero in search of clues to what may have caused the Havoc virus outbreak, in an effort to produce a cure with our finds.'],
    ['stranger', 'You may be thinking it\'s too dangerous for a squad to go to these depths, however...'],
    ['stranger', 'The Frail Initiative is formed by a group of the strongest humans available on earth.'],
    ['stranger', 'Your everyday Havoc threat is nothing more than child\'s play for those individuals. But the ground zero still poses a great threat regardless of our group\'s level, and that\'s where you come in, dear manager.'],
    ['stranger', 'Are we on the same page? Hm?'],
    'An opportunity to work alongside the strongest agents...',
    { choice: [{ text: 'Sounds good, I\'m in.' }] },
    ['stranger', 'I am delighted to hear that. However... you must pass a test to get the job.'],
    ['stranger', 'Look over the table next to you, the papers and pen should be at your disposal. Good luck.'],
    'You take one of the papers...',
    { test: true },
    { if: 'failedTest', goto: 'ending1' },
    { application: true },
    ['stranger', 'Welcome to the Frail Initiative, Manager {manager}. Your handler will take it from here.'],
    { hide: 'all' },
    { bg: 'backgrounds/bg2.png' },
    'Somewhere above the city, a signal comes through.',
    { show: 'handler', at: 'right' },
    ['handler', 'Can you hear me? Good. This is your handler.'],
    ['handler', 'Something is waking up under the city. The small ones first, then whatever is leading them.'],
    { show: 'astrec', at: 'left' },
    ['astrec', 'Understood. Where do you want me?'],
    ['handler', 'The outskirts. Watch for the red markings, that\'s where they\'ll strike.'],
    { choice: [
      { text: '"Let\'s go."',                  set: { eager: true } },
      { text: '"What do we get out of this?"', set: { eager: false }, goto: 'pay' },
    ] },
    ['handler', 'Good. Move out.'],
    { end: true },
    { label: 'pay' },
    ['handler', 'You\'ll be paid in full once the area is secure.'],
    ['astrec', '...Understood.'],
    { end: true },

    // ENDING 1: you failed the test (2 of 3 wrong) and go home. The level isn't cleared, so they can try again.
    { label: 'ending1' },
    { hide: 'all' },
    'You failed the interview.',
    'You go home.',
    { music: null },
    { ending: { n: 1, title: 'BACK HOME' } },
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
    ['handler', 'Area secure. Payment is on its way, as promised.'],
    { end: true },
    { label: 'eager' },
    ['handler', 'Clean work.'],
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
    ['stephen', 'The same goes for us. Make it count.'],
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
    ['astrec', 'What is that thing...?'],
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
