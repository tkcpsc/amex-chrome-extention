import { enrichOffers, daysSince } from './offers.js';
import { partnerTable } from './partners.js';
import { DEFAULT_SETTINGS } from './defaults.js';
import { tripIdeas } from './trips.js';
import { matchWatchlist } from './shop.js';

// Builds the "best this week / this month" view from stored state.
// Used by the dashboard and by the weekly emailer, so both always agree.
export function buildDigest(state, { period = 'week', now = new Date() } = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
  const days = period === 'month' ? 31 : 7;
  const topN = Number(settings.topN) || 10;

  const all = enrichOffers(Object.values(state.offers || {}), settings, now);
  const active = all.filter((o) => !o.expired && !o.hidden);
  const byScore = (a, b) => b.score.total - a.score.total;

  const best = [...active].sort(byScore).slice(0, topN);
  const expiring = active
    .filter((o) => o.daysLeft != null && o.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft || byScore(a, b));
  const fresh = active.filter((o) => (daysSince(o.firstSeen, now) ?? 99) <= days).sort(byScore);

  const transfers = partnerTable(settings, state.transferBonuses || {}, now);
  const bonuses = transfers.filter((t) => t.bonusPct > 0);
  const trips = tripIdeas(settings, state.transferBonuses || {}, now);
  const watch = matchWatchlist(settings.watchlist, active);

  const enrolled = active.filter((o) => o.status === 'enrolled');
  const stats = {
    tracked: active.length,
    enrolled: enrolled.length,
    available: active.filter((o) => o.status === 'available').length,
    potentialUsd: Math.round(enrolled.reduce((s, o) => s + (o.maxValueUsd || 0), 0)),
    expiringCount: expiring.length,
  };

  return {
    period,
    days,
    generatedAt: now.toISOString(),
    staleDays: daysSince(state.lastScanAt, now),
    transferStaleDays: daysSince(state.lastTransferScanAt, now),
    settings,
    all,
    active,
    best,
    expiring,
    fresh,
    transfers,
    bonuses,
    trips,
    watch,
    stats,
  };
}
