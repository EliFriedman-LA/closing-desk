// Ported Lakeland rate engine for instant attorney quotes (Closing Desk).
// Mirrors the staff app: constants.js (STATE_RATES, NJ_TIERS), helpers.js
// (calcTiered / calcState / calcNJSimultaneous / calcNJRefinanceWithPrior),
// and rtfCalc.js (NJ RTF + GPF). IF LAKELAND UPDATES FILED RATES on the staff
// side, update this file to match — it is a standalone copy.

export const NJ_TIERS = [
  { label: "$0–$100k", limit: 100000, rate: 5.25 },
  { label: "$100k–$500k", limit: 500000, rate: 4.00 },
  { label: "$500k–$2M", limit: 2000000, rate: 2.75 },
  { label: "$2M+", limit: Infinity, rate: 2.25 },
];

export const STATE_RATES = {
  NJ: {
    types: ["Owner's", "Loan", "Simultaneous", "Refinance"],
    note: "NJLTIRB filed rates. Min $200. Owner's & Loan use the same Standard schedule. Simultaneous: higher premium in full + $25 for the lower. Refinance: prior owner's coverage deducted first.",
    simultaneousAddOn: 25,
    Standard: { tiers: NJ_TIERS, min: 200 },
    "Owner's": { tiers: NJ_TIERS, min: 200 },
    Loan: { tiers: NJ_TIERS, min: 200 },
    Simultaneous: { tiers: NJ_TIERS, min: 200 },
    Refinance: { tiers: [
      { label: "$0–$100k", limit: 100000, rate: 2.50 },
      { label: "$100k–$500k", limit: 500000, rate: 2.25 },
      { label: "$500k–$2M", limit: 2000000, rate: 2.00 },
      { label: "$2M+", limit: Infinity, rate: 1.50 },
    ], min: 200 },
  },
  NY: {
    types: ["Standard", "Refinance", "New Construction"],
    search: 100,
    note: "TIRSA 7th Revision (eff. 10/1/2024). $100 search & examination fee applies.",
    Standard: { tiers: [
      { label: "Up to $100k", limit: 100000, rate: 5.25 },
      { label: "$100k–$500k", limit: 500000, rate: 4.25 },
      { label: "$500k–$2M", limit: 2000000, rate: 2.75 },
      { label: "$2M+", limit: Infinity, rate: 2.00 },
    ], min: 200 },
    Refinance: { tiers: [
      { label: "Up to $100k", limit: 100000, rate: 2.75 },
      { label: "$100k–$500k", limit: 500000, rate: 2.50 },
      { label: "$500k–$2M", limit: 2000000, rate: 2.25 },
      { label: "$2M+", limit: Infinity, rate: 1.75 },
    ], min: 200 },
    "New Construction": { tiers: [
      { label: "All amounts", limit: Infinity, rate: 1.00 },
    ], min: 200 },
  },
  PA: {
    types: ["Sale", "Non-Sale (Reissue)", "Approved Attorney"],
    note: "TIRBOP filed rates. Sale/Non-Sale = Section 5.50. Approved Attorney = Section 5.51.",
    Sale: { tiers: [
      { label: "$0–$30k", limit: 30000, flat: 569 },
      { label: "$30k–$45k", limit: 45000, rate: 7.41 },
      { label: "$45k–$100k", limit: 100000, rate: 6.27 },
      { label: "$100k–$500k", limit: 500000, rate: 5.70 },
      { label: "$500k–$1M", limit: 1000000, rate: 4.56 },
      { label: "$1M–$2M", limit: 2000000, rate: 3.42 },
      { label: "$2M–$7M", limit: 7000000, rate: 2.28 },
      { label: "$7M–$30M", limit: 30000000, rate: 1.71 },
      { label: "$30M+", limit: Infinity, rate: 1.42 },
    ] },
    "Non-Sale (Reissue)": { tiers: [
      { label: "$0–$30k", limit: 30000, flat: 512 },
      { label: "$30k–$45k", limit: 45000, rate: 5.98 },
      { label: "$45k–$100k", limit: 100000, rate: 5.41 },
      { label: "$100k–$500k", limit: 500000, rate: 4.84 },
      { label: "$500k–$1M", limit: 1000000, rate: 4.27 },
      { label: "$1M–$2M", limit: 2000000, rate: 3.13 },
      { label: "$2M–$7M", limit: 7000000, rate: 1.99 },
      { label: "$7M–$30M", limit: 30000000, rate: 1.71 },
      { label: "$30M+", limit: Infinity, rate: 1.42 },
    ] },
    "Approved Attorney": { tiers: [
      { label: "$0–$30k", limit: 30000, flat: 142 },
      { label: "$30k–$100k", limit: 100000, rate: 3.70 },
      { label: "$100k–$500k", limit: 500000, rate: 3.13 },
      { label: "$500k–$1M", limit: 1000000, rate: 2.85 },
      { label: "$1M–$2M", limit: 2000000, rate: 2.56 },
      { label: "$2M–$7M", limit: 7000000, rate: 2.28 },
      { label: "$7M+", limit: Infinity, rate: 1.71 },
    ] },
  },
  OH: {
    types: ["Owner", "Loan", "Title Guaranty"],
    simultaneous: 100,
    note: "Stewart Title filed rates for Ohio.",
    Owner: { tiers: [
      { label: "Up to $150k", limit: 150000, rate: 5.75 },
      { label: "$150k–$250k", limit: 250000, rate: 4.50 },
      { label: "$250k–$500k", limit: 500000, rate: 3.50 },
      { label: "$500k–$10M", limit: 10000000, rate: 2.75 },
      { label: "$10M+", limit: Infinity, rate: 2.25 },
    ], min: 175 },
    Loan: { tiers: [
      { label: "Up to $150k", limit: 150000, rate: 4.00 },
      { label: "$150k–$250k", limit: 250000, rate: 3.25 },
      { label: "$250k–$500k", limit: 500000, rate: 2.50 },
      { label: "$500k–$10M", limit: 10000000, rate: 2.25 },
      { label: "$10M+", limit: Infinity, rate: 2.00 },
    ], min: 125 },
    "Title Guaranty": { tiers: [
      { label: "Up to $100k", limit: 100000, rate: 3.50 },
      { label: "$100k–$250k", limit: 250000, rate: 3.00 },
      { label: "$250k+", limit: Infinity, rate: 2.50 },
    ], min: 105 },
  },
};

