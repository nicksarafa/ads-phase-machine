import { NextResponse } from "next/server";
import { pushState } from "@/lib/bus";
import { getState, log, persist } from "@/lib/store";
import { enqueue, renderAiImage, resolveProvider } from "@/lib/imagegen";
import type { Ad } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Render real imagery for a bounded set of ads.
 *
 * The loop renders whatever it generates, which is the right default but the
 * wrong thing when each image costs money. This endpoint takes an explicit
 * budget: render exactly N ads, chosen by score or recency, and nothing else.
 */
export async function POST(req: Request) {
  const {
    limit = 6,
    scope = "top",
    adIds,
  } = (await req.json().catch(() => ({}))) as {
    limit?: number;
    scope?: "top" | "latest";
    adIds?: string[];
  };

  const s = getState();
  const provider = await resolveProvider();
  if (provider === "procedural") {
    return NextResponse.json(
      { error: "No AI image provider configured. Set GEMINI_API_KEY in .env." },
      { status: 400 },
    );
  }

  const all = s.adOrder.map((id) => s.ads[id]).filter(Boolean) as Ad[];

  let chosen: Ad[];
  if (adIds?.length) {
    chosen = adIds.map((id) => s.ads[id]).filter(Boolean) as Ad[];
  } else {
    const pool = all.filter((a) => a.status === "active" || a.status === "rendering");
    const ranked =
      scope === "latest"
        ? [...pool].reverse()
        : [...pool].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    chosen = ranked.slice(0, Math.max(1, Math.min(50, limit)));
  }

  if (!chosen.length) {
    return NextResponse.json({ error: "no ads to render" }, { status: 400 });
  }

  s.machine.imageProvider = provider;
  log(
    `Rendering ${chosen.length} ad(s) on ${provider} — ${chosen.map((a) => a.label).join(", ")}.`,
    "info",
    "render",
  );

  for (const ad of chosen) {
    ad.image = { ...ad.image, status: "rendering", error: null };
    enqueue(async () => {
      try {
        const res = await renderAiImage(ad.id, ad.creative.imagePrompt, {
          withLogo: getState().settings.brandLogo,
        });
        const live = getState().ads[ad.id];
        if (!live) return;
        live.image = {
          status: "ready",
          url: `/api/image/${ad.id}?v=${Date.now()}`,
          provider: res.provider,
          error: null,
        };
        log(`Image ready for ${live.label} (${res.provider}).`, "good", "render");
      } catch (e) {
        const live = getState().ads[ad.id];
        if (!live) return;
        live.image = {
          ...live.image,
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
        };
        log(`Render failed for ${live.label}: ${live.image.error}`, "warn", "render");
      }
      persist();
      pushState(getState, true);
    });
  }

  persist();
  pushState(getState, true);
  return NextResponse.json({
    queued: chosen.length,
    provider,
    ads: chosen.map((a) => ({ id: a.id, label: a.label, headline: a.creative.headline })),
  });
}
