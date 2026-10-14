// ─────────────────────────────────────────────────────────────────────────────
// Everyone who can talk in cutscenes or pop up on the battle codec.
//
//   id: {
//     name:     shown in the name box ('???' until they introduce themselves, if you like)
//     color:    name box / codec accent colour
//     portrait: square face picture for the codec (path inside public/)
//     sprite:   standing picture for cutscenes (path inside public/)
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

  // Narrator lines ("plain strings" in a scene) use this
  narrator: { name: '', color: '#94a3b8', portrait: null, sprite: null },
};