// ---- core tiered premium (cumulative fill; rate is per $1,000, or flat) ----
function calcTiered(amt, cfg) {
  if (!amt || amt <= 0 || !cfg || !cfg.tiers) return { p: 0, rows: [] };
  let p = 0, prev = 0; const rows = [];
  for (const t of cfg.tiers) {
    if (amt <= prev) break;
    const top = Math.min(amt, t.limit);
    const span = top - prev;
    if (span <= 0) break;
    let tp = 0, rateDisplay = "";
    if (t.flat !== undefined) { tp = t.flat; rateDisplay = "flat"; }
    else if (t.rate !== undefined) { tp = (span / 1000) * t.rate; rateDisplay = t.rate; }
    rows.push({ label: t.label, tax: span, rate: rateDisplay, tp });
    p += tp; prev = t.limit;
    if (amt <= t.limit) break;
  }
  return { p: Math.max(p, cfg.min || 0), rows };
}

export function calcState(amt, state, policyType) {
  const stateCfg = STATE_RATES[state];
  if (!stateCfg) return { p: 0, rows: [], search: 0, simultaneous: 0, note: "" };
  const typeKey = policyType && stateCfg[policyType] ? policyType : stateCfg.types[0];
  const typeCfg = stateCfg[typeKey];
  if (!typeCfg) return { p: 0, rows: [], search: 0, simultaneous: 0, note: "" };
  const result = calcTiered(amt, typeCfg);
  return { ...result, search: stateCfg.search || 0, simultaneous: stateCfg.simultaneous || 0, note: stateCfg.note || "" };
}

