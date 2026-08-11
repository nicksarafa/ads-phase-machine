import fs from "node:fs";
import path from "node:path";
import {
  type AppState,
  type LogEntry,
  type MachinePhase,
  type Settings,
} from "./types";
import { COMPETITOR_INTEL } from "./hooks";

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
export const IMAGE_DIR = path.join(DATA_DIR, "images");

const STATE_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  adsPerCycle: 6,
  dailyBudget: 240,
  secondsPerWindow: 6,
  windowsPerCycle: 4,
  speed: 1,
  imageMode: "ai",
  stepMode: false,
  killThreshold: 0.4,
  offerFocus: "auto",
  brandLogo: true,
};

export const DEFAULT_BRIEF = `You are the creative strategist for Light School's paid acquisition on Meta.

Goal: get a decision-maker to book team training, or to start the free lessons
themselves and bring the team later. The winning ad is the one that makes a
specific person think "that's my team, and we could actually build that."

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
      llmProvider: null,
      imageProvider: null,
      lastError: null,
    },
    settings: { ...DEFAULT_SETTINGS },
    brief: DEFAULT_BRIEF,
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
}

export function loadState(): AppState {
  if (slot.loaded) return slot.state;
  ensureDirs();
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as AppState;
      if (raw.version === STATE_VERSION) {
        slot.state = raw;
        // Backfill fields added after this state file was written. Bumping the
        // version instead would be correct but would throw away a long run's
        // worth of ads and measured insight, which is the whole demo.
        slot.state.references ??= [];
        slot.state.drafts ??= [];
        slot.state.enabledFiles ??= ["design.md"];
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
    fresh.brief = prev.brief;
    fresh.context = prev.context.map((c) => ({ ...c }));
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
