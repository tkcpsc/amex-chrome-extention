import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDigest } from '../extension/lib/digest.js';
import { partnerTable, effectiveCpp } from '../extension/lib/partners.js';
import { renderEmail } from '../emailer/render.js';

const now = new Date('2026-10-03T12:00:00');
const state = {
  lastScanAt: '2026-10-02T12:00:00Z',
  offers: {
    a: { id: 'a', merchant: 'Starbucks', description: 'Spend $20 or more, get $5 back', expires: '2026-10-05', status: 'enrolled', firstSeen: '2026-10-01T00:00:00Z', cardLabel: 'Gold ••1001' },
    b: { id: 'b', merchant: 'Dell', description: 'Spend $500 or more, get $50 back', expires: '2026-11-30', status: 'available', firstSeen: '2026-08-01T00:00:00Z' },
    c: { id: 'c', merchant: 'Expired Co', description: 'Spend $10, get $5 back', expires: '2026-09-01', status: 'enrolled', firstSeen: '2026-08-01T00:00:00Z' },
    d: { id: 'd', merchant: '<script>alert(1)</script>', description: 'Spend $40 or more, get $10 back', expires: '2026-10-20', status: 'available', firstSeen: '2026-09-01T00:00:00Z' },
  },
  transferBonuses: {
    'virgin-atlantic': { partnerId: 'virgin-atlantic', bonusPct: 30, endDate: '2026-10-31', source: 'scraped' },
    hilton: { partnerId: 'hilton', bonusPct: 50, endDate: '2026-09-01', source: 'manual' }, // ended
  },
  settings: { mrCpp: 1 },
};

test('digest excludes expired offers and windows by period', () => {
  const w = buildDigest(state, { period: 'week', now });
  assert.equal(w.active.length, 3);
  assert.deepEqual(w.expiring.map((o) => o.id), ['a']);
  assert.deepEqual(w.fresh.map((o) => o.id), ['a']);
  const m = buildDigest(state, { period: 'month', now });
  assert.deepEqual(m.expiring.map((o) => o.id), ['a', 'd']);
  assert.equal(w.stats.enrolled, 1);
  assert.ok(w.staleDays <= 1, "scanned within a day");
});

test('transfer bonuses: active only, effective value', () => {
  const rows = partnerTable(state.settings, state.transferBonuses, now);
  const va = rows.find((r) => r.partnerId === 'virgin-atlantic');
  const hilton = rows.find((r) => r.partnerId === 'hilton');
  assert.equal(va.bonusPct, 30);
  assert.equal(va.effectiveCpp, 1.95);
  assert.equal(hilton.bonusPct, 0, 'ended bonus ignored');
  assert.equal(rows[0].partnerId, 'virgin-atlantic', 'sorted by value');
  assert.equal(effectiveCpp({ cpp: 0.5, ratio: 2 }, 0), 1);
});

test('partner overrides apply', () => {
  const rows = partnerTable({ mrCpp: 1, partnerOverrides: { delta: { cpp: 2 } } }, {}, now);
  assert.equal(rows.find((r) => r.partnerId === 'delta').effectiveCpp, 2);
});

test('email escapes scraped text', () => {
  const { html, subject } = renderEmail(buildDigest(state, { period: 'week', now }));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.match(subject, /30% bonus to Virgin Atlantic/);
});
