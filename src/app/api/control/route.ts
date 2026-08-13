import { NextResponse } from "next/server";
import { pushState } from "@/lib/bus";
import { getState, log, persist, resetState } from "@/lib/store";
import {
  beginPrefetch,
  haltForReset,
  pauseMachine,
  refreshLiveStatus,
  startMachine,
} from "@/lib/machine";
import { liveGateOpen, maxDailyUsd } from "@/lib/meta";
import { CAMPAIGN_IDS, activeCampaign, type CampaignId, type Settings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action: "start" | "pause" | "step" | "reset" | "settings" | "warm" | "budget";
  settings?: Partial<Settings>;
  /** For "budget": which campaign, and its new daily figure in dollars. */
  campaign?: CampaignId;
  dailyBudget?: number;
  hard?: boolean;
};

const NUMERIC_BOUNDS: Record<string, [number, number]> = {
  adsPerCycle: [1, 12],
  aiImagesPerCycle: [0, 12],
  dailyBudget: [10, 100_000],
  // Up to a real 6 hours, so the loop can also be run at true wall-clock pace.
  secondsPerWindow: [0.5, 21_600],
  windowsPerCycle: [1, 12],
  speed: [0.25, 50],
  killThreshold: [0, 0.8],
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const s = getState();

  switch (body.action) {
    case "start":
      await startMachine(false);
      break;

    case "pause":
      pauseMachine();
      break;

    case "step":
      await startMachine(true);
      break;

    // Write the next batch of copy now, without running the loop — so the
    // first "Run demo" in front of an audience starts instantly.
    case "warm":
      beginPrefetch(s.machine.cycle);
      break;

    case "reset": {
      haltForReset();
      resetState(!body.hard);
      log(
        body.hard
          ? "Hard reset — brief, context and settings restored to defaults."
          : "Reset — ads and metrics cleared, brief and context kept.",
        "warn",
        "idle",
      );
      break;
    }

    /**
     * Set one campaign's daily budget.
     *
     * The cap is on the TOTAL, so raising one campaign is only allowed as far
     * as the others leave room. Clamping here rather than erroring means the
     * slider always lands on a number that can actually be placed.
     */
    case "budget": {
      const c = s.campaigns.find((x) => x.id === body.campaign);
      const want = Number(body.dailyBudget);
      if (c && Number.isFinite(want)) {
        const others = s.campaigns
          .filter((x) => x.id !== c.id)
          .reduce((sum, x) => sum + x.dailyBudget, 0);
        const ceiling = liveGateOpen() ? Math.max(0, maxDailyUsd() - others) : 100_000;
        const next = Math.min(Math.max(1, want), ceiling);
        if (next !== c.dailyBudget) {
          c.dailyBudget = next;
          if (next < want) {
            log(
              `${c.name} capped at $${next}/day — $${others}/day is committed to other campaigns against a $${maxDailyUsd()} total.`,
              "warn",
            );
          }
        }
        persist();
      }
      break;
    }

    case "settings": {
      if (body.settings) {
        for (const [k, v] of Object.entries(body.settings)) {
          if (k in NUMERIC_BOUNDS && typeof v === "number") {
            const [min, max] = NUMERIC_BOUNDS[k];
            let next = Math.min(max, Math.max(min, v));
            // The live cap governs the budget field itself, so the number the
            // operator sees in the UI is the number that can actually be spent.
            if (k === "dailyBudget" && s.settings.live && liveGateOpen()) {
              next = Math.min(next, maxDailyUsd());
            }
            (s.settings as unknown as Record<string, unknown>)[k] = next;
          } else if (k === "live" && typeof v === "boolean") {
            // Turning live mode ON requires the environment to allow it.
            // Turning it OFF is always permitted — the safe direction never
            // needs permission.
            if (!v) {
              s.settings.live = false;
            } else if (liveGateOpen()) {
              s.settings.live = true;
              // Bring the campaigns inside the total cap before anything can
              // be placed, scaling them down proportionally rather than
              // silently favouring whichever one is listed first.
              const total = s.campaigns.reduce((sum, c) => sum + c.dailyBudget, 0);
              const cap = maxDailyUsd();
              if (total > cap && total > 0) {
                for (const c of s.campaigns) {
                  c.dailyBudget = Math.max(1, Math.round((c.dailyBudget / total) * cap * 100) / 100);
                }
              }
              log(
                `Live mode armed. Ads will be placed on the real ad account, PAUSED, at up to $${maxDailyUsd()}/day.`,
                "warn",
              );
            } else {
              log(
                "Live mode refused: ADS_LIVE is not set in this process. Set it in .env and restart.",
                "warn",
              );
            }
            await refreshLiveStatus();
          } else if (k === "imageMode" && (v === "ai" || v === "procedural")) {
            s.settings.imageMode = v;
          } else if (k === "stepMode" && typeof v === "boolean") {
            s.settings.stepMode = v;
          } else if (k === "brandLogo" && typeof v === "boolean") {
            s.settings.brandLogo = v;
          } else if (k === "offerFocus" && CAMPAIGN_IDS.includes(v as CampaignId)) {
            // Switching campaigns swaps the whole working set: brief, budget,
            // placement and the ads on the wall. Nothing is carried across.
            s.settings.offerFocus = v as CampaignId;
            log(`Switched to ${activeCampaign(s).name}.`, "info");
          }
        }
        persist();
      }
      break;
    }
  }

  pushState(getState, true);
  return NextResponse.json(getState());
}
