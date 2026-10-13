// Small thumbnails for character art shown in grids, slots and badges.
//
// The full-size character PNGs are ~2600×3700. In the deployed site the build
// (vite.config.js → optimizeImages) also writes 320px thumbnails into
// characters/thumb/, so grids don't have to download and decode the big files.
// In `npm run dev` there are no thumbnails, so the original image is used.
export function thumb(src) {
  if (!import.meta.env.PROD || !src || !src.includes('characters/')) return src;
  return src.replace('characters/', 'characters/thumb/').replace(/\.(png|jpe?g|gif|webp)$/i, '.webp');
}
