import fs from "node:fs";
import path from "node:path";
import {
  CAMPAIGN_IDS,
  type AppState,
  type Campaign,
  type ScoreRule,
  type Scorecard,
  type LogEntry,
  type MachinePhase,
  type Settings,
} from "./types";
import { COMPETITOR_INTEL } from "./hooks";

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
export const IMAGE_DIR = path.join(DATA_DIR, "images");
export const REF_DIR = path.join(DATA_DIR, "refs");

const STATE_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  // Simulation by default, always. Live mode additionally requires the ADS_LIVE
  // gate in the environment, so this defaulting to false is belt to that brace.
  live: false,
  adsPerCycle: 6,
  dailyBudget: 240,
  secondsPerWindow: 6,
  windowsPerCycle: 4,
  speed: 1,
  imageMode: "ai",
  aiImagesPerCycle: 2,
  stepMode: false,
  killThreshold: 0.4,
  offerFocus: "team-training",
  brandLogo: true,
};

/**
 * The workshops brief.
 *
 * Deliberately the opposite buyer to the team-training brief below: one person
 * deciding for themselves, in one sitting, about a real date in their own city.
 * Both campaigns run against the same Lisbon audience, so this copy is the only
 * thing that distinguishes them and it has to actually be different.
 */
export const WORKSHOPS_BRIEF = `You are the creative strategist for Light School's Lisbon workshops on Meta.

Goal: get one person in Lisbon to book a seat at an in-person workshop. They
pay their own way and decide alone, usually in a single sitting. There is no
procurement, no manager to convince, and no budget cycle.

Write to the individual, not to a company.

Write in English only.

POSITIONING:
The promise is a specific evening or afternoon in Lisbon where they build one
real thing and walk out with it working. Local, in the room, hands on keyboards.
Nobody else in this city is advertising that — competitors sell self-paced
video, and video is exactly what this person has already failed to finish.

Rules for every ad:
- Lead with what they will walk out having built, not with "AI".
- Say it is in Lisbon and in person. That is the whole edge — do not bury it.
- Name the thing: "your first working app", "an automation that reads your
  inbox". One concrete build beats any adjective.
- Speak to someone who has watched a hundred tutorials and shipped nothing.
- Primary text is 2-4 short lines. No emoji walls, no hashtag soup.
- Headline is under 40 characters.
- Use a different proven hook pattern for each ad in the batch, and name the
  pattern you used in the rationale.
- Never mention team training, companies, departments, or staff. That is the
  other campaign and mixing them wastes both.
- Avoid the saturated lines: "it's 2026", "Fortune 100 companies use us",
  and anything that sounds like an AI-avatar video tool.`;

export const DEFAULT_BRIEF = `You are the creative strategist for Light School's paid acquisition on Meta.

Goal: get a business owner or department head to book team training. This
account sells one thing — upgrading a team that already exists. Never pitch a
free lesson, a self-serve course, or anything an individual buys for
themselves. The winning ad is the one that makes an owner think "that's my
team, and we could actually build that."

Write to the person who owns the budget and the outcome, not to the learner.

Write in English only.

POSITIONING — this is the whole edge:
The competitor teardown found that everyone in this niche sells a tool, a
self-paced course, or a career change. Nobody is advertising live, hands-on
sessions where a team's own problem gets solved in the room. Lead with what
only a live session can promise: their actual problem, built during the
session, still running on Monday.

Rules for every ad:
- Lead with something the team could build this week, not with "AI".
- Use one concrete detail — a real build, a real number, a real objection.
  Name things. "The $800/month tool a student replaced" beats "save money".
- Name who it is for inside the ad itself.
- Primary text is 2-4 short lines. No emoji walls, no hashtag soup.
- Headline is under 40 characters.
- Use a different proven hook pattern for each ad in the batch, and name the
  pattern you used in the rationale.
- Never reuse a competitor's wording. Borrow the structure, write our sentence.
- Avoid the saturated lines: "it's 2026", "Fortune 100 companies use us",
  and anything that sounds like an AI-avatar video tool.`;

/**
 * A starting rubric drawn from the rules the brief already states, so the
 * feature is usable before anyone writes a rule. Edit or delete it freely.
 */
