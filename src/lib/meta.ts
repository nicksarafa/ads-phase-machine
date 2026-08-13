import { hasBinary, run } from "./llm";
import type { Ad, LiveInsight, LivePlacement } from "./types";

export type { LiveInsight, LivePlacement };

/**
 * The live Meta bridge.
 *
 * Everything in this file can spend real money, so it is built around one
 * principle: the model never decides anything that costs money. This process
 * computes the exact plan — budget in cents, geo, objective, statuses — asserts
 * it against a hard cap, and only then hands it to the `claude` CLI to execute
 * against the connected `facebook-ads` MCP. Afterwards the placement is read
 * back and checked against the same plan. A mismatch is an alarm, not a shrug.
 *
 * Why shell out at all: the MCP's OAuth token lives in Claude Code's credential
 * store, not in this Next.js process. Spawning the CLI is what lets the server
 * borrow the operator's existing Meta authorisation without minting a second
 * long-lived token and parking it in .env.
 */

// ------------------------------------------------------------------- config

/**
 * The master switch. Live mode is off unless the operator sets this in a local
 * .env, so a clone of this public repo can never place an ad by accident — not
 * on first run, not after a stray click in the UI.
 */
export function liveGateOpen(): boolean {
  const v = (process.env.ADS_LIVE || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * A ceiling this process refuses to cross regardless of what the UI, the state
 * file, or the model asks for. The settings slider is clamped to it too, but
 * this is the check that actually matters because it sits directly in front of
 * the spawn.
 */
export function maxDailyUsd(): number {
  const n = Number(process.env.ADS_LIVE_MAX_DAILY_USD);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

export interface LiveConfig {
  adAccountId: string;
  pageId: string;
  landingUrl: string;
  /** Human label for logs and the campaign name. */
  city: string;
  countryCode: string;
  /**
   * A custom-location pin rather than a city key.
   *
   * This mirrors the targeting the account already ran in Lisbon, so live mode
   * continues a proven setup instead of introducing a differently-shaped
   * audience and calling the difference a result.
   */
  lat: number;
  lng: number;
  radiusKm: number;
}

/**
 * Where a campaign's clicks go.
 *
 * Per-campaign first, then a shared fallback, and never a literal in source —
 * a fork of this repo must advertise its own site, not ours.
 */
export function landingUrlFor(campaignId: string): string {
  const key =
    campaignId === "workshops"
      ? process.env.ADS_LANDING_URL_WORKSHOPS
      : process.env.ADS_LANDING_URL_TEAMS;
  return key || process.env.ADS_LANDING_URL || "";
}

const CAMPAIGNS_NEEDING_URL = ["workshops", "team-training"];

export function liveConfig(): LiveConfig {
  return {
    adAccountId: process.env.ADS_META_AD_ACCOUNT_ID || "",
    pageId: process.env.ADS_META_PAGE_ID || "",
    landingUrl: process.env.ADS_LANDING_URL || "",
    city: process.env.ADS_GEO_CITY || "Lisbon",
    countryCode: (process.env.ADS_GEO_COUNTRY || "PT").toUpperCase(),
    lat: Number(process.env.ADS_GEO_LAT) || 38.7223,
    lng: Number(process.env.ADS_GEO_LNG) || -9.1393,
    radiusKm: Number(process.env.ADS_GEO_RADIUS_KM) || 40,
  };
}

export interface Preflight {
  ready: boolean;
  gateOpen: boolean;
  cliPresent: boolean;
  missing: string[];
  config: LiveConfig;
  maxDailyUsd: number;
}

/**
 * Everything that must be true before a single ad can be placed, answered in
 * one call so the UI can explain precisely what is missing instead of failing
 * at the moment of spend.
 */
export async function preflight(): Promise<Preflight> {
  const config = liveConfig();
  const gateOpen = liveGateOpen();
  const cliPresent = await hasBinary("claude");

  const missing: string[] = [];
  if (!config.adAccountId) missing.push("ADS_META_AD_ACCOUNT_ID");
  if (!config.pageId) missing.push("ADS_META_PAGE_ID");
  // A destination is required, but it may be given per campaign or shared.
  const noDestination = CAMPAIGNS_NEEDING_URL.every((c) => !landingUrlFor(c));
  if (noDestination) missing.push("ADS_LANDING_URL");
  if (!cliPresent) missing.push("the `claude` CLI on PATH");

  return {
    ready: gateOpen && cliPresent && missing.length === 0,
    gateOpen,
    cliPresent,
    missing,
    config,
    maxDailyUsd: maxDailyUsd(),
  };
}

// -------------------------------------------------------------- the spawn

const CLI_TIMEOUT_MS = Number(process.env.ADS_LIVE_TIMEOUT_MS) || 300_000;

/**
 * How long live mode waits between reads of Meta.
 *
 * Deliberately NOT derived from `secondsPerWindow`, which is a demo-speed knob
 * measured in seconds. Every poll is a billable model call, so at demo speed
 * the loop would spend more on reading insights than the ads spend on
 * delivery. Meta's reporting only moves on the order of tens of minutes
 * anyway, so polling faster buys nothing.
 */
export function pollIntervalMs(): number {
  const mins = Number(process.env.ADS_LIVE_POLL_MINUTES);
  return (Number.isFinite(mins) && mins > 0 ? mins : 30) * 60_000;
}

/**
 * Run one instruction through the CLI with only the Facebook MCP in reach, and
 * parse a single JSON object out of the reply.
 *
 * The tool allowlist is the containment boundary. The subprocess is asked to
 * touch an ad account, so it gets the ads tools and nothing else — no file
 * writes, no shell, no unrelated MCP that happens to be connected.
 */
async function askMeta<T>(instruction: string): Promise<T> {
  const raw = await run(
    "claude",
    [
      "-p",
      instruction,
      "--output-format",
      "json",
      "--allowedTools",
      "mcp__facebook-ads__*",
      "--disallowedTools",
      "Bash,Write,Edit,WebFetch",
    ],
    CLI_TIMEOUT_MS,
  );

  let text = raw;
  try {
    const wrapper = JSON.parse(raw) as { result?: string; is_error?: boolean };
    if (wrapper.is_error) {
      throw new Error(`the Facebook MCP step failed: ${String(wrapper.result).slice(0, 300)}`);
    }
    if (typeof wrapper.result === "string") text = wrapper.result;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("the Facebook MCP step failed")) throw e;
    // A bare (non-JSON-wrapped) reply is still worth trying to read.
  }

  // The model is told to emit only JSON, but a stray sentence around it must
  // not cost us a placement we may already have paid for, so recover the object.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error(`no JSON in the MCP reply: ${text.trim().slice(0, 200)}`);
  }
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    throw new Error(`unparseable JSON from the MCP: ${text.slice(start, start + 200)}`);
  }
}

