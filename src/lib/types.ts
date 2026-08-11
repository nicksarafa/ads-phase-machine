/**
 * Domain model for the ads phase machine.
 *
 * The machine runs a fixed cycle of phases. Each cycle produces one Generation,
 * which contains N Ads. Ads accrue metric snapshots, human feedback, and a
 * verdict; the verdicts and feedback become the input to the next generation.
 */

export const PHASES = [
  "research",
  "generate",
  "render",
  "launch",
  "observe",
  "evaluate",
  "evolve",
] as const;

export type Phase = (typeof PHASES)[number];
export type MachinePhase = Phase | "idle";

export const PHASE_LABELS: Record<MachinePhase, string> = {
  idle: "Idle",
  research: "Research",
  generate: "Generate",
  render: "Render",
  launch: "Launch",
  observe: "Observe",
  evaluate: "Evaluate",
  evolve: "Evolve",
};

export const PHASE_BLURBS: Record<MachinePhase, string> = {
  idle: "Waiting for a start signal.",
  research: "Pull brand context, collected sources, and the operator brief.",
  generate: "Write N distinct ad concepts, each with its own strategic DNA.",
  render: "Produce the creative image for every ad.",
  launch: "Place ads on the platform and allocate budget.",
  observe: "Every 6h, read back spend, impressions, clicks, conversions.",
  evaluate: "Score each ad, mark winners and losers, reallocate budget.",
  evolve: "Turn measured lift + human feedback into the next brief.",
};

/** The strategic levers the copywriter picks. The simulator has hidden
 *  preferences over these values; the loop's job is to discover them. */
export const GENE_SPACE = {
  angle: [
    "outcome",
    "identity",
    "fomo",
    "proof",
    "curiosity",
    "contrarian",
    "time-saving",
    "cost-saving",
  ],
  hook: ["question", "stat", "story", "command", "bold-claim", "negation"],
  audience: [
    "founders",
    "marketers",
    "operators",
    "career-switchers",
    "agency-owners",
    "teams",
  ],
  visual: [
    "screenshot",
    "portrait",
    "abstract",
    "before-after",
    "text-on-color",
    "workshop-scene",
  ],
  tone: ["warm", "urgent", "analytical", "playful", "authoritative"],
  offer: ["free-lesson", "workshop", "team-training", "campus"],
} as const;

export type GeneKey = keyof typeof GENE_SPACE;
export const GENE_KEYS = Object.keys(GENE_SPACE) as GeneKey[];

export type Genes = { [K in GeneKey]: string };

export interface Creative {
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
  imagePrompt: string;
  /** Rationale the copywriter gave for this specific ad. */
  rationale: string;
}

export type ImageStatus = "pending" | "rendering" | "ready" | "failed";

export interface AdImage {
  status: ImageStatus;
  /** Served from /api/image/[adId]. */
  url: string | null;
  provider: string | null;
  error: string | null;
}

export interface Metrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
}

export interface MetricSnapshot extends Metrics {
  /** Simulated hours of runtime at which this reading was taken. */
  atHour: number;
  cycle: number;
}

export type AdStatus = "draft" | "rendering" | "active" | "paused" | "killed";
export type Verdict = "winner" | "loser" | "neutral";

export interface Feedback {
  rating: 1 | -1;
  note: string;
  at: number;
}

export interface Ad {
  id: string;
  label: string;
  generation: number;
  createdAt: number;
  parentId: string | null;
  genes: Genes;
  creative: Creative;
  image: AdImage;
  status: AdStatus;
  dailyBudget: number;
  platform: {
    campaignId: string;
    adSetId: string;
    adId: string;
  };
  metrics: Metrics;
  history: MetricSnapshot[];
  feedback: Feedback[];
  verdict: Verdict | null;
  score: number | null;
}

export interface GeneInsight {
  key: GeneKey;
  value: string;
  /** 100 = average. 130 means 30% better than the pool average. */
  ctrIndex: number;
  cpaIndex: number;
  samples: number;
  impressions: number;
}

export interface Generation {
  index: number;
  createdAt: number;
  /** The brief actually used to produce this generation. */
  brief: string;
  adIds: string[];
  /** What the previous cycle learned, in the machine's own words. */
  learnings: string[];
  exploitGenes: Partial<Record<GeneKey, string[]>>;
  llmProvider: string;
}

