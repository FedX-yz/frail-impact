// ── Banner schedule ───────────────────────────────────────────────
// Which limited banners are live is controlled from the owner's schedule panel
// (open the game with ?schedule at the end of the address). The panel saves the
// schedule to a file in the GitHub repo (SCHEDULE_SOURCE below), and every player's
// game reads that file, so the schedule changes without a new deploy. Only someone
// with a GitHub key that can write to the repo can save it.
//
// DEFAULT_SCHEDULE is only used until that file has been loaded once (or if it
// can't be reached and the player has never loaded it). Same format as the file:
//   permanent  banners that are always there, with no timer
//   entries    { banner, start, end } — live from start until end (end: null = no
//              end). Entries can overlap, so several banners can be live at once.
export const SCHEDULE_SOURCE = { owner: 'FedX-yz', repo: 'frail-impact', branch: 'schedule', path: 'banner-schedule.json' };

export const DEFAULT_SCHEDULE = {
  permanent: ['standard'],
  entries: [
    { id: 'ak1', banner: 'anemic-kaisen',   start: '2026-10-16T00:00:00.000Z', end: '2026-11-06T00:00:00.000Z' },
    { id: 'rh1', banner: 'retirement-home', start: '2026-11-06T00:00:00.000Z', end: '2026-11-27T00:00:00.000Z' },
    { id: 'uh1', banner: 'unending-hunger', start: '2026-11-27T00:00:00.000Z', end: '2026-12-04T00:00:00.000Z' },
  ],
};

// Every banner. Which ones are live is decided by the schedule above.
// uiAssets: the four layers of the banner art, as paths inside public/ (see README).
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
        bg:    'ui/ui_standardbannerbg.png',
        char1: 'ui/ui_standardbannerchar1.png',
        char2: 'ui/ui_standardbannerchar2.png',
        text:  'ui/ui_standardbannertext.png',
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
          bg:    'ui/ui_retirementbannerbg.png',
          char1: 'ui/ui_retirementbannerchar1.png',
          char2: 'ui/ui_retirementbannerchar2.png',
          text:  'ui/ui_retirementbannertext.png',
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
        bg:    'ui/ui_anemicbannerbg.png',
        char1: 'ui/ui_anemicbannerchar1.png',
        char2: 'ui/ui_anemicbannerchar2.png',
        text:  'ui/ui_anemicbannertext.png',
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