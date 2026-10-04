// Offer parsing and scoring. Pure functions — shared by the dashboard and the
// Node emailer, and covered by test/offers.test.js.

const money = (s) => Number(String(s).replace(/[$,\s]/g, ''));
const count = (s) => Number(String(s).replace(/[,\s]/g, ''));

const CATEGORY_KEYWORDS = {
  dining: ['restaurant', 'grill', 'pizza', 'coffee', 'cafe', 'café', 'burger', 'doordash', 'grubhub', 'uber eats', 'kitchen', 'taco', 'starbucks', 'bakery', 'sushi', 'steakhouse', 'chipotle', 'resy', 'opentable', 'dining', 'bar ', 'sweetgreen', 'salad', 'panera', 'shake shack', 'chick-fil-a', 'mcdonald'],
  travel: ['hotel', 'resort', 'airline', 'airways', 'hilton', 'marriott', 'hyatt', 'expedia', 'cruise', 'hertz', 'avis', 'enterprise', 'airbnb', 'vrbo', 'travel', 'inn', 'suites', 'flight', 'delta', 'united', 'lounge'],
  streaming: ['netflix', 'hulu', 'spotify', 'disney+', 'peacock', 'paramount', 'audible', 'sirius', 'youtube', 'streaming', 'apple tv', 'max '],
  groceries: ['grocery', 'market', 'whole foods', 'instacart', 'kroger', 'safeway', 'wegmans', 'trader', 'fresh', 'hellofresh', 'meal kit'],
  shopping: ['amazon', 'walmart', 'target', 'best buy', 'apparel', 'shoes', 'store', 'shop', '.com', 'fashion', 'outlet', 'nordstrom', 'macy', 'dell', 'lenovo', 'clothing', 'jewelry'],
  'gas & auto': ['gas', 'fuel', 'shell', 'exxon', 'chevron', 'bp ', 'auto', 'car wash', 'tire', 'parking', 'ev charging'],
  'home & utilities': ['wireless', 'mobile', 'internet', 'att', 'at&t', 'verizon', 't-mobile', 'comcast', 'xfinity', 'home', 'furniture', 'wayfair', 'lowe', 'home depot', 'insurance'],
  wellness: ['fitness', 'gym', 'peloton', 'equinox', 'spa', 'health', 'pharmacy', 'cvs', 'walgreens', 'wellness', 'yoga'],
};

export const CATEGORIES = Object.keys(CATEGORY_KEYWORDS);

export function inferCategory(merchant = '', description = '') {
  const t = ` ${merchant} ${description} `.toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => t.includes(w))) return cat;
  }
  return 'other';
}

