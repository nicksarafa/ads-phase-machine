import fs from "node:fs";
import path from "node:path";
import { IMAGE_DIR } from "./store";
import { hasBinary, run } from "./llm";
import { BRAND_STYLE } from "./brand";
import type { Genes } from "./types";

/**
 * Ad imagery.
 *
 * Every ad gets a real generated image. Because a model round-trip takes tens
 * of seconds and the demo loop runs in seconds, generation is asynchronous:
 * each ad is written to disk immediately with procedural artwork so the wall is
 * never empty, an AI render is queued, and the card swaps to it when it lands.
 * Setting imageMode to "procedural" skips the queue entirely for a fast demo.
 */

export type ImageProvider = "google" | "openai" | "claude-mcp" | "procedural";

/** "Nano Banana Pro" is Google's image model on the Gemini API. */
const GOOGLE_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview";

function googleKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

const CONCURRENCY = Number(process.env.ADS_IMAGE_CONCURRENCY || 2);

let queue: (() => Promise<void>)[] = [];
let inFlight = 0;

function pump() {
  while (inFlight < CONCURRENCY && queue.length) {
    const job = queue.shift()!;
    inFlight++;
    job()
      .catch(() => {})
      .finally(() => {
        inFlight--;
        pump();
      });
  }
}

export function enqueue(job: () => Promise<void>) {
  queue.push(job);
  pump();
}

export function clearQueue() {
  queue = [];
}

export function queueDepth() {
  return queue.length + inFlight;
}

// ------------------------------------------------------------ provider chain

let resolvedProvider: ImageProvider | null = null;

export async function resolveProvider(): Promise<ImageProvider> {
  if (resolvedProvider) return resolvedProvider;
  const forced = process.env.ADS_IMAGE_PROVIDER;
  if (forced && forced !== "auto") {
    resolvedProvider = forced as ImageProvider;
    return resolvedProvider;
  }
  if (googleKey()) resolvedProvider = "google";
  else if (process.env.OPENAI_API_KEY) resolvedProvider = "openai";
  else if (await hasBinary("claude")) resolvedProvider = "claude-mcp";
  else resolvedProvider = "procedural";
  return resolvedProvider;
}

/** Re-read the env on the next resolve — used after a settings change. */
export function forgetProvider() {
  resolvedProvider = null;
}

export interface RenderResult {
  file: string;
  provider: string;
}

/**
 * Providers demoted for the rest of the process because their credential is
 * present but not usable — wrong key type, no entitlement, or exhausted quota.
 * Without this, a dead key makes every single ad pay the full request cost and
 * fail, instead of the chain falling through to one that works.
 */
const demoted = new Set<ImageProvider>();

/** Auth/entitlement/quota failures are permanent for this run; retrying them
 *  per-ad just burns time. Transient network errors are not demoted. */
function isCredentialFailure(message: string): boolean {
  return /\b(400|401|403|404|429)\b|not set|UNAUTHENTICATED|PERMISSION_DENIED|quota/i.test(
    message,
  );
}

/** The Light School mark, base64'd once, for models that accept a reference image. */
let markCache: string | null | undefined;
function brandMark(): string | null {
  if (markCache !== undefined) return markCache;
  try {
    const p = path.join(process.cwd(), "public", BRAND_STYLE.markPng);
    markCache = fs.readFileSync(p).toString("base64");
  } catch {
    markCache = null;
  }
  return markCache;
}

/** Wrap the ad's own image prompt in the house art direction. */
export function brandedPrompt(prompt: string, withLogo: boolean): string {
  return [
    prompt,
    "",
    BRAND_STYLE.artDirection,
    withLogo
      ? `Place ${BRAND_STYLE.markDescription} small and unobtrusive in one corner, as a real brand would — roughly 8% of the frame, correct proportions, no other text or lettering anywhere.`
      : "No text, letters, words, logos or watermarks anywhere in the image.",
    "Square 1:1 crop, suitable for a Facebook feed ad.",
  ].join("\n");
}