export function DEFAULT_SCORECARD(): Scorecard {
  const rule = (component: ScoreRule["component"], label: string, points: number): ScoreRule => ({
    id: `rule-${component}-${label.slice(0, 12).replace(/\W+/g, "-").toLowerCase()}`,
    component,
    label,
    points,
  });
  return {
    id: "sc-default",
    name: "House bar",
    enabled: true,
    threshold: 70,
    createdAt: Date.now(),
    rules: [
      rule("headline", "Under 40 characters", 10),
      rule("headline", "Would make a business owner stop scrolling, not a learner", 15),
      rule("primaryText", "Names one concrete build, number or objection rather than a vague benefit", 20),
      rule("primaryText", "Says who the ad is for inside the copy", 10),
      rule("primaryText", "Two to four short lines, no emoji walls or hashtag soup", 10),
      rule("cta", "Reads like an action a budget holder takes", 10),
      rule("imagePrompt", "Describes real people in a real workspace, not an abstract tech cliche", 10),
      rule("overall", "Contains no em dash anywhere", 5),
      rule("overall", "Sells team training rather than an individual course or free lesson", 10),
    ],
  };
}

/**
 * The two campaigns, at their default split.
 *
 * $5 + $5 against a $10 cap: the ceiling is the *total*, so adding a second
 * campaign divides the money rather than doubling it.
 */
export function DEFAULT_CAMPAIGNS(): Campaign[] {
  return [
    {
      id: "workshops",
      name: "Workshops · Lisbon",
      audience: "One person in Lisbon booking a seat for themselves",
      brief: WORKSHOPS_BRIEF,
      dailyBudget: 5,
      placement: null,
    },
    {
      id: "team-training",
      name: "Team Training · Companies",
      audience: "A business owner or department head with a team and a budget",
      brief: DEFAULT_BRIEF,
      dailyBudget: 5,
      placement: null,
    },
  ];
}

function emptyState(): AppState {
  return {
    version: STATE_VERSION,
    machine: {
      running: false,
      phase: "idle",
      cycle: 0,
      clockHours: 0,
      phaseProgress: 0,
      nextObserveAt: null,
      prefetch: "none",
      credentials: { anthropic: false, gemini: false, openai: false, claudeCli: false },
      live: { gateOpen: false, ready: false, missing: [], maxDailyUsd: 0, lastVerify: null, destinations: {}, geoLabel: "" },
      llmProvider: null,
      imageProvider: null,
      lastError: null,
    },
    settings: { ...DEFAULT_SETTINGS },
    campaigns: DEFAULT_CAMPAIGNS(),
    context: [
      {
        id: "ctx-seed-0",
        title: COMPETITOR_INTEL.title,
        kind: "note",
        body: COMPETITOR_INTEL.body,
        enabled: true,
        createdAt: Date.now(),
      },
      {
        id: "ctx-seed-1",
        title: "Best performing organic hook",
        kind: "note",
        body: "The post that outperformed everything else was a screen recording of a student replacing an $800/month SaaS tool with something they built in an afternoon. People replied asking what the tool was, not how the AI worked.",
        enabled: true,
        createdAt: Date.now(),
      },
      {
        id: "ctx-seed-2",
        title: "Objection we hear most",
        kind: "audience",
        body: '"I am not technical enough for this." Second most common: "I have watched a hundred AI videos and built nothing."',
        enabled: true,
        createdAt: Date.now(),
      },
    ],
    references: [],
    assets: [],
    scorecards: [DEFAULT_SCORECARD()],
    drafts: [],
    enabledFiles: ["design.md"],
    generations: [],
    ads: {},
    adOrder: [],
    insights: [],
    log: [],
  };
}

/**
 * Next bundles each route handler separately, so a plain module-level variable
 * would give the machine and the API routes different copies of the state.
 * The store lives on globalThis so every route — and every HMR reload — shares
 * exactly one instance.
 */
interface StoreSlot {
  state: AppState;
  loaded: boolean;
  logSeq: number;
}
const slot = ((globalThis as unknown as { __adsStore?: StoreSlot }).__adsStore ??= {
  state: emptyState(),
  loaded: false,
  logSeq: 0,
});

let writeTimer: NodeJS.Timeout | null = null;

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  fs.mkdirSync(REF_DIR, { recursive: true });
}

