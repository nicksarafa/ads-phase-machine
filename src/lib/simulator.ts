import { GENE_SPACE, type Ad, type GeneKey, type Genes } from "./types";

/**
 * The simulated ad platform.
 *
 * This is the part of the demo that has to be honest: if performance were pure
 * noise, the loop would look like it was learning while doing nothing. So the
 * simulator holds a hidden preference vector over the gene space — a fixed
 * "market truth" the machine never sees. Ads that happen to match it earn a
 * higher click-through and conversion rate, the evaluate phase measures that
 * lift, and the evolve phase exploits it. Progress across generations is
 * therefore real learning against a real (if synthetic) signal.
 *
 * Everything else in here is the boring realism: CPM auction pressure, creative
 * fatigue, binomial noise on small samples, and offer-specific economics.
 */

/** Deterministic PRNG so a demo can be replayed. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const MARKET_SEED = 0x5eed1a5;

/** Hidden truth: per gene value, a multiplier on CTR and on conversion rate. */
function buildMarket() {
  const rand = mulberry32(MARKET_SEED);
  const ctr: Record<string, number> = {};
  const cvr: Record<string, number> = {};
  for (const key of Object.keys(GENE_SPACE) as GeneKey[]) {
    for (const value of GENE_SPACE[key]) {
      const k = `${key}:${value}`;
      // Most values are near-neutral; a few are genuinely strong or weak.
      ctr[k] = 0.68 + rand() * 0.92; // 0.68 .. 1.60
      cvr[k] = 0.72 + rand() * 0.80; // 0.72 .. 1.52
    }
  }
  // Interaction effect: matching the offer to the audience matters more than
  // either gene alone. Teams buy team training; career-switchers do not.
  return { ctr, cvr };
}

const MARKET = buildMarket();

const OFFER_ECONOMICS: Record<
  string,
  { baseCvr: number; value: number; label: string }
> = {
  "free-lesson": { baseCvr: 0.092, value: 14, label: "Free lesson signup" },
  campus: { baseCvr: 0.061, value: 29, label: "Campus signup" },
  workshop: { baseCvr: 0.024, value: 149, label: "Workshop seat" },
  "team-training": { baseCvr: 0.0045, value: 2400, label: "Team training lead" },
};

const AUDIENCE_OFFER_FIT: Record<string, Record<string, number>> = {
  teams: { "team-training": 1.9, workshop: 0.9, "free-lesson": 0.7, campus: 0.7 },
  "agency-owners": { "team-training": 1.4, workshop: 1.15, "free-lesson": 0.85, campus: 0.9 },
  founders: { workshop: 1.25, "team-training": 1.1, "free-lesson": 1.0, campus: 0.95 },
  operators: { workshop: 1.1, "free-lesson": 1.05, campus: 1.05, "team-training": 0.8 },
  marketers: { "free-lesson": 1.15, campus: 1.1, workshop: 1.0, "team-training": 0.7 },
  "career-switchers": { "free-lesson": 1.3, campus: 1.25, workshop: 0.9, "team-training": 0.35 },
};

function geneMultiplier(genes: Genes, table: Record<string, number>): number {
  let m = 1;
  for (const key of Object.keys(GENE_SPACE) as GeneKey[]) {
    m *= table[`${key}:${genes[key]}`] ?? 1;
  }
  // Six multiplicative terms swing far too hard; compress toward the mean so a
  // "perfect" ad is roughly 2.5x a bad one rather than 20x.
  return Math.pow(m, 0.42);
}

/** Copy quality independent of strategy: length, specificity, numbers. */
function copyQuality(ad: Ad): number {
  const { headline, primaryText } = ad.creative;
  let q = 1;
  const hl = headline.length;
  if (hl >= 18 && hl <= 42) q *= 1.08;
  if (hl > 60) q *= 0.88;
  const words = primaryText.trim().split(/\s+/).length;
  if (words >= 18 && words <= 60) q *= 1.06;
  if (words > 110) q *= 0.85;
  if (/\d/.test(headline) || /\d/.test(primaryText)) q *= 1.07;
  if (/\?/.test(headline)) q *= 1.03;
  if (/(revolutionary|game.?chang|unlock the power|supercharge)/i.test(primaryText))
    q *= 0.8;
  return q;
}

