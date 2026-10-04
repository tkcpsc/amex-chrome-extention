import { partnerConfig } from './partners.js';

// Award "sweet spots" reachable with Amex Membership Rewards transfers.
//
//   miles   – lowest published price in the PARTNER's currency ("from" price)
//   feesUsd – typical taxes + carrier surcharges for the whole trip (estimate)
//   cashUsd – typical cash fare for the same trip (estimate, for value math)
//
// Prices were checked against published award charts and points-blog coverage
// in October 2026. Programs reprice without notice and award seats are
// limited — the UI always says "from" and tells you to find seats first.
export const TRIPS_CHECKED = 'October 2026';

export const TRIPS = [
  {
    id: 'ana-japan-business-rt',
    partnerId: 'ana',
    destination: 'Japan',
    region: 'Asia',
    route: 'US ⇄ Tokyo (Haneda/Narita) — most ANA US gateways',
    airline: 'ANA',
    cabin: 'business',
    tripType: 'round-trip',
    miles: 100000,
    milesNote: 'Low season. Regular season is ~105,000; Japanese peak dates (Golden Week, Obon, New Year) cost up to 165,000.',
    feesUsd: 700,
    feesNote: 'ANA adds fuel surcharges — roughly $500–$900 round-trip.',
    cashUsd: 6000,
    tips: [
      'ANA sells awards on its own flights as round trips only, but each ticket allows a free stopover in Japan and open jaws.',
      'Search award seats on ana.co.jp (or United.com, which shows most ANA saver space) before transferring.',
    ],
  },
  {
    id: 'virgin-ana-japan-business',
    partnerId: 'virgin-atlantic',
    destination: 'Japan',
    region: 'Asia',
    route: 'US West Coast ⇄ Tokyo on ANA',
    airline: 'ANA',
    cabin: 'business',
    tripType: 'round-trip',
    miles: 105000,
    milesNote: '52,500 each way from the West Coast; 60,000 each way from the Central/East Coast.',
    feesUsd: 700,
    feesNote: 'Virgin passes on ANA surcharges — roughly $360–$730 depending on routing.',
    cashUsd: 6000,
    tips: [
      'Unlike booking through ANA, Virgin Atlantic lets you book one-way, so you can mix programs for each direction.',
      'Find ANA saver space first (ana.co.jp or United.com), then book on virginatlantic.com or by phone.',
    ],
  },
  {
    id: 'virgin-ana-japan-first',
    partnerId: 'virgin-atlantic',
    destination: 'Japan',
    region: 'Asia',
    route: 'US West Coast ⇄ Tokyo on ANA "The Suite"',
    airline: 'ANA',
    cabin: 'first',
    tripType: 'round-trip',
    miles: 145000,
    milesNote: '72,500 each way from the West Coast; 85,000 each way from the Central/East Coast.',
    feesUsd: 900,
    feesNote: 'Carrier surcharges apply; expect several hundred dollars.',
    cashUsd: 20000,
    tips: [
      'ANA first-class award seats are scarce — usually released close to departure or ~355 days out.',
    ],
  },
  {
    id: 'aeroplan-japan-business',
    partnerId: 'aeroplan',
    destination: 'Japan',
    region: 'Asia',
    route: 'US → Tokyo on ANA, United or Air Canada',
    airline: 'ANA / United / Air Canada',
    cabin: 'business',
    tripType: 'one-way',
    miles: 75000,
    milesNote: 'Distance-based chart; some shorter Pacific Northwest routings price lower.',
    feesUsd: 90,
    feesNote: 'No fuel surcharges on most partners; Aeroplan adds a CA$39 partner booking fee.',
    cashUsd: 3500,
    tips: ['Aeroplan allows a stopover on one-way awards for a small fee — e.g. a few days in Vancouver or Tokyo.'],
  },
  {
    id: 'ana-europe-business',
    partnerId: 'ana',
    destination: 'Europe',
    region: 'Europe',
    route: 'US → Europe on Star Alliance (United, Lufthansa, SWISS, Austrian…)',
    airline: 'Star Alliance',
    cabin: 'business',
    tripType: 'one-way',
    miles: 50000,
    milesNote: 'ANA now allows one-way partner awards.',
    feesUsd: 250,
    feesNote: 'Low on United (~$100); Lufthansa/SWISS add surcharges ($500+).',
    cashUsd: 3000,
    tips: ['Prefer United or Air Canada flights to keep surcharges low.', 'Because ANA transfers take 2–3 days, confirm seats are still open right before you transfer.'],
  },
  {
    id: 'iberia-madrid-business',
    partnerId: 'iberia',
    destination: 'Madrid',
    region: 'Europe',
    route: 'New York / Boston → Madrid on Iberia',
    airline: 'Iberia',
    cabin: 'business',
    tripType: 'one-way',
    miles: 40500,
    milesNote: 'Off-peak dates (raised from 34,000 in March 2026). Peak dates cost more.',
    feesUsd: 130,
    feesNote: 'Usually about $120–$150.',
    cashUsd: 2500,
    tips: ['Off-peak covers most of the year except summer and holidays — check Iberia\'s calendar view.'],
  },
  {
    id: 'flying-blue-europe-business',
    partnerId: 'flying-blue',
    destination: 'Paris or Amsterdam',
    region: 'Europe',
    route: 'US → Paris / Amsterdam on Air France, KLM or Delta',
    airline: 'Air France / KLM',
    cabin: 'business',
    tripType: 'one-way',
    miles: 60000,
    milesNote: 'Standard saver price; monthly Promo Rewards sometimes drop it to ~40,000.',
    feesUsd: 330,
    feesNote: 'Roughly $300–$350 in taxes and surcharges.',
    cashUsd: 3000,
    tips: ['Check the monthly Flying Blue Promo Rewards list — it often includes US gateways.'],
  },
  {
    id: 'aeroplan-europe-business',
    partnerId: 'aeroplan',
    destination: 'Europe',
    region: 'Europe',
    route: 'US East Coast → Europe on United, Air Canada, Lufthansa, SWISS…',
    airline: 'Star Alliance',
    cabin: 'business',
    tripType: 'one-way',
    miles: 60000,
    milesNote: 'Shortest transatlantic band; longer routings cost up to ~110,000.',
    feesUsd: 100,
    feesNote: 'No fuel surcharges on most partners, plus a CA$39 booking fee.',
    cashUsd: 3000,
    tips: ['Add a stopover in Europe on a one-way award for a small fee.'],
  },
  {
    id: 'virgin-london-upper',
    partnerId: 'virgin-atlantic',
    destination: 'London',
    region: 'Europe',
    route: 'US East Coast (e.g. Boston) → London Heathrow',
    airline: 'Virgin Atlantic',
    cabin: 'business',
    tripType: 'one-way',
    miles: 29000,
    milesNote: 'Saver Upper Class pricing on low-demand dates; standard dates cost much more.',
    feesUsd: 500,
    feesNote: 'Virgin adds carrier surcharges on its own flights — often several hundred dollars.',
    cashUsd: 3000,
    tips: ['Saver dates move around — use Virgin\'s flexible-dates calendar.'],
  },
  {
    id: 'qatar-qsuites',
    partnerId: 'qatar',
    destination: 'Doha (and on to Asia, Africa or the Maldives)',
    region: 'Middle East',
    route: 'US → Doha on Qatar Airways Qsuites',
    airline: 'Qatar Airways',
    cabin: 'business',
    tripType: 'one-way',
    miles: 70000,
    milesNote: 'Off-peak; peak saver dates are ~94,500 Avios.',
    feesUsd: 100,
    feesNote: 'Taxes are usually low from the US.',
    cashUsd: 5000,
    tips: ['Qsuites is one of the best business-class seats in the world — book as soon as you see off-peak space.'],
  },
  {
    id: 'cathay-hong-kong-business',
    partnerId: 'cathay',
    destination: 'Hong Kong',
    region: 'Asia',
    route: 'US → Hong Kong on Cathay Pacific',
    airline: 'Cathay Pacific',
    cabin: 'business',
    tripType: 'one-way',
    miles: 91000,
    milesNote: 'Distance-based saver price; Amex → Asia Miles transfers at 5:4.',
    feesUsd: 150,
    feesNote: 'Varies by departure city.',
    cashUsd: 5000,
    tips: ['Hong Kong works well as a gateway to the rest of Asia.'],
  },
  {
    id: 'avianca-caribbean-business',
    partnerId: 'avianca',
    destination: 'the Caribbean or Central America',
    region: 'Caribbean & Latin America',
    route: 'US → Caribbean / Central America on United or Copa',
    airline: 'United / Copa',
    cabin: 'business',
    tripType: 'one-way',
    miles: 30000,
    milesNote: 'Economy from 17,500; LifeMiles sales sometimes go much lower.',
    feesUsd: 80,
    feesNote: 'No fuel surcharges; small booking fee.',
    cashUsd: 900,
    tips: ['LifeMiles runs frequent award sales — check before transferring.'],
  },
  {
    id: 'flying-blue-hawaii',
    partnerId: 'flying-blue',
    destination: 'Hawaii',
    region: 'Hawaii',
    route: 'US mainland → Hawaii on Delta',
    airline: 'Delta',
    cabin: 'economy',
    tripType: 'one-way',
    miles: 17500,
    milesNote: 'Delta first class to Hawaii is from 30,000 via Flying Blue.',
    feesUsd: 6,
    feesNote: '$5.60 US tax.',
    cashUsd: 350,
    tips: ['Often far cheaper than booking the same Delta flight with SkyMiles.'],
  },
  {
    id: 'singapore-hawaii',
    partnerId: 'singapore',
    destination: 'Hawaii',
    region: 'Hawaii',
    route: 'US mainland → Hawaii on United',
    airline: 'United',
    cabin: 'economy',
    tripType: 'one-way',
    miles: 20500,
    milesNote: 'United saver space required; first/business from 43,000.',
    feesUsd: 6,
    feesNote: '$5.60 US tax.',
    cashUsd: 350,
    tips: ['Search United.com for "saver" awards, then book the same flight through KrisFlyer.'],
  },
  {
    id: 'iberia-short-us',
    partnerId: 'iberia',
    destination: 'nearby US cities',
    region: 'United States',
    route: 'Shortest-distance flights on American or Alaska',
    airline: 'American / Alaska',
    cabin: 'economy',
    tripType: 'one-way',
    miles: 6000,
    milesNote: 'Lowest distance band only; longer flights cost more.',
    feesUsd: 6,
    feesNote: '$5.60 US tax.',
    cashUsd: 180,
    tips: ['Iberia partner awards generally can\'t be changed or cancelled — book only firm plans.'],
  },
];

