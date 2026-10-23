// Makes the audio for voiced story lines (cast.js → voice) — run it after changing
// any line a voiced character says:   node tools/make-voices.mjs   (--force redoes all)
//
// Needs espeak-ng with the MBROLA us2 voice, and ffmpeg built with rubberband:
//   Ubuntu/Debian:  sudo apt install espeak-ng mbrola mbrola-us2 ffmpeg
// The files go to public/<voice.dir>/<hash>.mp3 (see src/story/voice.js).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SCENES } from '../src/story/scenes.js';
import { CAST } from '../src/story/cast.js';
import { voiceFile } from '../src/story/voice.js';

const force = process.argv.includes('--force');
// voice presets: espeak voice/speed/pitch, then ffmpeg effects
const PRESETS = {
  // the unknown caller: low, doubled an octave down, phone-band, slightly crushed, wavering, echoing
  creepy: {
    espeak: ['-v', 'mb-us2', '-s', '125', '-p', '25'],
    filter: '[0:a]aresample=44100,asplit=2[a][b];[a]rubberband=pitch=0.82:formant=preserved[a1];[b]rubberband=pitch=0.5,volume=0.55[b1];' +
            '[a1][b1]amix=inputs=2:normalize=0,highpass=f=280,lowpass=f=3600,acrusher=bits=10:mix=0.18:mode=log,vibrato=f=5.5:d=0.06,' +
            'aecho=0.8:0.6:45|110:0.22|0.12,loudnorm=I=-16:TP=-1.5,apad=pad_dur=0.3',
  },
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voices-'));
let made = 0, kept = 0;
for (const [scene, steps] of Object.entries(SCENES)) {
  for (const step of steps) {
    if (!Array.isArray(step)) continue;
    const [who, text] = step;
    const v = CAST[who]?.voice;
    if (!v || !text) continue;
    const out = path.join('public', voiceFile(v.dir, text));
    if (fs.existsSync(out) && !force) { kept++; continue; }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const p = PRESETS[v.preset ?? 'creepy'];
    const say = text.replaceAll('Manager {manager}', 'Manager').replaceAll('{manager}', 'Manager');   // the voice can't know the player's name
    const wav = path.join(tmp, 'line.wav');
    execFileSync('espeak-ng', [...p.espeak, '-w', wav, say]);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-filter_complex', p.filter, '-ar', '44100', '-ac', '1', '-b:a', '96k', out]);
    console.log(`${scene}  ${who}: ${say.slice(0, 60)}  →  ${out}`);
    made++;
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`done: ${made} made, ${kept} already there`);
