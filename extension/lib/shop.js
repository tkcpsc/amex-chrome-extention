// "Before you buy": find offers by what you're shopping for, explain the spend
// thresholds, and match a watchlist of planned purchases. Pure functions,
// shared by the dashboard, popup and emailer (covered by test/shop.test.js).

// Product words → brands/merchants that sell them. Merchant terms match whole
// words in the offer's merchant name, so "away" won't match "Get away".
export const PRODUCT_GROUPS = [
  { label: 'luggage', terms: ['suitcase', 'luggage', 'carry-on', 'carry on', 'duffel', 'backpack', 'travel bag'],
    merchants: ['away', 'samsonite', 'tumi', 'rimowa', 'monos', 'briggs', 'calpak', 'travelpro', 'beis', 'béis', 'delsey', 'eagle creek', 'osprey', 'herschel', 'tortuga', 'luggage', 'stanley1913'] },
  { label: 'electronics', terms: ['laptop', 'computer', 'pc', 'monitor', 'tablet', 'headphones', 'tv', 'television', 'camera', 'keyboard', 'mouse', 'speaker', 'electronics'],
    merchants: ['dell', 'lenovo', 'hp', 'apple', 'best buy', 'samsung', 'logitech', 'microsoft', 'asus', 'bose', 'sony', 'b&h', 'newegg', 'sonos', 'dyson'] },
  { label: 'phones', terms: ['phone', 'iphone', 'smartphone', 'cell phone'],
    merchants: ['apple', 'samsung', 'verizon', 'at&t', 't-mobile', 'best buy', 'google'] },
  { label: 'mattresses & bedding', terms: ['mattress', 'bed', 'bedding', 'sheets', 'pillow', 'comforter', 'duvet'],
    merchants: ['casper', 'purple', 'saatva', 'tempur', 'sleep number', 'brooklinen', 'parachute', 'cozy earth', 'avocado', 'nectar', 'helix', 'tuft'] },
  { label: 'furniture & home', terms: ['furniture', 'sofa', 'couch', 'rug', 'lamp', 'lighting', 'decor', 'table', 'chair', 'desk'],
    merchants: ['wayfair', 'west elm', 'pottery barn', 'crate', 'article', 'rugsusa', 'lampsplus', 'lamps plus', 'ikea', 'arhaus', 'castlery', 'burrow', 'dyson'] },
  { label: 'clothing & shoes', terms: ['shoes', 'sneakers', 'boots', 'clothes', 'clothing', 'shirt', 'shirts', 'jacket', 'dress', 'apparel', 'jeans', 'suit'],
    merchants: ['nike', 'adidas', 'nobull', 'tecovas', 'sam edelman', 'charles tyrwhitt', 'criquet', 'bonobos', 'express', 'calvin klein', 'hugo boss', 'lululemon', 'revolve', 'bloomingdale', 'bloomingdale\'s', 'nordstrom', 'scheels', 'gap', 'j.crew', 'allbirds', 'muji', 'eddiebauer', 'eddie bauer', 'oakley'] },
  { label: 'glasses & contacts', terms: ['glasses', 'eyeglasses', 'contacts', 'contact lenses', 'sunglasses'],
    merchants: ['warby parker', 'lenscrafters', 'oakley', 'ray-ban', '1-800 contacts'] },
  { label: 'flights', terms: ['flight', 'flights', 'airfare', 'plane ticket'],
    merchants: ['jetblue', 'delta', 'united', 'american airlines', 'alaska', 'southwest', 'expedia'] },
  { label: 'hotels & stays', terms: ['hotel', 'hotels', 'stay', 'resort', 'vacation rental'],
    merchants: ['hilton', 'marriott', 'hyatt', 'wyndham', 'ihg', 'airbnb', 'vrbo', 'expedia', 'hotels.com'] },
  { label: 'car rental', terms: ['car rental', 'rental car', 'rent a car'],
    merchants: ['hertz', 'avis', 'turo', 'enterprise', 'national', 'budget'] },
  { label: 'flowers & gifts', terms: ['flowers', 'bouquet', 'gift', 'gifts'],
    merchants: ['teleflora', 'bouqs', 'simply blooms', '1-800-flowers', 'ftd', 'proflowers', 'hallmark', 'nothing bundt'] },
  { label: 'coffee', terms: ['coffee', 'espresso'], merchants: ['peets', 'starbucks', 'blue bottle', 'nespresso'] },
  { label: 'fitness & wellness', terms: ['fitness', 'gym', 'workout', 'wellness', 'health', 'blood test', 'lab test'],
    merchants: ['peloton', 'equinox', 'nobull', 'oura', 'whoop', 'function health', 'sky zone'] },
  { label: 'beauty', terms: ['makeup', 'skincare', 'skin care', 'perfume', 'fragrance', 'cologne', 'beauty', 'sunscreen', 'deodorant'],
    merchants: ['dior', 'sephora', 'ulta', 'elfcosmetics', 'elf', 'eltamd', 'fragrance', 'salt & stone'] },
  { label: 'sports & fan gear', terms: ['sports', 'jersey', 'fan gear', 'sporting goods', 'hunting', 'fishing', 'camping'],
    merchants: ['fanatics', 'nflshop', 'nfl', 'nhl shop', 'nhl', 'dick\'s', 'scheels', 'hibbett', 'sportsman\'s warehouse', 'rei'] },
  { label: 'pets', terms: ['pet', 'dog', 'cat', 'pet food', 'dog food', 'cat litter', 'litter'],
    merchants: ['chewy', 'petco', 'petsmart', 'hollywood feed', 'openfarmpet', 'prettylitter'] },
  { label: 'baby', terms: ['diapers', 'baby', 'wipes'], merchants: ['coterie', 'honest', 'pampers'] },
  { label: 'kitchen', terms: ['cookware', 'kitchen', 'knives', 'pots', 'pans', 'blender'],
    merchants: ['sur la table', 'williams sonoma', 'le creuset', 'made in', 'our place', 'hexclad'] },
  { label: 'books', terms: ['book', 'books', 'audiobook'], merchants: ['thriftbooks', 'barnes', 'audible'] },
  { label: 'tickets & entertainment', terms: ['tickets', 'concert', 'broadway', 'show', 'movie', 'movies', 'theater', 'theatre'],
    merchants: ['ticketmaster', 'todaytix', 'broadway.com', 'stubhub', 'seatgeek', 'cmx', 'amc', 'fandango', 'venue collection'] },
  { label: 'streaming & subscriptions', terms: ['streaming', 'subscription', 'tv service'],
    merchants: ['youtube', 'paramount', 'hbo', 'max', 'starz', 'mgm+', 'fubo', 'dish', 'history vault', 'cnn', 'hulu', 'netflix', 'peacock', 'disney+', 'duolingo', 'dropbox'] },
  { label: 'vitamins & supplements', terms: ['vitamins', 'supplements', 'protein'], merchants: ['iherb', 'thorne', 'nobull'] },
  { label: 'restaurants', terms: ['restaurant', 'dinner', 'lunch', 'takeout', 'food'],
    merchants: ['p.f. chang', 'ruth\'s chris', 'potbelly', 'mcalister', 'el pollo loco', 'moe\'s', 'pizza hut', 'auntie anne', 'doordash', 'grubhub', 'uber eats'] },
];

