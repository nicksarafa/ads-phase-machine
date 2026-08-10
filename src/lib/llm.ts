import { spawn } from "node:child_process";
import { GENE_SPACE, type Ad, type GeneKey, type Genes } from "./types";
import { BRAND, brandBlock } from "./brand";
import type { ContextSource, GeneInsight } from "./types";

/**
 * Copy + strategy generation.
 *
 * Provider chain, first that works wins:
 *   1. Anthropic API   (ANTHROPIC_API_KEY) — structured outputs, fast, best copy
 *   2. `claude` CLI    (existing Claude Code auth, no key needed) — slower
 *   3. offline composer — deterministic, keeps the demo alive with no network
 *
 * The offline composer is not a toy: it walks the same gene space and respects
 * the exploit plan, so the learning curve still moves. It just writes duller
 * copy than a model does.
 */

export interface AdDraft {
  genes: Genes;
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
  imagePrompt: string;
  rationale: string;
}

export interface GenerateInput {
  count: number;
  cycle: number;
  brief: string;
  context: ContextSource[];
  insights: GeneInsight[];
  exploit: Partial<Record<GeneKey, string[]>>;
  learnings: string[];
  winners: Ad[];
  losers: Ad[];
  feedbackNotes: { headline: string; rating: number; note: string }[];
  usedHeadlines: string[];
}

export interface GenerateResult {
  ads: AdDraft[];
  provider: string;
}

const MODEL = process.env.ADS_LLM_MODEL || "claude-opus-5";
const EFFORT = (process.env.ADS_LLM_EFFORT || "low") as
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

const AD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ads"],
  properties: {
    ads: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "angle",
          "hook",
          "audience",
          "visual",
          "tone",
          "offer",
          "headline",
          "primaryText",
          "description",
          "cta",
          "imagePrompt",
          "rationale",
        ],
        properties: {
          angle: { type: "string", enum: [...GENE_SPACE.angle] },
          hook: { type: "string", enum: [...GENE_SPACE.hook] },
          audience: { type: "string", enum: [...GENE_SPACE.audience] },
          visual: { type: "string", enum: [...GENE_SPACE.visual] },
          tone: { type: "string", enum: [...GENE_SPACE.tone] },
          offer: { type: "string", enum: [...GENE_SPACE.offer] },
          headline: { type: "string" },
          primaryText: { type: "string" },
          description: { type: "string" },
          cta: { type: "string" },
          imagePrompt: { type: "string" },
          rationale: { type: "string" },
        },
      },
    },
  },
} as const;

function buildPrompt(input: GenerateInput): string {
  const parts: string[] = [];

  parts.push(brandBlock());
  parts.push("");
  parts.push("OPERATOR BRIEF (this is the current prompt, edited live in the UI):");
  parts.push(input.brief.trim());

  const ctx = input.context.filter((c) => c.enabled);
  if (ctx.length) {
    parts.push("");
    parts.push("COLLECTED CONTEXT:");
    for (const c of ctx) parts.push(`- [${c.kind}] ${c.title}: ${c.body}`);
  }

  if (input.learnings.length) {
    parts.push("");
    parts.push(`MEASURED LEARNINGS AFTER ${input.cycle} CYCLE(S):`);
    for (const l of input.learnings) parts.push(`- ${l}`);
  }

  if (input.winners.length) {
    parts.push("");
    parts.push("TOP PERFORMERS SO FAR (do not copy them; extract why they worked):");
    for (const w of input.winners.slice(0, 3)) {
      parts.push(
        `- "${w.creative.headline}" [${geneStr(w.genes)}] CTR ${(w.metrics.ctr * 100).toFixed(2)}% · CPA $${w.metrics.cpa.toFixed(2)} · ROAS ${w.metrics.roas.toFixed(2)}x`,
      );
    }
  }

  if (input.losers.length) {
    parts.push("");
    parts.push("KILLED (do not repeat these shapes):");
    for (const l of input.losers.slice(0, 4)) {
      parts.push(`- "${l.creative.headline}" [${geneStr(l.genes)}]`);
    }
  }

  if (input.feedbackNotes.length) {
    parts.push("");
    parts.push("OPERATOR FEEDBACK — this outranks the metrics:");
    for (const f of input.feedbackNotes) {
      const mark = f.rating > 0 ? "KEEP" : "REJECT";
      parts.push(`- ${mark} "${f.headline}"${f.note ? ` — ${f.note}` : ""}`);
    }
  }

  const exploitLines = Object.entries(input.exploit).map(
    ([k, v]) => `- ${k}: prefer ${(v as string[]).join(", ")}`,
  );
  if (exploitLines.length) {
    parts.push("");
    parts.push("EXPLOIT (measured winners — use these in roughly 2 of every 3 ads):");
    parts.push(...exploitLines);
  }

  if (input.usedHeadlines.length) {
    parts.push("");
    parts.push("HEADLINES ALREADY RUNNING — every new headline must be distinct from all of these:");
    for (const h of input.usedHeadlines.slice(-24)) parts.push(`- ${h}`);
  }

  parts.push("");
  parts.push(`TASK: write exactly ${input.count} Facebook feed ads.`);
  parts.push(
    [
      "Each ad is its own specific ad — a different person, a different moment, a different concrete build.",
      "Do not write variations of one idea with words swapped.",
      "",
      "For each ad choose its strategic DNA from the allowed values:",
      ...Object.entries(GENE_SPACE).map(
        ([k, v]) => `  ${k}: ${(v as readonly string[]).join(" | ")}`,
      ),
      "",
      "Spend roughly two thirds of the batch exploiting what has been measured to work,",
      "and one third exploring gene combinations that have not been tried yet. If nothing",
      "has been measured yet, cover the space as widely as possible.",
      "",
      "Fields:",
      "  headline     under 40 characters, no trailing period",
      "  primaryText  2-4 short lines, the body of the post",
      "  description  one line under the headline, under 30 characters",
      "  cta          one of: Learn More | Sign Up | Get Offer | Book Now | Download",
      "  imagePrompt  a photographic or graphic prompt for the ad image. Describe the",
      "               subject, composition, lighting and mood. No text in the image.",
      "  rationale    one sentence: who this ad is for and why it should work",
    ].join("\n"),
  );

  return parts.join("\n");
}