// -------------------------------------------------------------------- launch

/**
 * Place a cycle's ads on Meta, paused.
 *
 * `existing` reuses the campaign and ad set from an earlier cycle so the whole
 * run shares one $10/day budget and one learning phase, rather than stacking a
 * fresh $10/day campaign every time the loop comes around — which is the way
 * this design could quietly turn into $70/day by Friday.
 */
export async function launchLive(
  ads: Ad[],
  opts: {
    campaignId: string;
    /** Shown in the Meta campaign name, so the account stays readable. */
    campaignName: string;
    dailyBudgetUsd: number;
    /**
     * What every OTHER campaign already spends per day. The cap governs the
     * total across campaigns, so two $5/day campaigns cannot quietly become
     * $10/day each the moment someone edits one slider.
     */
    otherBudgetsUsd: number;
    /** Reuse this campaign and ad set instead of creating new ones. */
    existing: LivePlacement | null;
  },
): Promise<LivePlacement> {
  const gate = await preflight();
  if (!gate.gateOpen) throw new Error("live mode is off (set ADS_LIVE=1 in .env)");
  if (!gate.ready) throw new Error(`live mode is not configured: missing ${gate.missing.join(", ")}`);
  if (!ads.length) throw new Error("no ads to place");

  const cfg = gate.config;

  // The cap check that matters. It sits in front of the spawn, reads the same
  // number that goes into the plan, and is expressed in cents because that is
  // the unit Meta bills in — no rounding surprises between here and the API.
  const cents = Math.round(opts.dailyBudgetUsd * 100);
  const otherCents = Math.round(Math.max(0, opts.otherBudgetsUsd) * 100);
  const capCents = Math.round(gate.maxDailyUsd * 100);
  if (!Number.isFinite(cents) || cents <= 0) {
    throw new Error(`refusing to place ads with a daily budget of ${opts.dailyBudgetUsd}`);
  }
  if (cents + otherCents > capCents) {
    throw new Error(
      `refusing to place ads: $${opts.dailyBudgetUsd}/day for this campaign plus $${opts.otherBudgetsUsd}/day already committed elsewhere exceeds the hard cap of $${gate.maxDailyUsd}/day across all campaigns (ADS_LIVE_MAX_DAILY_USD)`,
    );
  }

  const landingUrl = landingUrlFor(opts.campaignId);
  if (!landingUrl) {
    throw new Error(
      `refusing to place ads: no destination for "${opts.campaignId}" (set ADS_LANDING_URL_WORKSHOPS / ADS_LANDING_URL_TEAMS, or ADS_LANDING_URL)`,
    );
  }

  // The creative payload is built here, so the model transcribes copy rather
  // than writing it. Anything it invents would be copy that never passed the
  // scorecard.
  const creatives = ads.map((a) => ({
    ref: a.id,
    name: a.label,
    headline: a.creative.headline,
    primary_text: a.creative.primaryText,
    description: a.creative.description,
    call_to_action: a.creative.cta,
  }));

  // The budget sits on the campaign, not the ad set. Campaign budget
  // optimisation is both what this account already runs and the stronger cap:
  // one number governs every ad set beneath it, so no later cycle can add a
  // second ad set and quietly double the daily spend.
  const plan = {
    ad_account_id: cfg.adAccountId,
    page_id: cfg.pageId,
    landing_url: landingUrl,
    reuse: opts.existing
      ? { campaign_id: opts.existing.campaignId, ad_set_id: opts.existing.adSetId }
      : null,
    campaign: {
      name: `Ads Phase Machine — ${opts.campaignName} — ${cfg.city}`,
      objective: "OUTCOME_TRAFFIC",
      daily_budget_cents: cents,
      budget_optimization: "campaign",
      status: "PAUSED",
    },
    ad_set: {
      name: `${opts.campaignName} · ${cfg.city} ${cfg.radiusKm}km`,
      // Deliberately null. The budget lives on the campaign above.
      daily_budget_cents: null,
      optimization_goal: "LINK_CLICKS",
      status: "PAUSED",
      geo: {
        custom_locations: [
          {
            latitude: cfg.lat,
            longitude: cfg.lng,
            radius: cfg.radiusKm,
            distance_unit: "kilometer",
            country: cfg.countryCode,
          },
        ],
        location_types: ["home"],
      },
    },
    ads: creatives,
  };

  const instruction = [
    "You are placing ads on Meta through the connected facebook-ads MCP tools.",
    "",
    "Execute the plan below EXACTLY. It is not a suggestion and not a starting point.",
    "Hard rules, in order of importance:",
    `1. Every object you create must have status PAUSED. Never ACTIVE. The operator activates by hand.`,
    `2. The CAMPAIGN daily budget must be exactly ${cents} (Meta's minor units). Never any other number.`,
    "3. The ad set must have NO budget of its own. The campaign holds the budget (CBO). Never set an ad set daily or lifetime budget.",
    "4. If `reuse` is non-null, do NOT create a campaign or ad set, and do NOT change the existing budget. Attach the new ads to the ids given.",
    "5. Copy every creative field verbatim. Do not rewrite, improve, shorten or translate any ad copy.",
    "6. Use the custom_locations geo spec exactly as given. Do not substitute a city key or change the radius.",
    "7. If any step fails, stop. Do not improvise an alternative, a different budget, or a different objective.",
    "",
    "PLAN:",
    JSON.stringify(plan, null, 2),
    "",
    "Reply with ONE JSON object and no other text, in exactly this shape:",
    JSON.stringify(
      {
        campaign_id: "<id>",
        ad_set_id: "<id>",
        daily_budget_cents: 0,
        geo_key: "<the location key you targeted>",
        ads: [{ ref: "<the ref from the plan>", ad_id: "<meta ad id>" }],
        error: null,
      },
      null,
      2,
    ),
    "If you could not complete the plan, set `error` to a one-line reason and report whatever ids you did create so they can be cleaned up.",
  ].join("\n");

  const res = await askMeta<{
    campaign_id?: string;
    ad_set_id?: string;
    daily_budget_cents?: number;
    geo_key?: string | null;
    ads?: { ref?: string; ad_id?: string }[];
    error?: string | null;
  }>(instruction);

  if (res.error) throw new Error(`Meta placement failed: ${res.error}`);
  if (!res.campaign_id || !res.ad_set_id) {
    throw new Error("Meta placement returned no campaign or ad set id");
  }

  const adIds: Record<string, string> = {};
  for (const row of res.ads ?? []) {
    if (row?.ref && row?.ad_id && ads.some((a) => a.id === row.ref)) {
      adIds[row.ref] = row.ad_id;
    }
  }

  return {
    accountId: cfg.adAccountId,
    campaignId: res.campaign_id,
    adSetId: res.ad_set_id,
    adIds,
    dailyBudgetCents: cents,
    geoKey: res.geo_key ?? null,
    placedAt: Date.now(),
  };
}

