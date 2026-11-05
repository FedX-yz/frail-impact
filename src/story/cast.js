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
//               tools/make-voices.mjs into public/<dir>/. ElevenLabs voices:
//               { dir, engine: 'elevenlabs', id: '<voice ID from ElevenLabs>' } (id null = not
//               picked yet: their lines stay silent). Optional settings: see make-voices.mjs.
//     moods:    optional extra sprites, e.g. { angry: 'story/cast/astrec-angry.png' }
//               — use them with { show: 'astrec', mood: 'angry' } in a scene
//   }
//
// Leave portrait/sprite as null and a placeholder is drawn instead, so the
// story can be written before the art exists. New art goes in public/story/cast/.
// ─────────────────────────────────────────────────────────────────────────────
export const CAST = {
  // The guy with the hat from the codec mockup — placeholder until the art is in
  handler: { name: 'Handler',  color: '#facc15', portrait: null, sprite: null, voice: { dir: 'audio/voice/handler', engine: 'elevenlabs', id: null } },
  // The anonymous figure who hires you in the intro — placeholder
  // voice: lines get audio made by tools/make-voices.mjs (creepy = the distorted unknown caller)
  stranger: { name: '???',     color: '#9ca3af', portrait: null, sprite: null, voice: { dir: 'audio/voice/stranger', preset: 'creepy' } },

  // Playable cards (story art where it exists: public/story/cast/; card art until then)
  // (sprite: the closest cut-out there is until a story sprite exists — a card in a cutscene looks wrong)
  astrec:  { name: 'Astrec',   color: '#F59E0B', portrait: 'story/cast/astrec-icon.png', sprite: 'story/cast/astrec.png', voice: { dir: 'audio/voice/astrec', engine: 'elevenlabs', id: null } },
  bio:     { name: 'Bio',      color: '#a855f7', portrait: 'characters/bio.png',     sprite: 'characters/bio.png', voice: { dir: 'audio/voice/bio', engine: 'elevenlabs', id: null } },
  stephen: { name: 'Stephen',  color: '#60a5fa', portrait: 'characters/stephen.png', sprite: 'characters/stephen.png', voice: { dir: 'audio/voice/stephen', engine: 'elevenlabs', id: null } },
  ice:     { name: 'Ice',      color: '#67e8f9', portrait: 'story/cast/ice-icon.png', sprite: 'sprites/ice-platinum.png', voice: { dir: 'audio/voice/ice', engine: 'elevenlabs', id: null } },
  reef:    { name: 'refabiba', color: '#38bdf8', portrait: 'characters/reef.png',    sprite: 'characters/reef.png', voice: { dir: 'audio/voice/reef', engine: 'elevenlabs', id: null } },
  bonk:    { name: 'Bonk',     color: '#f87171', portrait: 'story/cast/bonk-icon.png',  sprite: 'sprites/bonk-platinum.png', voice: { dir: 'audio/voice/bonk', engine: 'elevenlabs', id: null } },
  ramsf:   { name: 'Ramsf',    color: '#f472b6', portrait: 'story/cast/ramsf-icon.png', sprite: 'sprites/ramsf-platinum.png', voice: { dir: 'audio/voice/ramsf', engine: 'elevenlabs', id: null } },
  // a few people talking at once (no picture)
  group:   { name: 'The Group', color: '#cbd5e1', portrait: null, sprite: null },
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
  boi:         { name: 'Boiyoujustgotoofed', color: '#22D3EE', portrait: 'sprites/boiyoujustgotoofed.png', sprite: 'sprites/boiyoujustgotoofed.png', focus: [36, 15, 3.6] },
  astrec_hr:   { name: 'Astrec',             color: '#FB7185', portrait: 'sprites/astrec-hr.png', sprite: 'sprites/astrec-hr.png', focus: [67, 15, 3.6] },

  // Narrator lines ("plain strings" in a scene) use this
  narrator: { name: '', color: '#94a3b8', portrait: null, sprite: null },
};