export async function renderAiImage(
  adId: string,
  prompt: string,
  opts: { withLogo?: boolean } = {},
): Promise<RenderResult> {
  const chain: ImageProvider[] = ["google", "openai", "claude-mcp"];
  const preferred = await resolveProvider();
  if (preferred === "procedural") throw new Error("no AI image provider configured");

  // Try the resolved provider first, then anything else that is configured.
  const order = [preferred, ...chain.filter((p) => p !== preferred)].filter(
    (p) => !demoted.has(p) && isConfigured(p),
  );
  if (!order.length) throw new Error("no usable AI image provider");

  const withLogo = opts.withLogo ?? false;
  const full = brandedPrompt(prompt, withLogo);

  let lastError = "";
  for (const provider of order) {
    try {
      if (provider === "google") return await renderGoogle(adId, full, withLogo);
      if (provider === "openai") return await renderOpenAi(adId, full);
      if (provider === "claude-mcp") return await renderViaClaudeMcp(adId, full);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (isCredentialFailure(lastError)) {
        demoted.add(provider);
        console.warn(
          `[imagegen] ${provider} disabled for this run — ${lastError.slice(0, 160)}`,
        );
      }
    }
  }
  throw new Error(lastError || "all image providers failed");
}

function isConfigured(p: ImageProvider): boolean {
  if (p === "google") return Boolean(googleKey());
  if (p === "openai") return Boolean(process.env.OPENAI_API_KEY);
  if (p === "claude-mcp") return true;
  return false;
}

/** Surfaced in the UI so a demoted provider is visible, not silent. */
export function demotedProviders(): string[] {
  return [...demoted];
}

/**
 * Google's Gemini image models ("Nano Banana Pro"). Returns the image inline as
 * base64 on the generateContent response rather than as a URL to fetch.
 */
async function renderGoogle(
  adId: string,
  prompt: string,
  withLogo = false,
): Promise<RenderResult> {
  const key = googleKey();
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  // AI Studio keys start with AIza. A Google Labs `AQ.` token authenticates
  // against models.list but is not entitled to call generateContent, which
  // surfaces as an empty-bodied 404 on every single ad — fail fast instead.
  if (!key.startsWith("AIza")) {
    throw new Error(
      "403 GEMINI_API_KEY is not an AI Studio key (expected AIza…, got " +
        `${key.slice(0, 3)}…). Create one at https://aistudio.google.com/apikey`,
    );
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_IMAGE_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            // Nano Banana Pro renders a supplied mark far more faithfully than
            // it renders one described in words, so pass the real PNG.
            parts: [
              ...(withLogo && brandMark()
                ? [
                    {
                      inlineData: {
                        mimeType: "image/png",
                        data: brandMark() as string,
                      },
                    },
                    {
                      text: "Reference image: the Light School logo. Reproduce it exactly as given — do not redraw, restyle or add text to it.",
                    },
                  ]
                : []),
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "1:1" },
        },
      }),
      signal: AbortSignal.timeout(180_000),
    },
  );

  if (!res.ok) {
    throw new Error(
      `gemini images ${res.status}: ${(await res.text()).slice(0, 240)}`,
    );
  }

  const json = (await res.json()) as {
    candidates?: {
      finishReason?: string;
      content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] };
    }[];
    promptFeedback?: { blockReason?: string };
  };

  const candidate = json.candidates?.[0];
  const inline = candidate?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;

  if (!inline?.data) {
    const why =
      json.promptFeedback?.blockReason ??
      candidate?.finishReason ??
      "no inline image in response";
    throw new Error(`gemini returned no image (${why})`);
  }


  const ext = (inline.mimeType ?? "").includes("jpeg")
    ? "jpg"
    : (inline.mimeType ?? "").includes("webp")
      ? "webp"
      : "png";
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  const file = path.join(IMAGE_DIR, `${adId}.${ext}`);
  fs.writeFileSync(file, Buffer.from(inline.data, "base64"));
  return { file, provider: `google:${GOOGLE_IMAGE_MODEL}` };
}