function geneStr(g: Genes) {
  return Object.entries(g)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
}

const SYSTEM = `You are a direct-response creative strategist running paid social for a real business.
You write ads that a specific human would stop scrolling for, and you can defend every choice with a reason.
You never write filler. You never write the same ad twice.
Return only the structured output requested.`;

// ---------------------------------------------------------------- provider 1

async function viaAnthropic(input: GenerateInput): Promise<GenerateResult> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: {
      effort: EFFORT,
      format: { type: "json_schema", schema: AD_SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [{ role: "user", content: buildPrompt(input) }],
  } as never);

  const msg = response as unknown as {
    stop_reason: string;
    content: { type: string; text?: string }[];
  };

  if (msg.stop_reason === "refusal") {
    throw new Error("model declined the request");
  }

  const text = msg.content.find((b) => b.type === "text")?.text ?? "";
  return { ads: parseDrafts(text, input.count), provider: `anthropic:${MODEL}` };
}

// ---------------------------------------------------------------- provider 2

async function viaClaudeCli(
  input: GenerateInput,
  timeoutMs = LLM_TIMEOUT_MS,
): Promise<GenerateResult> {
  const prompt = [
    SYSTEM,
    "",
    buildPrompt(input),
    "",
    "Respond with a single JSON object and nothing else:",
    '{"ads":[{"angle":"...","hook":"...","audience":"...","visual":"...","tone":"...","offer":"...","headline":"...","primaryText":"...","description":"...","cta":"...","imagePrompt":"...","rationale":"..."}]}',
  ].join("\n");

  const out = await run("claude", ["-p", prompt, "--output-format", "json"], timeoutMs);
  let payload = out;
  try {
    const wrapper = JSON.parse(out) as { result?: string };
    if (typeof wrapper.result === "string") payload = wrapper.result;
  } catch {
    /* raw text is fine too */
  }
  return { ads: parseDrafts(payload, input.count), provider: "claude-cli" };
}

// ---------------------------------------------------------------- provider 3

const SUBJECTS = [
  "an internal booking tool",
  "a dashboard that replaced three spreadsheets",
  "a client portal built in an afternoon",
  "an invoice chaser that runs itself",
  "a lead qualifier that reads the inbox",
  "a report that writes itself every Monday",
  "an onboarding flow with no developer involved",
  "a pricing calculator the sales team actually uses",
];

const OPENERS: Record<string, (s: string, who: string) => string> = {
  question: (s, who) => `What would you build first if ${s} took one evening?`,
  stat: (s) => `1,300 people have now built things like ${s}.`,
  story: (s, who) => `A ${who} showed up with a spreadsheet problem and left with ${s}.`,
  command: (s) => `Stop watching AI videos. Build ${s} instead.`,
  "bold-claim": (s) => `The gap between the idea and ${s} is now one Wednesday.`,
  negation: (s) => `You do not need to learn to code to ship ${s}.`,
};

const WHO: Record<string, string> = {
  founders: "founder",
  marketers: "marketer",
  operators: "ops lead",
  "career-switchers": "career switcher",
  "agency-owners": "agency owner",
  teams: "team lead",
};

