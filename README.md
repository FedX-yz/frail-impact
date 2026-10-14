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
| `src/combat/stages.js` | What each stage spawns, kill targets, which boss shows up, stage modifiers |
| `src/combat/enemies.js` | Enemy roster: basics, elites, horde, shields, bosses (worm, hydra), treasure; elite affixes |
| `src/combat/kits.js` | 5★/6★ skills (weaker from LV1, full at LV20) and ults (LV50), keyed by `effect` in characters.js |
| `src/combat/sets.js` | 3★/4★ card sets and relic sub-stats |
| `src/data/characters.js` | Every card: art, stats, skill/ult/passive |
| `src/data/banners.js` | Gacha banners and their featured cards |
| `src/story/` | Story mode (Tower): chapters/map, cast, cutscene scripts, cutscene player, codec |
| `src/screens/TowerScreen.jsx` | The Tower map |
| `src/utils/sfx.js` | Menu sounds and combat sounds |
| `src/utils/settings.js` | Volume, combat sounds and screen shake (Settings screen) |

### Adding things

- **A new card:** add it to `src/data/characters.js`. For a 5★/6★, give `skill.effect` and
  `ult.effect` one of the ids in `src/combat/kits.js` (or add a new one there). For a
  3★/4★, add its id to a set in `src/combat/sets.js` if it belongs to one.
- **A status-frame portrait:** add the image to `public/ui/` and its card id to
  `STATUS_PORTRAITS` in `src/combat/BattleArena.jsx`. Cards without one use their card art.
- **A new enemy:** add it to `ENEMY_TYPES` in `src/combat/enemies.js`, then list it in
  `stages.js` (`basics`, `elites` or `boss`).

### Combat extras

- **Combo:** every hit adds +1% damage (up to +50%). It drains if you stop hitting for
  2.5 s and resets when you get hit. Numbers: `COMBO_*` in `balance.js`.
- **Stage modifiers:** from stage 3, most stages get a twist (Haste, Glass Cannon,
  Swarm, Bloodlust…) shown on the stage banner. Same stage number = same modifier.
  Add or change them in `MODIFIERS` in `stages.js`.
- **Elite affixes:** from stage 4, elites can roll Volatile, Toxic, Shielded, Swift,
  Regenerating or Splitter (20% chance, rising to 50%). They give 1.5× rewards.
  See `AFFIXES` in `enemies.js`.

### Story mode (Tower)

The Tower button opens a map of levels, chapter by chapter, like a Mario world map.
A level plays an **intro cutscene** → a **battle** (with **codec** lines popping up
during the fight) → an **outro cutscene** → results. Any of the three can be left
out. First clears pay gems/coins; replays only give kill rewards. Progress, choices
and flags are saved with the rest of the game.

Everything is written in three files — no other code needs touching:

| File | What goes in it |
| --- | --- |
| `src/story/chapters.js` | Chapters, map nodes (position, what unlocks them), each level's battle settings, codec lines, rewards |
| `src/story/scenes.js` | Cutscene scripts |
| `src/story/cast.js` | Who can talk: name, colour, codec portrait, cutscene sprite |

A cutscene is a list of steps:

```js
'c1-briefing': [
  { bg: 'story/bg/rooftop.png' },          // background
  { show: 'handler', at: 'right' },         // left / center / right
  ['handler', 'Can you hear me?'],          // someone talks
  'The city was quiet.',                    // narration
  { choice: [
    { text: 'Help him', set: { helped: true } },
    { text: 'Walk away', set: { helped: false }, goto: 'left' },
  ] },
  ['handler', 'Thanks.'],
  { end: true },
  { label: 'left' },
  ['handler', 'Fine. Remember this.'],
],
```

Flags set by choices are saved, and can change later scenes (`{ if: 'helped', goto: ... }`),
codec lines (`if: 'helped'`) and even which map nodes exist (`if:` on a node) — that's
where "your choices have consequences" plugs in. The full list of steps and options is
at the top of `scenes.js` and `chapters.js`.

**Art:** put story art in `public/story/` (`bg/` backgrounds, `cast/` portraits and
sprites, `maps/` chapter maps) and write the path in the story files, e.g.
`portrait: 'story/cast/handler.png'`. Anything left as `null` gets a placeholder, so the
story can be written before the art is ready. Map node positions are percentages, so a
map picture of any size works (16:9 looks best).

**Checking your work:** in developer mode the Tower shows a 🛠 panel: unlock every node,
reset story progress, see the current flags, and a list of typos it found (a speaker
missing from cast.js, a `goto` with no matching label, an unknown enemy…). In battle a
🛠 WIN button skips the fight.

### Sounds

Combat sounds (hit, crit, kill, hurt, explosion…) are generated in code as
placeholders. To use a real sound, put the file in `public/sounds/` and write its
name in `SFX_FILES` at the bottom of `src/utils/sfx.js`, e.g. `crit: 'crit.mp3'`.

### Art files

Keep full-quality originals in `public/`. The build (see `vite.config.js`) makes
the small WebP copies, 320px thumbnails for grids, 720p videos and lighter MP3s
for the website. Your originals are never changed.

### How your stats work

Your battle stats come straight from the deck (`src/combat/stats.js`), and the
Deck screen's **Battle Stats** box shows the result:

- **ATK** = main card ATK + 50% of each support's ATK. Every click deals ATK; auto-attack deals 10% of it per second.
- **HP** = main card HP + 25% of each support's HP.
- **DEF** = main card DEF + 25% of each support's DEF. Damage taken is cut by DEF ÷ (DEF + 300).
- Main card level: +2% ATK and +1% HP/DEF per level. Superimposition: up to +60% (3★/4★) or +75% (5★/6★) stats, and 5★/6★ kits get stronger (`si` in `kits.js`).
- Train: +10% ATK per level.

### Developer sandbox

Tap the **SETTINGS** title 5 times (or open the site with `?dev`) to turn on
developer mode. A **DEV** button then appears on the battle screen with a sandbox:
give gems/coins/cards, set levels and superimposition, god mode, game speed,
spawn any enemy or boss, spawn an elite with a chosen affix, set the stage modifier, jump to a stage, force the next gacha pull to be a 5★.
It changes your real save, so use Reset Save in Settings to start clean.

### Debugging

Open the live site with `?debug` at the end of the URL (or run `npm run dev`) and
the battle is available in the browser console as `window.__battle`, e.g.
`__battle.dev.fillUlt()` to make the ult ready.
