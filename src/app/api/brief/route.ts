import { NextResponse } from "next/server";
import { pushState } from "@/lib/bus";
import { getState, log, persist } from "@/lib/store";
import { DEFAULT_CAMPAIGNS } from "@/lib/store";
import { activeCampaign } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const { brief, reset } = (await req.json()) as {
    brief?: string;
    reset?: boolean;
  };
  const s = getState();

  // The brief belongs to whichever campaign is on screen. Editing it while
  // Workshops is selected must never rewrite the Team Training brief.
  const campaign = activeCampaign(s);
  const fallback =
    DEFAULT_CAMPAIGNS().find((c) => c.id === campaign.id)?.brief ?? campaign.brief;

  campaign.brief = reset ? fallback : String(brief ?? "").slice(0, 20_000);
  log(
    `Brief for ${campaign.name} updated. It takes effect on the next generate phase.`,
    "good",
  );
  persist();
  pushState(getState, true);
  return NextResponse.json({ brief: campaign.brief });
}
