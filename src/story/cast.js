// ─────────────────────────────────────────────────────────────────────────────
// Everyone who can talk in cutscenes or pop up on the battle codec.
//
//   id: {
//     name:     shown in the name box. To hide it until they introduce themselves, give
//               a line a third item: ['ice', 'Hi.', '???'] shows "???" for that line
//     color:    name box / codec accent colour
//     portrait: square face picture for the codec (path inside public/)
//     sprite:   standing picture for cutscenes (path inside public/)
//     focus:    optional [x %, y %, zoom] — where the face is in `portrait`, for
//               full-size art (the codec zooms onto it)
//     voice:    optional: every line they say gets spoken. Made ahead of time by
//               tools/make-voices.mjs into public/<dir>/ ({ dir, preset: 'creepy' }: espeak).
//     dub:      optional: the secret dub (ElevenLabs voices, on for a device that typed the
//               phrase into Settings' hidden prompt: utils/secrets.js). With the dub on, a line
//               plays its dub file if there is one, else its normal voice (if any).
//               { dir, engine: 'elevenlabs', id: '<voice ID from ElevenLabs>' } (id null = not
//               picked yet). Made by tools/make-voices.mjs (with an API key) or brought in from
//               the ElevenLabs app with tools/import-voices.mjs. Optional settings: make-voices.mjs.
//     moods:    optional extra sprites, e.g. { angry: 'story/cast/astrec-angry.png' }
//               — use them with { show: 'astrec', mood: 'angry' } in a scene
//     height:   optional: how tall the sprite stands in cutscenes (1 = full height). For
//               cut-outs that aren't head to toe (a bust, a sitting cat), e.g. 0.8
//     call:     optional: true = they're only ever heard over a call — their face is a
//               moving voice line instead of a picture
//     icon:     optional: 'group' = the face is a few people (for lines said by several)
//   }
//
// Leave portrait/sprite as null and a placeholder is drawn instead, so the
// story can be written before the art exists. New art goes in public/story/cast/.
// ─────────────────────────────────────────────────────────────────────────────
export const CAST = {
  // The guy with the hat from the codec mockup — placeholder until the art is in
  handler: { name: 'Handler',  color: '#facc15', portrait: null, sprite: null, dub: { dir: 'audio/dub/handler', engine: 'elevenlabs', id: null } },
  // The anonymous figure who hires you in the intro (Dr. Reef, hidden behind the hospital screens)
  // voice: the distorted robot caller (espeak, creepy preset)
  // dub: Reef's own voice (same German accent), made strange by a filter: pitched down with a
  // faint octave-under shadow, a little grit and wobble, and the echo of the empty ward
  stranger: { name: '???',     color: '#9ca3af', portrait: null, sprite: null, voice: { dir: 'audio/voice/stranger', preset: 'creepy' },
    dub: { dir: 'audio/dub/stranger', engine: 'elevenlabs', id: 'vLzdnvUdGP8OvYq89hc0', model: 'eleven_v4',
    fx: '[0:a]aresample=44100,asplit=2[a][b];[a]rubberband=pitch=0.9:formant=preserved[a1];[b]rubberband=pitch=0.5:formant=preserved,volume=0.32[b1];' +
        '[a1][b1]amix=inputs=2:normalize=0,highpass=f=170,lowpass=f=5200,acrusher=bits=12:mix=0.12:mode=log,vibrato=f=4.5:d=0.03,aecho=0.8:0.5:40|95:0.2|0.1' } },

  // Playable cards (story art where it exists: public/story/cast/; card art until then)
  // (sprite: the closest cut-out there is until a story sprite exists — a card in a cutscene looks wrong)
  // Dub voices (ElevenLabs): designed for them (2026-11-05, ElevenLabs voice design, saved in the
  // library under their names), from how they look and act:
  //   bonk: ~25, a clean young Texas drawl, playful grin, a sly edge (he's the mole)
  //   ice: ~22, tired and flat until he's hyped, then fast and cracking
  //   astrec: ~30, a bright, theatrical clown showman: smug, mocking, punchlines
  //   reef: ~32, smooth and polite with a German "mad doctor" accent (but perfectly sane)
  //   ramsf: ~27, chill, dry, few words, a bit of a smirk
  astrec:  { name: 'Astrec',   color: '#F59E0B', portrait: 'story/cast/astrec-icon.png', sprite: 'story/cast/astrec.png', dub: { dir: 'audio/dub/astrec', engine: 'elevenlabs', id: 'VFdk7Zq3HuLz7FiyutLd', model: 'eleven_v4' } },
  bio:     { name: 'Bio',      color: '#a855f7', portrait: 'characters/bio.png',     sprite: 'characters/bio.png', dub: { dir: 'audio/dub/bio', engine: 'elevenlabs', id: null } },
  stephen: { name: 'Stephen',  color: '#60a5fa', portrait: 'characters/stephen.png', sprite: 'characters/stephen.png', dub: { dir: 'audio/dub/stephen', engine: 'elevenlabs', id: null } },
  ice:     { name: 'Ice',      color: '#67e8f9', portrait: 'story/cast/ice-icon.png', sprite: 'sprites/ice-platinum.png', dub: { dir: 'audio/dub/ice', engine: 'elevenlabs', id: 'jM2QOJnIafEVnGbvD3MG', model: 'eleven_v4' } },
  reef:    { name: 'refabiba', color: '#38bdf8', portrait: 'story/cast/reef-icon.png', sprite: 'story/cast/reef.png', dub: { dir: 'audio/dub/reef', engine: 'elevenlabs', id: 'vLzdnvUdGP8OvYq89hc0', model: 'eleven_v4' } },
  bonk:    { name: 'Bonk',     color: '#f87171', portrait: 'story/cast/bonk-icon.png',  sprite: 'sprites/bonk-platinum.png', dub: { dir: 'audio/dub/bonk', engine: 'elevenlabs', id: '4AAd0brMoUBx1UTrsTp0', model: 'eleven_v4' } },
  ramsf:   { name: 'Ramsf',    color: '#f472b6', portrait: 'story/cast/ramsf-icon.png', sprite: 'sprites/ramsf-platinum.png', dub: { dir: 'audio/dub/ramsf', engine: 'elevenlabs', id: 'JGjk9pqgjO7AVqVHjnbI', model: 'eleven_v4' } },
  // a few people talking at once (no picture)
  group:   { name: 'The Group', color: '#cbd5e1', portrait: null, sprite: null, icon: 'group' },
  // the squad's other two (Z District): Entity has no art yet; Boi uses his card's cut-out (cast.boi)
  entity:  { name: 'Entity',   color: '#a3e635', portrait: null, sprite: null },
  // Dave: the crew guy (gets everyone on the bus, carries the Doctor's laptop). A cat.
  dave:    { name: 'Dave',     color: '#fdba74', portrait: 'story/cast/dave-icon.png', sprite: 'story/cast/dave.png', height: 0.66 },
  // The Doctor: the voice on the laptop. The same robot voice as the hospital's unknown caller
  // (it's him), and the same dub when that's made
  redgiant: { name: 'Red Giant', color: '#ef4444', portrait: 'enemies/giant/head.png', sprite: null },   // (too big for the stage: only his face on the codec)
  doctor:  { name: 'The Doctor', color: '#9ca3af', portrait: null, sprite: null, call: true, voice: { dir: 'audio/voice/stranger', preset: 'creepy' },
    dub: { dir: 'audio/dub/stranger', engine: 'elevenlabs', id: null } },
  hox:     { name: 'HOX',      color: '#ef4444', portrait: 'characters/hoxthankyou.gif', sprite: 'characters/hoxthankyou.gif' },

  // Anemic Kaisen 5★s — cut-out sprites (Room 16 still uses his full art until he has one);
  // the codec centres on the face (same spot as the card's portraitFocus)
  jerry:       { name: 'Jerry',              color: '#E8A33D', portrait: 'sprites/jerry.png', sprite: 'sprites/jerry.png', focus: [16, 25, 2.8] },
  room16:      { name: 'Room Number 16',     color: '#EC4899', portrait: 'cardart/room16-card.png',      sprite: 'cardart/room16-card.png',      focus: [41, 24, 3] },
  ice_fire:    { name: 'Ice',                color: '#F97316', portrait: 'sprites/ice-fire.png', sprite: 'sprites/ice-fire.png', focus: [42, 37, 3.2] },
  tyran:       { name: 'Tyran',              color: '#A855F7', portrait: 'sprites/tyran.png', sprite: 'sprites/tyran.png', focus: [69, 20, 3.4] },
  ivy:         { name: 'Ivy',                color: '#D946EF', portrait: 'sprites/ivy.png', sprite: 'sprites/ivy.png', focus: [50, 10, 3.6] },
  doro:        { name: 'Doro',               color: '#FACC15', portrait: 'sprites/doro-proud.png', sprite: 'sprites/doro-proud.png', focus: [60, 19, 3.4] },
  bio_shadows: { name: 'Bio',                color: '#6366F1', portrait: 'sprites/bio-shadows.png', sprite: 'sprites/bio-shadows.png', focus: [52, 53, 3.0] },
  boi:         { name: 'Boiyoujustgotoofed', color: '#22D3EE', portrait: 'sprites/boiyoujustgotoofed.png', sprite: 'sprites/boiyoujustgotoofed.png', focus: [36, 15, 3.6], height: 0.84 },
  astrec_hr:   { name: 'Astrec',             color: '#FB7185', portrait: 'sprites/astrec-hr.png', sprite: 'sprites/astrec-hr.png', focus: [67, 15, 3.6] },

  // Narrator lines ("plain strings" in a scene) use this
  narrator: { name: '', color: '#94a3b8', portrait: null, sprite: null },
};
