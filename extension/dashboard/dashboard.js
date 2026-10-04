import { loadState, saveSettings, saveTransferBonuses, exportSnapshot, downloadJson, buildSnapshot, h, relTime } from '../lib/store.js';
import { buildDigest } from '../lib/digest.js';
import { CATEGORIES } from '../lib/offers.js';
import { PARTNERS } from '../lib/partners.js';
import { DEFAULT_SETTINGS } from '../lib/defaults.js';
import { TRIPS_CHECKED } from '../lib/trips.js';
import { searchOffers, spendAdvice, cartAdvice, groupsFor } from '../lib/shop.js';

const main = document.getElementById('main');
const TABS = ['week', 'month', 'shop', 'trips', 'all', 'transfers', 'settings'];
const filters = { q: '', card: '', status: '', category: '', sort: 'score' };
const tripFilters = { region: '', cabin: '', partner: '', affordable: false };
const shop = { q: '', cart: '' };
let state;

const usd = (n) => (n == null ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`);
const cents = (n) => `${n.toFixed(2)}¢`;
const fmt = (n) => n.toLocaleString('en-US');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const tab = () => (TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'week');

async function refresh() {
  state = await loadState();
  render();
}

function render() {
  const t = tab();
  for (const a of document.querySelectorAll('.tabs a')) a.classList.toggle('active', a.dataset.tab === t);
  document.getElementById('sync-line').textContent =
    `Offers scanned ${relTime(state.lastScanAt)} · transfer bonuses ${relTime(state.lastTransferScanAt)} · snapshot saved ${relTime(state.lastExportAt)}`;

  const digest = buildDigest(state, { period: t === 'month' ? 'month' : 'week' });
  const views = { week: periodView, month: periodView, shop: shopView, trips: tripsView, all: allView, transfers: transfersView, settings: settingsView };
  const offerTab = ['week', 'month', 'all'].includes(t);
  main.replaceChildren(...[offerTab ? banners(digest) : null, views[t](digest)].flat().filter(Boolean));
}

function banners(d) {
  if (!state.lastScanAt) {
    return h('div', { class: 'banner info' },
      h('p', {}, 'No offers yet. Log in to Amex, open the Offers page, then use the extension button → “Scan offers” or “Add all offers”.'),
      h('a', { class: 'btn primary', href: 'https://global.americanexpress.com/offers', target: '_blank', rel: 'noopener noreferrer' }, 'Open Amex Offers ↗'));
  }
  const out = [];
  if (d.staleDays >= 7) {
    out.push(h('div', { class: 'banner warn' }, h('p', {}, `Offers were last scanned ${d.staleDays} days ago — new offers have probably appeared. Run the extension on the Amex Offers page.`)));
  }
  if (state.lastExportAt == null || new Date(state.lastExportAt) < new Date(state.lastScanAt)) {
    out.push(h('div', { class: 'banner info' },
      h('p', {}, 'Your weekly email uses the latest saved snapshot, and there’s newer data than the last one.'),
      h('button', { class: 'primary', onclick: doExport }, 'Save snapshot')));
  }
  return out;
}

// ---------- This week / This month ----------

function periodView(d) {
  const label = d.period === 'month' ? 'this month' : 'this week';
  return [
    watchPanel(d),
    statTiles(d),
    h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', {}, `Best offers ${label}`), h('span', { class: 'muted' }, 'Ranked by return, value, urgency and your preferences')),
      offerList(d.best, { ranked: true })),
    h('div', { class: 'grid-2' },
      h('section', { class: 'panel compact' },
        h('div', { class: 'panel-head' }, h('h2', {}, `Expiring in ${d.days} days`), h('span', { class: 'muted' }, String(d.expiring.length))),
        offerList(d.expiring.slice(0, 12), { empty: 'Nothing expiring soon.' })),
      h('section', { class: 'panel compact' },
        h('div', { class: 'panel-head' }, h('h2', {}, `New ${label}`), h('span', { class: 'muted' }, String(d.fresh.length))),
        offerList(d.fresh.slice(0, 12), { empty: 'No new offers since your last scans.' }))),
    h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', {}, 'Trip ideas for your points'), h('a', { href: '#trips' }, 'All trip ideas →')),
      h('ol', { class: 'trip-mini' }, d.trips.slice(0, 3).map((t) =>
        h('li', {},
          h('div', {}, t.headline, t.bonusPct ? h('span', { class: 'chip accent' }, `+${t.bonusPct}% bonus`) : null),
          h('div', { class: 'muted' }, `${t.valueCpp}¢ per point`))))),
    h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', {}, 'Best points transfers'), h('a', { href: '#transfers' }, 'All partners →')),
      transferSummary(d)),
  ];
}

// ---------- Before you buy ----------

function shopOfferItem(o, reason, cart) {
  const advice = cart ? cartAdvice(o, cart) : null;
  return h('li', { class: 'shop-item' },
    h('div', { class: 'shop-head' },
      h('div', {}, h('b', {}, o.merchant), h('div', { class: 'desc' }, o.description || o.text)),
      h('div', { class: 'nums' }, h('div', { class: 'big' }, o.returnPct != null ? `${o.returnPct}% back` : usd(o.valueUsd)))),
    h('div', { class: 'chips' },
      o.status === 'available'
        ? h('span', { class: 'chip warn' }, 'Not added to your card — add it before you buy')
        : o.status === 'enrolled' ? h('span', { class: 'chip good' }, `Added${o.cardLabel ? ` to ${o.cardLabel}` : ''}`) : null,
      o.daysLeft != null ? h('span', { class: `chip ${o.daysLeft <= 7 ? 'warn' : ''}` }, `Expires in ${o.daysLeft}d`) : null,
      reason && reason !== 'merchant name' ? h('span', { class: 'chip accent' }, `Matched: ${reason}`) : null),
    h('p', { class: 'advice' }, spendAdvice(o)),
    advice ? h('p', { class: `cart-advice ${advice.tone}` }, advice.text) : null);
}

function shopView(d) {
  const results = searchOffers(shop.q, d.active);
  const groups = groupsFor(shop.q);
  const keepFocus = (sel, fn) => (e) => {
    fn(e.target.value);
    const pos = e.target.selectionStart;
    render();
    const el = main.querySelector(sel);
    el.focus();
    try { el.setSelectionRange(pos, pos); } catch {}
  };
  const q = h('input', { id: 'shop-q', type: 'search', placeholder: 'What are you buying? e.g. suitcase, laptop, flowers', value: shop.q, 'aria-label': 'What are you buying?' });
  q.addEventListener('input', keepFocus('#shop-q', (v) => { shop.q = v; }));
  const cart = h('input', { id: 'shop-cart', type: 'number', min: '0', step: '0.01', placeholder: 'Cart total (optional)', value: shop.cart, 'aria-label': 'Cart total in dollars' });
  cart.addEventListener('input', keepFocus('#shop-cart', (v) => { shop.cart = v; }));

  const addToWatch = async () => {
    const text = shop.q.trim();
    if (!text) return;
    const s = state.settings;
    const list = [...(s.watchlist || [])];
    if (!list.some((w) => w.text.toLowerCase() === text.toLowerCase())) {
      list.push({ id: `w${Date.now().toString(36)}`, text, addedAt: new Date().toISOString() });
      await saveSettings({ ...s, watchlist: list });
    }
    toast(`Watching for “${text}”`);
  };

  return [
    h('section', { class: 'panel' },
      h('h2', {}, 'Before you buy'),
      h('p', { class: 'muted' }, 'Search for what you’re about to buy — by product (“suitcase”) or store (“Dell”). You’ll see every matching offer on your cards and exactly how much to spend to get the most back.'),
      h('div', { class: 'filters' }, q, h('span', { class: 'inline' }, '$', cart)),
      shop.q.trim().length >= 2
        ? [
          h('p', { class: 'muted' },
            `${results.length} matching offer${results.length === 1 ? '' : 's'}`,
            groups.length ? ` · includes ${groups.map((g) => g.label).join(', ')} brands` : ''),
          results.length
            ? h('ul', { class: 'shop-list' }, results.map((r) => shopOfferItem(r.offer, r.reason, shop.cart)))
            : h('p', { class: 'empty' }, 'No current offers match. Add it to your planned purchases and you’ll be told when one appears.'),
          h('button', { class: 'primary', onclick: addToWatch }, `Watch for “${shop.q.trim()}” offers`),
        ]
        : null),
    watchManager(d),
  ];
}

function watchManager(d) {
  const s = state.settings;
  const input = h('input', { type: 'text', placeholder: 'e.g. suitcase, new laptop, flowers for mom', maxlength: '60', 'aria-label': 'Planned purchase' });
  const add = async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const list = [...(s.watchlist || [])];
    if (!list.some((w) => w.text.toLowerCase() === text.toLowerCase())) {
      list.push({ id: `w${Date.now().toString(36)}`, text, addedAt: new Date().toISOString() });
      await saveSettings({ ...s, watchlist: list });
    }
  };
  const remove = (id) => saveSettings({ ...s, watchlist: (s.watchlist || []).filter((w) => w.id !== id) });
  return h('section', { class: 'panel' },
    h('h2', {}, 'Planned purchases'),
    h('p', { class: 'muted' }, 'Add things you plan to buy. Matching offers are flagged on “This week” and in the weekly email — so you find the $60-back-on-$300 suitcase offer before you buy, not after.'),
    h('form', { class: 'filters', onsubmit: add }, input, h('button', { class: 'primary', type: 'submit' }, 'Add')),
    d.watch.length
      ? h('ul', { class: 'watch-list' }, d.watch.map(({ item, matches }) => h('li', {},
        h('div', { class: 'watch-head' },
          h('b', {}, item.text),
          h('span', { class: `chip ${matches.length ? 'good' : ''}` }, matches.length ? `${matches.length} offer${matches.length === 1 ? '' : 's'}` : 'No offers yet'),
          h('button', { class: 'link', onclick: () => { shop.q = item.text; location.hash = '#shop'; render(); window.scrollTo(0, 0); } }, 'View'),
          h('button', { class: 'link danger', onclick: () => remove(item.id) }, 'Remove')),
        matches.length ? h('div', { class: 'muted' }, matches.slice(0, 4).map((m) => m.offer.merchant).join(' · ')) : null)))
      : h('p', { class: 'empty' }, 'Nothing on your list yet.'));
}

function watchPanel(d) {
  const hits = d.watch.filter((w) => w.matches.length);
  if (!d.watch.length) return null;
  return h('section', { class: 'panel watch-panel' },
    h('div', { class: 'panel-head' }, h('h2', {}, 'Offers for your planned purchases'), h('a', { href: '#shop' }, 'Manage →')),
    hits.length
      ? h('ul', { class: 'shop-list' }, hits.flatMap(({ item, matches }) => matches.slice(0, 3).map((m) =>
        shopOfferItem(m.offer, `${item.text}${m.reason !== 'merchant name' ? ` (${m.reason})` : ''}`, null))))
      : h('p', { class: 'empty' }, `No offers yet for: ${d.watch.map((w) => w.item.text).join(', ')}. You’ll see them here as soon as they appear.`));
}

// ---------- Trip ideas ----------

function tripsView(d) {
  const s = state.settings;
  const regions = [...new Set(d.trips.map((t) => t.region))];
  const partnerOpts = [...new Map(d.trips.map((t) => [t.partnerId, t.partnerName])).entries()];
  const trips = d.trips.filter((t) =>
    (!tripFilters.region || t.region === tripFilters.region) &&
    (!tripFilters.cabin || t.cabin === tripFilters.cabin) &&
    (!tripFilters.partner || t.partnerId === tripFilters.partner) &&
    (!tripFilters.affordable || t.affordable));
  const boosted = trips.filter((t) => t.bonusPct > 0);
  const rest = trips.filter((t) => !t.bonusPct);

  const select = (key, options) => {
    const el = h('select', { 'aria-label': key, onchange: (e) => { tripFilters[key] = e.target.value; render(); } },
      options.map(([v, l]) => h('option', { value: v }, l)));
    el.value = tripFilters[key];
    return el;
  };
  const balance = h('input', {
    type: 'number', min: '0', step: '1000', placeholder: 'e.g. 120000', value: s.mrBalance ? String(s.mrBalance) : '',
    'aria-label': 'Your Membership Rewards balance',
    onchange: async (e) => { await saveSettings({ ...s, mrBalance: Math.max(0, Number(e.target.value) || 0) }); toast('Balance saved'); },
  });

  return [
    h('section', { class: 'panel' },
      h('h2', {}, 'Trip ideas'),
      h('p', { class: 'muted' }, `Award flights you can book by transferring Amex Membership Rewards points. Prices are the lowest published “from” prices (checked ${TRIPS_CHECKED}) and include any transfer bonus the extension has found. Value compares a typical cash fare, minus taxes and fees, to the points used.`),
      h('p', { class: 'note' }, 'Always find award seats on the airline’s site before transferring — Amex transfers can’t be reversed, and seats at these prices are limited.'),
      h('div', { class: 'filters' },
        h('label', { class: 'inline' }, 'My points', balance),
        select('partner', [['', 'All transfer partners'], ...partnerOpts]),
        select('region', [['', 'All regions'], ...regions.map((r) => [r, r])]),
        select('cabin', [['', 'Any cabin'], ['first', 'First'], ['business', 'Business'], ['economy', 'Economy']]),
        h('label', { class: 'inline' },
          h('input', { type: 'checkbox', checked: tripFilters.affordable, disabled: !s.mrBalance, onchange: (e) => { tripFilters.affordable = e.target.checked; render(); } }),
          'Only trips I can book now'))),
    boosted.length
      ? h('section', {}, h('h2', { class: 'section-title' }, 'Boosted by current transfer bonuses'), h('div', { class: 'trips' }, boosted.map(tripCard)))
      : null,
    h('section', {},
      h('h2', { class: 'section-title' }, boosted.length ? 'More trip ideas' : 'Best trip ideas'),
      rest.length ? h('div', { class: 'trips' }, rest.map(tripCard)) : h('p', { class: 'empty' }, 'No trips match these filters.')),
  ];
}

function tripCard(t) {
  const stat = (label, ...value) => h('div', {}, h('dt', {}, label), h('dd', {}, ...value));
  const link = (href, text) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);
  const ratio = t.ratio === 1 ? '' : ` (1 Amex point = ${t.ratio} ${t.partnerName} points)`;
  return h('article', { class: `trip ${t.bonusPct ? 'boosted' : ''}` },
    h('div', { class: 'chips' },
      t.bonusPct ? h('span', { class: 'chip accent' }, `+${t.bonusPct}% transfer bonus${t.bonusEnds ? ` · ends ${t.bonusEnds}` : ''}`) : null,
      h('span', { class: 'chip' }, t.region),
      h('span', { class: 'chip' }, `${cap(t.cabinLabel)} · ${t.tripType}`),
      t.affordable === true ? h('span', { class: 'chip good' }, 'You have enough points') : null,
      t.affordable === false ? h('span', { class: 'chip warn' }, `Need ${fmt(t.shortBy)} more`) : null),
    h('h3', {}, cap(t.destination)),
    h('p', { class: 'headline' }, t.headline),
    h('dl', { class: 'trip-stats' },
      stat('Amex points', fmt(t.mrPoints), t.savedPoints ? h('s', { class: 'muted' }, fmt(t.mrPointsNoBonus)) : null),
      stat('Taxes & fees', `~${usd(t.feesUsd)}`),
      stat('Typical cash price', `~${usd(t.cashUsd)}`),
      stat('Value', `${t.valueCpp}¢/pt`)),
    h('details', {},
      h('summary', {}, 'Route details & how to book'),
      h('p', {}, h('b', {}, 'Route: '), t.route),
      h('p', {}, h('b', {}, 'Price: '), `from ${fmt(t.miles)} ${t.partnerName} points ${t.tripType}. ${t.milesNote}`),
      h('p', {}, h('b', {}, 'Fees: '), t.feesNote),
      h('ol', {},
        h('li', {}, 'Search for award seats on ', link(t.site, t.partnerName), '.'),
        h('li', {}, `When you find seats, transfer ${fmt(t.mrPoints)} Amex points to ${t.partnerName}${ratio} in Amex → Membership Rewards → Transfer Points (${t.transferTime || 'timing varies, from minutes to a few days'}).`),
        h('li', {}, 'Book right away — award seats can disappear.')),
      t.tips?.length ? h('ul', { class: 'tips' }, t.tips.map((x) => h('li', {}, x))) : null));
}

function statTiles(d) {
  const tile = (label, value) => h('div', { class: 'stat' }, h('div', { class: 'label' }, label), h('div', { class: 'value' }, value));
  return h('div', { class: 'stats' },
    tile('Active offers', String(d.stats.tracked)),
    tile('Added to card', String(d.stats.enrolled)),
    tile('Max value of added offers', usd(d.stats.potentialUsd)),
    tile(`Expiring in ${d.days} days`, String(d.stats.expiringCount)));
}

function offerList(offers, { ranked = false, empty = 'No offers yet.' } = {}) {
  if (!offers.length) return h('p', { class: 'empty' }, empty);
  return h('ol', { class: 'offers' }, offers.map((o, i) => offerRow(o, ranked ? i + 1 : null)));
}

function offerRow(o, rank) {
  const p = o.score.parts;
  const why = `Score ${o.score.total} = return ${p.return} + value ${p.value} + urgency ${p.urgency} + new ${p.new} + favorite ${p.favorite} + category ${p.category}`;
  const chips = [
    o.status === 'enrolled' ? h('span', { class: 'chip good' }, 'Added') : o.status === 'available' ? h('span', { class: 'chip warn' }, 'Not added') : null,
    o.cardLabel && h('span', { class: 'chip' }, o.cardLabel),
    h('span', { class: 'chip' }, o.category),
    o.daysLeft != null && h('span', { class: `chip ${o.daysLeft <= 7 ? 'warn' : ''}` }, o.daysLeft === 0 ? 'Expires today' : `Expires in ${o.daysLeft}d`),
    o.isNew && h('span', { class: 'chip accent' }, 'New'),
    o.favorite && h('span', { class: 'chip accent' }, '★ Favorite'),
    o.parsed.times > 1 && h('span', { class: 'chip' }, `Up to ${o.parsed.times}×`),
  ];
  return h('li', { class: 'offer' },
    rank != null ? h('div', {}, h('span', { class: 'score', title: why }, String(o.score.total))) : null,
    h('div', {},
      h('div', { class: 'merchant' }, o.merchant),
      h('div', { class: 'desc' }, o.description || o.text),
      h('div', { class: 'chips' }, chips)),
    h('div', { class: 'nums' },
      h('div', { class: 'big' }, o.returnPct != null ? `${o.returnPct}% back` : usd(o.valueUsd)),
      h('div', { class: 'muted' }, o.parsed.minSpend ? `on ${usd(o.parsed.minSpend)}` : o.valueUsd != null ? 'value' : '')));
}

function transferSummary(d) {
  const baseline = Number(d.settings.mrCpp) || 1;
  const rows = d.bonuses.length ? d.bonuses : d.transfers.slice(0, 5);
  const note = d.bonuses.length
    ? h('p', { class: 'muted' }, `Active bonuses, by value per Membership Rewards point. Your baseline: ${cents(baseline)} per point.`)
    : h('p', { class: 'muted' }, `No active transfer bonuses recorded${d.transferStaleDays == null ? ' (never scanned)' : ` (scanned ${d.transferStaleDays}d ago)`}. Highest-value partners at standard rates:`);
  return [note, partnerTableEl(rows, { compact: true, trips: d.trips })];
}

function showTripsFor(partnerId) {
  Object.assign(tripFilters, { region: '', cabin: '', affordable: false, partner: partnerId });
  location.hash = '#trips';
}

function tripsLink(trips, partnerId) {
  const n = trips.filter((t) => t.partnerId === partnerId).length;
  return n ? h('button', { class: 'link', onclick: () => showTripsFor(partnerId) }, `${n} trip idea${n === 1 ? '' : 's'} →`) : null;
}

function partnerTableEl(rows, { compact = false, editable = false, trips = null } = {}) {
  const head = ['Partner', 'Ratio', 'Partner pt value', 'Bonus', 'Value per MR pt', 'vs baseline', 'Ends'];
  return h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, head.map((c, i) => h('th', { class: i > 0 && i < 6 ? 'num' : '' }, c)))),
    h('tbody', {}, rows.map((r) => h('tr', { class: r.bonusPct > 0 ? 'hl' : '' },
      h('td', {}, r.name, compact ? null : h('div', { class: 'muted' }, r.type),
        trips ? h('div', {}, tripsLink(trips, r.partnerId)) : null),
      h('td', { class: 'num' }, editable ? numInput(r, 'ratio') : `1:${r.ratio}`),
      h('td', { class: 'num' }, editable ? numInput(r, 'cpp') : cents(r.cpp)),
      h('td', { class: 'num' }, r.bonusPct ? `+${r.bonusPct}%` : '—'),
      h('td', { class: 'num' }, h('b', {}, cents(r.effectiveCpp))),
      h('td', { class: 'num' }, `${r.vsBaselinePct > 0 ? '+' : ''}${r.vsBaselinePct}%`),
      h('td', { class: 'nowrap' }, r.endDate || (r.bonusPct ? 'unknown' : '—')))))));
}

function numInput(row, field) {
  return h('input', {
    type: 'number', step: '0.05', min: '0', value: String(row[field]), 'aria-label': `${row.name} ${field}`,
    onchange: async (e) => {
      const s = state.settings;
      const overrides = { ...(s.partnerOverrides || {}) };
      overrides[row.partnerId] = { ...(overrides[row.partnerId] || {}), [field]: Number(e.target.value) };
      await saveSettings({ ...s, partnerOverrides: overrides });
      toast('Saved');
    },
  });
}

// ---------- All offers ----------

function allView(d) {
  const cards = Object.values(state.cards);
  const q = filters.q.toLowerCase();
  let rows = d.all.filter((o) => !o.expired)
    .filter((o) => !q || `${o.merchant} ${o.description}`.toLowerCase().includes(q))
    .filter((o) => !filters.card || o.cardKey === filters.card)
    .filter((o) => !filters.status || o.status === filters.status)
    .filter((o) => !filters.category || o.category === filters.category);
  const sorters = {
    score: (a, b) => b.score.total - a.score.total,
    expires: (a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999),
    value: (a, b) => (b.maxValueUsd ?? 0) - (a.maxValueUsd ?? 0),
    return: (a, b) => (b.returnPct ?? -1) - (a.returnPct ?? -1),
    merchant: (a, b) => a.merchant.localeCompare(b.merchant),
  };
  rows = rows.sort(sorters[filters.sort]);

  const select = (key, options) => {
    const el = h('select', { 'aria-label': key, onchange: (e) => { filters[key] = e.target.value; render(); } },
      options.map(([v, l]) => h('option', { value: v }, l)));
    el.value = filters[key];
    return el;
  };
  const search = h('input', { type: 'search', placeholder: 'Search merchant or offer…', value: filters.q });
  search.addEventListener('input', (e) => {
    filters.q = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const again = main.querySelector('input[type="search"]');
    again.focus();
    again.setSelectionRange(pos, pos);
  });

  return h('section', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('h2', {}, 'All active offers'), h('span', { class: 'muted' }, `${rows.length} shown`)),
    h('div', { class: 'filters' },
      search,
      select('card', [['', 'All cards'], ...cards.map((c) => [c.key, c.label])]),
      select('status', [['', 'Any status'], ['enrolled', 'Added'], ['available', 'Not added'], ['unknown', 'Unknown']]),
      select('category', [['', 'All categories'], ...[...CATEGORIES, 'other'].map((c) => [c, c])]),
      select('sort', [['score', 'Sort: score'], ['expires', 'Sort: expiring soonest'], ['value', 'Sort: dollar value'], ['return', 'Sort: % return'], ['merchant', 'Sort: merchant']])),
    h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Score', 'Merchant', 'Offer', 'Return', 'Max value', 'Expires', 'Card', 'Status'].map((c, i) => h('th', { class: [0, 3, 4].includes(i) ? 'num' : '' }, c)))),
      h('tbody', {}, rows.map((o) => h('tr', {},
        h('td', { class: 'num', title: JSON.stringify(o.score.parts) }, String(o.score.total)),
        h('td', {}, o.merchant, o.hidden ? h('div', { class: 'muted' }, 'on skip list') : null),
        h('td', {}, o.description || o.text),
        h('td', { class: 'num' }, o.returnPct != null ? `${o.returnPct}%` : '—'),
        h('td', { class: 'num' }, usd(o.maxValueUsd)),
        h('td', {}, o.expires || '—'),
        h('td', {}, o.cardLabel || ''),
        h('td', {}, o.status === 'enrolled' ? 'Added' : o.status === 'available' ? 'Not added' : '?')))))));
}

// ---------- Transfers ----------

function transfersView(d) {
  const manual = Object.values(state.transferBonuses).filter((b) => b.source === 'manual');
  const partnerSel = h('select', { 'aria-label': 'Partner' }, PARTNERS.map((p) => h('option', { value: p.id }, p.name)));
  const pct = h('input', { type: 'number', min: '1', max: '200', placeholder: 'Bonus %', 'aria-label': 'Bonus percent' });
  const end = h('input', { type: 'date', 'aria-label': 'End date' });
  const add = async () => {
    const bonusPct = Number(pct.value);
    if (!(bonusPct > 0)) return toast('Enter a bonus %');
    const tb = { ...state.transferBonuses };
    tb[partnerSel.value] = { partnerId: partnerSel.value, bonusPct, endDate: end.value || null, source: 'manual', updatedAt: new Date().toISOString() };
    await saveTransferBonuses(tb);
    toast('Bonus added');
  };
  const remove = async (id) => {
    const tb = { ...state.transferBonuses };
    delete tb[id];
    await saveTransferBonuses(tb);
  };

  return [
    h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', {}, 'Transfer partners'), h('span', { class: 'muted' }, `Baseline: ${cents(Number(d.settings.mrCpp) || 1)} per MR point`)),
      h('p', { class: 'muted' }, 'Value per MR point = partner point value × ratio × (1 + bonus). Edit ratio and point value to match how you redeem — ratios occasionally change, so check the Amex transfer page before moving points.'),
      partnerTableEl(d.transfers, { editable: true, trips: d.trips })),
    h('section', { class: 'panel' },
      h('h2', {}, 'Add a transfer bonus by hand'),
      h('p', { class: 'muted' }, 'Use this when you see a bonus the scanner missed (open Membership Rewards → Transfer Points and click “Scan transfer bonuses” in the extension to read them automatically).'),
      h('div', { class: 'filters' }, partnerSel, pct, end, h('button', { class: 'primary', onclick: add }, 'Add bonus')),
      manual.length
        ? h('ul', {}, manual.map((b) => h('li', {}, `${PARTNERS.find((p) => p.id === b.partnerId)?.name}: +${b.bonusPct}%${b.endDate ? ` until ${b.endDate}` : ''} `, h('button', { class: 'link danger', onclick: () => remove(b.partnerId) }, 'remove'))))
        : null),
  ];
}

// ---------- Settings ----------

function settingsView() {
  const s = state.settings;
  const lines = (arr) => (arr || []).join('\n');
  const parseLines = (v) => v.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

  const f = {
    mrCpp: h('input', { type: 'number', step: '0.05', min: '0.1', value: String(s.mrCpp) }),
    topN: h('input', { type: 'number', min: '3', max: '50', value: String(s.topN) }),
    mrBalance: h('input', { type: 'number', min: '0', step: '1000', value: s.mrBalance ? String(s.mrBalance) : '', placeholder: 'optional' }),
    favorites: h('textarea', { value: lines(s.favorites), placeholder: 'starbucks\ndoordash\nhilton' }),
    skipMerchants: h('textarea', { value: lines(s.skipMerchants), placeholder: 'One merchant per line' }),
    minDelaySec: h('input', { type: 'number', min: '1', max: '30', value: String(s.minDelaySec) }),
    maxDelaySec: h('input', { type: 'number', min: '1', max: '60', value: String(s.maxDelaySec) }),
    maxPerRun: h('input', { type: 'number', min: '1', max: '300', value: String(s.maxPerRun) }),
  };
  const catBoxes = CATEGORIES.map((c) => h('label', {}, h('input', { type: 'checkbox', value: c, checked: (s.boostCategories || []).includes(c) }), c));

  const save = async (e) => {
    e.preventDefault();
    const next = {
      ...s,
      mrCpp: Number(f.mrCpp.value) || DEFAULT_SETTINGS.mrCpp,
      topN: Number(f.topN.value) || DEFAULT_SETTINGS.topN,
      mrBalance: Math.max(0, Number(f.mrBalance.value) || 0),
      favorites: parseLines(f.favorites.value),
      skipMerchants: parseLines(f.skipMerchants.value),
      boostCategories: catBoxes.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value),
      minDelaySec: Math.max(1, Number(f.minDelaySec.value) || 2),
      maxDelaySec: Math.max(1, Number(f.maxDelaySec.value) || 5),
      maxPerRun: Math.min(300, Math.max(1, Number(f.maxPerRun.value) || 100)),
    };
    if (next.maxDelaySec < next.minDelaySec) next.maxDelaySec = next.minDelaySec;
    await saveSettings(next);
    toast('Settings saved');
  };

  const importFile = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const snap = JSON.parse(await file.text());
      if (snap.app !== 'amex-offers') throw new Error('Not an Amex Offers snapshot');
      await chrome.storage.local.set({
        offers: snap.offers || {}, cards: snap.cards || {}, transferBonuses: snap.transferBonuses || {},
        settings: { ...DEFAULT_SETTINGS, ...(snap.settings || {}) }, lastScanAt: snap.lastScanAt || null, lastTransferScanAt: snap.lastTransferScanAt || null,
      });
      toast('Imported');
    } catch (err) {
      toast(`Import failed: ${err.message}`);
    }
  } });

  const clearAll = async () => {
    if (!confirm('Delete all stored offers, bonuses and settings from this browser?')) return;
    await chrome.storage.local.clear();
    toast('All data cleared');
  };

  return h('section', { class: 'panel' },
    h('h2', {}, 'Settings'),
    h('form', { class: 'form', onsubmit: save },
      h('div', { class: 'row' },
        h('label', {}, 'Value of 1 MR point (cents)', f.mrCpp, h('span', { class: 'hint' }, 'Used for points offers and as the transfer baseline. 1.0 is conservative.')),
        h('label', {}, 'Offers in “Best offers”', f.topN),
        h('label', {}, 'My Membership Rewards balance', f.mrBalance, h('span', { class: 'hint' }, 'Flags trip ideas you can book now.'))),
      h('label', {}, 'Favorite merchants (+25 score)', f.favorites, h('span', { class: 'hint' }, 'One per line. Partial names match, e.g. “hilton”.')),
      h('label', {}, 'Never add / hide these merchants', f.skipMerchants, h('span', { class: 'hint' }, 'Skipped by “Add all offers” — useful to keep an offer free for a different card.')),
      h('div', {}, h('div', {}, 'Boost categories (+10 score)'), h('div', { class: 'checks' }, catBoxes)),
      h('div', { class: 'row' },
        h('label', {}, 'Min pause between clicks (s)', f.minDelaySec),
        h('label', {}, 'Max pause between clicks (s)', f.maxDelaySec),
        h('label', {}, 'Max offers per run', f.maxPerRun)),
      h('div', {}, h('button', { class: 'primary', type: 'submit' }, 'Save settings'))),
    h('hr', { class: 'sep' }),
    h('h3', {}, 'Data'),
    h('p', { class: 'muted' }, 'Everything is stored only in this Chrome profile. Snapshots contain offer terms and card nicknames — no account numbers or login data.'),
    h('div', { class: 'filters' },
      h('button', { onclick: doExport }, 'Save snapshot for email'),
      h('button', { onclick: async () => downloadJson(buildSnapshot(await loadState()), 'amex-offers-backup.json') }, 'Download backup'),
      h('button', { onclick: () => importFile.click() }, 'Import backup'),
      importFile,
      h('button', { class: 'danger', onclick: clearAll }, 'Delete all data')));
}

// ---------- misc ----------

async function doExport() {
  await exportSnapshot();
  toast('Snapshot saved to Downloads');
}

let toastTimer;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2200);
}

document.getElementById('btn-export').addEventListener('click', doExport);
window.addEventListener('hashchange', render);
chrome.storage.onChanged.addListener((changes) => {
  // Don't wipe a half-edited settings form when only sync progress changes.
  if (tab() === 'settings' && Object.keys(changes).every((k) => k === 'syncState' || k === 'settings')) {
    loadState().then((s) => { state = s; });
    return;
  }
  if (Object.keys(changes).every((k) => k === 'syncState')) return;
  refresh();
});

refresh();
