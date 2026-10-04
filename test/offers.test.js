import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOffer, enrichOffer, inferCategory, daysUntil } from '../extension/lib/offers.js';

test('spend X get $Y back', () => {
  const p = parseOffer('Spend $50 or more, get $10 back. Up to 2 times.');
  assert.equal(p.type, 'credit');
  assert.equal(p.minSpend, 50);
  assert.equal(p.rewardUsd, 10);
  assert.equal(p.times, 2);
});

test('spend X earn N points', () => {
  const p = parseOffer('Spend $1,000 or more, earn 10,000 Membership Rewards® points.');
  assert.equal(p.type, 'points');
  assert.equal(p.minSpend, 1000);
  assert.equal(p.rewardPoints, 10000);
});

test('points per dollar with cap', () => {
  const p = parseOffer('Earn +4 Membership Rewards® points per eligible dollar spent, up to 4,000 points.');
  assert.equal(p.type, 'points-per-dollar');
  assert.equal(p.perDollar, 4);
  assert.equal(p.rewardPoints, 4000);
  assert.equal(p.minSpend, 1000);
});

test('percent back with cap', () => {
  const p = parseOffer('Get 20% back on purchases, up to a total of $40.');
  assert.equal(p.type, 'percent');
  assert.equal(p.pct, 20);
  assert.equal(p.rewardUsd, 40);
  assert.equal(p.minSpend, 200);
});

test('unknown copy is "other"', () => {
  assert.equal(parseOffer('Enjoy a complimentary dessert').type, 'other');
});

test('enrichOffer computes return, value and points at mrCpp', () => {
  const now = new Date('2026-10-03T12:00:00');
  const o = enrichOffer(
    { merchant: 'Starbucks', description: 'Spend $20 or more, get $5 back', expires: '2026-10-06', firstSeen: '2026-10-01T00:00:00Z' },
    { mrCpp: 1, favorites: ['starbucks'] },
    now
  );
  assert.equal(o.returnPct, 25);
  assert.equal(o.valueUsd, 5);
  assert.equal(o.daysLeft, 3);
  assert.equal(o.favorite, true);
  assert.equal(o.isNew, true);
  assert.equal(o.category, 'dining');
  assert.equal(o.score.parts.urgency, 10);

  const pts = enrichOffer({ merchant: 'Dell', description: 'Spend $500 or more, earn 10,000 points' }, { mrCpp: 1.5 }, now);
  assert.equal(pts.valueUsd, 150);
  assert.equal(pts.returnPct, 30);
});

test('higher return outranks bigger spend', () => {
  const now = new Date('2026-10-03');
  const a = enrichOffer({ merchant: 'A', description: 'Spend $50 or more, get $15 back', expires: '2026-12-31' }, {}, now);
  const b = enrichOffer({ merchant: 'B', description: 'Spend $500 or more, get $50 back', expires: '2026-12-31' }, {}, now);
  assert.ok(a.score.total > b.score.total);
});

test('skip list hides merchants', () => {
  const o = enrichOffer({ merchant: 'Some Airline', description: 'Spend $100, get $20 back' }, { skipMerchants: ['airline'] });
  assert.equal(o.hidden, true);
});

test('categories and dates', () => {
  assert.equal(inferCategory('Hilton Hotels'), 'travel');
  assert.equal(inferCategory('Zzz'), 'other');
  assert.equal(daysUntil('2026-10-03', new Date('2026-10-03T23:00:00')), 0);
  assert.equal(daysUntil('2026-10-02', new Date('2026-10-03T01:00:00')), -1);
});

test('wording seen on the real Amex page', () => {
  let p = parseOffer('Spend $99 or more, earn $25');
  assert.deepEqual([p.type, p.minSpend, p.rewardUsd], ['credit', 99, 25]);
  p = parseOffer('Earn up to $96 back, one time, when you purchase an annual Uber One membership.');
  assert.deepEqual([p.type, p.rewardUsd], ['credit', 96]);
  p = parseOffer('Spend $13.99 or more, earn $13.99 back, up to 3 times (total of $41.97).');
  assert.deepEqual([p.type, p.minSpend, p.rewardUsd, p.times], ['credit', 13.99, 13.99, 3]);
  p = parseOffer('Spend $150 or more, earn 4,500 Membership Rewards® points');
  assert.deepEqual([p.type, p.rewardPoints], ['points', 4500]);
  p = parseOffer('Earn +5 Membership Rewards® points per eligible dollar spent, up to 15,000 pts');
  assert.deepEqual([p.type, p.minSpend], ['points-per-dollar', 3000]);
  p = parseOffer('Earn 10% back on qualifying concessions purchases, up to $250 per calendar year');
  assert.deepEqual([p.type, p.pct, p.rewardUsd], ['percent', 10, 250]);
});