export interface ContextSource {
  id: string;
  title: string;
  kind: "note" | "url" | "audience" | "proof";
  body: string;
  enabled: boolean;
  createdAt: number;
}

/**
 * An ad whose *shape* should be copied — pasted in, or captured off the wall.
 * The model is told to match the structure and never the wording, so a
 * reference is a format exemplar rather than a source of copy.
 */
export interface ReferenceAd {
  id: string;
  title: string;
  body: string;
  source: "pasted" | "captured";
  enabled: boolean;
  createdAt: number;
}

/** A candidate brief, produced by the rebuild button, held until it is used. */
export interface PromptDraft {
  id: string;
  title: string;
  body: string;
  source: "winners" | "manual";
  /** Headlines the draft was synthesised from, so its basis stays auditable. */
  basis: string[];
  createdAt: number;
}

export interface Settings {
  /** Ads produced per cycle. */
  adsPerCycle: number;
  /** Total daily budget in dollars, split across active ads. */
  dailyBudget: number;
  /** Real seconds that represent one 6-hour observation window. */
  secondsPerWindow: number;
  /** Observation windows per cycle before evaluating. */
  windowsPerCycle: number;
  /** Demo speed multiplier applied on top of secondsPerWindow. */
  speed: number;
  /** How images get made. */
  imageMode: "ai" | "procedural";
  /** Pause the loop after each cycle instead of rolling straight on. */
  stepMode: boolean;
  /** Kill ads whose score falls below this percentile of the cycle. */
  killThreshold: number;
  /** Pin the campaign to one offer, or let the machine pick per ad. */
  offerFocus: "auto" | "team-training" | "workshop" | "free-lesson" | "campus";
  /** Ask the image model to place the Light School mark in the creative. */
  brandLogo: boolean;
}

export interface LogEntry {
  id: string;
  at: number;
  phase: MachinePhase;
  cycle: number;
  level: "info" | "good" | "warn";
  message: string;
}

export interface MachineState {
  running: boolean;
  phase: MachinePhase;
  cycle: number;
  /** Simulated hours elapsed since launch. */
  clockHours: number;
  /** 0..1 progress within the current phase, for the UI. */
  phaseProgress: number;
  nextObserveAt: number | null;
  /** Whether the next generation's copy is already written and waiting. */
  prefetch: "none" | "writing" | "ready";
  llmProvider: string | null;
  imageProvider: string | null;
  /** Which credentials the *running process* can actually see. */
  credentials: {
    anthropic: boolean;
    gemini: boolean;
    openai: boolean;
    claudeCli: boolean;
  };
  lastError: string | null;
}

export interface AppState {
  version: number;
  machine: MachineState;
  settings: Settings;
  brief: string;
  context: ContextSource[];
  generations: Generation[];
  ads: Record<string, Ad>;
  adOrder: string[];
  insights: GeneInsight[];
  log: LogEntry[];
}

export const EMPTY_METRICS: Metrics = {
  spend: 0,
  impressions: 0,
  clicks: 0,
  conversions: 0,
  revenue: 0,
  ctr: 0,
  cpc: 0,
  cpm: 0,
  cpa: 0,
  roas: 0,
};

export function deriveMetrics(m: {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}): Metrics {
  return {
    ...m,
    ctr: m.impressions ? m.clicks / m.impressions : 0,
    cpc: m.clicks ? m.spend / m.clicks : 0,
    cpm: m.impressions ? (m.spend / m.impressions) * 1000 : 0,
    cpa: m.conversions ? m.spend / m.conversions : 0,
    roas: m.spend ? m.revenue / m.spend : 0,
  };
}

export function addMetrics(a: Metrics, b: Omit<Metrics, keyof Metrics> & Partial<Metrics>): Metrics {
  return deriveMetrics({
    spend: a.spend + (b.spend ?? 0),
    impressions: a.impressions + (b.impressions ?? 0),
    clicks: a.clicks + (b.clicks ?? 0),
    conversions: a.conversions + (b.conversions ?? 0),
    revenue: a.revenue + (b.revenue ?? 0),
  });
}
