import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../extension/content/scrape.js';

const { parseExpiry, isAddButton } = globalThis.AmexScrape;
const now = new Date('2026-10-03T12:00:00');

test('expiry formats', () => {
  assert.equal(parseExpiry('Expires 12/31/26', now), '2026-12-31');
  assert.equal(parseExpiry('Exp. 1/5/2027', now), '2027-01-05');
  assert.equal(parseExpiry('Expires Dec 31, 2026', now), '2026-12-31');
  assert.equal(parseExpiry('Ends Nov 2', now), '2026-11-02');
  assert.equal(parseExpiry('Expires Sept 30, 2027', now), '2027-09-30');
  assert.equal(parseExpiry('Expires Oct 15', now), '2026-10-15');
  assert.equal(parseExpiry('Expires 2/1', now), '2027-02-01', 'past month/day rolls to next year');
  assert.equal(parseExpiry('Expires in 5 days', now), '2026-10-08');
  assert.equal(parseExpiry('Expires today', now), '2026-10-03');
  assert.equal(parseExpiry('Ends tomorrow', now), '2026-10-04');
  assert.equal(parseExpiry('Spend $50, get $10 back', now), null);
});

// Minimal stand-in for a DOM element.
const el = (attrs = {}, text = '') => ({
  isConnected: true,
  disabled: false,
  textContent: text,
  getAttribute: (k) => attrs[k] ?? null,
});

test('recognizes the real Amex icon-only add button', () => {
  assert.equal(isAddButton(el({ title: 'add to list card', 'data-testid': 'merchantOfferListAddButton' })), true);
  assert.equal(isAddButton(el({ 'aria-label': 'Add to Card' })), true);
  assert.equal(isAddButton(el({}, 'Enroll')), true);
});

test('ignores look-alikes', () => {
  assert.equal(isAddButton(el({ title: 'Add a card' }, '+ Add Card')), false);
  assert.equal(isAddButton(el({ title: 'added to list card' })), false);
  assert.equal(isAddButton(el({ 'aria-label': 'Add authorized user' })), false);
  assert.equal(isAddButton(el({ 'aria-label': 'Add to calendar' })), false);
  assert.equal(isAddButton(el({ title: 'add to list card', 'aria-pressed': 'true' })), false);
  assert.equal(isAddButton(el({ 'data-testid': 'merchantOfferListRemoveButton' })), false);
  assert.equal(isAddButton(el({ href: 'https://pieventscapture.americanexpress.com/x' }, 'Add a Member')), false);
  assert.equal(isAddButton(el({}, 'Add a Member')), false);
  assert.equal(isAddButton(el({ 'data-testid': 'merchantOfferDetailsLink' }, 'View Details')), false);
});
