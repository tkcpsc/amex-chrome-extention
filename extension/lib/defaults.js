export const DEFAULT_SETTINGS = {
  // Cents you value one Membership Rewards point at when you don't transfer.
  mrCpp: 1.0,
  // Merchants you shop at (substring match) — boosted in rankings.
  favorites: [],
  // Merchants never to auto-add and to hide from rankings.
  skipMerchants: [],
  // Categories to boost, e.g. ["dining", "travel"].
  boostCategories: [],
  // Auto-enroll pacing: random pause between clicks, in seconds.
  minDelaySec: 2,
  maxDelaySec: 5,
  // Hard cap on clicks per enrollment run.
  maxPerRun: 100,
  // How many offers to show in "Best offers".
  topN: 10,
  // Your Membership Rewards balance (optional) — used to flag trips you can book now.
  mrBalance: 0,
  // Planned purchases: [{ id, text, addedAt }] — matching offers get flagged.
  watchlist: [],
  // { [partnerId]: { ratio?, cpp? } }
  partnerOverrides: {},
};