export function calcNJSimultaneous(ownerAmt, loanAmt, policyType) {
  const typeKey = policyType && STATE_RATES.NJ[policyType] ? policyType : "Standard";
  const cfg = STATE_RATES.NJ[typeKey];
  const owner = calcTiered(ownerAmt, cfg);
  const loan = calcTiered(loanAmt, cfg);
  const addOn = STATE_RATES.NJ.simultaneousAddOn || 25;
  const ownerHigher = owner.p >= loan.p;
  if (!ownerAmt || ownerAmt <= 0) return { ownerPremium: 0, loanPremium: loan.p, higherSide: "loan", higherPremium: loan.p, lowerPremium: 0, addOn: 0, total: loan.p, ownerRows: [], loanRows: loan.rows };
  if (!loanAmt || loanAmt <= 0) return { ownerPremium: owner.p, loanPremium: 0, higherSide: "owner", higherPremium: owner.p, lowerPremium: 0, addOn: 0, total: owner.p, ownerRows: owner.rows, loanRows: [] };
  const higherPrem = ownerHigher ? owner.p : loan.p;
  const lowerPrem = ownerHigher ? loan.p : owner.p;
  return { ownerPremium: owner.p, loanPremium: loan.p, higherSide: ownerHigher ? "owner" : "loan", higherPremium: higherPrem, lowerPremium: lowerPrem, addOn, total: higherPrem + addOn, ownerRows: owner.rows, loanRows: loan.rows };
}

export function calcNJRefinanceWithPrior(newCoverage, priorCoverage) {
  const newAmt = Math.max(0, Number(newCoverage) || 0);
  const priorAmt = Math.max(0, Number(priorCoverage) || 0);
  const effective = Math.max(0, newAmt - priorAmt);
  const result = calcTiered(effective, STATE_RATES.NJ.Refinance);
  return { premium: result.p, effectiveCoverage: effective, rows: result.rows, deducted: Math.min(priorAmt, newAmt) };
}

// ---- NJ Realty Transfer Fee + Graduated Percent Fee (from rtfCalc.js) ----
const STANDARD_UNDER_350K = [{ from: 0, to: 150000, rate: 2.00 }, { from: 150000, to: 200000, rate: 3.35 }, { from: 200000, to: 350000, rate: 3.90 }];
const STANDARD_OVER_350K = [{ from: 0, to: 150000, rate: 2.90 }, { from: 150000, to: 200000, rate: 4.25 }, { from: 200000, to: 550000, rate: 4.80 }, { from: 550000, to: 850000, rate: 5.30 }, { from: 850000, to: 1000000, rate: 5.80 }, { from: 1000000, to: Infinity, rate: 6.05 }];
const REDUCED_UNDER_350K = [{ from: 0, to: 150000, rate: 0.50 }, { from: 150000, to: 350000, rate: 1.25 }];
const REDUCED_OVER_350K = [{ from: 0, to: 150000, rate: 1.40 }, { from: 150000, to: 550000, rate: 2.15 }, { from: 550000, to: 850000, rate: 2.65 }, { from: 850000, to: 1000000, rate: 3.15 }, { from: 1000000, to: Infinity, rate: 3.40 }];

export const SIMPLE_EXEMPTION_OPTIONS = [
  { value: "none", label: "Standard (full RTF)" },
  { value: "senior", label: "Partial — Senior / Blind / Disabled" },
  { value: "exempt", label: "Fully exempt" },
];
export const PROPERTY_CLASS_OPTIONS = [
  { value: "", label: "N/A (not subject to GPF)" },
  { value: "2", label: "Class 2 — Residential (most homes)" },
  { value: "3A", label: "Class 3A — Farm w/ residence" },
  { value: "4A", label: "Class 4A — Commercial" },
  { value: "4C", label: "Class 4C — Co-op units" },
];
function rtfGroup(v) { if (v === "exempt") return "exempt"; if (v === "senior" || v === "blind" || v === "disabled" || v === "low_mod_income") return "reduced"; return "standard"; }

