import { NextResponse } from "next/server";
import { pushState } from "@/lib/bus";
import { getState, log, persist } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Human feedback on a specific ad. This is read back in the generate phase and
 * is explicitly told to outrank the metrics — the operator is part of the loop,
 * not a spectator.
 */
export async function POST(req: Request) {
  const { adId, rating, note } = (await req.json()) as {
    adId: string;
    rating: 1 | -1 | 0;
    note?: string;
  };

  const s = getState();
  const ad = s.ads[adId];
  if (!ad) return NextResponse.json({ error: "unknown ad" }, { status: 404 });

  if (rating === 0) {
    ad.feedback = [];
    log(`Cleared feedback on ${ad.label}.`);
  } else {
    ad.feedback = ad.feedback.filter((f) => f.note !== (note ?? ""));
    ad.feedback.push({ rating, note: (note ?? "").slice(0, 500), at: Date.now() });
    log(
      `${rating > 0 ? "Kept" : "Rejected"} ${ad.label}: "${ad.creative.headline}"${
        note ? ` — ${note}` : ""
      }`,
      rating > 0 ? "good" : "warn",
    );
  }

  persist();
  pushState(getState, true);
  return NextResponse.json({ ok: true });
}
