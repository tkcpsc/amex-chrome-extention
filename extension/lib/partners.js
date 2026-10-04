import './partners-data.js';

export const PARTNERS = globalThis.AMEX_PARTNERS;
export const matchPartners = globalThis.AMEX_MATCH_PARTNERS;

// Partner list with the user's ratio/cpp overrides applied.
export function partnerConfig(settings = {}) {
  const overrides = settings.partnerOverrides || {};
  return PARTNERS.map((p) => {
    const o = overrides[p.id] || {};
    return {
      ...p,
      ratio: num(o.ratio) ?? p.ratio,
      cpp: num(o.cpp) ?? p.cpp,
    };
  });
}

// Cents of value per 1 MR point transferred, including any bonus.
export function effectiveCpp(partner, bonusPct = 0) {
  return partner.cpp * partner.ratio * (1 + (bonusPct || 0) / 100);
}

// One row per partner: current bonus (if active) and effective value.
export function partnerTable(settings = {}, transferBonuses = {}, now = new Date()) {
  const baseline = Number(settings.mrCpp) || 1;
  return partnerConfig(settings)
    .map((p) => {
      const b = transferBonuses[p.id];
      const active = b && b.bonusPct > 0 && !isPast(b.endDate, now);
      const bonusPct = active ? b.bonusPct : 0;
      const eff = effectiveCpp(p, bonusPct);
      return {
        partnerId: p.id,
        name: p.name,
        type: p.type,
        ratio: p.ratio,
        cpp: p.cpp,
        bonusPct,
        endDate: active ? b.endDate || null : null,
        source: active ? b.source : null,
        effectiveCpp: round(eff, 2),
        baseCpp: round(effectiveCpp(p, 0), 2),
        vsBaselinePct: Math.round((eff / baseline - 1) * 100),
      };
    })
    .sort((a, b) => b.effectiveCpp - a.effectiveCpp);
}

function isPast(isoDate, now) {
  if (!isoDate) return false;
  const end = new Date(`${isoDate}T23:59:59`);
  return end < now;
}

function num(v) {
  const n = Number(v);
  return v === '' || v == null || !Number.isFinite(n) || n <= 0 ? null : n;
}

function round(n, d) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
