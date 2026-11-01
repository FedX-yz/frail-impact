// The credits that roll at the endings ({ credits: true } in scenes.js → VNPlayer → CreditsRoll).
// Each entry: { title } (a big line), { role, names: [...] } (a heading and the people under it),
// or { gap: true } (extra space). Add the team here; it's the one list every ending uses.
export const CREDITS = [
  { title: 'FRAIL IMPACT' },
  { gap: true },
  { role: 'Created by', names: ['FedX'] },
  { role: 'Icons', names: ['game-icons.net', 'Lorc, Delapouite and contributors (CC BY 3.0)'] },
  { role: 'Effects', names: ['ParticleFX Studio'] },
  { role: 'Sound effects', names: ['freesound.org: bbrocer, kvv_audio, acheaa, thomas_weakley, razrox, saha213131,',
    'nox_sound, silverdubloons, dr_skitz, rambler52, sinatra314, shinyobjects, ivolipa'] },
  { gap: true },
  { title: 'Thank you for playing.' },
];
