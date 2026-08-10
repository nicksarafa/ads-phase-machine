import { NextResponse } from "next/server";
import { pushState } from "@/lib/bus";
import { getState, log, persist } from "@/lib/store";
import { DEFAULT_BRIEF } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const { brief, reset } = (await req.json()) as {
    brief?: string;
    reset?: boolean;
  };
  const s = getState();

  s.brief = reset ? DEFAULT_BRIEF : String(brief ?? "").slice(0, 20_000);
  log(
    "Operator brief updated. It takes effect on the next generate phase.",
    "good",
  );
  persist();
  pushState(getState, true);
  return NextResponse.json({ brief: s.brief });
}
