import { NextResponse } from "next/server";
import { getState } from "@/lib/store";
import { hasBinary } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = getState();
  // Report what this *process* can see, not what is on disk. Next reads .env
  // once at boot, so an edit made after startup is invisible until restart —
  // which is exactly the confusion this field exists to end.
  s.machine.credentials = {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    claudeCli: await hasBinary("claude"),
  };
  return NextResponse.json(s);
}
