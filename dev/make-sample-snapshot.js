#!/usr/bin/env node
// Writes dev/sample-snapshot.json with fake offers (dates relative to today) so
// you can preview the email:  npm run digest:sample
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const day = 86_400_000;
const iso = (d) => new Date(Date.now() + d * day).toISOString().slice(0, 10);
const ts = (d) => new Date(Date.now() + d * day).toISOString();

const raw = [
  ['Starbucks', 'Spend $20 or more, get $5 back. Up to 2 times.', 3, 'enrolled', -2],
  ['Dell Technologies', 'Spend $500 or more, earn 10,000 Membership Rewards® points.', 40, 'enrolled', -20],
  ['DoorDash', 'Get 20% back on purchases, up to a total of $40.', 12, 'enrolled', -3],
  ['Hilton Hotels', 'Earn +4 Membership Rewards® points per eligible dollar spent, up to 4,000 points.', 25, 'enrolled', -30],
  ['Sweetgreen', 'Spend $15 or more, get $5 back.', 6, 'enrolled', -1],
  ['Hulu', 'Spend $10 or more, get $10 back.', 20, 'enrolled', -9],
  ['Wayfair', 'Spend $300 or more, get $50 back.', 55, 'enrolled', -12],
  ['Shell', 'Spend $40 or more, get $8 back. Up to 3 times.', 9, 'enrolled', -4],
  ['Rimowa', 'Spend $750 or more, get $150 back.', 70, 'available', -2],
  ['Away - Luggage & Travel Accessories', 'Spend $300 or more, earn $60 back', 58, 'available', -3],
];

const offers = {};
raw.forEach(([merchant, description, exp, status, seen], i) => {
  const id = `sample${i}`;
  offers[id] = {
    id, cardKey: 'platinum-1005', cardLabel: 'Platinum Card® ••1005', merchant, description,
    expires: iso(exp), text: `${merchant} | ${description}`, status, firstSeen: ts(seen),
    enrolledAt: status === 'enrolled' ? ts(seen) : null,
  };
});

const snapshot = {
  app: 'amex-offers',
  version: 1,
  exportedAt: ts(0),
  lastScanAt: ts(-1),
  lastTransferScanAt: ts(-1),
  cards: { 'platinum-1005': { key: 'platinum-1005', label: 'Platinum Card® ••1005', lastScanAt: ts(-1) } },
  offers,
  transferBonuses: {
    'virgin-atlantic': { partnerId: 'virgin-atlantic', bonusPct: 30, endDate: iso(28), source: 'scraped' },
    'flying-blue': { partnerId: 'flying-blue', bonusPct: 25, endDate: iso(12), source: 'scraped' },
  },
  settings: { mrCpp: 1, skipMerchants: ['rimowa'], favorites: ['starbucks'], watchlist: [{ id: 'w1', text: 'suitcase' }] },
};

const out = join(dirname(fileURLToPath(import.meta.url)), 'sample-snapshot.json');
writeFileSync(out, JSON.stringify(snapshot, null, 2));
console.log(`Wrote ${out}`);
