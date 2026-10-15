// ─────────────────────────────────────────────────────────────────────────────
// Everyone who can talk in cutscenes or pop up on the battle codec.
//
//   id: {
//     name:     shown in the name box ('???' until they introduce themselves, if you like)
//     color:    name box / codec accent colour
//     portrait: square face picture for the codec (path inside public/)
//     sprite:   standing picture for cutscenes (path inside public/)
//     focus:    optional [x %, y %, zoom] — where the face is in `portrait`, for
//               full-size art (the codec zooms onto it)
//     moods:    optional extra sprites, e.g. { angry: 'story/cast/astrec-angry.png' }
//               — use them with { show: 'astrec', mood: 'angry' } in a scene
//   }
//
// Leave portrait/sprite as null and a placeholder is drawn instead, so the
// story can be written before the art exists. New art goes in public/story/cast/.
// ─────────────────────────────────────────────────────────────────────────────
export const CAST = {
  // The guy with the hat from the codec mockup — placeholder until the art is in
  handler: { name: 'Handler',  color: '#facc15', portrait: null, sprite: null },

  // Playable cards (using their card art until story sprites exist)
  astrec:  { name: 'Astrec',   color: '#F59E0B', portrait: 'characters/astrec.png',  sprite: 'characters/astrec.png' },
  bio:     { name: 'Bio',      color: '#a855f7', portrait: 'characters/bio.png',     sprite: 'characters/bio.png' },
  stephen: { name: 'Stephen',  color: '#60a5fa', portrait: 'characters/stephen.png', sprite: 'characters/stephen.png' },
  ice:     { name: 'Ice',      color: '#67e8f9', portrait: 'characters/iceduke.png', sprite: 'characters/iceduke.png' },
  reef:    { name: 'refabiba', color: '#38bdf8', portrait: 'characters/reef.png',    sprite: 'characters/reef.png' },
  hox:     { name: 'HOX',      color: '#ef4444', portrait: 'characters/hoxthankyou.gif', sprite: 'characters/hoxthankyou.gif' },

  // Anemics Kaisen 5★s — cut-out sprite where there is one, otherwise the full art;
  // the codec centres on the face (same spot as the card's portraitFocus)
  jerry:       { name: 'Jerry',              color: '#E8A33D', portrait: 'cardart/jerry-card.png',       sprite: 'cardart/jerry-card.png',       focus: [22, 31, 2.6] },
  room16:      { name: 'Room Number 16',     color: '#EC4899', portrait: 'cardart/room16-card.png',      sprite: 'cardart/room16-card.png',      focus: [41, 24, 3] },
  ice_fire:    { name: 'Ice',                color: '#F97316', portrait: 'cardart/ice-fire-card.png',    sprite: 'cardart/ice-fire-card.png',    focus: [36, 38, 2.6] },
  tyran:       { name: 'Tyran',              color: '#A855F7', portrait: 'cardart/tyran-card.png',       sprite: 'cardart/tyran-card.png',       focus: [50, 34, 3.2] },
  ivy:         { name: 'Ivy',                color: '#D946EF', portrait: 'cardart/ivy-card.png',         sprite: 'cardart/ivy-card.png',         focus: [50, 43, 3.4] },
  doro:        { name: 'Doro',               color: '#FACC15', portrait: 'sprites/doro-proud.png',       sprite: 'sprites/doro-proud.png',       focus: [57, 19, 3.4] },
  bio_shadows: { name: 'Bio',                color: '#6366F1', portrait: 'cardart/bio-shadows-card.png', sprite: 'cardart/bio-shadows-card.png', focus: [41, 50, 3] },
  boi:         { name: 'Boiyoujustgotoofed', color: '#22D3EE', portrait: 'sprites/boiyoujustgotoofed.png', sprite: 'sprites/boiyoujustgotoofed.png', focus: [37, 17, 3.4] },
  astrec_hr:   { name: 'Astrec',             color: '#FB7185', portrait: 'sprites/astrec-hr.png',        sprite: 'sprites/astrec-hr.png',        focus: [68, 17, 3.6] },

  // Narrator lines ("plain strings" in a scene) use this
  narrator: { name: '', color: '#94a3b8', portrait: null, sprite: null },
};
