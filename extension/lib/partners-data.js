// Amex Membership Rewards transfer partners (US).
//
// This file is plain (non-module) JS so it can be loaded both as a content
// script and via a side-effect import from ES modules / Node.
//
//   ratio – partner points received per 1 MR point (e.g. Hilton 1:2 → 2)
//   cpp   – rough value of ONE partner point, in cents
//   transferTime – how long Amex → partner transfers typically take ('' = unknown)
//
// Etihad Guest left the Amex program on June 30, 2026.
//
// Ratios change occasionally and valuations are opinions. Both can be
// overridden per partner in the dashboard's Settings tab.
globalThis.AMEX_PARTNERS = [
  { id: 'aer-lingus',      name: 'Aer Lingus AerClub',           type: 'airline', ratio: 1,   cpp: 1.4, aliases: ['aer lingus', 'aerclub'], site: 'https://www.aerlingus.com/', transferTime: '' },
  { id: 'aeromexico',      name: 'Aeromexico Rewards',           type: 'airline', ratio: 1.6, cpp: 0.8, aliases: ['aeromexico', 'aeroméxico'], site: 'https://www.aeromexico.com/', transferTime: '' },
  { id: 'aeroplan',        name: 'Air Canada Aeroplan',          type: 'airline', ratio: 1,   cpp: 1.5, aliases: ['aeroplan', 'air canada'], site: 'https://www.aircanada.com/aeroplan', transferTime: 'usually instant' },
  { id: 'flying-blue',     name: 'Air France-KLM Flying Blue',   type: 'airline', ratio: 1,   cpp: 1.3, aliases: ['flying blue', 'air france', 'klm'], site: 'https://www.flyingblue.us/', transferTime: 'usually instant' },
  { id: 'ana',             name: 'ANA Mileage Club',             type: 'airline', ratio: 1,   cpp: 1.5, aliases: ['ana mileage club', 'all nippon', 'ana'], site: 'https://www.ana.co.jp/en/us/amc/', transferTime: 'takes 2–3 days' },
  { id: 'avianca',         name: 'Avianca LifeMiles',            type: 'airline', ratio: 1,   cpp: 1.5, aliases: ['avianca', 'lifemiles'], site: 'https://www.lifemiles.com/', transferTime: 'usually instant' },
  { id: 'british-airways', name: 'British Airways Club',         type: 'airline', ratio: 1,   cpp: 1.4, aliases: ['british airways'], site: 'https://www.britishairways.com/', transferTime: 'usually instant' },
  { id: 'cathay',          name: 'Cathay Pacific Asia Miles',    type: 'airline', ratio: 0.8, cpp: 1.3, aliases: ['cathay', 'asia miles'], site: 'https://www.cathaypacific.com/', transferTime: '' },
  { id: 'delta',           name: 'Delta SkyMiles',               type: 'airline', ratio: 1,   cpp: 1.2, aliases: ['delta', 'skymiles'], site: 'https://www.delta.com/', transferTime: 'usually instant' },
  { id: 'emirates',        name: 'Emirates Skywards',            type: 'airline', ratio: 0.8, cpp: 1.2, aliases: ['emirates', 'skywards'], site: 'https://www.emirates.com/', transferTime: '' },
  { id: 'iberia',          name: 'Iberia Club',                  type: 'airline', ratio: 1,   cpp: 1.4, aliases: ['iberia'], site: 'https://www.iberia.com/us/', transferTime: 'usually instant' },
  { id: 'jetblue',         name: 'JetBlue TrueBlue',             type: 'airline', ratio: 0.8, cpp: 1.3, aliases: ['jetblue', 'trueblue'], site: 'https://www.jetblue.com/', transferTime: '' },
  { id: 'qantas',          name: 'Qantas Frequent Flyer',        type: 'airline', ratio: 1,   cpp: 1.3, aliases: ['qantas'], site: 'https://www.qantas.com/', transferTime: '' },
  { id: 'qatar',           name: 'Qatar Airways Privilege Club', type: 'airline', ratio: 1,   cpp: 1.4, aliases: ['qatar', 'privilege club'], site: 'https://www.qatarairways.com/en-us/privilege-club.html', transferTime: 'usually instant' },
  { id: 'singapore',       name: 'Singapore KrisFlyer',          type: 'airline', ratio: 1,   cpp: 1.4, aliases: ['singapore', 'krisflyer'], site: 'https://www.singaporeair.com/', transferTime: 'usually instant' },
  { id: 'virgin-atlantic', name: 'Virgin Atlantic Flying Club',  type: 'airline', ratio: 1,   cpp: 1.5, aliases: ['virgin atlantic', 'flying club'], site: 'https://www.virginatlantic.com/', transferTime: 'usually instant' },
  { id: 'choice',          name: 'Choice Privileges',            type: 'hotel',   ratio: 1,   cpp: 0.6, aliases: ['choice privileges', 'choice hotels'], site: 'https://www.choicehotels.com/', transferTime: '' },
  { id: 'hilton',          name: 'Hilton Honors',                type: 'hotel',   ratio: 2,   cpp: 0.5, aliases: ['hilton'], site: 'https://www.hilton.com/', transferTime: 'usually instant' },
  { id: 'marriott',        name: 'Marriott Bonvoy',              type: 'hotel',   ratio: 1,   cpp: 0.8, aliases: ['marriott', 'bonvoy'], site: 'https://www.marriott.com/', transferTime: 'usually instant' },
];

// Returns the ids of every partner whose name/alias appears in `text`.
globalThis.AMEX_MATCH_PARTNERS = function matchPartners(text) {
  const t = ` ${String(text).toLowerCase()} `;
  const ids = [];
  for (const p of globalThis.AMEX_PARTNERS) {
    const hit = p.aliases.some((a) => {
      const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z])${esc}([^a-z]|$)`).test(t);
    });
    if (hit) ids.push(p.id);
  }
  return ids;
};
