# Frail Impact

A gacha clicker for the browser: pull cards, build a deck, and click through
stages of enemies while dodging their attacks. Built with React 19 + Vite and
hosted on GitHub Pages at https://fedx-yz.github.io/frail-impact/.

Works on PC (mouse) and phones (touch: your finger is your position).

## Running it

```bash
npm install          # first time only
npm run dev          # local dev server with hot reload
npm run build        # production build into dist/
npm run deploy       # build + publish dist/ to the gh-pages branch (the live site)
```

The first `npm run build`/`deploy` takes about two minutes because it shrinks
every image, video and sound for the website. Results are cached in
`node_modules/.cache/frail-assets`, so later builds only process new or changed
files and finish in seconds.

## How the game is put together

| Where | What |
| --- | --- |
| `src/App.jsx` | Save data (localStorage key `rhg_v3`) and screen switching |
| `src/screens/` | Main battle screen, gacha, deck, card shop + fusion, codex, settings |
| `src/combat/engine.js` | The battle itself: spawning, movement, attacks, damage, ults (plain JS) |
| `src/combat/BattleArena.jsx` | Draws the battle and turns mouse/touch into input |
| `src/combat/balance.js` | **Every combat number** (damage, HP, scaling, ult charge…) |
| `src/combat/stages.js` | What each stage spawns, kill targets and which boss shows up |
| `src/combat/enemies.js` | Enemy roster: basics, elites, horde, shields, bosses (worm, hydra), treasure |
| `src/combat/kits.js` | 5★/6★ skills (LV20) and ults (LV50), keyed by `effect` in characters.js |
| `src/combat/sets.js` | 3★/4★ card sets and relic sub-stats |
| `src/data/characters.js` | Every card: art, stats, skill/ult/passive |
| `src/data/banners.js` | Gacha banners and their featured cards |

### Adding things

- **A new card:** add it to `src/data/characters.js`. For a 5★/6★, give `skill.effect` and
  `ult.effect` one of the ids in `src/combat/kits.js` (or add a new one there). For a
  3★/4★, add its id to a set in `src/combat/sets.js` if it belongs to one.
- **A status-frame portrait:** add the image to `public/ui/` and its card id to
  `STATUS_PORTRAITS` in `src/combat/BattleArena.jsx`. Cards without one use their card art.
- **A new enemy:** add it to `ENEMY_TYPES` in `src/combat/enemies.js`, then list it in
  `stages.js` (`basics`, `elites` or `boss`).
- **Story mode / Tower:** a stage is just a config object (see `makeEndlessStage`), so
  hand-made stages can be passed to `createBattle({ makeStage })`.

### Art files

Keep full-quality originals in `public/`. The build (see `vite.config.js`) makes
the small WebP copies, 320px thumbnails for grids, 720p videos and lighter MP3s
for the website. Your originals are never changed.

### Debugging

Open the live site with `?debug` at the end of the URL (or run `npm run dev`) and
the battle is available in the browser console as `window.__battle`, e.g.
`__battle.state.ult.charge = 1` to fill the ult.
