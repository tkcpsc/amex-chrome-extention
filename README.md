# Amex Offers Optimizer (local-only)

Adds all your Amex Offers to your card, ranks the best offers and Membership Rewards transfer bonuses for the week or month, and sends you a weekly digest.

It's built to be **the most secure version of this app**:

- **No passwords handled.** You log in to Amex yourself. The extension only works inside your own logged-in tab.
- **No servers, no cloud, no database.** Data lives in `chrome.storage.local` in your Chrome profile.
- **Zero npm dependencies.** Plain JS, so there's no supply chain to trust.
- **Minimal extension permissions.** `storage`, plus host access to `global.americanexpress.com` only. No `cookies`, `tabs`, `webRequest` or `<all_urls>`.
- **Network locked down.** Extension pages run under a CSP with `connect-src 'none'`, so they *can't* make network requests. The content script makes none either.
- **Only reads what you can see.** It reads visible page text and clicks "Add to Card". It never reads cookies, tokens or web storage, and never calls Amex's internal APIs.
- **Email password in the macOS Keychain.** It's never stored in a file. SMTP is TLS-only (implicit TLS on 465, otherwise STARTTLS is required), with certificate verification on.
- **Minimal email content.** The email has merchant names, offer terms, dates and card nicknames. No account numbers or balances.

```
extension/            Chrome extension (Manifest V3, load unpacked)
  content/            runs on americanexpress.com: scan + "Add to Card" + transfer-bonus scan
  popup/              toolbar popup: scan / preview / add all / stop
  dashboard/          rankings UI (This week, This month, All offers, Transfers, Settings)
  lib/                shared logic: parsing, scoring, partners, digest (also used by the emailer)
emailer/              Node script: newest snapshot → weekly email and/or macOS notification
scripts/              Keychain + launchd setup
test/                 node:test unit tests
dev/                  mock Amex pages + chrome shim for testing without a real account
```

---

## 1. Install the extension

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `extension/` folder.
4. Pin "Amex Offers Optimizer" to the toolbar.

Load it from this folder. Don't install "offer adder" extensions from the store: they get full access to your banking session.

## 2. Weekly routine (about 2 minutes)

1. Log in at americanexpress.com and open **Offers**. Reload the tab once if you just installed the extension.
2. Click the extension:
   - **Preview what will be added**: a dry run that lists the offers and doesn't click anything.
   - **Add all offers to this card**: clicks "Add to Card" one at a time, with a random 2–5 s pause. Progress and a **Stop** button appear at the bottom right of the Amex page.
3. *(Optional)* Go to **Membership Rewards → Transfer Points** and click **Scan transfer bonuses**. If one is missed, add it by hand on the dashboard's Transfers tab.
4. Click **Save snapshot for email**. This saves `amex-offers-snapshot-YYYY-MM-DD.json` to Downloads for the weekly digest.

The run stops automatically if Amex shows an identity/security check or error dialog, if three adds in a row don't confirm, if you leave the Offers page, or when it reaches the per-run cap.

**Multiple cards:** many offers can be on only one card per account. Run it on the card you most want offers on first, then switch cards in Amex's card picker and run it again. Use **Settings → Never add** to keep specific merchants free for another card. If the card name isn't detected, type a nickname into the popup's **Card** field.

## 3. Dashboard

Open it with the popup's **Open dashboard** button.

- **This week / This month:** top-ranked offers, offers expiring in the window, new offers, and the best transfer bonuses.
- **All offers:** search, filter by card, status or category, and sort.
- **Transfers:** every MR partner with its ratio, your value per partner point, the active bonus, and **value per MR point**. Edit the ratio or value to match how you redeem.
- **Settings:** MR point value, favorite merchants (+25 score), boosted categories (+10), skip list, click pacing, backup/import, and delete all data.

**How offers are scored.** Hover the score to see the breakdown.

| Part | Points |
|---|---|
| Return % (reward ÷ minimum spend) | up to 60 |
| Dollar value (including "up to N times") | up to 30 |
| Expiring ≤3 days / ≤7 / ≤14 | 10 / 6 / 2 |
| New in the last 7 days | 3 |
| Favorite merchant | 25 |
| Boosted category | 10 |

