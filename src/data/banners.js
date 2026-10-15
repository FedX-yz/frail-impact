// ── Banner schedule ───────────────────────────────────────────────
// This decides which limited banner is live, how long it lasts and what comes
// next. It runs on the clock, so every player sees the same banner at the same
// time. The gacha screen shows the countdown and an "Up next" line from this.
//
//   permanent  banners that are always there, with no timer
//   start      when the first banner in `rotation` begins. 'Z' means UTC; you can
//              also write your own time zone, e.g. '2026-10-16T18:00+04:00'
//   rotation   played top to bottom. `days` is how long each one runs (0.5 = 12 h).
//              Several at once: banner: ['retirement-home', 'unending-hunger'].
//              A break with no limited banner: banner: null.
//   repeat     true = after the last one, start again from the top.
//              false = after the last one, only the permanent banners are left.
//
// To move everything later or earlier, change `start`. To make the current
// banner last longer, raise its `days`. In developer mode every banner can be
// picked, live or not, so you can test one before it goes live.
export const BANNER_SCHEDULE = {
  permanent: ['standard'],
  start: '2026-10-16T00:00Z',
  rotation: [
    { banner: 'anemic-kaisen',   days: 21 },
    { banner: 'retirement-home', days: 21 },
    { banner: 'unending-hunger', days: 7 },
  ],
  repeat: true,
};

// Every banner. Which ones are live is decided by BANNER_SCHEDULE above.
export const BANNERS = [
    {
      id: 'standard',
      name: 'Standard',
      subtitle: 'Standard Banner · All characters',
      accentColor: '#a855f7',
      featuredIds: [],
      boostedRarity: null,
      boostedChance: 0,
      uiAssets: {
        bg:    null,   // falls back to a gradient
        char1: null,
        char2: null,
        text:  null,
      },
    },
    {
        id: 'retirement-home',
        name: 'Retirement Home',
        subtitle: 'Limited · Members of the Retirement Home',
        accentColor: '#f0c040',
        featuredIds: [1, 2, 6, 9, 10],          // fill with your featured IDs
        boostedRarity: 5,
        boostedChance: 0.5,
        uiAssets: {
          bg:    'ui_retirementbannerbg',
          char1: 'ui_retirementbannerchar1',
          char2: 'ui_retirementbannerchar2',
          text:  'ui_retirementbannertext',
        },
      },
    {
      id: 'anemic-kaisen',
      name: 'Anemic Kaisen',
      subtitle: 'Limited · Anemic Characters from JJK',
      accentColor: '#3B82F6',
      featuredIds: [28, 29, 30, 31, 32, 33, 34, 35, 36],   // the Anemic Kaisen exclusives
      boostedRarity: 5,
      boostedChance: 0.5,
      uiAssets: {
        bg:    'ui_anemicbannerbg',
        char1: 'ui_anemicbannerchar1',
        char2: 'ui_anemicbannerchar2',
        text:  'ui_anemicbannertext',
      },
    },
    {
      id: 'unending-hunger',
      name: 'Unending Hunger',
      subtitle: 'The Stomach grumbles..',
      accentColor: '#ff4444',
      featuredIds: [99],
      boostedRarity: 6,
      boostedChance: 0.75,
      uiAssets: {
        bg:    null,
        char1: null,
        char2: null,
        text:  null,
      },
    },
  ];