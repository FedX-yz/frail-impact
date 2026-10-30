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
// uiFrame (optional): the layers are pictures of any size, all the same, with the banner card
// at `card` inside them; everything outside the card (characters sticking out) shows too.
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
        bg:    'ui/ui_jjkbannerbg.png',
        char1: 'ui/ui_jjkbannerchar1.png',    // right: Tyran, Boi, Bio
        char2: 'ui/ui_jjkbannerchar2.png',    // left: Ice, Doro (in front)
        text:  'ui/ui_jjkbannertext.png',
      },
      // all four layers are 4412×2310 and the banner card is this rectangle in them (x, y, w, h)
      uiFrame: { size: [4412, 2310], card: [690, 357, 3139, 1932] },
    },
    {
      // The Platinum Series: a secret banner. It never shows from the schedule; a device sees it
      // once someone there finds the secret in Records (CardsScreen.jsx, utils/secrets.js).
      // Only 6★ Ice can be pulled so far (Bonk and Ramsf are still unpullable).
      id: 'platinum-series',
      secret: true,
      name: 'Platinum Series',
      subtitle: 'Classified · 6★ Platinum',
      accentColor: '#e2e8f0',
      featuredIds: [37, 38, 39],
      boostedRarity: 6,
      boostedChance: 0.75,
      sixChance: 0.3,      // a top-tier pull here is a 6★ 30% of the time (10% elsewhere)
      // placeholder art (made in code; replace any layer with the real one, same size)
      uiAssets: {
        bg:    'ui/ui_platinumbannerbg.png',
        char1: 'ui/ui_platinumbannerchar1.png',   // Bonk and Ramsf, behind (coming later)
        char2: 'ui/ui_platinumbannerchar2.png',   // Ice, in front
        text:  'ui/ui_platinumbannertext.png',
      },
      uiFrame: { size: [3200, 2000], card: [320, 250, 2560, 1600] },
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