const CABIN_LABEL = { economy: 'economy', premium: 'premium economy', business: 'business class', first: 'first class' };
const fmt = (n) => n.toLocaleString('en-US');

// Amex transfers move whole thousands of points.
export function mrNeeded(miles, ratio, bonusPct = 0) {
  return Math.ceil(miles / (ratio * (1 + (bonusPct || 0) / 100)) / 1000) * 1000;
}

function activeBonus(b, now) {
  if (!b || !(b.bonusPct > 0)) return null;
  if (b.endDate && new Date(`${b.endDate}T23:59:59`) < now) return null;
  return b;
}

// Trip ideas priced in Amex points with today's bonuses, best value first.
export function tripIdeas(settings = {}, transferBonuses = {}, now = new Date()) {
  const partners = Object.fromEntries(partnerConfig(settings).map((p) => [p.id, p]));
  const balance = Number(settings.mrBalance) || 0;

  return TRIPS.filter((t) => partners[t.partnerId])
    .map((t) => {
      const p = partners[t.partnerId];
      const bonus = activeBonus(transferBonuses[t.partnerId], now);
      const bonusPct = bonus ? bonus.bonusPct : 0;
      const mrPoints = mrNeeded(t.miles, p.ratio, bonusPct);
      const mrPointsNoBonus = mrNeeded(t.miles, p.ratio, 0);
      const valueCpp = t.cashUsd ? Math.round(((t.cashUsd - (t.feesUsd || 0)) / mrPoints) * 1000) / 10 : null;
      const cabin = CABIN_LABEL[t.cabin] || t.cabin;
      const trip = t.tripType === 'round-trip' ? 'round-trip' : 'one-way';
      const headline =
        `You could fly ${trip} to ${t.destination} in ${t.airline} ${cabin} for only ${fmt(mrPoints)} Amex points` +
        (bonusPct ? ` with the current ${bonusPct}% transfer bonus.` : '.');
      return {
        ...t,
        cabinLabel: cabin,
        partnerName: p.name,
        ratio: p.ratio,
        site: p.site,
        transferTime: p.transferTime,
        bonusPct,
        bonusEnds: bonus?.endDate || null,
        mrPoints,
        mrPointsNoBonus,
        savedPoints: mrPointsNoBonus - mrPoints,
        valueCpp,
        headline,
        affordable: balance ? balance >= mrPoints : null,
        shortBy: balance ? Math.max(0, mrPoints - balance) : null,
      };
    })
    .sort((a, b) => (b.valueCpp ?? 0) - (a.valueCpp ?? 0));
}
