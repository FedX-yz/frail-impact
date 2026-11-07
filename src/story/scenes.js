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
//   { shake: true }   { wait: 0.8 }
//   { sfx: 'door_slam' }              a sound (public/sounds/door_slam.mp3). It belongs to the line that
//                                       comes up next and plays when that line appears. Options:
//                                       delay: 1.5   …seconds later (dropped if the player clicks on first)
//                                       at: 'end'    …once the line is typed out and its voice is done
//                                       hold: false  auto mode doesn't wait for it (background sounds)
//                                       Story sounds, music and ambience are mastered to the game's mix
//                                       levels by tools/master-audio.py (the levels are listed at its top)
//   { crawl: ['…', '…'] }             paragraphs of text fading in one by one on black, then fading out;
//                                       {red:words} lights words up (red, havoc, gold, zone, green, title, em, dim, shake)
//   { music: 'audio/story/x.mp3' }    music (path in public/), loops until the next { music };
//                                       { music: null } fades it out. It also stops when the scene ends
//   { ambience: 'audio/story/amb/x.mp3' }   a background loop (wind, crowd…) under the music, same rules
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
//   { credits: true }                 the credits roll up the screen (story/credits.js); tap to skip
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
      'In the face of this merciless enemy, humanity was forced to hasten their technology advancements to get an upper hand against the Havoc. Thanks to those efforts, today fending off Havoc hordes became much more manageable, {em:but still on the edge.}',
    ] },
    { crawl: ['{title:JUNE 9TH 2020}'] },
    { bg: null },
    { music: 'audio/story/drive.mp3' },
    { ambience: 'audio/story/amb/wind.mp3' },
    { sfx: 'car_drive', delay: 1.2, hold: false },   // a car passing: sets the scene
    'You are driving a car heading to the location of your job interview, it\'s a big one.',
    'It\'s a cold morning, the streets are empty as usual. But it\'s a good thing, it means peace, even if temporary.',
    'And you are part of the reason this peace came to be. As the manager of the Anti-Havoc Task Force you helped guide your team to victory in battle against the ferocious Havoc beasts in these very streets.',
    'Given your role as the manager you don\'t get to be on the field, only watch the battlefield from drones above, giving intel to your team. However you are just as important as your reliable field soldiers.',
    'In fact you\'re crucial to the operation, to make sure your comrades don\'t die and to let them know exactly what\'s happening on the field.',
    'This interview you\'re going to is top secret. You\'re not even sure why you were selected, but your employer told you to go anyways, said it\'s a big opportunity.',
    '...',
    { music: 'audio/story/hospital.mp3' },
    { ambience: 'audio/story/amb/night.mp3' },
    { sfx: 'car_arrive', delay: 0.3 },
    'You reach the location. It\'s a run-down hospital, how welcoming. There\'s a single window lit up.',
    { sfx: 'door_creak', delay: 0.3 },
    { sfx: 'footsteps', delay: 3.2 },   // once the door's open
    'You enter the building and try to go to the lit up room. There\'s no electricity, so you stumble your way over there. Inside that room...',
    { music: 'audio/story/birthday.mp3' },
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
    { sfx: 'paper_take', delay: 0.2 },
    'You take one of the papers...',
    { music: 'audio/story/test.mp3' },
    { test: true },
    { if: 'failedTest', goto: 'ending1' },

    // You passed: it's your birthday, apparently.
    { music: 'audio/story/birthday.mp3' },
    ['stranger', 'Hmmmmm... well...'],
    { sfx: 'party_horn', at: 'end' },   // right after he's said it
    ['stranger', 'Con-gra..........tulations!!!!!!! You may now blow out the candle, Mr. Manager, it\'s your birthday!!!'],
    { choice: [{ text: 'Do as he said' }] },
    { sfx: 'candle_blow', delay: 0.35 },
    'You blow out the candle on the birthday cake. Didn\'t think to make a wish beforehand.',
    ['stranger', 'Okay Mr. Manager, now sign this contract right here.'],
    { application: true },   // type your name and sign by hand (skipped on replays once you've signed)
    ['stranger', 'That settles it! The Frail Initiative welcomes you with open arms.'],
    { shake: true },
    ['stranger', 'Now get out of my clinic!!! Your first day will be tomorrow in the Z district at 6. I do hope you are prepared.'],
    ['stranger', 'Oh, and you may take the cake.'],
    { choice: [{ text: 'Ok, thanks!' }] },
    { hide: 'all' },
    { bg: null },   // [ ] outside the hospital, cake in hand (same picture slot as ending 1)
    { music: 'audio/story/cake.mp3' },
    { ambience: null },
    'You exit the abandoned hospital with your birthday cake!',
    'Tomorrow is looking to be a promising day.',
    { end: true },

    // ENDING 1: you failed the test (2 of 3 wrong). He throws you out, the credits roll, and the
    // level isn't cleared, so they can try again.
    { label: 'ending1' },
    { music: null },
    { sfx: 'paper_crumple', at: 'end' },   // he scrunches up your test
    ['stranger', 'Hmmmmm.... No, that\'s not quite it.'],
    ['stranger', 'I\'m afraid our birthday party here is over. Out of here!!'],
    { sfx: 'door_slam' },   // …and you're out
    { shake: true },
    { ambience: 'audio/story/amb/wind.mp3' },
    { hide: 'all' },
    { bg: null },   // [ ] a picture of you outside the hospital goes here
    'You get out of the abandoned hospital.',
    { choice: [{ text: 'What the fuck was his deal?' }] },
    'You can\'t believe you bought some of the words that insane man said. Absolute maniac.',
    'You return to your usual day-to-day life and forget about this event.',
    { ambience: null },
    { music: 'audio/story/credits.mp3' },
    { credits: true },
    { ending: { n: 1, title: 'INTERVIEW FAILURE' } },
  ],

  // Level 2: Z district. You meet the squad (they're busy opening card packs).
  'c1-outskirts-in': [
    { crawl: ['{title:JUNE 10TH, 5:54}'] },
    { bg: null },   // [ ] Z district: the crowd, the bus, the car carrier (send the picture)
    { music: 'audio/story/zdistrict.mp3' },
    { ambience: 'audio/story/amb/crowd.mp3' },
    'You arrive at Z district.',
    { sfx: 'bus_idle', delay: 0.8, hold: false },
    'It\'s pretty packed here, a bunch of people gathered around a bus. There\'s also a car carrier with a big vehicle under cover. You wonder what\'s hiding there.',
    'You look around and don\'t see anyone familiar. It\'s not like you could recognize the person that was behind the hospital screens anyway.',
    'Someone approaches you.',
    { show: 'bonk', at: 'center' },
    ['bonk', 'Yo! Are ya with us?', '???'],
    { choice: [{ text: 'Yes I am.' }] },
    'He\'s very tall, about 2 meters. But more interestingly, his right arm is mechanical. Could this be one of your comrades?',
    { choice: [{ text: 'Are you part of the squad?' }] },
    ['bonk', 'Sure am. Call me Bonk, what\'s yer name?', '???'],
    { choice: [{ text: 'I am {manager}, I\'ll be your manager! Nice to be working alongside you.' }] },
    ['bonk', 'Oh for real? Well nice to meet ya, Mr. {manager}! Ya should meet the rest of the squad, come follow me.'],
    'Bonk leads you to a group of people that look just as unusual as him. They\'re all facing away, their attention religiously fixed on something.',
    ['bonk', 'Yo guys, I found the manager!!'],
    'But they don\'t listen.',
    ['bonk', 'Uh... what\'s y\'all doing??'],
    { music: 'audio/story/squad.mp3' },
    'You come closer and see that they\'re opening a pack of cards.',
    ['bonk', 'Oh, that silly game of yours.'],

    // the pack opening (they haven't introduced themselves yet: ???)
    { hide: 'all' },
    { show: 'astrec', at: 'p1' }, { show: 'ice', at: 'p2' }, { show: 'reef', at: 'p3' }, { show: 'ramsf', at: 'p4' },
    { sfx: 'pack_tear' },
    ['astrec', 'Another one!!!', '???'],
    ['ice', 'If we don\'t get it here I\'m gonna cut my ballsack off.', '???'],
    ['reef', 'Snip snip, buddy.', '???'],
    ['ramsf', '...', '???'],
    { sfx: 'card_flip' },
    'Nothing.',
    { hide: 'all' },
    { show: 'ice', at: 'left' }, { show: 'reef', at: 'right' },
    ['ice', 'Dude.', '???'],
    ['reef', 'I\'m gonna hold you to that!!', '???'],
    ['ice', 'Shut your whore mouth!!! Alright, this is my last one...', '???'],
    { sfx: 'pack_tear' },
    { sfx: 'card_flip', delay: 1.6 },   // "…after a few cards"
    'They open another pack, and after a few cards...',
    { sfx: 'gasp', delay: 0.15 },
    'They hit the jackpot!',
    { shake: true },
    { hide: 'all' },
    { show: 'ice', at: 'left' }, { show: 'astrec', at: 'center' }, { show: 'reef', at: 'right' },
    ['ice', 'HOLY FUCK!!!', '???'],
    ['astrec', 'WHAT THE FUCK?!?', '???'],
    ['reef', 'YO', '???'],
    // [ ] the player gets a collectible: the card they just pulled (to decide)
    { hide: 'all' },
    { show: 'ramsf', at: 'left' }, { show: 'ice', at: 'right' },
    ['ramsf', 'So is that good?', '???'],
    ['ice', 'Dude, this card is worth a fuck ton, this is insane!', '???'],
    ['ramsf', 'No way.', '???'],
    { choice: [{ text: 'Good job guys!' }] },
    'They notice you.',
    { hide: 'all' },
    { show: 'astrec', at: 'p1' }, { show: 'ice', at: 'p2' }, { show: 'reef', at: 'p3' }, { show: 'ramsf', at: 'p4' },
    ['group', '... ... ...'],
    ['ramsf', 'Random kid?', '???'],
    { hide: 'all' },
    { show: 'bonk', at: 'left' }, { show: 'ice', at: 'right' },
    ['bonk', 'Guys, no, this is our manager.'],
    ['ice', 'Ouuu shit.', '???'],
    ['ice', 'Uhhhh...', '???'],
    'He carefully slips the card into a sleeve and puts it in his wallet.',
    ['ice', 'Nice to meet you, I\'m Ice.', '???'],
    { choice: [{ text: 'Call me {manager}!' }] },
    { hide: 'all' },
    { show: 'bonk', at: 'p1' }, { show: 'reef', at: 'p2' }, { show: 'ramsf', at: 'p3' }, { show: 'astrec', at: 'p4' },
    ['bonk', 'By the way...'],
    'He points to the rest of the group.',
    ['bonk', '...these clowns are Reef, Ramsf and Astrec. Just so you know.'],
    ['astrec', 'The fuck did you just call me?!'],
    ['bonk', 'Lalala, clown.'],
    ['astrec', 'Oh yeah? This clown here was in your momma\'s bed last night. She was sooo good.'],
    'The two start arguing, while Reef steps forward to shake your hand, and you do.',
    { hide: 'all' },
    { show: 'reef', at: 'center' },
    ['reef', 'Hello manager, I hope we get along well!', 'Reef'],
    'His voice sounds familiar...',
    'It\'s probably nothing.',
    { show: 'reef', at: 'left' }, { show: 'ice', at: 'right' },
    ['ice', 'There\'s two more in this group, but I don\'t know where they are.'],

    // the other two: Entity and Boi, sparring
    { hide: 'all' },
    { shake: true },   // [ ] a BOOM sound (public/sounds/boom.mp3) would go here
    '-BOOM!-',
    'You heard a loud noise coming from not too far.',
    { show: 'ramsf', at: 'left' }, { show: 'ice', at: 'right' },
    ['ramsf', 'Now we know.'],
    ['ice', 'Shit.'],
    { hide: 'all' },
    { sfx: 'footsteps', hold: false },
    'Your group quickly runs to the source of that sound.',
    { show: 'entity', at: 'left' }, { show: 'boi', at: 'right' },   // [ ] Entity has no art yet (a placeholder is drawn)
    'Two men appear to be fighting each other with their full might. From your squad\'s reaction, they\'re probably part of the group.',
    { hide: 'all' },
    { show: 'ice', at: 'left' }, { show: 'bonk', at: 'right' },
    ['ice', 'Entity and Boi are sparring again, fighting junkies.'],
    ['bonk', 'Guysss!!! Guyss!!!! The manager!!!!!!'],
    { hide: 'all' },
    { show: 'entity', at: 'left' }, { show: 'boi', at: 'right' },
    { shake: true },
    'Entity slams Boi to the ground and looks over to you.',
    ['entity', 'hi'],
    { shake: true },
    'Boi counter-attacks, Entity falls back.',
    ['boi', 'Bitch!', 'Boi'],
    'They continue sparring without a care in the world.',
    { hide: 'all' },
    { show: 'ramsf', at: 'left' }, { show: 'ice', at: 'right' },
    ['ramsf', 'That\'s them.'],
    ['ice', 'Yep.'],
    { hide: 'all' },
    'What a great impression for the strongest beings alive on earth! You really wonder how they fare on the field.',

    // on the road
    { show: 'dave', at: 'center' },
    ['dave', 'Attention cocksuckers! It\'s time we get on the road. Inside the bus now.'],
    { hide: 'all' },
    { show: 'astrec', at: 'left' }, { show: 'bonk', at: 'right' },
    ['astrec', 'I hope you pick a good seat for the next 7 hours.'],
    ['bonk', 'I\'m just going to sleep the entire time, no way I stand the boredom.'],
    { hide: 'all' },
    'Right, ground zero is very far, it\'s gonna be a long trip.',
    { ambience: null },
    { music: 'audio/story/drive.mp3' },
    { bg: 'story/bg/bus-interior.jpg' },
    { sfx: 'door_slam' },
    { sfx: 'car_drive', delay: 0.6, hold: false },
    'You and your team get inside the bus and hit the road right away, alongside the car carrier.',
    'Very soon you start to get drowsy and fall asleep, drifting in and out of consciousness during the whole voyage.',
    // (end of the level: the music fades as the scene ends)
  ],

  // ── Ground Zero (one level: arrival → the road as Ice and Bonk → the city as Astrec, Ramsf, Reef) ──
  'c1-gz-arrival': [
    { crawl: ['{title:13:09}', '{zone:GROUND ZERO — OUTSKIRTS}'] },
    { bg: 'story/bg/bus-interior.jpg' },
    { sfx: 'bus_idle', hold: false },
    'The bus arrives at ground zero after a few hours. Everyone gets up from their seats and goes outside.',
    { bg: null },   // [ ] CG of the scenery (send the picture)
    { show: 'bonk', at: 'left' }, { show: 'astrec', at: 'right' },
    ['bonk', 'Hell of a view innit? Can you imagine what\'s hiding there?!'],
    ['astrec', 'Don\'t even mention it bro, I\'m getting the feels already...'],
    { hide: 'all' },
    { show: 'ice', at: 'left' }, { show: 'ramsf', at: 'center' }, { show: 'boi', at: 'right' },
    ['ice', 'Look, there\'s a massive fog dome enclosing the center. I doubt we\'ll be able to explore everything right away.'],
    ['ramsf', 'Red Mist... yeah, this place is the real deal.'],
    ['boi', 'That\'s Red Mist?! Literally what do we even do about that??', 'Boi'],
    { hide: 'all' },
    'Red Mist is a Havoc gas substance that can infect and accelerate the process of the Havoc virus in your nervous system. Lethal to any and all life forms.',
    { show: 'reef', at: 'left' }, { show: 'astrec', at: 'right' },
    ['reef', 'We\'ll figure it out. Red Mist might seem impossible to deal with, but we\'ve got the best of the best here. No wall too high for us to climb.'],
    ['astrec', 'Type shi'],
    { hide: 'all' },

    // the Doctor, on a laptop call
    { shake: true },
    ['doctor', 'WELL WELL WELL, WOULD YOU LOOK AT OUR LOVELY SQUAD RIGHT HERE. READY TO FACE DEATH RIGHT BY ITS NOSE? LOSE A LIMB OR TWO? FATE WORSE THAN DEATH???', '???'],
    { show: 'dave', at: 'center' },
    'You all look behind and see one of the crew staff carrying a laptop with its screen facing towards you. It\'s displaying a call screen. Someone is speaking to you at the other end of the connection.',
    { show: 'boi', at: 'right' },
    ['boi', 'This guy.', 'Boi'],
    ['doctor', '"GUY"? WHAT "GUY"?? MIND TELLING ME?? OOH, DON\'T TELL ME WE ARE DEALING WITH "GUY" WHO THINKS RED MIST IS SCARY??? NOOOOOOOOOO', '???'],
    ['boi', 'The fuck is wrong with you.', 'Boi'],
    'That voice is familiar to you.',
    { choice: [{ text: '...Weird hospital gu-... I mean, gentleman?' }] },
    ['doctor', 'OH YES, DING DING DING! THAT\'S ME, BRAVO!!! CALL ME...', '???'],
    { shake: true },
    ['doctor', 'THE DOCTOR!!!'],
    { choice: [{ text: 'Okay.' }] },
    ['doctor', 'OKAY, WE\'RE ABOUT TO ENTER THE GROUND ZERO, BUT FIRST I MUST GO OVER OUR PLAN HERE. DON\'T WANT TO DIVE HEAD FIRST INTO DANGER, RIGHT? OR MAYBE YOU DO.'],
    { hide: 'boi' },
    { show: 'astrec', at: 'left' }, { show: 'bonk', at: 'right' },
    ['group', '...', 'Astrec, Bonk'],
    { hide: 'all' }, { show: 'dave', at: 'center' },
    ['doctor', 'WE\'RE HERE TO NOT ONLY CLEAR THE HAVOC CREATURES FROM THIS GOD FORSAKEN PLACE, WE\'RE ALSO TRYING TO DEVELOP A CURE.'],
    ['doctor', 'WHAT WE WILL NEED FOR THE CURE IS CLASSIFIED AS "Demon Core", AND GUESS WHAT??? WE CAN ONLY ACQUIRE THOSE BY KILLING ONLY THE MIGHTIEST HAVOC BEASTS THERE ARE. WE\'LL NEED FIVE OF THEM.'],
    ['doctor', 'LUCKY FOR US, THIS PLACE IS LIKE A NEST FOR THOSE GUYS.'],
    ['doctor', 'BUT ALAS,'],
    ['doctor', 'WHAT YOU\'LL BE CLEARING FIRST WILL BE THE SURROUNDING AREAS OF THIS PLACE, AND MAKE SURE YOU DON\'T GET SURROUNDED BY THE ENEMY LATER ON AND DIE LIKE A BUNCH OF IDIOTS.'],
    ['doctor', 'KEEP GOING DEEPER AS NEEDED, UNTIL YOU REACH THE WALL THAT IS THE RED MIST. WE DON\'T HAVE ANY BUSINESS INSIDE THERE YET. BUT DON\'T WORRY, I ALREADY KNOW HOW TO DEAL WITH IT.'],
    ['doctor', 'REMEMBER, WHAT YOU\'LL BE SEEING HERE IS ONLY THE ABSOLUTE HIGHEST CALIBER HAVOC CAN OFFER. DO NOT UNDERESTIMATE THEIR FORCES.'],
    ['doctor', 'ARE WE ON THE SAME PAGE?'],
    { hide: 'all' },
    { show: 'astrec', at: 'p1' }, { show: 'ice', at: 'p2' }, { show: 'bonk', at: 'p3' }, { show: 'ramsf', at: 'p4' },
    { shake: true },
    ['group', 'SIR YES SIR OORAH', 'Everyone'],
    ['doctor', 'NOW, GO MARCH TO DEATH YOU FOOLS, AND MAKE SURE TO BRING IT BACK WITH YOU.'],
    { hide: 'all' },
    { choice: [{ text: 'Alright you boys have fun, I\'ll be going to my monitoring room.' }] },
    { show: 'boi', at: 'farleft' }, { show: 'reef', at: 'center' }, { show: 'ice', at: 'farright' },
    ['boi', 'Yeah buddy.', 'Boi'],
    ['reef', 'Does he know?'],
    ['ice', 'He doesn\'t know!!'],
    { hide: 'all' }, { show: 'dave', at: 'center' },
    ['doctor', '...OH, RIGHT, MANAGERR!!!'],
    ['doctor', 'HERE\'S YOUR DRIVE.'],
    { hide: 'all' },

    // Big Boy
    { sfx: 'paper_take' },   // [ ] the cover coming off (a sound for it would go here)
    'The heavy vehicle on the car carrier is uncovered and unloaded. What you see is what looks like a hi-tech tank, big enough to fit your party... and of course... you!',   // [ ] CG of Big Boy
    { choice: [{ text: 'What the fuck' }, { text: 'Say wallahi' }] },
    { show: 'ice', at: 'left' }, { show: 'ramsf', at: 'right' },
    'Ice pats your back.',
    ['ice', 'Come on manager blud! Show us the way!'],
    ['ramsf', 'Thought you\'d be holed up in a comfortable room, did you?'],
    { hide: 'all' }, { show: 'dave', at: 'center' },
    ['doctor', 'DATA IS REAL SLOW AROUND THESE AREAS, YOU KNOW.'],
    ['doctor', 'BY THE WAY, ITS NAME IS BIG BOY!'],
    { hide: 'all' },
    'Shiiit.',
    { choice: [{ text: 'Well... so be it.' }] },
    'You struggle to climb the tank, but eventually you manage to get inside. It\'s somewhat spacious. You get to your driver\'s seat and there\'s a bunch of equipment at your disposal, as well as screens for monitoring. This is some high-grade stuff.',
    { sfx: 'footsteps', hold: false },
    'You hear someone approaching from behind.',
    { show: 'entity', at: 'center' },
    ['entity', 'I do hope we\'re in good hands.'],
    { choice: [{ text: 'Sure are!' }] },
    ['entity', 'None of us are accustomed to working with managers, much less in groups. It\'s a first for everyone. Stay cool!!'],
    { hide: 'all' },
    'Entity goes to his seat in the back.',
    'Everyone seems to be ready. Astrec, Boi, Ramsf, Reef and Entity are inside the tank, while Ice and Bonk chose to be outside, on the roof.',
    { sfx: 'car_arrive' },   // [ ] a tank engine starting would fit better
    'You start the tank engine.',
    { choice: [{ text: 'Alright everyone, let\'s go.' }] },
    { choice: [{ text: 'Alright gang, how do I go forwards' }] },
    { show: 'boi', at: 'left' }, { show: 'ramsf', at: 'center' }, { show: 'astrec', at: 'right' },
    ['boi', 'Bro.', 'Boi'],
    ['ramsf', 'Our manager is cooked bro.'],
    ['astrec', 'It\'s over, we\'re dead.'],
    { hide: 'all' },
    { music: 'audio/story/drive.mp3' },
    { sfx: 'car_drive', hold: false },
    'You start driving Big Boy to ground zero, leaving the bus you all came in behind.',
    '...',
    { show: 'astrec', at: 'left' }, { show: 'ramsf', at: 'center' }, { show: 'reef', at: 'right' },
    ['astrec', 'Yo, can this thing go any faster?'],
    ['ramsf', 'Calm down bruh, this is a tank not a racecar.'],
    ['reef', 'Yeah. Anyways, it\'s quite peaceful so far. Surprising for big zero.'],
    { hide: 'all' },

    // the road: they come
    { show: 'ice', at: 'center' },
    ['ice', 'Shit... guys!!!'],
    { hide: 'all' },
    { shake: true },   // [ ] a slam/clang sound would go here
    '-Kabam!-',
    'You hear something slamming the sides of your tank. You quickly look over to one of your monitors and see that enemies started coming out to the main road and are following the tank.',
    { show: 'astrec', at: 'center' },
    ['astrec', 'Party\'s getting started!!!'],
    { hide: 'all' },
    { show: 'ice', at: 'left' }, { show: 'bonk', at: 'right' },
    ['ice', 'Alright, we\'ll show them!'],
    ['bonk', 'Tear them to pieces!!!'],
    'Ice and Bonk get off the tank and start holding off the Havoc creatures.',
    { music: null },
  ],

  // between the road and the city
  'c1-gz-chase': [
    { show: 'bonk', at: 'left' }, { show: 'ice', at: 'right' },
    ['bonk', 'I think we had too much fun, they\'re off and gone.'],
    ['ice', 'Then we served our purpose, let\'s catch up.'],
    { hide: 'all' },
    { sfx: 'footsteps', hold: false },
    'They start running after Big Boy. They are rather fast and don\'t break a sweat, as expected of these inhumane units.',
    { show: 'bonk', at: 'left' }, { show: 'ice', at: 'right' },
    ['bonk', '...'],
    ['bonk', 'Do ya think The Doctor is fuckin\' with us?'],
    ['ice', 'What do you mean?'],
    ['bonk', 'Y\'know, all this talk about a cure sounds like bullshit to me.'],
    ['ice', 'Yeah I don\'t know, guess we\'ll find out. As long as I get to fight sick monsters and get paid I don\'t really care.'],
    ['bonk', 'Shit, I also want to fight sick monsters and get fat stacks, but I\'m thinkin\' what if the Doctor wants to do some real fucked up stuff with those Demon Cores? How can that bastard think to make a cure with that?!?'],
    ['ice', 'I guess we should be cautious then, you\'re right. But we should focus on the mission right now.'],
    ['bonk', 'Whatever ya say.'],
    { hide: 'all' },
    '...',
    { music: 'audio/story/drive.mp3' },
    'Back at Big Boy, things have gotten a little calmer as you approach the city. You can see on your monitor the two fighting off the monsters.',
    { choice: [{ text: 'They\'ll catch up, right?' }] },
    { show: 'astrec', at: 'center' },
    ['astrec', 'Yeah, don\'t worry about that, they\'re good. But hey, now the roof spot is open!'],
    { hide: 'all' },
    'Astrec opens the roof hatch and climbs out to the top.',
    { music: null },
    'You shortly reach the city and stop the tank momentarily.',
    { show: 'ramsf', at: 'left' }, { show: 'boi', at: 'right' },
    ['ramsf', 'About time we stretched our legs.'],
    ['boi', 'Damn right!', 'Boi'],
    { hide: 'all' },
    'Everyone except you exits Big Boy and follows your lead.',
    { show: 'reef', at: 'center' },
    ['reef', 'Oh?'],
    { hide: 'all' },
    'A group of Havoc creatures notice you and start running towards your group...',
    { shake: true },
    'but they\'re suddenly swarmed by another group of Havoc creatures, and are eaten alive.',
    { show: 'reef', at: 'center' },
    ['reef', 'The fuck?'],
    { hide: 'all' },
    'Once they\'re done devouring the creatures, the swarm rushes towards you.',
    { show: 'astrec', at: 'center' },
    'Astrec gets in front of everyone and opens his arms.',
    { shake: true },
    ['astrec', 'Come to daddy!!!'],
  ],

  // after the city fights
  'c1-gz-swarm-out': [
    { show: 'ramsf', at: 'left' }, { show: 'entity', at: 'center' }, { show: 'astrec', at: 'right' },
    ['ramsf', 'Jesus fuck, they just won\'t stop coming!!'],
    ['entity', 'Well, one of us is enjoying it.'],
    { shake: true },
    ['astrec', 'MOOORE!!!!'],
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
