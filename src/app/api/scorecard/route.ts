import { NextResponse } from "next/server";
import { pushState } from "@/lib/bus";
import { getState, log, persist } from "@/lib/store";
import { judgeAd } from "@/lib/llm";
import {
  SCORED_COMPONENTS,
  type Ad,
  type AdJudgement,
  type ScoreRule,
  type Scorecard,
  type ScoredComponent,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scorecards: the rubric an ad is judged against before it earns budget.
 *
 * Kept separate from the performance score the simulator produces. This one
 * asks "is this ad worth running", answered by reading the copy; that one asks
 * "did it work", answered by delivery.
 */

function rid(p: string) {
  return `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function payload() {
  const s = getState();
  return { scorecards: s.scorecards };
}

function ok() {
  persist();
  pushState(getState, true);
  return NextResponse.json(payload());
}

export async function GET() {
  return NextResponse.json(payload());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    id?: string;
    ruleId?: string;
    name?: string;
    label?: string;
    component?: string;
    points?: number;
    threshold?: number;
    adIds?: string[];
    limit?: number;
  };
  const s = getState();
  const card = s.scorecards.find((c) => c.id === body.id);

  switch (body.action) {
    case "add-scorecard": {
      const c: Scorecard = {
        id: rid("sc"),
        name: String(body.name || "New scorecard").slice(0, 80),
        enabled: true,
        threshold: 70,
        rules: [],
        createdAt: Date.now(),
      };
      s.scorecards.unshift(c);
      return ok();
    }
    case "delete-scorecard": {
      s.scorecards = s.scorecards.filter((c) => c.id !== body.id);
      return ok();
    }
    case "toggle-scorecard": {
      if (card) card.enabled = !card.enabled;
      return ok();
    }
    case "set-threshold": {
      if (card) card.threshold = Math.max(0, Math.min(100, Number(body.threshold) || 0));
      return ok();
    }
    case "add-rule": {
      if (!card) return NextResponse.json({ error: "unknown scorecard" }, { status: 400 });
      const label = String(body.label ?? "").trim();
      if (!label) return NextResponse.json({ error: "label required" }, { status: 400 });
      const component = (SCORED_COMPONENTS as readonly string[]).includes(body.component ?? "")
        ? (body.component as ScoredComponent)
        : "overall";
      const rule: ScoreRule = {
        id: rid("rule"),
        component,
        label: label.slice(0, 200),
        points: Math.max(1, Math.min(100, Number(body.points) || 10)),
      };
      card.rules.push(rule);
      return ok();
    }
    case "delete-rule": {
      if (card) card.rules = card.rules.filter((r) => r.id !== body.ruleId);
      return ok();
    }

    /**
     * Grade ads. Costs one model call per ad, so it is always explicit and
     * always bounded — never wired into the loop where it would multiply
     * silently with every cycle.
     */
    case "judge": {
      const cards = s.scorecards.filter((c) => c.enabled && c.rules.length);
      if (!cards.length) {
        return NextResponse.json(
          { error: "No enabled scorecard with rules." },
          { status: 400 },
        );
      }
      const card0 = cards[0];

      const pool = (body.adIds?.length
        ? body.adIds.map((id) => s.ads[id])
        : s.adOrder.map((id) => s.ads[id]).filter((a) => a && a.status === "active")
      ).filter(Boolean) as Ad[];

      const limit = Math.max(1, Math.min(20, Number(body.limit) || 6));
      const chosen = pool.slice(0, limit);
      if (!chosen.length) {
        return NextResponse.json({ error: "no ads to judge" }, { status: 400 });
      }

      const max = card0.rules.reduce((n, r) => n + r.points, 0);
      let judged = 0;

      for (const ad of chosen) {
        const results = await judgeAd(ad.creative, card0.rules);
        if (!results) continue;
        const byId = new Map(results.map((r) => [r.ruleId, r]));
        const rows = card0.rules.map((r) => {
          const got = byId.get(r.id);
          return {
            ruleId: r.id,
            label: r.label,
            component: r.component,
            awarded: Math.max(0, Math.min(r.points, Math.round(got?.awarded ?? 0))),
            max: r.points,
            note: got?.note ?? "not judged",
          };
        });
        const total = rows.reduce((n, r) => n + r.awarded, 0);
        const j: AdJudgement = {
          scorecardId: card0.id,
          scorecardName: card0.name,
          total,
          max,
          pass: max > 0 && (total / max) * 100 >= card0.threshold,
          results: rows,
          at: Date.now(),
        };
        ad.judgement = j;
        judged++;
      }

      if (!judged) {
        return NextResponse.json(
          { error: "Judging needs ANTHROPIC_API_KEY — there is no offline judge." },
          { status: 400 },
        );
      }
      const passed = chosen.filter((a) => a.judgement?.pass).length;
      log(
        `Scored ${judged} ad(s) against "${card0.name}" — ${passed} cleared the ${card0.threshold}% bar.`,
        "good",
      );
      return ok();
    }
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