// Turns Amex offer copy into numbers. Returns:
//   { type, minSpend, rewardUsd, rewardPoints, pct, perDollar, times }
// `type` is one of credit | points | percent | points-per-dollar | other.
export function parseOffer(description = '', extraText = '') {
  const t = `${description} ${extraText}`
    .replace(/[®™℠]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const timesM = t.match(/up to (?:a total of )?(\d+) times/i);
  const times = timesM ? Number(timesM[1]) : 1;
  const out = { type: 'other', minSpend: null, rewardUsd: null, rewardPoints: null, pct: null, perDollar: null, times };

  // "Spend $50 or more, get $10 back"
  let m = t.match(/spend \$([\d,.]+)\+?(?: or more)?[^$]{0,80}?(?:get|receive|earn) (?:a )?(?:one-time )?\$([\d,.]+)(?: statement credit| back)/i);
  if (m) return { ...out, type: 'credit', minSpend: money(m[1]), rewardUsd: money(m[2]) };

  // "Spend $100 or more, earn 5,000 Membership Rewards points"
  m = t.match(/spend \$([\d,.]+)\+?(?: or more)?[^$]{0,80}?earn ([\d,]+) (?:additional )?(?:membership rewards )?(?:points|pts)/i);
  if (m) return { ...out, type: 'points', minSpend: money(m[1]), rewardPoints: count(m[2]) };

  // "Earn +4 Membership Rewards points per eligible dollar spent, up to 4,000 points"
  m = t.match(/earn \+?(\d+(?:\.\d+)?) (?:additional )?(?:membership rewards )?(?:points?|pts) per (?:eligible )?dollar.{0,120}?up to (?:a total of )?([\d,]+) (?:membership rewards )?(?:points|pts)/i);
  if (m) {
    const perDollar = Number(m[1]);
    const cap = count(m[2]);
    return { ...out, type: 'points-per-dollar', perDollar, rewardPoints: cap, minSpend: Math.round(cap / perDollar) };
  }

  // "Get 20% back on purchases, up to a total of $40"
  m = t.match(/(?:get|earn) (\d+(?:\.\d+)?)% back.{0,120}?up to (?:a total of )?\$([\d,.]+)/i);
  if (m) {
    const pct = Number(m[1]);
    const cap = money(m[2]);
    return { ...out, type: 'percent', pct, rewardUsd: cap, minSpend: Math.round((cap / pct) * 100) };
  }

  // "Spend $99 or more, earn $25" (no "back")
  m = t.match(/spend \$([\d,.]+)\+?(?: or more)?[^$]{0,80}?(?:get|receive|earn) \$([\d,.]+)(?![\d,.]*\s*(?:membership|points|pts))/i);
  if (m) return { ...out, type: 'credit', minSpend: money(m[1]), rewardUsd: money(m[2]) };

  // "Get $15 back" / "Earn up to $96 back" with no stated minimum.
  m = t.match(/(?:get|receive|earn) (?:up to )?(?:a )?\$([\d,.]+)(?: statement credit| back)/i);
  if (m) return { ...out, type: 'credit', rewardUsd: money(m[1]) };

  return out;
}

export function daysUntil(isoDate, now = new Date()) {
  if (!isoDate) return null;
  const end = new Date(`${isoDate}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end - today) / 86_400_000);
}

export function daysSince(isoTimestamp, now = new Date()) {
  if (!isoTimestamp) return null;
  return Math.floor((now - new Date(isoTimestamp)) / 86_400_000);
}

const listMatch = (list, merchant) => {
  const m = String(merchant).toLowerCase();
  return (list || []).some((x) => x && m.includes(String(x).toLowerCase().trim()));
};

// Adds parsed numbers, value, category and a transparent score to each offer.
export function enrichOffer(offer, settings = {}, now = new Date()) {
  const mrCpp = Number(settings.mrCpp) || 1;
  const parsed = parseOffer(offer.description, offer.text);
  const valueUsd =
    parsed.rewardUsd ?? (parsed.rewardPoints != null ? (parsed.rewardPoints * mrCpp) / 100 : null);
  const maxValueUsd = valueUsd != null ? valueUsd * parsed.times : null;
  const returnPct = valueUsd != null && parsed.minSpend ? (valueUsd / parsed.minSpend) * 100 : null;
  const daysLeft = daysUntil(offer.expires, now);
  const ageDays = daysSince(offer.firstSeen, now);
  const category = inferCategory(offer.merchant, offer.description);
  const favorite = listMatch(settings.favorites, offer.merchant);
  const hidden = listMatch(settings.skipMerchants, offer.merchant);

  const score = scoreOffer({ returnPct, maxValueUsd, daysLeft, ageDays, category, favorite }, settings);

  return {
    ...offer,
    parsed,
    valueUsd: valueUsd != null ? round2(valueUsd) : null,
    maxValueUsd: maxValueUsd != null ? round2(maxValueUsd) : null,
    returnPct: returnPct != null ? Math.round(returnPct) : null,
    daysLeft,
    expired: daysLeft != null && daysLeft < 0,
    isNew: ageDays != null && ageDays <= 7,
    category,
    favorite,
    hidden,
    score,
  };
}

// Score is a sum of visible parts so the UI can explain every ranking.
export function scoreOffer({ returnPct, maxValueUsd, daysLeft, ageDays, category, favorite }, settings = {}) {
  const parts = {
    return: returnPct != null ? Math.min(returnPct, 60) : 8,
    value: maxValueUsd != null ? (Math.min(maxValueUsd, 150) / 150) * 30 : 0,
    urgency: daysLeft == null ? 0 : daysLeft <= 3 ? 10 : daysLeft <= 7 ? 6 : daysLeft <= 14 ? 2 : 0,
    new: ageDays != null && ageDays <= 7 ? 3 : 0,
    favorite: favorite ? 25 : 0,
    category: (settings.boostCategories || []).includes(category) ? 10 : 0,
  };
  for (const k of Object.keys(parts)) parts[k] = Math.round(parts[k] * 10) / 10;
  const total = Math.round(Object.values(parts).reduce((a, b) => a + b, 0));
  return { total, parts };
}

export function enrichOffers(offers, settings, now = new Date()) {
  return offers.map((o) => enrichOffer(o, settings, now));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
