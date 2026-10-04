// DOM heuristics for reading Amex Offers and transfer-bonus pages.
//
// Amex doesn't publish its markup and changes it without notice, so nothing
// here depends on class names. Instead it anchors on visible text that the
// page must show to humans ("Expires 12/31/26", "Add to Card", "30% bonus").
//
// Read-only: these functions never read cookies, storage, or network data.
// Exposed as globalThis.AmexScrape so the dev/ mock pages can test them.
(() => {
  // Expiry wording varies: "Expires 12/31/26", "Exp. 12/31", "Expires Dec 31, 2026",
  // "Expires in 5 days", "Ends tomorrow".
  const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';
  const EXPIRES_RE = new RegExp(
    String.raw`\b(?:exp(?:ires?|iring|iration)?|ends?|valid\s+(?:thru|through|until))\b\.?[:\s]*(?:on\s+)?` +
      String.raw`(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|(?:${MONTHS})[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?|in\s+\d+\s+days?|today|tomorrow)`,
    'i'
  );
  const REWARD_RE = /(\$\s?\d|\d\s?%|\bpoints?\b|\bpts\b|\bback\b|\bearn\b|\bspend\b|\bcredit\b)/i;
  // "Add to Card", "Add Offer", "+ Add", "Enroll", aria-label "Add Starbucks offer to card"…
  const ADD_LABEL_RE = /\badd\b|\benroll\b|\bactivate\b/i;
  // …but not "Added", "Add a card", "Add authorized user", "Add payment", "Add to calendar"…
  const NOT_ADD_RE = /\b(added|enrolled|activated|remove|address|additional|member|supplement\w*|apply|application|upgrade|employee|authorized|payment|bank|checking|savings|funds?|money)\b|\badd\s+(?:a\s+|an\s+|new\s+)?(?:card\b(?!\s*offer)|user|account|to\s+(?:calendar|wallet|apple|google))/i;
  // Amex's real offer button: <button data-testid="merchantOfferListAddButton" title="add to list card">
  const KNOWN_ADD_SELECTOR = '[data-testid*="OfferListAddButton" i], [data-testid*="offerAddButton" i], button[title="add to list card" i]';
  const ADDED_RE = /\badded\b|\benrolled\b|\bactivated\b|\bsaved to card\b/i;
  const NOISE_RE = /^(\+?\s*add( to card)?|add offer|enroll|added( to card)?|enrolled|terms( apply)?|view (details|terms)|see details|new|ending soon|limited time|offer|\+|remove|details|expired?)$/i;
  const MORE_RE = /^(view|show|load|see) more( offers)?$/i;
  const BONUS_RE = /(\d{1,3})\s?%\s*(?:(?:transfer\s*)?bonus|more\s+[\w\s®-]{0,40}?(?:points|miles))/i;
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'TEMPLATE', 'HEAD']);
  const CLICKABLE = 'button, [role="button"], a, [tabindex], [aria-label], [title], [data-testid]';

  const clean = (s) => String(s || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
  const visibleText = (el) => clean(el.innerText ?? el.textContent);
  // data-testid like "addToCardButton" → "add To Card Button"
  const splitCamel = (s) => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
  const label = (el) =>
    clean(
      [el.getAttribute('aria-label'), el.getAttribute('title'), splitCamel(el.getAttribute('data-testid')), el.textContent]
        .filter(Boolean)
        .join(' ')
    );

  function* elements(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => (SKIP_TAGS.has(n.tagName.toUpperCase()) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let n = walker.nextNode();
    while (n) {
      yield n;
      n = walker.nextNode();
    }
  }

  // True for links that would leave the page (only in-page "#" or no href is OK).
  function navigates(el) {
    const href = el.getAttribute && el.getAttribute('href');
    return !!href && !href.startsWith('#') && !/^javascript:/i.test(href);
  }

  function isAddButton(el) {
    if (!el || !el.isConnected) return false;
    if (navigates(el)) return false;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    if (el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-checked') === 'true') return false;
    const l = label(el);
    return l.length > 0 && l.length < 120 && ADD_LABEL_RE.test(l) && !NOT_ADD_RE.test(l);
  }

  // Innermost clickable elements whose label says "add". Wrappers that merely
  // contain such a button are dropped so each offer yields one button.
  function findAddButtons(root = document.body) {
    // When Amex's own offer button exists anywhere on the page, trust only that.
    const known = document.querySelector(KNOWN_ADD_SELECTOR);
    const pool = known ? root.querySelectorAll(KNOWN_ADD_SELECTOR) : root.querySelectorAll(CLICKABLE);
    const hits = [...pool].filter(isAddButton);
    return hits.filter((el) => !hits.some((o) => o !== el && el.contains(o)));
  }

  function findMoreButton(root = document.body) {
    return [...root.querySelectorAll('button, [role="button"]')].find(
      (el) => !navigates(el) && MORE_RE.test(clean(el.textContent))
    );
  }

  // Grow from `start` to the largest ancestor that still holds only one offer.
  function growTile(start, root, isSecondOffer) {
    let node = start;
    while (node.parentElement && node !== root) {
      const p = node.parentElement;
      if ((p.textContent || '').length > 1500 || isSecondOffer(p)) break;
      node = p;
    }
    return node;
  }

  // Offer tiles are found two independent ways and merged:
  //   1. around each "Add" button (largest ancestor with exactly one add button)
  //   2. around each expiry date (largest ancestor with exactly one expiry)
  // so the page still works if either the date or the button wording changes.
  function findOfferTiles(root = document.body) {
    const buttons = findAddButtons(root);
    const byButton = buttons
      .map((b) => growTile(b, root, (p) => buttons.filter((o) => p.contains(o)).length > 1))
      .filter((t) => REWARD_RE.test(t.textContent || ''));

    const leaves = [];
    for (const el of elements(root)) {
      const t = el.textContent || '';
      if (t.length > 200 || !EXPIRES_RE.test(t)) continue;
      if ([...el.children].some((c) => EXPIRES_RE.test(c.textContent || ''))) continue;
      leaves.push(el);
    }
    // Count expiry elements, not regex hits on textContent: adjacent elements
    // run together there ("…$30 backExpires 10/20/26"), hiding word boundaries.
    const byExpiry = leaves.map((leaf) =>
      growTile(leaf, root, (p) => leaves.filter((l) => p.contains(l)).length > 1 || buttons.filter((o) => p.contains(o)).length > 1)
    );

    const tiles = [...new Set(byButton)];
    for (const t of byExpiry) {
      if (!tiles.some((x) => x === t || x.contains(t) || t.contains(x))) tiles.push(t);
    }
    return tiles;
  }

  function toIsoDate(mdy) {
    if (!mdy) return null;
    const [m, d, yRaw] = mdy.split('/').map(Number);
    const y = yRaw < 100 ? 2000 + yRaw : yRaw;
    if (!m || !d || !y) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const isoOf = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  // Converts any supported expiry wording to YYYY-MM-DD (null if unknown).
  function parseExpiry(text, now = new Date()) {
    const m = String(text || '').match(EXPIRES_RE);
    if (!m) return null;
    const v = m[1].toLowerCase();
    const addDays = (n) => isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n));
    if (v === 'today') return addDays(0);
    if (v === 'tomorrow') return addDays(1);
    const inDays = v.match(/in\s+(\d+)\s+days?/);
    if (inDays) return addDays(Number(inDays[1]));
    // Dates without a year roll forward to the next occurrence.
    const withYear = (mo, d, y) => {
      if (y) return isoOf(new Date(y < 100 ? 2000 + y : y, mo, d));
      const dt = new Date(now.getFullYear(), mo, d);
      if (dt < new Date(now.getFullYear(), now.getMonth(), now.getDate())) dt.setFullYear(dt.getFullYear() + 1);
      return isoOf(dt);
    };
    const slash = v.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (slash) return withYear(Number(slash[1]) - 1, Number(slash[2]), slash[3] ? Number(slash[3]) : null);
    const named = v.match(/^([a-z]+)\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
    if (named) {
      const mo = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(named[1].slice(0, 3));
      if (mo >= 0) return withYear(mo, Number(named[2]), named[3] ? Number(named[3]) : null);
    }
    return null;
  }

  function inAddedSection(tile) {
    let node = tile.parentElement;
    for (let i = 0; node && i < 6; i++, node = node.parentElement) {
      if (/^\s*added to card\b/i.test(node.textContent || '')) return true;
    }
    return false;
  }

  function parseTile(tile) {
    const full = visibleText(tile);
    const lines = full.split('\n').map(clean).filter(Boolean);
    const content = lines.filter((l) => !NOISE_RE.test(l) && !EXPIRES_RE.test(l));

    const description =
      content.find((l) => REWARD_RE.test(l) && l.length >= 12) || content.find((l) => REWARD_RE.test(l)) || '';

    const alt = clean(tile.querySelector('img[alt]')?.getAttribute('alt')).replace(/\s*logo$/i, '');
    const altOk = alt && alt.length <= 60 && !/^(image|offer|logo|merchant|card)$/i.test(alt);
    const merchant =
      (altOk && alt) ||
      content.find((l) => l !== description && !REWARD_RE.test(l) && l.length <= 60) ||
      content[0] ||
      'Unknown merchant';

    const hasAdd = findAddButtons(tile).length > 0;
    const status = hasAdd ? 'available' : ADDED_RE.test(full) || inAddedSection(tile) ? 'enrolled' : 'unknown';

    return {
      merchant,
      description,
      expires: parseExpiry(full),
      status,
      text: content.join(' | ').slice(0, 600),
    };
  }

  // Best-effort read of the selected card's name and last digits.
  function detectCard(root = document.body) {
    const re = /((?:[A-Z][\w®&'.-]*\s){0,5}(?:card|platinum|gold|green|blue|cash|delta|hilton|marriott)[\w®]*)[^\n\d]{0,12}?(?:ending(?: in)?|[-•·*]+)\s*(\d{4,5})\b/i;
    for (const el of root.querySelectorAll('header *, nav *, [aria-label*="card" i], [data-testid*="card" i], button, h1, h2')) {
      const t = clean(el.textContent);
      if (t.length > 90) continue;
      const m = t.match(re);
      if (m) return { label: clean(`${m[1]} ••${m[2]}`), last: m[2] };
    }
    return null;
  }

  function scanTransferBonuses(root = document.body) {
    const match = globalThis.AMEX_MATCH_PARTNERS;
    const hits = [];
    for (const el of elements(root)) {
      const t = el.textContent || '';
      if (t.length > 160 || !BONUS_RE.test(t)) continue;
      if ([...el.children].some((c) => BONUS_RE.test(c.textContent || ''))) continue;
      hits.push(el);
    }
    const found = new Map();
    for (const hit of hits) {
      let node = hit;
      let partners = match(node.textContent);
      while (partners.length === 0 && node.parentElement && node !== root) {
        const p = node.parentElement;
        if ((p.textContent || '').length > 1500) break;
        node = p;
        partners = match(node.textContent);
      }
      if (partners.length !== 1) continue; // ambiguous or none — skip rather than guess
      for (let i = 0; i < 3 && node.parentElement && node !== root; i++) {
        const p = node.parentElement;
        if ((p.textContent || '').length > 500 || match(p.textContent).length !== 1 || findAddButtons(p).length) break;
        node = p;
      }
      const text = clean(node.innerText ?? node.textContent);
      const bonusPct = Number((hit.textContent.match(BONUS_RE) || [])[1]);
      const endM = text.match(/(?:ends?|through|until|expires?|valid through)\s*(?:on\s*)?(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      const prev = found.get(partners[0]);
      if (!prev || bonusPct > prev.bonusPct) {
        found.set(partners[0], {
          partnerId: partners[0],
          bonusPct,
          endDate: endM ? toIsoDate(endM[1]) : null,
          text: text.slice(0, 300),
        });
      }
    }
    return [...found.values()];
  }

  // Structural report for debugging on the real page. Contains offer wording
  // and button labels only; long digit runs are masked so no card or account
  // numbers can leak if you share it.
  function diagnose(root = document.body) {
    const mask = (t) => clean(t).replace(/(?<![$\d,.])\d{4,}(?![\d,])/g, '####').slice(0, 160);
    const describe = (el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || undefined,
      ariaLabel: el.getAttribute('aria-label') ? mask(el.getAttribute('aria-label')) : undefined,
      title: el.getAttribute('title') ? mask(el.getAttribute('title')) : undefined,
      testid: el.getAttribute('data-testid') || undefined,
      ariaPressed: el.getAttribute('aria-pressed') || undefined,
      text: mask(el.textContent).slice(0, 60),
    });
    const clickables = [...root.querySelectorAll(CLICKABLE)];
    const labels = new Map();
    for (const el of clickables) {
      const l = mask(label(el)).slice(0, 70);
      if (l) labels.set(l, (labels.get(l) || 0) + 1);
    }
    const expiryLike = new Set();
    for (const el of elements(root)) {
      if (el.children.length) continue;
      const t = el.textContent || '';
      if (t.length < 80 && /\b(exp|expires?|ends?|valid|days? left)\b/i.test(t)) expiryLike.add(mask(t));
      if (expiryLike.size >= 12) break;
    }
    const addButtons = findAddButtons(root);
    const tiles = findOfferTiles(root);
    return {
      path: location.pathname,
      counts: {
        elements: root.querySelectorAll('*').length,
        clickables: clickables.length,
        addButtons: addButtons.length,
        tiles: tiles.length,
        iframes: document.querySelectorAll('iframe').length,
        openShadowRoots: [...root.querySelectorAll('*')].filter((e) => e.shadowRoot).length,
      },
      addButtonSamples: addButtons.slice(0, 5).map(describe),
      tileSamples: tiles.slice(0, 3).map((t) => ({ ...parseTile(t), text: mask(visibleText(t)).slice(0, 160) })),
      expiryLikeText: [...expiryLike],
      // Most common clickable labels — shows what the Add button is really called.
      topClickableLabels: [...labels.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25),
    };
  }

  // Stable id so re-scans update the same record. FNV-1a, hex.
  function offerId(cardKey, o) {
    const s = [cardKey, o.merchant, o.description, o.expires].join('|').toLowerCase();
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  globalThis.AmexScrape = {
    findOfferTiles,
    findAddButtons,
    findMoreButton,
    isAddButton,
    parseTile,
    detectCard,
    scanTransferBonuses,
    offerId,
    toIsoDate,
    parseExpiry,
    diagnose,
  };
})();