async function renderOpenAi(adId: string, prompt: string): Promise<RenderResult> {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, prompt, size: "1024x1024", n: 1 }),
  });
  if (!res.ok) {
    throw new Error(`openai images ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data: { b64_json?: string; url?: string }[];
  };
  const item = json.data?.[0];
  if (item?.b64_json) {
    const file = path.join(IMAGE_DIR, `${adId}.png`);
    fs.writeFileSync(file, Buffer.from(item.b64_json, "base64"));
    return { file, provider: `openai:${model}` };
  }
  if (item?.url) return { file: await download(item.url, adId), provider: `openai:${model}` };
  throw new Error("openai returned no image");
}

/**
 * Uses the local `claude` CLI to drive whichever image MCP is connected. No API
 * key needed — it reuses the operator's existing Claude Code auth.
 */
async function renderViaClaudeMcp(
  adId: string,
  prompt: string,
): Promise<RenderResult> {
  const instruction = [
    "Generate one image with an image generation tool and reply with nothing but its URL.",
    "Do not explain. Do not add markdown. Output must be a bare https:// URL.",
    "",
    `Image prompt: ${prompt}`,
    "Aspect ratio: square. No text or lettering anywhere in the image.",
  ].join("\n");

  const out = await run(
    "claude",
    ["-p", instruction, "--output-format", "json"],
    300_000,
  );

  let text = out;
  try {
    const wrapper = JSON.parse(out) as { result?: string };
    if (typeof wrapper.result === "string") text = wrapper.result;
  } catch {
    /* raw text is fine */
  }

  const url = text.match(/https?:\/\/[^\s"'<>)\]]+/)?.[0];
  if (!url) throw new Error("image tool returned no URL");
  return { file: await download(url, adId), provider: "claude-mcp" };
}

async function download(url: string, adId: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") ?? "";
  const ext = type.includes("webp")
    ? "webp"
    : type.includes("jpeg") || type.includes("jpg")
      ? "jpg"
      : "png";
  const file = path.join(IMAGE_DIR, `${adId}.${ext}`);
  fs.writeFileSync(file, buf);
  return file;
}

// -------------------------------------------------------- procedural artwork

/** Tone-shifted variants of the Light School palette (violet #6868E8). */
const PALETTES: Record<string, [string, string, string, string]> = {
  warm: ["#17161f", "#8b7ae8", "#EFEAFB", "#3b2f6e"],
  urgent: ["#14121c", "#6868E8", "#DEDCFA", "#4646b4"],
  analytical: ["#0A0A0B", "#5D5DDA", "#DEDCFA", "#2f2f80"],
  playful: ["#1a1526", "#8f6ef0", "#F0EFFE", "#5050C8"],
  authoritative: ["#0A0A0B", "#6868E8", "#F0EFFE", "#252A0B"],
};

/**
 * A deterministic generative composition. Same ad, same picture, every time —
 * which matters when you re-run a demo in front of an audience.
 */
export function proceduralSvg(adId: string, genes: Genes, seedText: string): string {
  const rand = seeded(`${adId}:${seedText}`);
  const [bg, accent, light, deep] =
    PALETTES[genes.tone] ?? PALETTES.analytical;
  const W = 1024;
  const H = 1024;

  const shapes: string[] = [];

  const blobs = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < blobs; i++) {
    const cx = rand() * W;
    const cy = rand() * H;
    const r = 140 + rand() * 380;
    const c = [accent, light, deep][Math.floor(rand() * 3)];
    shapes.push(
      `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${c}" opacity="${(0.16 + rand() * 0.26).toFixed(2)}" filter="url(#soft)"/>`,
    );
  }

  switch (genes.visual) {
    case "screenshot": {
      // A stylised UI: window chrome, sidebar, rows, one highlighted metric.
      const x = 150;
      const y = 250;
      shapes.push(
        `<rect x="${x}" y="${y}" width="724" height="524" rx="22" fill="#0b0f14" opacity="0.92"/>`,
        `<rect x="${x}" y="${y}" width="724" height="46" rx="22" fill="${deep}" opacity="0.9"/>`,
        `<circle cx="${x + 28}" cy="${y + 23}" r="7" fill="#ff5f57"/>`,
        `<circle cx="${x + 50}" cy="${y + 23}" r="7" fill="#febc2e"/>`,
        `<circle cx="${x + 72}" cy="${y + 23}" r="7" fill="#28c840"/>`,
        `<rect x="${x + 20}" y="${y + 70}" width="150" height="434" rx="12" fill="#ffffff" opacity="0.06"/>`,
      );
      for (let i = 0; i < 7; i++) {
        shapes.push(
          `<rect x="${x + 40}" y="${y + 96 + i * 42}" width="${60 + rand() * 90}" height="12" rx="6" fill="${light}" opacity="0.35"/>`,
        );
      }
      for (let i = 0; i < 5; i++) {
        shapes.push(
          `<rect x="${x + 196}" y="${y + 96 + i * 78}" width="${360 + rand() * 140}" height="52" rx="12" fill="#ffffff" opacity="0.07"/>`,
        );
      }
      shapes.push(
        `<rect x="${x + 196}" y="${y + 96}" width="${420}" height="52" rx="12" fill="${accent}" opacity="0.5"/>`,
      );
      break;
    }
    case "before-after": {
      shapes.push(
        `<rect x="90" y="300" width="380" height="424" rx="20" fill="#0b0f14" opacity="0.85"/>`,
        `<rect x="554" y="300" width="380" height="424" rx="20" fill="${accent}" opacity="0.22"/>`,
        `<rect x="506" y="240" width="12" height="544" rx="6" fill="${light}" opacity="0.5"/>`,
      );
      for (let i = 0; i < 9; i++) {
        shapes.push(
          `<rect x="120" y="${340 + i * 40}" width="${80 + rand() * 200}" height="14" rx="7" fill="#ffffff" opacity="0.12"/>`,
        );
      }
      shapes.push(
        `<rect x="584" y="360" width="320" height="200" rx="16" fill="${light}" opacity="0.3"/>`,
        `<rect x="584" y="590" width="220" height="18" rx="9" fill="${light}" opacity="0.45"/>`,
      );
      break;
    }
    case "portrait": {
      shapes.push(
        `<circle cx="512" cy="430" r="170" fill="${light}" opacity="0.30"/>`,
        `<path d="M242 900 Q512 600 782 900 Z" fill="${light}" opacity="0.24"/>`,
        `<circle cx="512" cy="430" r="170" fill="none" stroke="${accent}" stroke-width="6" opacity="0.6"/>`,
      );
      break;
    }
    case "workshop-scene": {
      shapes.push(
        `<rect x="120" y="560" width="784" height="26" rx="13" fill="${deep}" opacity="0.85"/>`,
      );
      for (let i = 0; i < 4; i++) {
        const bx = 170 + i * 190;
        shapes.push(
          `<rect x="${bx}" y="${470 + rand() * 20}" width="120" height="88" rx="10" fill="#0b0f14" opacity="0.9"/>`,
          `<rect x="${bx + 8}" y="${478}" width="104" height="62" rx="6" fill="${accent}" opacity="${(0.35 + rand() * 0.4).toFixed(2)}"/>`,
          `<circle cx="${bx + 60}" cy="${420}" r="34" fill="${light}" opacity="0.35"/>`,
        );
      }
      break;
    }
    case "text-on-color": {
      shapes.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${accent}" opacity="0.5"/>`);
      for (let i = 0; i < 4; i++) {
        shapes.push(
          `<rect x="150" y="${330 + i * 96}" width="${300 + rand() * 420}" height="46" rx="10" fill="${bg}" opacity="0.55"/>`,
        );
      }
      break;
    }
    default: {
      // abstract: layered isometric bars, the "system being built" look
      for (let i = 0; i < 14; i++) {
        const bw = 60 + rand() * 200;
        const bh = 18 + rand() * 26;
        shapes.push(
          `<rect x="${(rand() * (W - bw)).toFixed(0)}" y="${(180 + rand() * 620).toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" rx="${(bh / 2).toFixed(0)}" fill="${[accent, light, deep][Math.floor(rand() * 3)]}" opacity="${(0.25 + rand() * 0.5).toFixed(2)}"/>`,
        );
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${deep}"/>
    </linearGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="70"/>
    </filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${shapes.join("\n  ")}
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.055"/>
</svg>`;
}

export function writeProcedural(adId: string, genes: Genes, seedText: string): string {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  const file = path.join(IMAGE_DIR, `${adId}.svg`);
  fs.writeFileSync(file, proceduralSvg(adId, genes, seedText));
  return file;
}

export function findImageFile(adId: string): string | null {
  for (const ext of ["png", "jpg", "webp", "svg"]) {
    const p = path.join(IMAGE_DIR, `${adId}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function seeded(s: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
