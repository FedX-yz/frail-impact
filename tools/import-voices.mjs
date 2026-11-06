// Bring ElevenLabs takes that were made in the ElevenLabs app (a flow) into the game.
//
//   node tools/import-voices.mjs <folder with the downloaded mp3s (or a .zip)> [--dry]
//
// tools/voices-*.json say which take belongs to which line (its generation id, its length and
// the game file it becomes). Each downloaded file is matched to its line by the generation id
// in its file name if it has one, otherwise by its length (and the voice's name, if the file
// name has it). Then it gets its character's filter (cast.js dub.fx: Dr. Reef's distortion)
// and is levelled like tools/make-voices.mjs does, into public/audio/dub/<who>/<hash>.mp3 (the secret dub).
// Lines it isn't sure about are listed, not guessed.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CAST } from '../src/story/cast.js';

const args = process.argv.slice(2), dry = args.includes('--dry');
let src = args.find(a => !a.startsWith('--'));
if (!src) { console.error('usage: node tools/import-voices.mjs <folder or zip> [--dry]'); process.exit(1); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'import-voices-'));
if (src.endsWith('.zip')) { execFileSync('unzip', ['-q', '-o', src, '-d', path.join(tmp, 'zip')]); src = path.join(tmp, 'zip'); }

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(src).filter(f => /\.(mp3|wav|m4a|flac)$/i.test(f) && !path.basename(f).startsWith('._'));
const secsOf = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();

// every line we're waiting on
const lines = fs.readdirSync('tools').filter(f => /^voices-.*\.json$/.test(f)).flatMap(f => {
  const d = JSON.parse(fs.readFileSync(path.join('tools', f), 'utf8'));
  return d.lines.map(l => ({ ...l, voiceName: d.voice ?? d.voices?.[l.who] ?? '' }));
});

// match: generation id in the name → certain; else the closest length among the lines whose
// voice name is in the file name (all lines if none is), and only if nothing else is close
const left = new Set(lines), plan = [], unsure = [];
const named = files.map(f => ({ f, base: path.basename(f), secs: secsOf(f) }));
for (const x of named) {
  const byId = lines.find(l => x.base.includes(l.generation));
  if (byId) { plan.push([x, byId, 'id']); left.delete(byId); x.done = true; }
}
for (const x of named.filter(x => !x.done).sort((a, b) => b.secs - a.secs)) {
  let pool = [...left].filter(l => l.voiceName && x.base.toLowerCase().includes(l.voiceName.toLowerCase()));
  if (!pool.length) pool = [...left];
  pool.sort((a, b) => Math.abs(a.secs - x.secs) - Math.abs(b.secs - x.secs));
  const [a, b] = pool, da = a ? Math.abs(a.secs - x.secs) : Infinity, db = b ? Math.abs(b.secs - x.secs) : Infinity;
  if (da < 0.15 && db - da > 0.06) { plan.push([x, a, `length ${x.secs.toFixed(2)}s`]); left.delete(a); }
  else unsure.push([x, pool.slice(0, 3)]);
}

const DIALOGUE_M = -13.5;   // (same as make-voices.mjs)
function loudestMoment(file) {
  const r = spawnSync('ffmpeg', ['-nostdin', '-nostats', '-hide_banner', '-i', file, '-af', 'ebur128=framelog=info', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...r.stderr.matchAll(/M:\s*(-?[\d.]+)/g)].map(x => +x[1]).filter(x => x > -70);
  return m.length ? Math.max(...m) : DIALOGUE_M;
}
for (const [x, l, how] of plan) {
  console.log(`${x.base}  →  ${l.file}  (${l.who}: "${l.text.slice(0, 50)}", by ${how})`);
  if (dry) continue;
  const v = CAST[l.who].dub, fx = path.join(tmp, 'fx.wav');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', x.f, ...(v.fx ? [v.fx.includes('[') ? '-filter_complex' : '-af', v.fx] : []), '-ar', '44100', '-ac', '1', fx]);
  const gain = DIALOGUE_M - loudestMoment(fx);
  fs.mkdirSync(path.dirname(l.file), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', fx, '-af', `volume=${gain.toFixed(2)}dB,aresample=176400,alimiter=limit=0.82:attack=3:release=60:level=0:latency=1,aresample=44100,apad=pad_dur=0.3`,
    '-ar', '44100', '-ac', '1', '-b:a', '96k', l.file]);
}
for (const [x, pool] of unsure) console.log(`NOT SURE: ${x.base} (${x.secs.toFixed(2)}s) could be: ${pool.map(l => `${l.who} "${l.text.slice(0, 30)}" (${l.secs}s)`).join(' | ')}`);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${dry ? 'would import' : 'imported'} ${plan.length}, not sure about ${unsure.length}, ${left.size} lines still without a file`);