const BASE_CTR = 0.0092;
const BASE_CPM = 10.5;
const FATIGUE_IMPRESSIONS = 45000;

export interface WindowResult {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

/**
 * Simulate one 6-hour delivery window for a single ad.
 *
 * `budget` is the spend allocated to this ad for the window.
 */
export function simulateWindow(
  ad: Ad,
  budget: number,
  windowIndex: number,
): WindowResult {
  if (budget <= 0) {
    return { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
  }

  const rand = mulberry32(hashString(`${ad.id}:${windowIndex}`));

  const ctrMult = geneMultiplier(ad.genes, MARKET.ctr) * copyQuality(ad);
  const cvrMult = geneMultiplier(ad.genes, MARKET.cvr);

  // Creative fatigue: the more this exact ad has been shown, the less it works.
  const fatigue = 1 / (1 + ad.metrics.impressions / FATIGUE_IMPRESSIONS);

  // Meta rewards engaging creative with cheaper impressions, so CPM moves
  // inversely (and gently) with expected relevance.
  const relevance = Math.min(2.2, Math.max(0.45, ctrMult * fatigue));
  const cpm = (BASE_CPM / Math.pow(relevance, 0.55)) * (0.9 + rand() * 0.25);

  // Delivery is lumpy: not every dollar clears the auction every window.
  const deliveryRate = 0.82 + rand() * 0.2;
  const spend = Math.min(budget, budget * deliveryRate);
  const impressions = Math.max(0, Math.round((spend / cpm) * 1000));

  const ctr = BASE_CTR * ctrMult * fatigue * (0.82 + rand() * 0.4);
  const clicks = binomial(impressions, Math.min(0.2, ctr), rand);

  const offer = OFFER_ECONOMICS[ad.genes.offer] ?? OFFER_ECONOMICS["free-lesson"];
  const fit = AUDIENCE_OFFER_FIT[ad.genes.audience]?.[ad.genes.offer] ?? 1;
  const cvr = Math.min(0.5, offer.baseCvr * cvrMult * fit * (0.75 + rand() * 0.5));
  const conversions = binomial(clicks, cvr, rand);
  const revenue = conversions * offer.value * (0.9 + rand() * 0.2);

  return {
    spend: round2(spend),
    impressions,
    clicks,
    conversions,
    revenue: round2(revenue),
  };
}

/** Normal approximation for large n, exact draws for small n. */
function binomial(n: number, p: number, rand: () => number): number {
  if (n <= 0 || p <= 0) return 0;
  if (n < 40) {
    let hits = 0;
    for (let i = 0; i < n; i++) if (rand() < p) hits++;
    return hits;
  }
  const mean = n * p;
  const sd = Math.sqrt(n * p * (1 - p));
  const u1 = Math.max(1e-9, rand());
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, Math.min(n, Math.round(mean + z * sd)));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function offerLabel(offer: string) {
  return OFFER_ECONOMICS[offer]?.label ?? "Conversion";
}

export function offerValue(offer: string) {
  return OFFER_ECONOMICS[offer]?.value ?? 14;
}

/**
 * Exposed only for the "reveal market truth" debug view — the loop itself never
 * calls this, which is the whole point.
 */
export function revealMarketTruth() {
  const rows: { key: string; ctr: number; cvr: number }[] = [];
  for (const key of Object.keys(GENE_SPACE) as GeneKey[]) {
    for (const value of GENE_SPACE[key]) {
      const k = `${key}:${value}`;
      rows.push({ key: k, ctr: MARKET.ctr[k], cvr: MARKET.cvr[k] });
    }
  }
  return rows;
}
