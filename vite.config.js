import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'
import ffmpegPath from 'ffmpeg-static'

// ─────────────────────────────────────────────────────────────────────────────
// optimizeAssets — runs only on `npm run build` / `npm run deploy`.
//
// Your original art, video and sound in public/ are NEVER touched. After the
// build, the copies in dist/ are shrunk for the website:
//   • images the code names directly → resized WebP, code pointed at .webp
//   • images whose names are built up in code (banner art), the cursor and the
//     favicon → resized, same name and format
//   • characters/thumb/*.webp → 320px thumbnails for grids (src/utils/assets.js)
//   • videos → 720p H.264; music/voices → lower bitrate MP3 (same names)
// Results are cached in node_modules/.cache/frail-assets, so only new or
// changed files get processed on the next build.
// ─────────────────────────────────────────────────────────────────────────────
const MAX_SIZE = { characters: 1100, cardart: 1600, ui: 2048, enemies: 512, backgrounds: 1920, story: 1920, sprites: 1100 }
const KEEP_FORMAT = new Set(['ui/mouse.png', 'ui/frail.png'])   // cursor + favicon: PNG works everywhere
const IMG = /\.(png|jpe?g|gif)$/i
const CACHE_DIR = path.resolve('node_modules/.cache/frail-assets')
const VERSION = 'v1'   // bump to redo everything after changing the settings below

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)])
}

// Run `make(src) → Buffer` once per unique input + settings; reuse afterwards
async function cached(src, settings, make) {
  const key = crypto.createHash('sha1').update(VERSION).update(settings).update(src).digest('hex')
  const file = path.join(CACHE_DIR, key)
  if (fs.existsSync(file)) return fs.readFileSync(file)
  const out = await make(src)
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(file, out)
  return out
}

function ffmpeg(src, ext, args) {
  const tmp = path.join(CACHE_DIR, `tmp-${process.pid}-${Date.now()}`)
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(tmp + '-in.' + ext, src)
  try {
    execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', tmp + '-in.' + ext, ...args, tmp + '-out.' + ext], { stdio: 'pipe' })
    return fs.readFileSync(tmp + '-out.' + ext)
  } finally {
    for (const f of [tmp + '-in.' + ext, tmp + '-out.' + ext]) fs.rmSync(f, { force: true })
  }
}

const VIDEO_ARGS = ['-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264', '-preset', 'medium', '-crf', '26',
  '-maxrate', '1800k', '-bufsize', '3600k', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart']
const audioArgs = size => ['-codec:a', 'libmp3lame', '-b:a', size > 3e6 ? '128k' : '96k']

function optimizeAssets() {
  let outDir
  return {
    name: 'optimize-assets',
    apply: 'build',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir) },
    async closeBundle() {
      const started = Date.now()
      const all = walk(outDir)
      const codeFiles = all.filter(f => /\.(js|css|html)$/.test(f))
      const code = Object.fromEntries(codeFiles.map(f => [f, fs.readFileSync(f, 'utf8')]))
      const rel = f => path.relative(outDir, f).split(path.sep).join('/')
      let before = 0, after = 0

      // ── Images ──────────────────────────────────────────────────────────
      for (const file of all.filter(f => IMG.test(f) && !rel(f).startsWith('assets'))) {
        const r = rel(file), top = r.split('/')[0]
        const isGif = /\.gif$/i.test(r)
        const max = isGif ? 600 : (MAX_SIZE[top] ?? 1600)
        const src = fs.readFileSync(file)
        before += src.length
        const resized = s => sharp(s, { animated: isGif }).resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })

        if (top === 'characters') {
          const thumb = await cached(src, 'thumb320', s => sharp(s, { animated: isGif }).resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer())
          const t = path.join(outDir, 'characters', 'thumb', path.basename(r).replace(IMG, '.webp'))
          fs.mkdirSync(path.dirname(t), { recursive: true })
          fs.writeFileSync(t, thumb)
          after += thumb.length
        }

        // whole-path match only (so ui/a.png never matches xui/a.png)
        const pattern = new RegExp(`(?<![\\w-])${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')
        const referenced = !KEEP_FORMAT.has(r) && codeFiles.some(f => pattern.test(code[f]))
        if (referenced) {
          const q = top === 'ui' ? 90 : 82
          const out = await cached(src, `webp${max}q${q}`, s => resized(s).webp({ quality: q, effort: 5 }).toBuffer())
          const webpRel = r.replace(IMG, '.webp')
          fs.writeFileSync(path.join(outDir, webpRel), out)
          fs.unlinkSync(file)
          after += out.length
          for (const f of codeFiles) code[f] = code[f].replace(pattern, webpRel)
        } else {
          const fmt = isGif ? 'gif' : /\.png$/i.test(r) ? 'png' : 'jpeg'
          const out = await cached(src, `same${max}${fmt}`, s => resized(s)[fmt](fmt === 'jpeg' ? { quality: 85 } : fmt === 'png' ? { compressionLevel: 9 } : {}).toBuffer())
          const best = out.length < src.length ? out : src
          fs.writeFileSync(file, best)
          after += best.length
        }
      }
      for (const f of codeFiles) fs.writeFileSync(f, code[f])

      // ── Video & audio (same names, smaller files) ───────────────────────
      let media = 0
      for (const file of all.filter(f => /\.(mp4|mp3)$/i.test(f))) {
        const src = fs.readFileSync(file)
        before += src.length
        const isVideo = /\.mp4$/i.test(file)
        if (!ffmpegPath || (!isVideo && src.length < 150e3)) { after += src.length; continue }   // tiny UI sounds: leave
        try {
          const args = isVideo ? VIDEO_ARGS : audioArgs(src.length)
          const out = await cached(src, args.join(' '), s => ffmpeg(s, isVideo ? 'mp4' : 'mp3', args))
          const best = out.length < src.length ? out : src
          fs.writeFileSync(file, best)
          after += best.length
          media++
        } catch (e) {
          console.warn(`[optimize-assets] kept original ${rel(file)}: ${e.message.split('\n')[0]}`)
          after += src.length
        }
      }

      console.log(`\n[optimize-assets] images + ${media} media files: ${(before / 1e6).toFixed(0)} MB → ${(after / 1e6).toFixed(1)} MB in ${((Date.now() - started) / 1000).toFixed(0)}s`)
    },
  }
}

export default defineConfig({
  plugins: [react(), optimizeAssets()],
  base: '/frail-impact/',
})