export function loadState(): AppState {
  if (slot.loaded) return slot.state;
  ensureDirs();
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as AppState;
      if (raw.version === STATE_VERSION) {
        slot.state = raw;
        const prevBudget = raw.settings?.dailyBudget;
        // Backfill fields added after this state file was written. Bumping the
        // version instead would be correct but would throw away a long run's
        // worth of ads and measured insight, which is the whole demo.
        slot.state.references ??= [];
        slot.state.assets ??= [];
        slot.state.scorecards ??= [DEFAULT_SCORECARD()];
        slot.state.drafts ??= [];
        slot.state.enabledFiles ??= ["design.md"];
        slot.state.settings.aiImagesPerCycle ??= DEFAULT_SETTINGS.aiImagesPerCycle;
        slot.state.settings.live ??= false;

        // Migrate a single-campaign state file. Everything it held belonged to
        // the offer this account used to sell exclusively, so the old brief,
        // placement and ads all land on team-training rather than being split
        // across two campaigns they were never written for.
        const legacy = raw as unknown as {
          brief?: string;
          placement?: AppState["campaigns"][number]["placement"];
        };
        if (!Array.isArray(slot.state.campaigns) || !slot.state.campaigns.length) {
          const fresh = DEFAULT_CAMPAIGNS();
          const teams = fresh.find((c) => c.id === "team-training")!;
          if (typeof legacy.brief === "string" && legacy.brief.trim()) {
            teams.brief = legacy.brief;
          }
          if (legacy.placement) teams.placement = legacy.placement;
          if (typeof prevBudget === "number" && prevBudget > 0) {
            // The old single budget covered one campaign; halving it keeps the
            // total unchanged rather than silently doubling the daily spend.
            const half = Math.max(1, Math.round((prevBudget / 2) * 100) / 100);
            for (const c of fresh) c.dailyBudget = half;
          }
          slot.state.campaigns = fresh;
        }
        for (const id of Object.keys(slot.state.ads)) {
          slot.state.ads[id].campaign ??= "team-training";
        }
        if (!CAMPAIGN_IDS.includes(slot.state.settings.offerFocus)) {
          slot.state.settings.offerFocus = "team-training";
        }
        slot.state.machine.live ??= {
          gateOpen: false,
          ready: false,
          missing: [],
          maxDailyUsd: 0,
          lastVerify: null,
          destinations: {},
          geoLabel: "",
        };
        // Readiness is a fact about the current process, not about the state
        // file, so it is always recomputed from the environment on start.
        slot.state.machine.live.lastVerify = null;
        // A process restart always stops the loop; the UI can start it again.
        slot.state.machine.running = false;
        slot.state.machine.phase = "idle";
        slot.state.machine.prefetch = "none";
      }
    }
  } catch {
    slot.state = emptyState();
  }
  slot.loaded = true;
  return slot.state;
}

export function getState(): AppState {
  return loadState();
}

/** Debounced atomic write. The loop mutates state far faster than disk cares. */
export function persist() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      ensureDirs();
      const tmp = `${STATE_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(slot.state));
      fs.renameSync(tmp, STATE_FILE);
    } catch {
      // A failed snapshot must never take the loop down.
    }
  }, 400);
}

export function resetState(keepConfig = true) {
  const prev = loadState();
  const fresh = emptyState();
  if (keepConfig) {
    fresh.settings = { ...prev.settings };
    fresh.context = prev.context.map((c) => ({ ...c }));
    // Briefs, budgets and placements all survive a soft reset. Forgetting a
    // placement would not delete it from Meta — it would just make the next
    // launch open a second campaign on the same budget while the first exists.
    fresh.campaigns = prev.campaigns.map((c) => ({ ...c }));
  }
  slot.state = fresh;
  slot.loaded = true;
  try {
    if (fs.existsSync(IMAGE_DIR)) {
      for (const f of fs.readdirSync(IMAGE_DIR)) {
        fs.rmSync(path.join(IMAGE_DIR, f), { force: true });
      }
    }
  } catch {
    /* best effort */
  }
  persist();
  return slot.state;
}

export function log(
  message: string,
  level: LogEntry["level"] = "info",
  phase?: MachinePhase,
) {
  const s = getState();
  const entry: LogEntry = {
    id: `log-${Date.now()}-${slot.logSeq++}`,
    at: Date.now(),
    phase: phase ?? s.machine.phase,
    cycle: s.machine.cycle,
    level,
    message,
  };
  s.log.unshift(entry);
  if (s.log.length > 400) s.log.length = 400;
  return entry;
}