**Transfer value:** `partner point value × ratio × (1 + bonus%)`. For example, Virgin Atlantic at 1.5¢ × 1 × 1.30 = **1.95¢ per MR point**. Partner ratios and valuations are estimates, so check the Amex transfer page before moving points.

### Before you buy (don't miss an offer)

- **Search by what you're buying** — on the dashboard's *Before you buy* tab, or from the search box at the top of the extension popup on any website. Type "suitcase" and it finds luggage brands (Away, Samsonite, Tumi…), "glasses" finds Warby Parker/LensCrafters, and so on (see `extension/lib/shop.js` to add brands).
- **Spend math on every match** — e.g. *"Spend at least $300 to get $60 back — you effectively pay $240 for $300. Spending $299.99 gets nothing."* Enter your cart total to get a verdict: *"Add $20 to reach $300 and get $60 back. You'd pay $240 net — $40 less than your current $280 cart."*
- **Planned purchases** — add things you intend to buy. Matching offers are pinned to the top of *This week* and the weekly email, with a warning if the offer isn't added to your card yet.

## 4. Weekly email (optional)

```bash
cp emailer/config.example.json emailer/config.json
```

Edit `emailer/config.json` with your `to`, `from` and `smtpUser`. For Gmail, keep `smtp.gmail.com` and port `465`. **Don't put a password in this file**; the script refuses to run if it finds one.

Store the SMTP **app password** in the Keychain. For Gmail, create one at myaccount.google.com/apppasswords; this needs 2-step verification. You type it into macOS's own prompt:

```bash
./scripts/setup-keychain.sh
```

Preview the email without sending it, using your newest snapshot (or fake data with `npm run digest:sample`):

```bash
npm run digest:preview
```

Then open `emailer/out/preview.html`. To send one now:

```bash
npm run digest
```

Schedule it weekly with launchd (Sundays 9:00 by default; `./scripts/install-schedule.sh 1 8` means Mondays at 8:00):

```bash
./scripts/install-schedule.sh
```

- If the Mac is asleep at that time, the job runs when it wakes.
- During the first 7 days of a month the digest switches to a **monthly** view. Override with `--period=week|month`.
- The first scheduled run may trigger a macOS prompt asking to let `node` access Downloads. Allow it, or set `snapshotDir` to another folder and move snapshots there.
- Logs are in `~/Library/Logs/amex-offers/digest.log`. Remove the schedule with `./scripts/uninstall-schedule.sh`.

**Want nothing to leave your Mac at all?** Set `"mode": "notify"` in `config.json` to get a macOS notification instead of an email, or use `"both"`. Notify mode needs no Keychain item.

## 5. Development & tests

```bash
npm test
```

There are 16 unit tests: offer parsing, scoring, digest windows, transfer math, email escaping, SMTP header injection, and refusal to send without TLS.

Mock pages exercise the real content script with a fake `chrome` API (`dev/chrome-shim.js`):

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open:
- `http://127.0.0.1:8765/dev/offers/index.html`: a mock offers page. In the console, run `await __send({type:'preview'})` or `await __send({type:'enroll'})`.
- `http://127.0.0.1:8765/dev/rewards/transfer.html`: a mock transfer page. Run `await __send({type:'scanTransfers'})`.
- `http://127.0.0.1:8765/dev/dashboard.html`: the dashboard, showing whatever the mock pages stored.

## Troubleshooting

Amex changes its site without notice, so the scraper avoids class names. It anchors on visible text instead ("Expires 12/31/26", "Add to Card", "30% bonus").

- **"Open the Amex Offers page first."** The URL must contain `/offers`. Reload the tab after installing or updating the extension.
- **Wrong merchant or description, or offers not found.** On the Offers page, open DevTools → Console, select the extension's context in the dropdown, and run `AmexScrape.findOfferTiles().map(AmexScrape.parseTile)`. Compare the output to the page and adjust the regexes at the top of `extension/content/scrape.js`.
- **"Three adds in a row did not confirm".** Amex's button may have changed. Check `isAddButton` / `ADD_LABEL_RE` in `scrape.js`.
- After editing extension code, click **Reload** on the extension in `chrome://extensions`, then reload the Amex tab.

## Caveats

- Amex's online terms prohibit automated access. This tool runs only when you start it, inside your own session, at human pace, but there's still a small risk of a security check or a forced logout. If that happens, it stops.
- Rankings and transfer values are estimates. Always check offer terms on Amex.