const STOP = new Set(['a', 'an', 'the', 'for', 'new', 'and', 'or', 'to', 'of', 'my', 'buy', 'buying', 'some', 'with', 'get']);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordIn = (needle, hay) => new RegExp(`(^|[^a-z0-9])${esc(needle)}([^a-z0-9]|$)`, 'i').test(hay);
const tokens = (q) => q.toLowerCase().split(/[^a-z0-9'+&.-]+/).filter((t) => t.length >= 3 && !STOP.has(t));

// Product groups a query refers to ("suitcases" → luggage).
export function groupsFor(query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  // Also try singular forms ("suitcases" → "suitcase"), and allow a partly
  // typed word ("suitc" → "suitcase") — but never "suitcases" → "suit".
  const forms = [q, q.replace(/(\w{3})s\b/g, '$1'), q.replace(/(\w{3})es\b/g, '$1')];
  return PRODUCT_GROUPS.filter((g) =>
    g.label === q ||
    g.terms.some((t) => forms.some((f) => wordIn(t, f)) || (q.length >= 4 && t.startsWith(q)))
  );
}

// Offers matching what you're shopping for, each with the reason it matched.
export function searchOffers(query, offers) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const groups = groupsFor(q);
  const toks = tokens(q);
  const out = [];
  for (const o of offers) {
    const merchant = o.merchant || '';
    const text = `${merchant} ${o.description || ''}`;
    let reason = null;
    if (wordIn(q, merchant) || merchant.toLowerCase().includes(q.toLowerCase())) reason = 'merchant name';
    else {
      const g = groups.find((gr) => gr.merchants.some((m) => wordIn(m, merchant)));
      if (g) reason = g.label;
      else if (toks.some((t) => wordIn(t, text))) reason = 'offer text';
    }
    if (reason) out.push({ offer: o, reason });
  }
  const rank = { 'merchant name': 0 };
  return out.sort((a, b) => (rank[a.reason] ?? 1) - (rank[b.reason] ?? 1) || (b.offer.score?.total ?? 0) - (a.offer.score?.total ?? 0));
}

const usd = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

// One-line explanation of how to get the most from an offer.
export function spendAdvice(o) {
  const p = o.parsed || {};
  const times = p.times > 1 ? ` Works up to ${p.times} times — split into ${p.times} separate purchases of ${usd(p.minSpend || 0)}+ to get it ${p.times}×.` : '';
  if (p.type === 'credit' && p.minSpend && p.rewardUsd) {
    return `Spend at least ${usd(p.minSpend)} in one purchase to get ${usd(p.rewardUsd)} back — you effectively pay ${usd(p.minSpend - p.rewardUsd)} for ${usd(p.minSpend)}. Spending ${usd(p.minSpend - 0.01)} gets nothing.${times}`;
  }
  if (p.type === 'points' && p.minSpend && p.rewardPoints) {
    return `Spend at least ${usd(p.minSpend)} in one purchase to earn ${p.rewardPoints.toLocaleString('en-US')} bonus points (worth ~${usd(o.valueUsd ?? p.rewardPoints / 100)}).${times}`;
  }
  if (p.type === 'percent' && p.pct && p.rewardUsd) {
    return `${p.pct}% back on every dollar, up to ${usd(p.rewardUsd)} — spending ${usd(p.minSpend)} maxes it out; beyond that there's no extra savings.`;
  }
  if (p.type === 'points-per-dollar' && p.perDollar && p.rewardPoints) {
    return `+${p.perDollar} points per dollar up to ${p.rewardPoints.toLocaleString('en-US')} bonus points — maxes out at ${usd(p.minSpend)} spent.`;
  }
  return 'Check the offer terms on Amex for how it pays out.';
}

// What to do with a specific cart total.
export function cartAdvice(o, cart) {
  const p = o.parsed || {};
  const c = Number(cart);
  if (!(c > 0)) return null;
  if ((p.type === 'credit' || p.type === 'points') && p.minSpend) {
    const reward = p.type === 'credit' ? p.rewardUsd : o.valueUsd ?? p.rewardPoints / 100;
    if (c >= p.minSpend) return { tone: 'good', text: `Your ${usd(c)} cart qualifies — you get ${usd(reward)} back (${p.type === 'points' ? 'in points' : 'statement credit'}).` };
    const gap = p.minSpend - c;
    const netAtThreshold = p.minSpend - reward;
    if (netAtThreshold <= c) {
      return { tone: 'good', text: `Add ${usd(gap)} to reach ${usd(p.minSpend)} and get ${usd(reward)} back. You'd pay ${usd(netAtThreshold)} net — ${usd(c - netAtThreshold)} less than your current ${usd(c)} cart, and you get more stuff.` };
    }
    return { tone: 'warn', text: `You're ${usd(gap)} short. Topping up to ${usd(p.minSpend)} gets ${usd(reward)} back (net ${usd(netAtThreshold)}) — worth it only if you'd use the extra ${usd(gap)} of items.` };
  }
  if (p.type === 'percent' && p.pct) {
    const back = Math.min(c * (p.pct / 100), p.rewardUsd || Infinity);
    return { tone: 'good', text: `You'd get ${usd(Math.round(back * 100) / 100)} back on a ${usd(c)} cart${p.minSpend && c > p.minSpend ? ` (capped — spending beyond ${usd(p.minSpend)} earns nothing extra)` : ''}.` };
  }
  if (p.type === 'points-per-dollar' && p.perDollar) {
    const pts = Math.min(Math.round(c * p.perDollar), p.rewardPoints || Infinity);
    return { tone: 'good', text: `You'd earn ${pts.toLocaleString('en-US')} bonus points on a ${usd(c)} cart.` };
  }
  return null;
}

// For each planned purchase, the active offers that match it.
export function matchWatchlist(watchlist = [], offers = []) {
  return watchlist
    .filter((w) => w && w.text)
    .map((w) => ({ item: w, matches: searchOffers(w.text, offers) }));
}
