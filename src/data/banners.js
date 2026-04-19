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
      featuredIds: [9, 10, 22],
      boostedRarity: 5,
      boostedChance: 0.5,
      uiAssets: {
        bg:    null,
        char1: null,
        char2: null,
        text:  null,
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