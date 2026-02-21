export const SLOTS_CONFIG = {
  reelCount: 3,
  animationSpinFrames: 3,
  animationSpinInterval: 600,
  animationStopInterval: 800,
  payouts: {
    jackpot: 500,         // 3x special
    specialTwo: 5,        // 2x special
    specialOne: 2,        // 1x special
    threeHighRank: 40,    // 3x high rank
    threeMediumRank: 20,  // 3x medium rank
    threeLowRank: 10,     // 3x low rank
    twoMatch: 2,          // 2x any match
    loss: 0,              // no match
  },
} as const;

export const BLACKJACK_CONFIG = {
  deckCount: 4,
  dealerStandValue: 17,
  blackjackPayout: 1.5,   // 3:2
  insurancePayout: 2,     // 2:1
  normalPayout: 1,        // 1:1
} as const;

export const HORSE_RACE_CONFIG = {
  horses: [
    { stars: 5, baseOdds: 1.5, winChance: 0.40 },
    { stars: 4, baseOdds: 2.5, winChance: 0.25 },
    { stars: 3, baseOdds: 4.0, winChance: 0.17 },
    { stars: 2, baseOdds: 7.0, winChance: 0.12 },
    { stars: 1, baseOdds: 15.0, winChance: 0.06 },
  ],
  trackLength: 20,
  animationFrames: 8,
  animationInterval: 1200,
} as const;

export const COINFLIP_CONFIG = {
  payout: 2, // 1:1 (bet returned + 1x profit)
} as const;

export const POKER_CONFIG = {
  smallBlind: 100n,
  bigBlind: 200n,
  lobbyUpdateInterval: 15_000,
  actionUpdateInterval: 5_000,
} as const;
