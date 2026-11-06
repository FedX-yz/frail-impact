// Makes the audio for voiced story lines (cast.js → voice) — run it after changing
// any line a voiced character says:   node tools/make-voices.mjs
//   --force        redo every line (not just new / changed ones)
//   --only bonk    just this character (or several: --only bonk,ice)
//   --scene c1-outskirts-in   just this scene (or several, comma-separated)
//   --dry          list what would be made and how many characters it costs, make nothing
//
// Two kinds of voice (cast.js → voice):
//   { engine: 'elevenlabs', id: '<voice ID>' }  an ElevenLabs voice. Needs your API key:
//        ELEVENLABS_API_KEY=sk_...  node tools/make-voices.mjs
//      (Windows PowerShell:  $env:ELEVENLABS_API_KEY="sk_..."; node tools/make-voices.mjs)
//      Optional: model (default eleven_multilingual_v2), settings (ElevenLabs voice_settings:
//      stability, similarity_boost, style, use_speaker_boost, speed), fx (an ffmpeg filter run on
//      every line, e.g. a slight pitch drop).
//   { preset: 'creepy' }  made on this computer with espeak-ng (the unknown caller). Needs
//      espeak-ng with the MBROLA us2 voice, and ffmpeg built with rubberband:
//        Ubuntu/Debian:  sudo apt install espeak-ng mbrola mbrola-us2 ffmpeg
// Every line is then levelled with ffmpeg (so every voice sits at the same loudness).
// The files go to public/<voice.dir>/<hash>.mp3 (see src/story/voice.js).
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SCENES } from '../src/story/scenes.js';
import { CAST } from '../src/story/cast.js';
import { voiceFile } from '../src/story/voice.js';

const argv = process.argv.slice(2);
const force = argv.includes('--force'), dry = argv.includes('--dry');
const onlyAt = argv.indexOf('--only'), only = onlyAt >= 0 ? new Set(argv[onlyAt + 1].split(',')) : null;
const sceneAt = argv.indexOf('--scene'), scenes = sceneAt >= 0 ? new Set(argv[sceneAt + 1].split(',')) : null;
const KEY = process.env.ELEVENLABS_API_KEY;
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
if (!hasFfmpeg) console.warn('ffmpeg not found: ElevenLabs lines are saved as they come (not levelled), espeak lines are skipped');
// voice presets: espeak voice/speed/pitch, then ffmpeg effects
const PRESETS = {
  // the unknown caller: low, doubled an octave down, phone-band, slightly crushed, wavering, echoing
  creepy: {
    espeak: ['-v', 'mb-us2', '-s', '125', '-p', '25'],
    filter: '[0:a]aresample=44100,asplit=2[a][b];[a]rubberband=pitch=0.82:formant=preserved[a1];[b]rubberband=pitch=0.5,volume=0.55[b1];' +
            '[a1][b1]amix=inputs=2:normalize=0,highpass=f=280,lowpass=f=3600,acrusher=bits=10:mix=0.18:mode=log,vibrato=f=5.5:d=0.06,' +
            'aecho=0.8:0.6:45|110:0.22|0.12',
  },
};

// Dialogue level: the loudest 400 ms of every line lands here (≈ -17 LUFS over a whole line)
const DIALOGUE_M = -13.5;
function loudestMoment(file) {
  const r = spawnSync('ffmpeg', ['-nostdin', '-nostats', '-hide_banner', '-i', file, '-af', 'ebur128=framelog=info', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...r.stderr.matchAll(/M:\s*(-?[\d.]+)/g)].map(x => +x[1]).filter(x => x > -70);
  return m.length ? Math.max(...m) : DIALOGUE_M;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voices-'));
// an ElevenLabs line → an mp3 file
async function eleven(v, text, file) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.id}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: v.model ?? 'eleven_multilingual_v2', ...(v.settings ? { voice_settings: v.settings } : {}) }),
  });
  if (!res.ok) throw new Error(`ElevenLabs said ${res.status}: ${(await res.text()).slice(0, 300)}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

let made = 0, kept = 0, chars = 0;
const waiting = new Set();   // characters set to ElevenLabs with no voice ID yet
for (const [scene, steps] of Object.entries(SCENES)) {
  if (scenes && !scenes.has(scene)) continue;
  for (const step of steps) {
    if (!Array.isArray(step)) continue;
    const [who, text] = step;
    if (!text || !/[a-z0-9]/i.test(text) || (only && !only.has(who))) continue;   // (no words: "..." stays silent)
    // their normal voice and their dub (cast.js), each into its own folder
    for (const v of [CAST[who]?.voice, CAST[who]?.dub].filter(Boolean)) {
    const el = v.engine === 'elevenlabs';
    if (el && !v.id) { waiting.add(who); continue; }
    const out = path.join('public', voiceFile(v.dir, text));
    if (fs.existsSync(out) && !force) { kept++; continue; }
    const say = text.replaceAll('Manager {manager}', 'Manager').replaceAll('{manager}', 'Manager');   // the voice can't know the player's name
    if (dry) { console.log(`would make  ${scene}  ${who}: ${say.slice(0, 60)}`); chars += say.length; made++; continue; }
    if (el && !KEY) { console.error('Set ELEVENLABS_API_KEY first (see the top of this file).'); process.exit(1); }
    if (!el && !hasFfmpeg) continue;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const fx = path.join(tmp, 'fx.wav');
    if (el) {
      const raw = path.join(tmp, 'line.mp3');
      await eleven(v, say, raw);
      chars += say.length;
      if (!hasFfmpeg) { fs.copyFileSync(raw, out); console.log(`${scene}  ${who}: ${say.slice(0, 60)}  →  ${out}`); made++; continue; }
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, ...(v.fx ? [v.fx.includes('[') ? '-filter_complex' : '-af', v.fx] : []), '-ar', '44100', '-ac', '1', fx]);   // (a fx with [labels] is a filter graph)
    } else {
      const p = PRESETS[v.preset ?? 'creepy'];
      const wav = path.join(tmp, 'line.wav');
      execFileSync('espeak-ng', [...p.espeak, '-w', wav, say]);
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-filter_complex', p.filter, '-ar', '44100', '-ac', '1', fx]);
    }
    // levelled by its loudest moment (so short lines aren't quieter than long ones — the
    // average of a short line is mostly the silence around it), then a true-peak limit and a
    // little silence after it (tools/master-audio.py has the whole mix)
    const gain = DIALOGUE_M - loudestMoment(fx);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', fx, '-af', `volume=${gain.toFixed(2)}dB,aresample=176400,alimiter=limit=0.82:attack=3:release=60:level=0:latency=1,aresample=44100,apad=pad_dur=0.3`,
      '-ar', '44100', '-ac', '1', '-b:a', '96k', out]);
    console.log(`${scene}  ${who}: ${say.slice(0, 60)}  →  ${out}`);
    made++;
    }
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
if (waiting.size) console.log(`no ElevenLabs voice ID yet (cast.js) for: ${[...waiting].join(', ')}`);
console.log(dry ? `would make ${made} lines, ${chars} characters of ElevenLabs credit at most (${kept} already there)`
  : `done: ${made} made, ${kept} already there${chars ? `, ${chars} characters sent to ElevenLabs` : ''}`);
