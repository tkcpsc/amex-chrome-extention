import { DEFAULT_SETTINGS } from './defaults.js';

const KEYS = ['offers', 'cards', 'transferBonuses', 'settings', 'lastScanAt', 'lastTransferScanAt', 'lastExportAt', 'syncState'];

export async function loadState() {
  const s = await chrome.storage.local.get(KEYS);
  return {
    offers: s.offers || {},
    cards: s.cards || {},
    transferBonuses: s.transferBonuses || {},
    settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
    lastScanAt: s.lastScanAt || null,
    lastTransferScanAt: s.lastTransferScanAt || null,
    lastExportAt: s.lastExportAt || null,
    syncState: s.syncState || null,
  };
}

export const saveSettings = (settings) => chrome.storage.local.set({ settings });
export const saveTransferBonuses = (transferBonuses) => chrome.storage.local.set({ transferBonuses });

// What the weekly emailer reads. Deliberately minimal: offer terms, card
// nicknames and bonuses — no account numbers, balances, or session data.
export function buildSnapshot(state) {
  const offers = {};
  for (const [id, o] of Object.entries(state.offers)) {
    offers[id] = {
      id,
      cardKey: o.cardKey,
      cardLabel: o.cardLabel,
      merchant: o.merchant,
      description: o.description,
      expires: o.expires,
      text: o.text,
      status: o.status,
      firstSeen: o.firstSeen,
      enrolledAt: o.enrolledAt,
    };
  }
  return {
    app: 'amex-offers',
    version: 1,
    exportedAt: new Date().toISOString(),
    lastScanAt: state.lastScanAt,
    lastTransferScanAt: state.lastTransferScanAt,
    cards: state.cards,
    offers,
    transferBonuses: state.transferBonuses,
    settings: state.settings,
  };
}

export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportSnapshot() {
  const state = await loadState();
  const date = new Date().toISOString().slice(0, 10);
  downloadJson(buildSnapshot(state), `amex-offers-snapshot-${date}.json`);
  await chrome.storage.local.set({ lastExportAt: new Date().toISOString() });
}

// Tiny DOM builder. Text is always set via textContent — scraped strings are
// untrusted and must never reach innerHTML.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'value' || k === 'checked') el[k] = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function relTime(iso) {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
