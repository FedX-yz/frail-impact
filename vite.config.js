import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

// ─────────────────────────────────────────────────────────────────────────────
// optimizeImages — runs only on `npm run build` / `npm run deploy`.
//
// Your original art in public/ is never touched. After the build, the copies
// in dist/ are shrunk for the website:
//   • images the code names directly → resized WebP, and the code is pointed
//     at the .webp file
//   • images whose names are built up in code (e.g. banner art) → resized but
//     kept in their original format and name, so nothing breaks
//   • characters/thumb/*.webp → 320px thumbnails for grids (see src/utils/assets.js)
// ─────────────────────────────────────────────────────────────────────────────
const MAX_SIZE = { characters: 1100, cardart: 1600, ui: 2048, enemies: 512, backgrounds: 1920 }
const IMG = /\.(png|jpe?g|gif)$/i

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)])
}

function optimizeImages() {
  let outDir
  return {
    name: 'optimize-images',
    apply: 'build',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir) },
    async closeBundle() {
      const started = Date.now()
      const all = walk(outDir)
      const codeFiles = all.filter(f => /\.(js|css|html)$/.test(f))
      const code = Object.fromEntries(codeFiles.map(f => [f, fs.readFileSync(f, 'utf8')]))
      const images = all.filter(f => IMG.test(f) && !path.relative(outDir, f).startsWith('assets'))
      let before = 0, after = 0

      for (const file of images) {
        const rel = path.relative(outDir, file).split(path.sep).join('/')
        const top = rel.split('/')[0]
        const isGif = /\.gif$/i.test(rel)
        const max = isGif ? 600 : (MAX_SIZE[top] ?? 1600)
        const src = fs.readFileSync(file)
        before += src.length
        const resized = () => sharp(src, { animated: isGif }).resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })

        // grid thumbnails for character art
        if (top === 'characters') {
          const t = path.join(outDir, 'characters', 'thumb', path.basename(rel).replace(IMG, '.webp'))
          fs.mkdirSync(path.dirname(t), { recursive: true })
          await sharp(src, { animated: isGif }).resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(t)
          after += fs.statSync(t).size
        }

        // whole-path match only (so ui/a.png never matches xui/a.png)
        const pattern = new RegExp(`(?<![\\w-])${rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')
        const referenced = codeFiles.some(f => pattern.test(code[f]))
        if (referenced) {
          const webpRel = rel.replace(IMG, '.webp')
          await resized().webp({ quality: top === 'ui' ? 90 : 82, effort: 5 }).toFile(path.join(outDir, webpRel))
          fs.unlinkSync(file)
          after += fs.statSync(path.join(outDir, webpRel)).size
          for (const f of codeFiles) code[f] = code[f].replace(pattern, webpRel)
        } else {
          const fmt = isGif ? 'gif' : /\.png$/i.test(rel) ? 'png' : 'jpeg'
          const buf = await resized()[fmt](fmt === 'jpeg' ? { quality: 85 } : fmt === 'png' ? { compressionLevel: 9 } : {}).toBuffer()
          const out = buf.length < src.length ? buf : src
          fs.writeFileSync(file, out)
          after += out.length
        }
      }
      for (const f of codeFiles) fs.writeFileSync(f, code[f])
      console.log(`\n[optimize-images] ${images.length} images: ${(before / 1e6).toFixed(0)} MB → ${(after / 1e6).toFixed(1)} MB in ${((Date.now() - started) / 1000).toFixed(0)}s`)
    },
  }
}

export default defineConfig({
  plugins: [react(), optimizeImages()],
  base: '/frail-impact/',
})
