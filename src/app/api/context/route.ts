import { NextResponse } from "next/server";
import { pushState } from "@/lib/bus";
import { getState, log, persist } from "@/lib/store";
import type { ContextSource } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: ContextSource["kind"][] = ["note", "url", "audience", "proof"];

/** Add or toggle a collected context source that feeds the generate phase. */
export async function POST(req: Request) {
  const body = (await req.json()) as Partial<ContextSource> & {
    op?: "toggle" | "delete";
  };
  const s = getState();

  if (body.op === "toggle" && body.id) {
    const c = s.context.find((x) => x.id === body.id);
    if (c) c.enabled = !c.enabled;
  } else if (body.op === "delete" && body.id) {
    s.context = s.context.filter((x) => x.id !== body.id);
  } else {
    const title = String(body.title ?? "").trim().slice(0, 120);
    const bodyText = String(body.body ?? "").trim().slice(0, 4000);
    if (!title || !bodyText) {
      return NextResponse.json({ error: "title and body required" }, { status: 400 });
    }
    const kind = KINDS.includes(body.kind as ContextSource["kind"])
      ? (body.kind as ContextSource["kind"])
      : "note";

    let resolved = bodyText;
    if (kind === "url") {
      resolved = await fetchReadable(bodyText).catch(
        (e) => `${bodyText}\n(could not fetch: ${e instanceof Error ? e.message : e})`,
      );
    }

    s.context.push({
      id: `ctx-${Date.now().toString(36)}`,
      title,
      kind,
      body: resolved,
      enabled: true,
      createdAt: Date.now(),
    });
    log(`Context added: ${title}. It joins the next generate phase.`, "good");
  }

  persist();
  pushState(getState, true);
  return NextResponse.json({ context: s.context });
}

/** Crude readability pass — enough to give the copywriter real page text. */
async function fetchReadable(url: string): Promise<string> {
  const target = url.startsWith("http") ? url : `https://${url}`;
  const res = await fetch(target, {
    headers: { "user-agent": "ads-phase-machine/0.1" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${target}\n\n${text.slice(0, 3000)}`;
}
