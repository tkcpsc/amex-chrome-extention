// Renders the weekly/monthly digest as an email (HTML + plain text).
// Every value from scraped data is HTML-escaped.
import { spendAdvice } from '../extension/lib/shop.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const usd = (n) => (n == null ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`);
const cents = (n) => `${n.toFixed(2)}¢`;
const OFFERS_URL = 'https://global.americanexpress.com/offers';

function offerLine(o) {
  const ret = o.returnPct != null ? `${o.returnPct}% back` : usd(o.valueUsd);
  const exp = o.daysLeft != null ? (o.daysLeft === 0 ? 'expires today' : `expires in ${o.daysLeft}d`) : '';
  const st = o.status === 'available' ? 'NOT ADDED' : o.status === 'enrolled' ? 'added' : '';
  return { ret, exp, st };
}

export function renderEmail(d) {
  const label = d.period === 'month' ? 'this month' : 'this week';
  const topBonus = d.bonuses[0];
  const subjectBits = [`${d.best.length} offers worth using ${label}`];
  if (d.expiring.length) subjectBits.push(`${d.expiring.length} expiring`);
  if (topBonus) subjectBits.push(`${topBonus.bonusPct}% bonus to ${topBonus.name}`);
  const subject = `Amex Offers: ${subjectBits.join(' · ')}`;

  const stale = d.staleDays == null
    ? 'No offers have been scanned yet.'
    : d.staleDays >= 7 ? `Your offers were last scanned ${d.staleDays} days ago — open Amex Offers and run the extension to pick up new ones.` : null;

  // ---------- plain text ----------
  const t = [];
  t.push(`AMEX OFFERS — best ${label}`, '');
  if (stale) t.push(`! ${stale}`, '');
  t.push(`Active offers: ${d.stats.tracked} · added: ${d.stats.enrolled} · max value of added offers: ${usd(d.stats.potentialUsd)}`, '');
  const watchHits = (d.watch || []).filter((w) => w.matches.length);
  if (watchHits.length) {
    t.push('OFFERS FOR YOUR PLANNED PURCHASES');
    for (const { item, matches } of watchHits) {
      t.push(`${item.text}:`);
      matches.slice(0, 3).forEach(({ offer: o }) => t.push(`- ${o.merchant}: ${o.description}${o.status === 'available' ? ' (NOT ADDED — add it before you buy)' : ''}`, `  ${spendAdvice(o)}`));
    }
    t.push('');
  }
  t.push('TOP OFFERS');
  d.best.forEach((o, i) => {
    const l = offerLine(o);
    t.push(`${i + 1}. ${o.merchant} — ${o.description}`, `   ${l.ret} · ${l.exp} · ${o.cardLabel || ''} ${l.st ? `· ${l.st}` : ''}`);
  });
  if (d.expiring.length) {
    t.push('', `EXPIRING IN ${d.days} DAYS`);
    d.expiring.slice(0, 10).forEach((o) => t.push(`- ${o.merchant}: ${o.description} (${offerLine(o).exp})`));
  }
  if (d.fresh.length) {
    t.push('', `NEW ${label.toUpperCase()}`);
    d.fresh.slice(0, 10).forEach((o) => t.push(`- ${o.merchant}: ${o.description}`));
  }
  t.push('', 'POINTS TRANSFERS');
  if (d.bonuses.length) d.bonuses.forEach((b) => t.push(`- ${b.name}: +${b.bonusPct}% → ${cents(b.effectiveCpp)}/pt${b.endDate ? ` (ends ${b.endDate})` : ''}`));
  else {
    t.push('No active transfer bonuses recorded. Best standard-rate partners:');
    d.transfers.slice(0, 3).forEach((b) => t.push(`- ${b.name}: ${cents(b.effectiveCpp)}/pt`));
  }
  const trips = (d.trips || []).slice(0, 3);
  if (trips.length) {
    t.push('', 'TRIP IDEAS FOR YOUR POINTS');
    trips.forEach((x) => t.push(`- ${x.headline} (~${usd(x.feesUsd)} taxes/fees, ${x.valueCpp}¢/pt)`));
    t.push('  Find award seats before transferring — Amex transfers can\'t be reversed.');
  }
  t.push('', `Open Amex Offers: ${OFFERS_URL}`);
  const text = t.join('\n');

  // ---------- HTML ----------
  const td = 'padding:8px 10px;border-top:1px solid #e5e7eb;vertical-align:top;';
  const th = 'padding:6px 10px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;';
  const section = (title, inner) =>
    `<h2 style="font-size:16px;margin:28px 0 8px;color:#111827;">${esc(title)}</h2>${inner}`;

  const offerTable = (list, ranked) =>
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;">${list
      .map((o, i) => {
        const l = offerLine(o);
        const badge = o.status === 'available'
          ? '<span style="background:#fdf3e2;color:#b45309;border-radius:999px;padding:1px 8px;font-size:12px;">Not added</span>'
          : o.status === 'enrolled' ? '<span style="background:#e7f6ef;color:#047857;border-radius:999px;padding:1px 8px;font-size:12px;">Added</span>' : '';
        return `<tr>
          ${ranked ? `<td style="${td}width:28px;color:#6b7280;font-weight:600;">${i + 1}</td>` : ''}
          <td style="${td}"><b>${esc(o.merchant)}</b><br><span style="color:#374151;">${esc(o.description)}</span><br>
            <span style="color:#6b7280;font-size:12px;">${esc(o.cardLabel || '')}${l.exp ? ` · ${esc(l.exp)}` : ''}</span> ${badge}</td>
          <td style="${td}text-align:right;white-space:nowrap;"><b>${esc(l.ret)}</b>${o.parsed.minSpend ? `<br><span style="color:#6b7280;font-size:12px;">on ${usd(o.parsed.minSpend)}</span>` : ''}</td>
        </tr>`;
      })
      .join('')}</table>`;

  const transferRows = (d.bonuses.length ? d.bonuses : d.transfers.slice(0, 3))
    .map((b) => `<tr><td style="${td}">${esc(b.name)}</td><td style="${td}text-align:right;">${b.bonusPct ? `+${b.bonusPct}%` : '—'}</td><td style="${td}text-align:right;"><b>${cents(b.effectiveCpp)}</b></td><td style="${td}">${esc(b.endDate || '')}</td></tr>`)
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f6f7f9;">
<div style="max-width:640px;margin:0 auto;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
  <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
    <h1 style="font-size:20px;margin:0 0 4px;">Amex Offers — best ${esc(label)}</h1>
    <p style="margin:0;color:#6b7280;font-size:13px;">${d.stats.tracked} active · ${d.stats.enrolled} added · ${usd(d.stats.potentialUsd)} max value of added offers</p>
    ${stale ? `<p style="background:#fdf3e2;color:#b45309;border-radius:8px;padding:10px 12px;margin:16px 0 0;">${esc(stale)}</p>` : ''}
    ${watchHits.length ? section('Offers for your planned purchases', watchHits.map(({ item, matches }) =>
      `<p style="margin:12px 0 4px;font-weight:600;">${esc(item.text)}</p>` +
      matches.slice(0, 3).map(({ offer: o }) => `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin:6px 0;">
        <b>${esc(o.merchant)}</b> — ${esc(o.description)}
        ${o.status === 'available' ? '<br><span style="color:#b45309;font-size:12px;">Not added to your card — add it before you buy</span>' : ''}
        <br><span style="color:#6b7280;font-size:13px;">${esc(spendAdvice(o))}</span></div>`).join('')).join('')) : ''}
    ${section('Top offers', d.best.length ? offerTable(d.best, true) : '<p style="color:#6b7280;">No offers yet.</p>')}
    ${d.expiring.length ? section(`Expiring in ${d.days} days`, offerTable(d.expiring.slice(0, 10), false)) : ''}
    ${d.fresh.length ? section(`New ${label}`, offerTable(d.fresh.slice(0, 10), false)) : ''}
    ${section(d.bonuses.length ? 'Transfer bonuses' : 'Best transfer partners (no active bonuses)',
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;">
        <tr><th style="${th}">Partner</th><th style="${th}text-align:right;">Bonus</th><th style="${th}text-align:right;">Value / MR pt</th><th style="${th}">Ends</th></tr>${transferRows}</table>`)}
    ${trips.length ? section('Trip ideas for your points', `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;">${trips
      .map((x) => `<tr><td style="${td}">${x.bonusPct ? `<span style="background:#e6f1fb;color:#006fcf;border-radius:999px;padding:1px 8px;font-size:12px;">+${x.bonusPct}% bonus</span><br>` : ''}${esc(x.headline)}<br><span style="color:#6b7280;font-size:12px;">${esc(x.route)} · ~${usd(x.feesUsd)} taxes/fees · from ${x.miles.toLocaleString('en-US')} ${esc(x.partnerName)} points</span></td><td style="${td}text-align:right;white-space:nowrap;"><b>${x.valueCpp}¢</b><br><span style="color:#6b7280;font-size:12px;">per point</span></td></tr>`)
      .join('')}</table><p style="color:#6b7280;font-size:12px;margin:8px 0 0;">Prices are “from” award prices; find seats before transferring — Amex transfers can’t be reversed.</p>`) : ''}
    <p style="margin:28px 0 0;"><a href="${OFFERS_URL}" style="background:#006fcf;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;font-weight:600;">Open Amex Offers</a></p>
  </div>
  <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:12px;">Sent by your local Amex Offers app. Rankings are estimates; check offer terms on Amex.</p>
</div></body></html>`;

  return { subject, text, html };
}

// Short version for a macOS notification.
export function renderNotification(d) {
  const top = d.best.slice(0, 3).map((o) => `${o.merchant} (${offerLine(o).ret})`).join(', ');
  const bonus = d.bonuses[0] ? ` · ${d.bonuses[0].bonusPct}% to ${d.bonuses[0].name}` : '';
  return {
    title: 'Amex Offers',
    message: (top ? `Top: ${top}${bonus}` : 'No offers yet — run the extension on Amex Offers.').slice(0, 220),
  };
}
