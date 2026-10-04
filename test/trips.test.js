import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripIdeas, mrNeeded, TRIPS } from '../extension/lib/trips.js';
import { PARTNERS } from '../extension/lib/partners.js';

const now = new Date('2026-10-03T12:00:00');

test('every trip points at a current Amex partner (no Etihad)', () => {
  const ids = new Set(PARTNERS.map((p) => p.id));
  assert.ok(!ids.has('etihad'));
  for (const t of TRIPS) assert.ok(ids.has(t.partnerId), t.id);
});

test('points needed respects ratio, bonus and 1,000-point transfer steps', () => {
  assert.equal(mrNeeded(100000, 1), 100000);
  assert.equal(mrNeeded(91000, 0.8), 114000); // 113,750 → rounds up
  assert.equal(mrNeeded(60000, 1, 25), 48000);
  assert.equal(mrNeeded(52500, 1, 30), 41000); // 40,385 → 41,000
});

test('headline and bonus-adjusted price', () => {
  const trips = tripIdeas({}, {}, now);
  const ana = trips.find((t) => t.id === 'ana-japan-business-rt');
  assert.equal(ana.headline, 'You could fly round-trip to Japan in ANA business class for only 100,000 Amex points.');
  assert.equal(ana.valueCpp, 5.3);

  const boosted = tripIdeas({}, { 'flying-blue': { bonusPct: 25, endDate: '2026-10-31' } }, now);
  const fb = boosted.find((t) => t.id === 'flying-blue-europe-business');
  assert.equal(fb.mrPoints, 48000);
  assert.equal(fb.savedPoints, 12000);
  assert.match(fb.headline, /48,000 Amex points with the current 25% transfer bonus\.$/);
});

test('expired bonuses are ignored; balance flags affordability; sorted by value', () => {
  const trips = tripIdeas({ mrBalance: 50000 }, { 'flying-blue': { bonusPct: 25, endDate: '2026-09-01' } }, now);
  const fb = trips.find((t) => t.id === 'flying-blue-europe-business');
  assert.equal(fb.bonusPct, 0);
  assert.equal(fb.affordable, false);
  assert.equal(fb.shortBy, 10000);
  assert.equal(trips.find((t) => t.id === 'iberia-madrid-business').affordable, true);
  for (let i = 1; i < trips.length; i++) assert.ok(trips[i - 1].valueCpp >= trips[i].valueCpp);
});
