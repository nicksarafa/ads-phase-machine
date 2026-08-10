import {
  GENE_KEYS,
  type Ad,
  type GeneInsight,
  type GeneKey,
} from "./types";

/**
 * Turn the ad pool into per-gene performance indices.
 *
 * Indices are impression-weighted and shrunk toward 100 by sample size, so a
 * single lucky ad with 300 impressions cannot declare a winner. This is what
 * the evolve phase reads, and what the UI shows as "what the machine believes".
 */
export function computeInsights(ads: Ad[]): GeneInsight[] {
  const scored = ads.filter((a) => a.metrics.impressions > 0);
  if (scored.length < 2) return [];

  const totalImpr = scored.reduce((s, a) => s + a.metrics.impressions, 0);
  const totalClicks = scored.reduce((s, a) => s + a.metrics.clicks, 0);
  const totalSpend = scored.reduce((s, a) => s + a.metrics.spend, 0);
  const totalConv = scored.reduce((s, a) => s + a.metrics.conversions, 0);

  const poolCtr = totalImpr ? totalClicks / totalImpr : 0;
  const poolCpa = totalConv ? totalSpend / totalConv : 0;

  const out: GeneInsight[] = [];

  for (const key of GENE_KEYS) {
    const buckets = new Map<string, Ad[]>();
    for (const ad of scored) {
      const v = ad.genes[key];
      const arr = buckets.get(v) ?? [];
      arr.push(ad);
      buckets.set(v, arr);
    }

    for (const [value, group] of buckets) {
      const impr = group.reduce((s, a) => s + a.metrics.impressions, 0);
      const clicks = group.reduce((s, a) => s + a.metrics.clicks, 0);
      const spend = group.reduce((s, a) => s + a.metrics.spend, 0);
      const conv = group.reduce((s, a) => s + a.metrics.conversions, 0);
      if (impr === 0) continue;

      // Shrink toward the pool mean; k is the "prior impressions" weight.
      const kCtr = 5000;
      const shrunkCtr = (clicks + poolCtr * kCtr) / (impr + kCtr);
      const ctrIndex = poolCtr ? (shrunkCtr / poolCtr) * 100 : 100;

      let cpaIndex = 100;
      if (poolCpa > 0) {
        const kConv = 4;
        const shrunkCpa =
          (spend + poolCpa * kConv * 1) / Math.max(0.001, conv + kConv);
        // Lower CPA is better, so invert so >100 always means "good".
        cpaIndex = (poolCpa / shrunkCpa) * 100;
      }

      out.push({
        key,
        value,
        ctrIndex: Math.round(ctrIndex),
        cpaIndex: Math.round(cpaIndex),
        samples: group.length,
        impressions: impr,
      });
    }
  }

  return out.sort((a, b) => b.ctrIndex - a.ctrIndex);
}

/**
 * Composite score for a single ad. Blends efficiency (CPA), engagement (CTR)
 * and return (ROAS), then applies human feedback as a deliberate thumb on the
 * scale — the operator's opinion is an input, not a tiebreaker.
 */
export function scoreAd(ad: Ad, pool: Ad[]): number {
  const withData = pool.filter((a) => a.metrics.impressions > 0);
  if (ad.metrics.impressions === 0) return 0;

  const poolCtr = avg(withData.map((a) => a.metrics.ctr)) || 0.0001;
  const poolRoas = avg(withData.map((a) => a.metrics.roas)) || 0.0001;
  const cpas = withData.filter((a) => a.metrics.conversions > 0).map((a) => a.metrics.cpa);
  const poolCpa = avg(cpas) || 0;

  const ctrTerm = ad.metrics.ctr / poolCtr;
  const roasTerm = ad.metrics.roas / poolRoas;
  const cpaTerm =
    ad.metrics.conversions > 0 && poolCpa > 0 ? poolCpa / ad.metrics.cpa : 0.6;

  // Confidence penalty for thin data — a 400-impression ad has not earned a
  // verdict yet.
  const confidence = Math.min(1, ad.metrics.impressions / 6000);

  let score = (0.3 * ctrTerm + 0.35 * cpaTerm + 0.35 * roasTerm) * (0.55 + 0.45 * confidence);

  const votes = ad.feedback.reduce((s, f) => s + f.rating, 0);
  if (votes > 0) score *= 1 + Math.min(0.35, votes * 0.18);
  if (votes < 0) score *= Math.max(0.4, 1 + votes * 0.22);

  return Math.round(score * 1000) / 1000;
}

function avg(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** The gene values worth exploiting in the next generation. */
export function exploitPlan(
  insights: GeneInsight[],
): Partial<Record<GeneKey, string[]>> {
  const plan: Partial<Record<GeneKey, string[]>> = {};
  for (const key of GENE_KEYS) {
    const rows = insights
      .filter((i) => i.key === key && i.impressions > 2500)
      .sort((a, b) => b.ctrIndex + b.cpaIndex - (a.ctrIndex + a.cpaIndex));
    if (rows.length < 2) continue;
    const top = rows.filter((r) => r.ctrIndex >= 105 || r.cpaIndex >= 110);
    if (top.length) plan[key] = top.slice(0, 3).map((r) => r.value);
  }
  return plan;
}

/** Human-readable learnings, ordered by how confident we are. */
export function learningsFrom(
  insights: GeneInsight[],
  ads: Ad[],
): string[] {
  const out: string[] = [];

  // Rank by how far a lever sits from average on either metric, weighted by how
  // much delivery backs it up. CPA usually separates before CTR does, because
  // conversion differences between offers are larger than click differences.
  const strength = (i: GeneInsight) =>
    Math.max(Math.abs(i.ctrIndex - 100), Math.abs(i.cpaIndex - 100) * 0.7) *
    Math.log10(Math.max(10, i.impressions));

  const strong = insights
    .filter(
      (i) =>
        i.impressions > 3000 &&
        (i.ctrIndex >= 107 ||
          i.ctrIndex <= 93 ||
          i.cpaIndex >= 125 ||
          i.cpaIndex <= 75),
    )
    .sort((a, b) => strength(b) - strength(a))
    .slice(0, 5);

  for (const i of strong) {
    const clicks =
      i.ctrIndex >= 107 ? "earns more clicks" : i.ctrIndex <= 93 ? "earns fewer clicks" : null;
    const cost =
      i.cpaIndex >= 125
        ? "converts far more cheaply"
        : i.cpaIndex <= 75
          ? "converts far more expensively"
          : null;

    const verdict = [clicks, cost].filter(Boolean).join(" and ");
    out.push(
      `${i.key}=${i.value} ${verdict} than average (CTR index ${i.ctrIndex}, CPA index ${i.cpaIndex}, ${i.samples} ads / ${fmtInt(i.impressions)} impressions).`,
    );
  }

  const best = [...ads]
    .filter((a) => a.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  if (best) {
    out.push(
      `Best single ad so far: "${best.creative.headline}" — CTR ${(best.metrics.ctr * 100).toFixed(2)}%, CPA ${money(best.metrics.cpa)}, ROAS ${best.metrics.roas.toFixed(2)}x.`,
    );
  }

  const downvoted = ads.filter((a) => a.feedback.some((f) => f.rating === -1));
  if (downvoted.length) {
    out.push(
      `Operator rejected ${downvoted.length} ad(s). Their notes override measured performance.`,
    );
  }

  return out;
}

function fmtInt(n: number) {
  return n.toLocaleString("en-US");
}
function money(n: number) {
  return n ? `$${n.toFixed(2)}` : "—";
}