// -------------------------------------------------------------------- verify

export interface Verification {
  ok: boolean;
  problems: string[];
  observed: {
    campaignDailyBudgetCents: number | null;
    adSetDailyBudgetCents: number | null;
    adSetStatus: string | null;
    campaignStatus: string | null;
    activeAdCount: number | null;
    countryCodes: string[];
  };
}

/**
 * Read the placement back and check it against what we asked for.
 *
 * This is the half of the design that makes an LLM acceptable in a money path.
 * The model was trusted to make the calls; it is not trusted to report on
 * itself, so the budget, the pause state and the country are confirmed from
 * Meta's own records before the loop moves on.
 */
export async function verifyPlacement(p: LivePlacement): Promise<Verification> {
  const instruction = [
    "Read back the following Meta objects with the facebook-ads MCP tools and report what you find.",
    "Report only. Do not create, edit, pause, activate or delete anything.",
    "",
    `campaign_id: ${p.campaignId}`,
    `ad_set_id: ${p.adSetId}`,
    "",
    "Reply with ONE JSON object and no other text:",
    JSON.stringify(
      {
        campaign_daily_budget_cents: 0,
        ad_set_daily_budget_cents: null,
        ad_set_status: "<effective status>",
        campaign_status: "<effective status>",
        active_ad_count: 0,
        country_codes: ["<targeted country codes>"],
      },
      null,
      2,
    ),
    "`active_ad_count` is how many ads under this ad set are not paused, archived or deleted.",
    "`ad_set_daily_budget_cents` must be null if the ad set has no budget of its own. Report what you actually find.",
  ].join("\n");

  const obs = await askMeta<{
    campaign_daily_budget_cents?: number;
    ad_set_daily_budget_cents?: number | null;
    ad_set_status?: string;
    campaign_status?: string;
    active_ad_count?: number;
    country_codes?: string[];
  }>(instruction);

  const cfg = liveConfig();
  const problems: string[] = [];
  const budget = Number(obs.campaign_daily_budget_cents);
  const capCents = Math.round(maxDailyUsd() * 100);
  const countries = (obs.country_codes ?? []).map((c) => String(c).toUpperCase());

  if (Number.isFinite(budget) && budget !== p.dailyBudgetCents) {
    problems.push(
      `campaign daily budget is ${budget} on Meta but ${p.dailyBudgetCents} was requested`,
    );
  }
  if (Number.isFinite(budget) && budget > capCents) {
    problems.push(`campaign daily budget ${budget} is over the hard cap of ${capCents}`);
  }
  // An ad set that grew its own budget is the failure mode CBO exists to
  // prevent: the campaign cap stops governing total spend the moment one
  // appears, so it is treated as seriously as an over-cap campaign.
  const adSetBudget = Number(obs.ad_set_daily_budget_cents);
  if (Number.isFinite(adSetBudget) && adSetBudget > 0) {
    problems.push(
      `ad set carries its own budget of ${adSetBudget}, which escapes the campaign cap`,
    );
  }
  if (obs.ad_set_status && obs.ad_set_status.toUpperCase() !== "PAUSED") {
    problems.push(`ad set is ${obs.ad_set_status}, expected PAUSED`);
  }
  if (typeof obs.active_ad_count === "number" && obs.active_ad_count > 0) {
    problems.push(`${obs.active_ad_count} ad(s) are already active, expected all paused`);
  }
  if (countries.length && !countries.includes(cfg.countryCode)) {
    problems.push(
      `targeting reports ${countries.join(", ") || "no country"}, expected ${cfg.countryCode}`,
    );
  }

  return {
    ok: problems.length === 0,
    problems,
    observed: {
      campaignDailyBudgetCents: Number.isFinite(budget) ? budget : null,
      adSetDailyBudgetCents: Number.isFinite(adSetBudget) ? adSetBudget : null,
      adSetStatus: obs.ad_set_status ?? null,
      campaignStatus: obs.campaign_status ?? null,
      activeAdCount: typeof obs.active_ad_count === "number" ? obs.active_ad_count : null,
      countryCodes: countries,
    },
  };
}

