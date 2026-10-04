import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchOffers, groupsFor, spendAdvice, cartAdvice, matchWatchlist } from '../extension/lib/shop.js';
import { enrichOffer } from '../extension/lib/offers.js';

const now = new Date('2026-10-03T12:00:00');
const mk = (merchant, description, status = 'available') =>
  enrichOffer({ id: merchant, merchant, description, expires: '2026-12-31', status }, { mrCpp: 1 }, now);

// A slice of the offers from the real Amex page.
const offers = [
  mk('Away', 'Spend $300 or more, earn $60 back'),
  mk('Tecovas', 'Spend $250 or more, earn $50 back'),
  mk('Warby Parker - Contacts & Eyeglasses', 'Spend $95 or more, earn $20 back', 'enrolled'),
  mk('Teleflora - Flowers arranged & delivered by local florists', 'Spend $15 or more, earn $15 back, up to 10 times (total of $150).'),
  mk('Dell Technologies', 'Spend $500 or more, earn 10,000 Membership Rewards® points.'),
  mk('iherb.com', 'Earn 4% back on purchases, up to a total of $250'),
  mk('Getaway Spa', 'Spend $100 or more, earn $20 back'),
];

test('product words find brands', () => {
  assert.deepEqual(groupsFor('suitcases').map((g) => g.label), ['luggage']);
  assert.deepEqual(searchOffers('suitcase', offers).map((r) => r.offer.merchant), ['Away']);
  assert.equal(searchOffers('suitcase', offers)[0].reason, 'luggage');
  assert.deepEqual(searchOffers('new glasses', offers).map((r) => r.offer.merchant), ['Warby Parker - Contacts & Eyeglasses']);
  assert.deepEqual(searchOffers('flowers', offers).map((r) => r.offer.merchant), ['Teleflora - Flowers arranged & delivered by local florists']);
  assert.deepEqual(searchOffers('laptop', offers).map((r) => r.offer.merchant), ['Dell Technologies']);
  assert.deepEqual(searchOffers('vitamins', offers).map((r) => r.offer.merchant), ['iherb.com']);
});

test('merchant terms match whole words only ("away" ≠ "Getaway")', () => {
  assert.ok(!searchOffers('luggage', offers).some((r) => r.offer.merchant === 'Getaway Spa'));
});

test('searching a store name works directly', () => {
  assert.equal(searchOffers('dell', offers)[0].reason, 'merchant name');
  assert.equal(searchOffers('cat', offers).length, 0);
});

test('spend advice explains the threshold', () => {
  const away = offers[0];
  assert.match(spendAdvice(away), /Spend at least \$300 .* get \$60 back — you effectively pay \$240 for \$300\. Spending \$299\.99 gets nothing\./);
  assert.match(spendAdvice(offers[3]), /up to 10 times — split into 10 separate purchases of \$15\+/i);
  assert.match(spendAdvice(offers[5]), /4% back .* up to \$250/);
});

test('cart advice: the $280 suitcase', () => {
  const a = cartAdvice(offers[0], 280);
  assert.equal(a.tone, 'good');
  assert.equal(a.text, 'Add $20 to reach $300 and get $60 back. You\'d pay $240 net — $40 less than your current $280 cart, and you get more stuff.');
  assert.equal(cartAdvice(offers[0], 150).tone, 'warn'); // net $240 > $150: only worth it if you want the extra
  assert.match(cartAdvice(offers[0], 320).text, /qualifies — you get \$60 back/);
  assert.match(cartAdvice(offers[5], 10000).text, /capped/);
});

test('watchlist matching', () => {
  const w = matchWatchlist([{ id: '1', text: 'suitcase' }, { id: '2', text: 'mattress' }], offers);
  assert.equal(w[0].matches.length, 1);
  assert.equal(w[1].matches.length, 0);
});
