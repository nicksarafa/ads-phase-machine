import { NextResponse } from "next/server";
import { pushState } from "@/lib/bus";
import { getState, log, persist, resetState } from "@/lib/store";
import { beginPrefetch, haltForReset, pauseMachine, startMachine } from "@/lib/machine";
import type { Settings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action: "start" | "pause" | "step" | "reset" | "settings" | "warm";
  settings?: Partial<Settings>;
  hard?: boolean;
};

const NUMERIC_BOUNDS: Record<string, [number, number]> = {
  adsPerCycle: [1, 12],
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
      startMachine(false);
      break;

    case "pause":
      pauseMachine();
      break;

    case "step":
      startMachine(true);
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

    case "settings": {
      if (body.settings) {
        for (const [k, v] of Object.entries(body.settings)) {
          if (k in NUMERIC_BOUNDS && typeof v === "number") {
            const [min, max] = NUMERIC_BOUNDS[k];
            (s.settings as unknown as Record<string, unknown>)[k] = Math.min(
              max,
              Math.max(min, v),
            );
          } else if (k === "imageMode" && (v === "ai" || v === "procedural")) {
            s.settings.imageMode = v;
          } else if (k === "stepMode" && typeof v === "boolean") {
            s.settings.stepMode = v;
          } else if (k === "brandLogo" && typeof v === "boolean") {
            s.settings.brandLogo = v;
          } else if (
            k === "offerFocus" &&
            ["auto", "team-training", "workshop", "free-lesson", "campus"].includes(
              String(v),
            )
          ) {
            s.settings.offerFocus = v as Settings["offerFocus"];
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