// ------------------------------------------------------------------ insights

/**
 * Read real delivery for a placement, keyed by our ad id.
 *
 * Returns an empty map rather than throwing when there is simply no delivery
 * yet — which is the normal state for ads that are still paused awaiting
 * review, and must not read as an error in the log.
 */
export async function fetchInsights(
  p: LivePlacement,
): Promise<Record<string, LiveInsight>> {
  const refs = Object.entries(p.adIds);
  if (!refs.length) return {};

  const instruction = [
    "Read delivery insights for the following Meta ads with the facebook-ads MCP tools.",
    "Report only. Do not create, edit, pause, activate or delete anything.",
    "",
    `ad_set_id: ${p.adSetId}`,
    "Use the lifetime date preset, at ad level.",
    "ads:",
    ...refs.map(([ref, metaId]) => `  - ref: ${ref}  ad_id: ${metaId}`),
    "",
    "Reply with ONE JSON object and no other text:",
    JSON.stringify(
      {
        ads: [
          {
            ref: "<the ref above>",
            spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            revenue: 0,
          },
        ],
      },
      null,
      2,
    ),
    "Use 0 for any metric Meta has not reported. Spend and revenue are in whole currency units, not minor units.",
  ].join("\n");

  const res = await askMeta<{
    ads?: {
      ref?: string;
      spend?: number;
      impressions?: number;
      clicks?: number;
      conversions?: number;
      revenue?: number;
    }[];
  }>(instruction);

  const known = new Set(Object.keys(p.adIds));
  const out: Record<string, LiveInsight> = {};
  for (const row of res.ads ?? []) {
    if (!row?.ref || !known.has(row.ref)) continue;
    out[row.ref] = {
      spend: num(row.spend),
      impressions: Math.round(num(row.impressions)),
      clicks: Math.round(num(row.clicks)),
      conversions: Math.round(num(row.conversions)),
      revenue: num(row.revenue),
    };
  }
  return out;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
