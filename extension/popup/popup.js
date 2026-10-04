import { exportSnapshot, h, relTime, loadState } from '../lib/store.js';
import { buildDigest } from '../lib/digest.js';
import { searchOffers, spendAdvice, cartAdvice } from '../lib/shop.js';

const OFFERS_URL = 'https://global.americanexpress.com/offers';
const $ = (id) => document.getElementById(id);

let tabId = null;

function setStatus(text, isError = false) {
  $('status').textContent = text || '';
  $('status').classList.toggle('error', isError);
}

function setBusy(busy) {
  for (const id of ['btn-scan', 'btn-preview', 'btn-enroll', 'btn-transfers']) $(id).disabled = busy;
  $('btn-stop').hidden = !busy;
}

async function send(msg) {
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    return null; // no content script → not an Amex page (or tab needs a reload)
  }
}

async function run(type, { confirmText } = {}) {
  if (confirmText && !confirm(confirmText)) return;
  setBusy(true);
  $('preview').hidden = true;
  setStatus('Working… you can close this popup; progress shows on the Amex page.');
  const res = await send({ type, cardLabel: $('card-label').value });
  setBusy(false);
  if (!res) return setStatus('Lost connection to the Amex tab. Reload it and try again.', true);
  if (!res.ok) return setStatus(res.error, true);
  return res;
}

async function init() {
  const { lastScanAt } = await chrome.storage.local.get('lastScanAt');
  $('last-scan').textContent = `Last scan: ${relTime(lastScanAt)}`;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  const ping = tabId != null ? await send({ type: 'ping' }) : null;

  if (!ping?.ok) {
    $('not-amex').hidden = false;
    return;
  }
  $('controls').hidden = false;
  const { lastCardLabel } = await chrome.storage.local.get('lastCardLabel');
  $('card-label').value = ping.card?.label || lastCardLabel || '';
  $('offers-actions').hidden = ping.page !== 'offers';
  $('rewards-actions').hidden = ping.page !== 'rewards';
  $('wrong-page').hidden = ping.page !== 'other';
  if (ping.running) {
    setBusy(true);
    setStatus('A run is in progress on this tab.');
  }
}

$('card-label').addEventListener('change', (e) => chrome.storage.local.set({ lastCardLabel: e.target.value.trim() }));

$('open-offers').addEventListener('click', () => chrome.tabs.create({ url: OFFERS_URL }));

$('btn-scan').addEventListener('click', async () => {
  const res = await run('scan');
  if (res) setStatus(`Scanned ${res.found} offers on ${res.card.label} (${res.newOffers} new).`);
});

$('btn-preview').addEventListener('click', async () => {
  const res = await run('preview');
  if (!res) return;
  setStatus(`Would add ${res.plan.length} offer(s); ${res.skipped.length} on your skip list.`);
  const list = $('preview');
  list.replaceChildren(
    ...res.plan.map((o) => h('li', {}, h('b', {}, o.merchant), o.description)),
    ...res.skipped.map((o) => h('li', { class: 'skip' }, h('b', {}, `${o.merchant} (skipped)`), o.description))
  );
  list.hidden = res.plan.length + res.skipped.length === 0;
});

$('btn-enroll').addEventListener('click', async () => {
  const res = await run('enroll', {
    confirmText:
      'Add every available offer (except your skip list) to this card?\n\n' +
      'Clicks are paced a few seconds apart. Remember: many offers can only be on ONE card per account.',
  });
  if (res) setStatus(`Added ${res.added}${res.failed ? `, ${res.failed} didn't confirm` : ''}.${res.stopReason ? ` ${res.stopReason}` : ''}`);
});

$('btn-transfers').addEventListener('click', async () => {
  const res = await run('scanTransfers');
  if (!res) return;
  setStatus(
    res.found.length
      ? `Found: ${res.found.map((b) => `${b.bonusPct}% ${b.partnerId}`).join(', ')}`
      : 'No transfer bonuses found on this page. You can add them by hand in the dashboard.'
  );
});

$('btn-diagnose').addEventListener('click', async () => {
  const res = await send({ type: 'diagnose' });
  if (!res?.ok) return setStatus('Could not read the page. Reload the Amex tab and try again.', true);
  const text = JSON.stringify(res.report, null, 1);
  const box = $('report');
  box.value = text;
  box.hidden = false;
  box.select();
  try {
    await navigator.clipboard.writeText(text);
    setStatus(`Copied (${res.report.counts.tiles} offers, ${res.report.counts.addButtons} add buttons found). Paste it to Claude. Card/account numbers are masked.`);
  } catch {
    setStatus('Select the text below and copy it (⌘C).');
  }
});

$('btn-stop').addEventListener('click', () => send({ type: 'stop' }));
$('btn-dashboard').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') }));
$('btn-snapshot').addEventListener('click', async () => {
  await exportSnapshot();
  setStatus('Snapshot saved to Downloads. The weekly emailer picks up the newest one.');
});

chrome.storage.onChanged.addListener((changes) => {
  const s = changes.syncState?.newValue;
  if (s?.message) setStatus(s.message);
  if (s?.phase === 'done') setBusy(false);
});

// "What are you buying?" — search stored offers from any tab.
let activeOffers = [];
loadState().then((st) => { activeOffers = buildDigest(st).active; });

function renderShop() {
  const q = $('shop-q').value.trim();
  const cart = $('shop-cart').value;
  const list = $('shop-results');
  if (q.length < 2) { list.hidden = true; return; }
  const results = searchOffers(q, activeOffers).slice(0, 6);
  list.replaceChildren(...(results.length
    ? results.map(({ offer: o }) => {
      const ca = cart ? cartAdvice(o, cart) : null;
      return h('li', {},
        h('b', {}, o.merchant),
        o.description,
        o.status === 'available' ? h('div', { class: 'flag' }, 'Not added to your card yet') : null,
        h('div', { class: `tip ${ca ? ca.tone : ''}` }, ca ? ca.text : spendAdvice(o)));
    })
    : [h('li', {}, activeOffers.length ? 'No current offers match. Add it to “Planned purchases” in the dashboard to be told when one appears.' : 'No offers scanned yet — scan your Amex Offers page first.')]));
  list.hidden = false;
}
$('shop-q').addEventListener('input', renderShop);
$('shop-cart').addEventListener('input', renderShop);

init();