export function calcRTF(consideration, exemptionType) {
  const amt = parseFloat(consideration) || 0;
  if (amt <= 0) return { amount: 0, breakdown: [], note: "Enter a price.", rateTable: "" };
  const g = rtfGroup(exemptionType);
  if (g === "exempt") return { amount: 0, breakdown: [], note: "Fully exempt — no RTF due.", rateTable: "Exempt" };
  const reduced = g === "reduced";
  const over = amt > 350000;
  let tiers, rateTable;
  if (over) { tiers = reduced ? REDUCED_OVER_350K : STANDARD_OVER_350K; rateTable = reduced ? "Reduced · Over $350K" : "Standard · Over $350K"; }
  else { tiers = reduced ? REDUCED_UNDER_350K : STANDARD_UNDER_350K; rateTable = reduced ? "Reduced · Up to $350K" : "Standard · Up to $350K"; }
  const breakdown = []; let total = 0;
  for (const tier of tiers) {
    if (amt <= tier.from) break;
    const top = Math.min(amt, tier.to);
    const units = (top - tier.from) / 500;
    const fee = units * tier.rate;
    breakdown.push({ from: tier.from, to: top, rate: tier.rate, units, fee });
    total += fee;
  }
  total = Math.round(total * 100) / 100;
  return { amount: total, breakdown, note: "", rateTable };
}

export function calcGPF(consideration, propertyClass) {
  const amt = parseFloat(consideration) || 0;
  if (amt <= 1000000) return { amount: 0, percentage: 0, note: "GPF applies only over $1,000,000.", bracketLabel: "" };
  if (!propertyClass) return { amount: 0, percentage: 0, note: "Pick a property class to compute GPF.", bracketLabel: "" };
  let pct, bracketLabel;
  if (amt <= 2000000) { pct = 0.010; bracketLabel = "Over $1M–$2M"; }
  else if (amt <= 2500000) { pct = 0.020; bracketLabel = "Over $2M–$2.5M"; }
  else if (amt <= 3000000) { pct = 0.025; bracketLabel = "Over $2.5M–$3M"; }
  else if (amt <= 3500000) { pct = 0.030; bracketLabel = "Over $3M–$3.5M"; }
  else { pct = 0.035; bracketLabel = "Over $3.5M"; }
  return { amount: Math.round(amt * pct * 100) / 100, percentage: pct, note: "", bracketLabel };
}

// ---- quote dispatcher: returns { premium, search, lines[] } ----
export function quotePremium(state, policyType, amounts) {
  amounts = amounts || {};
  const price = Number(amounts.price) || 0;
  const loan = Number(amounts.loan) || 0;
  const prior = Number(amounts.prior) || 0;
  const cfg = STATE_RATES[state];
  if (!cfg) return { premium: 0, search: 0, lines: [] };
  const type = (policyType && cfg[policyType]) ? policyType : cfg.types[0];

  if (state === "NJ" && type === "Simultaneous") {
    const s = calcNJSimultaneous(price, loan, "Standard");
    const lines = [
      { label: `Owner's premium (${money(price)})`, amount: s.ownerPremium },
      { label: `Loan premium (${money(loan)})`, amount: s.loanPremium },
      { label: `Simultaneous: higher in full + $${s.addOn} add-on`, amount: null },
    ];
    return { premium: s.total, search: 0, lines, detail: s };
  }
  if (state === "NJ" && type === "Refinance") {
    const r = calcNJRefinanceWithPrior(loan, prior);
    const label = `Refinance premium on ${money(r.effectiveCoverage)}` + (prior ? ` (after ${money(prior)} prior deducted)` : "");
    return { premium: r.premium, search: 0, lines: [{ label, amount: r.premium }], detail: r };
  }
  const usesLoan = /loan|refi|refinance|non-sale|reissue/i.test(type);
  const amt = usesLoan ? loan : price;
  const c = calcState(amt, state, type);
  const lines = [{ label: `${type} premium on ${money(amt)}`, amount: c.p }];
  return { premium: c.p, search: c.search || 0, lines };
}

export function money(n) {
  const x = Number(n) || 0;
  return x.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
