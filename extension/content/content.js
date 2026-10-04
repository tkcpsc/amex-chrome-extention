// Runs on global.americanexpress.com pages. Dormant until the extension popup
// sends it a message — it never acts on its own.
//
// Security notes:
//  • Only accepts messages from this extension (sender.id check).
//  • Reads visible page text and clicks "Add to Card" buttons. Never touches
//    cookies, auth tokens, web storage, or Amex's internal APIs.
//  • Makes no network requests. Data goes to chrome.storage.local only.
(() => {
  if (globalThis.__amexOffersLoaded) return;
  globalThis.__amexOffersLoaded = true;

  const S = globalThis.AmexScrape;
  const DEFAULTS = { minDelaySec: 2, maxDelaySec: 5, maxPerRun: 100, skipMerchants: [] };
  const BLOCKED_RE = /verify your identity|security (check|verification)|unusual activity|temporarily (locked|unavailable)|too many requests|something went wrong/i;

  let running = false;
  let stopRequested = false;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const jitter = (minS, maxS) => (minS + Math.random() * Math.max(0, maxS - minS)) * 1000;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !msg || typeof msg.type !== 'string') return;
    handle(msg)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true; // async response
  });

  async function handle(msg) {
    switch (msg.type) {
      case 'ping':
        return { ok: true, page: pageKind(), card: S.detectCard(), running };
      case 'scan':
        return guarded(() => scanOffers(msg.cardLabel));
      case 'preview':
        return guarded(() => enroll({ cardLabel: msg.cardLabel, dryRun: true }));
      case 'enroll':
        return guarded(() => enroll({ cardLabel: msg.cardLabel, dryRun: false }));
      case 'scanTransfers':
        return guarded(() => scanTransfers());
      case 'diagnose':
        return { ok: true, report: S.diagnose() };
      case 'debugTiles':
        return { ok: true, tiles: S.findOfferTiles().slice(0, 15).map((t) => S.parseTile(t)) };
      case 'stop':
        stopRequested = true;
        return { ok: true };
      default:
        return { ok: false, error: 'Unknown command' };
    }
  }

  async function guarded(fn) {
    if (running) return { ok: false, error: 'Already running on this tab.' };
    running = true;
    stopRequested = false;
    try {
      return await fn();
    } finally {
      running = false;
      overlay.hide(4000);
    }
  }

  function pageKind() {
    const p = location.pathname.toLowerCase();
    if (p.includes('/offers')) return 'offers';
    if (p.includes('transfer') || p.includes('/rewards')) return 'rewards';
    return 'other';
  }

  function resolveCard(cardLabel) {
    const label = (cardLabel && cardLabel.trim()) || S.detectCard()?.label || 'My Amex card';
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'default';
    return { key, label };
  }

  async function progress(state) {
    const syncState = { ...state, updatedAt: new Date().toISOString() };
    overlay.show(syncState);
    await chrome.storage.local.set({ syncState });
  }

  // Click "View more"/"Load more" and scroll until the tile count stops growing.
  async function expandList() {
    let last = -1;
    let stable = 0;
    for (let i = 0; i < 40 && stable < 2 && !stopRequested; i++) {
      const more = S.findMoreButton();
      if (more) more.click();
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(jitter(0.8, 1.5));
      const n = S.findOfferTiles().length;
      stable = n === last && !more ? stable + 1 : 0;
      last = n;
      await progress({ phase: 'loading', message: `Loading offers… ${n} found` });
    }
    window.scrollTo(0, 0);
  }

  async function scanOffers(cardLabel, { expand = true, silent = false } = {}) {
    if (pageKind() !== 'offers') return { ok: false, error: 'Open the Amex Offers page first.' };
    if (expand) await expandList();
    const card = resolveCard(cardLabel);
    const infos = S.findOfferTiles().map((t) => S.parseTile(t)).filter((o) => o.description || o.expires);
    const saved = await saveOffers(card, infos);
    await scanTransfers({ replace: false, silent: true });
    if (!silent) await progress({ phase: 'done', message: `Scanned ${infos.length} offers on ${card.label}` });
    return { ok: true, card, found: infos.length, ...saved };
  }

  async function saveOffers(card, infos) {
    const now = new Date().toISOString();
    const { offers = {}, cards = {} } = await chrome.storage.local.get(['offers', 'cards']);
    let added = 0;
    for (const info of infos) {
      const id = S.offerId(card.key, info);
      const prev = offers[id];
      if (!prev) added++;
      const status = info.status === 'unknown' ? prev?.status || 'unknown' : info.status;
      offers[id] = {
        ...prev,
        id,
        cardKey: card.key,
        cardLabel: card.label,
        merchant: info.merchant,
        description: info.description,
        expires: info.expires,
        text: info.text,
        status,
        firstSeen: prev?.firstSeen || now,
        lastSeen: now,
        enrolledAt: status === 'enrolled' ? prev?.enrolledAt || now : null,
      };
    }
    // Forget offers that expired more than 30 days ago.
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    for (const [id, o] of Object.entries(offers)) {
      if (o.expires && o.expires < cutoff) delete offers[id];
    }
    cards[card.key] = { key: card.key, label: card.label, lastScanAt: now };
    await chrome.storage.local.set({ offers, cards, lastScanAt: now });
    return { newOffers: added };
  }

  async function markEnrolled(card, info) {
    const { offers = {} } = await chrome.storage.local.get('offers');
    const id = S.offerId(card.key, info);
    const now = new Date().toISOString();
    offers[id] = {
      ...offers[id],
      id,
      cardKey: card.key,
      cardLabel: card.label,
      merchant: info.merchant,
      description: info.description,
      expires: info.expires,
      text: info.text,
      status: 'enrolled',
      firstSeen: offers[id]?.firstSeen || now,
      lastSeen: now,
      enrolledAt: now,
    };
    await chrome.storage.local.set({ offers });
  }

  function looksBlocked() {
    if (pageKind() !== 'offers') return 'Left the Offers page.';
    for (const el of document.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="alert"]')) {
      const t = el.textContent || '';
      if (BLOCKED_RE.test(t)) return `Amex showed a message: "${t.trim().slice(0, 100)}"`;
    }
    return null;
  }

  // Close a simple "Offer added" confirmation dialog if one appears.
  function dismissDialogs() {
    for (const d of document.querySelectorAll('[role="dialog"]')) {
      if (BLOCKED_RE.test(d.textContent || '')) continue;
      const close = [...d.querySelectorAll('button')].find((b) =>
        /^(close|ok|got it|done|dismiss|×)$/i.test((b.getAttribute('aria-label') || b.textContent || '').trim())
      );
      close?.click();
    }
  }

  async function waitFor(pred, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (pred()) return true;
      await sleep(250);
    }
    return pred();
  }

  async function enroll({ cardLabel, dryRun }) {
    if (pageKind() !== 'offers') return { ok: false, error: 'Open the Amex Offers page first.' };
    const { settings: stored = {} } = await chrome.storage.local.get('settings');
    const settings = { ...DEFAULTS, ...stored };
    const skip = (settings.skipMerchants || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean);
    const isSkipped = (info) => skip.some((s) => info.merchant.toLowerCase().includes(s));
    const card = resolveCard(cardLabel);
    const maxPerRun = Math.max(1, Math.min(Number(settings.maxPerRun) || 100, 300));
    const minDelay = Math.max(1, Number(settings.minDelaySec) || 2);
    const maxDelay = Math.max(minDelay, Number(settings.maxDelaySec) || 5);

    await expandList();

    const candidates = () =>
      S.findOfferTiles()
        .map((tile) => ({ tile, info: S.parseTile(tile), btn: S.findAddButtons(tile)[0] }))
        .filter((x) => x.btn);

    if (candidates().length === 0) {
      const tiles = S.findOfferTiles().length;
      const error = tiles
        ? `Found ${tiles} offers but no "Add" buttons on them — maybe they're all added already. If not, click "Copy diagnostic report" and send it over.`
        : 'Couldn\'t recognize any offers on this page. Click "Copy diagnostic report" and send it over.';
      await progress({ phase: 'done', message: error });
      return { ok: false, error };
    }

    if (dryRun) {
      const list = candidates();
      const plan = list.filter((x) => !isSkipped(x.info)).map((x) => x.info);
      const skipped = list.filter((x) => isSkipped(x.info)).map((x) => x.info);
      await progress({ phase: 'done', message: `Preview: would add ${Math.min(plan.length, maxPerRun)} offers` });
      return { ok: true, card, plan: plan.slice(0, maxPerRun), skipped };
    }

    const attempted = new Set();
    let added = 0;
    let failed = 0;
    let consecutiveFails = 0;
    let stopReason = null;
    const total = candidates().filter((x) => !isSkipped(x.info)).length;

    while (added + failed < maxPerRun) {
      if (stopRequested) { stopReason = 'Stopped by you.'; break; }
      const blocked = looksBlocked();
      if (blocked) { stopReason = blocked; break; }

      const next = candidates().find((x) => !isSkipped(x.info) && !attempted.has(S.offerId(card.key, x.info)));
      if (!next) break;
      attempted.add(S.offerId(card.key, next.info));

      await progress({
        phase: 'enrolling',
        message: `Adding ${added + failed + 1} of ${Math.min(total, maxPerRun)}: ${next.info.merchant}`,
        added,
        failed,
        total,
      });

      if (next.btn.closest('a[href]:not([href^="#"])')) { stopReason = 'Refusing to click a link that leaves the page.'; break; }
      next.btn.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await sleep(jitter(0.3, 0.8));
      next.btn.click();

      const ok = await waitFor(() => !S.isAddButton(next.btn), 8000);
      dismissDialogs();
      if (ok) {
        added++;
        consecutiveFails = 0;
        await markEnrolled(card, next.info);
      } else {
        failed++;
        consecutiveFails++;
        if (consecutiveFails >= 3) { stopReason = 'Three adds in a row did not confirm — stopping to be safe.'; break; }
      }
      await sleep(jitter(minDelay, maxDelay));
    }

    // Refresh stored state from what's on the page now (no re-expansion).
    await scanOffers(cardLabel, { expand: false, silent: true });
    const message = `Added ${added} offer${added === 1 ? '' : 's'} to ${card.label}` +
      (failed ? `, ${failed} didn't confirm` : '') + (stopReason ? `. ${stopReason}` : '.');
    await progress({ phase: 'done', message, added, failed, total });
    return { ok: true, card, added, failed, stopReason };
  }

  // On the Transfer Points page (replace: true) the scan is authoritative, so
  // previously scraped bonuses that are gone get removed. Banners on the offers
  // page only add/update. Manual entries are always kept.
  async function scanTransfers({ replace = true, silent = false } = {}) {
    const found = S.scanTransferBonuses();
    const now = new Date().toISOString();
    const { transferBonuses = {} } = await chrome.storage.local.get('transferBonuses');
    if (replace) {
      for (const [id, b] of Object.entries(transferBonuses)) {
        if (b.source === 'scraped') delete transferBonuses[id];
      }
    }
    for (const b of found) {
      transferBonuses[b.partnerId] = { ...b, source: 'scraped', updatedAt: now };
    }
    await chrome.storage.local.set({ transferBonuses, ...(replace ? { lastTransferScanAt: now } : {}) });
    if (!silent) await progress({ phase: 'done', message: `Found ${found.length} transfer bonus${found.length === 1 ? '' : 'es'}` });
    return { ok: true, found };
  }

  // Small on-page status panel so progress is visible even after the popup closes.
  const overlay = (() => {
    let host;
    let msgEl;
    let hideTimer;
    function ensure() {
      if (host) return;
      host = document.createElement('div');
      host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;';
      const root = host.attachShadow({ mode: 'closed' });
      const box = document.createElement('div');
      box.style.cssText =
        'font:13px/1.4 -apple-system,system-ui,sans-serif;background:#111827;color:#f9fafb;padding:10px 12px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.3);display:flex;gap:10px;align-items:center;max-width:360px;';
      msgEl = document.createElement('span');
      const stop = document.createElement('button');
      stop.textContent = 'Stop';
      stop.style.cssText = 'background:#ef4444;color:#fff;border:0;border-radius:6px;padding:4px 10px;cursor:pointer;font:inherit;';
      stop.addEventListener('click', () => { stopRequested = true; });
      box.append(msgEl, stop);
      root.append(box);
      document.documentElement.append(host);
    }
    return {
      show(state) {
        ensure();
        clearTimeout(hideTimer);
        host.style.display = '';
        msgEl.textContent = `Amex Offers: ${state.message}`;
      },
      hide(afterMs) {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => { if (host) host.style.display = 'none'; }, afterMs);
      },
    };
  })();
})();