function offline(input: GenerateInput): GenerateResult {
  const ads: AdDraft[] = [];
  const pick = <T,>(arr: readonly T[], i: number) => arr[i % arr.length];

  for (let i = 0; i < input.count; i++) {
    const exploitFor = (key: GeneKey) => {
      const pool = input.exploit[key];
      // Two thirds exploit, one third explore.
      if (pool && pool.length && i % 3 !== 2) return pool[i % pool.length];
      return pick(GENE_SPACE[key], i * 7 + key.length);
    };

    const genes: Genes = {
      angle: exploitFor("angle"),
      hook: exploitFor("hook"),
      audience: exploitFor("audience"),
      visual: exploitFor("visual"),
      tone: exploitFor("tone"),
      offer: exploitFor("offer"),
    };

    const subject = pick(SUBJECTS, i + input.cycle * 3);
    const who = WHO[genes.audience] ?? "builder";
    const opener = (OPENERS[genes.hook] ?? OPENERS.question)(subject, who);
    const offer = BRAND.offers[genes.offer as keyof typeof BRAND.offers];

    ads.push({
      genes,
      headline: shorten(
        genes.angle === "cost-saving"
          ? "Replace $800/mo of SaaS"
          : genes.angle === "time-saving"
            ? "Ship it by Wednesday"
            : genes.angle === "proof"
              ? "1,300 people, real builds"
              : `Build ${subject.replace(/^an?\s+/, "")}`,
        38,
      ),
      primaryText: [
        opener,
        `Light School is a hands-on workshop for ${who}s. You leave with the thing built, not with notes about it.`,
        offer.note,
      ].join("\n\n"),
      description: offer.label,
      cta: genes.offer === "team-training" ? "Book Now" : "Sign Up",
      imagePrompt: `${genes.visual} composition, ${genes.tone} mood: a ${who} at a laptop with ${subject} on screen, warm natural light, shallow depth of field, candid documentary photography, no text`,
      rationale: `Offline composer: ${genes.angle} angle at ${who}s via a ${genes.hook} hook for the ${genes.offer} offer.`,
    });
  }

  return { ads, provider: "offline" };
}

// ---------------------------------------------------------------- entrypoint

/**
 * Hard ceiling on how long a phase may wait for copy. Past this the offline
 * composer takes over so the loop always advances — a demo that hangs in
 * `generate` is worse than a demo with duller copy for one cycle.
 */
export const LLM_TIMEOUT_MS = Number(process.env.ADS_LLM_TIMEOUT_MS || 100_000);

export async function generateAds(input: GenerateInput): Promise<GenerateResult> {
  const errors: string[] = [];
  const deadline = Date.now() + LLM_TIMEOUT_MS;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await withDeadline(viaAnthropic(input), deadline - Date.now(), "anthropic");
    } catch (e) {
      errors.push(`anthropic: ${msgOf(e)}`);
    }
  }

  const remaining = deadline - Date.now();
  if (remaining > 5_000 && (await hasBinary("claude"))) {
    try {
      return await withDeadline(viaClaudeCli(input, remaining), remaining, "claude-cli");
    } catch (e) {
      errors.push(`claude-cli: ${msgOf(e)}`);
    }
  }

  const result = offline(input);
  result.provider = errors.length ? `offline · ${errors.join("; ")}` : "offline";
  return result;
}

function withDeadline<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} exceeded ${Math.round(ms / 1000)}s budget`)),
        Math.max(1000, ms),
      ),
    ),
  ]);
}

// ---------------------------------------------------------------- utilities

function parseDrafts(text: string, expected: number): AdDraft[] {
  const json = extractJson(text);
  if (!json) throw new Error("no JSON object in model output");
  const parsed = JSON.parse(json) as {
    ads?: Record<string, string>[];
  };
  const rows = parsed.ads ?? [];
  if (!rows.length) throw new Error("model returned zero ads");

  const drafts = rows.slice(0, expected).map((r) => ({
    genes: {
      angle: coerce("angle", r.angle),
      hook: coerce("hook", r.hook),
      audience: coerce("audience", r.audience),
      visual: coerce("visual", r.visual),
      tone: coerce("tone", r.tone),
      offer: coerce("offer", r.offer),
    },
    headline: String(r.headline ?? "").trim() || "Build it this Wednesday",
    primaryText: String(r.primaryText ?? "").trim(),
    description: String(r.description ?? "").trim(),
    cta: String(r.cta ?? "Learn More").trim(),
    imagePrompt: String(r.imagePrompt ?? "").trim(),
    rationale: String(r.rationale ?? "").trim(),
  }));

  return drafts;
}

function coerce(key: GeneKey, value: unknown): string {
  const allowed = GENE_SPACE[key] as readonly string[];
  const v = String(value ?? "").trim();
  if (allowed.includes(v)) return v;
  // Models occasionally reword an enum; snap to the closest allowed value.
  const lower = v.toLowerCase();
  const near = allowed.find((a) => lower.includes(a) || a.includes(lower));
  return near ?? allowed[0];
}

function extractJson(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text;
  const start = body.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return body.slice(start, i + 1);
    }
  }
  return null;
}

function shorten(s: string, n: number) {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

function msgOf(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

const binaryCache = new Map<string, boolean>();
export async function hasBinary(name: string): Promise<boolean> {
  const cached = binaryCache.get(name);
  if (cached !== undefined) return cached;
  let ok = false;
  try {
    await run("which", [name], 4000);
    ok = true;
  } catch {
    ok = false;
  }
  binaryCache.set(name, ok);
  return ok;
}

export function run(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(err.trim().slice(0, 300) || `${cmd} exited ${code}`));
    });
  });
}
