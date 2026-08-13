import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { pushState } from "@/lib/bus";
import { activeCampaign } from "@/lib/types";
import { REF_DIR, getState, log, persist } from "@/lib/store";
import {
  MAIN_FILE,
  SECTION_FILES,
  createPromptFile,
  mainPrompt,
  deletePromptFile,
  extraContextBlocks,
  listPromptFiles,
  readPromptFile,
  writePromptFile,
} from "@/lib/library";
import { brandedPrompt } from "@/lib/imagegen";
import { generateAds, previewPrompt } from "@/lib/llm";
import { buildGenerateInput } from "@/lib/machine";
import type { Ad, DesignAsset, PromptDraft, ReferenceAd } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The prompt library: the files, reference ads and drafts that shape an ad,
 * plus a live render of the exact prompt they currently produce.
 */

function rid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Everything the panel renders, including the assembled prompt itself. */
function payload() {
  const s = getState();
  const input = buildGenerateInput(s);
  const { system, user } = previewPrompt(input);
  return {
    brief: mainPrompt(s.settings.offerFocus, activeCampaign(s).brief),
    context: s.context,
    files: listPromptFiles()
      .filter((f) => f.name !== MAIN_FILE)
      .map((f) => ({
      ...f,
      // A section file replaces a built-in part of the prompt when switched
      // on, rather than being appended like an extra. Both kinds toggle.
      section: SECTION_FILES.includes(f.name),
      enabled: s.enabledFiles.includes(f.name),
    })),
    references: s.references,
    assets: s.assets,
    drafts: s.drafts,
    live: {
      system,
      user,
      // The ad's own subject line varies per ad; the wrapper does not, so show
      // the wrapper with a placeholder where the subject goes.
      image: brandedPrompt("<the ad's own image prompt>", s.settings.brandLogo),
      chars: user.length,
    },
  };
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
    name?: string;
    title?: string;
    text?: string;
    adId?: string;
  };
  const s = getState();

  switch (body.action) {
    // ---------------------------------------------------------------- files
    case "create-file": {
      const f = createPromptFile(body.title ?? "", body.text ?? "");
      if (!f) {
        return NextResponse.json({ error: "invalid file name" }, { status: 400 });
      }
      if (!s.enabledFiles.includes(f.name)) s.enabledFiles.push(f.name);
      log(`Added prompt file ${f.name}. It is on for the next generate.`, "good");
      return ok();
    }
    case "save-file": {
      const f = writePromptFile(body.name ?? "", body.text ?? "");
      if (!f) {
        return NextResponse.json({ error: "unknown file" }, { status: 400 });
      }
      log(`Saved ${f.name}.`, "good");
      return ok();
    }
    case "delete-file": {
      if (!deletePromptFile(body.name ?? "")) {
        return NextResponse.json({ error: "unknown file" }, { status: 400 });
      }
      s.enabledFiles = s.enabledFiles.filter((n) => n !== body.name);
      log(`Deleted ${body.name}.`, "warn");
      return ok();
    }
    case "toggle-file": {
      const name = body.name ?? "";
      if (!readPromptFile(name)) {
        return NextResponse.json({ error: "unknown file" }, { status: 400 });
      }
      s.enabledFiles = s.enabledFiles.includes(name)
        ? s.enabledFiles.filter((n) => n !== name)
        : [...s.enabledFiles, name];
      return ok();
    }

    // ----------------------------------------------------------- references
    case "add-reference": {
      const text = String(body.text ?? "").trim();
      if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });
      const ref: ReferenceAd = {
        id: rid("ref"),
        title: String(body.title || "Pasted reference").slice(0, 80),
        body: text.slice(0, 8_000),
        source: "pasted",
        enabled: true,
        createdAt: Date.now(),
      };
      s.references.unshift(ref);
      log(`Added format reference "${ref.title}".`, "good");
      return ok();
    }
    case "capture-reference": {
      const ad = s.ads[body.adId ?? ""] as Ad | undefined;
      if (!ad) return NextResponse.json({ error: "unknown ad" }, { status: 400 });
      const ref: ReferenceAd = {
        id: rid("ref"),
        title: `${ad.label} — ${ad.creative.headline}`.slice(0, 80),
        body: [ad.creative.primaryText, "", ad.creative.headline, ad.creative.description]
          .filter(Boolean)
          .join("\n"),
        source: "captured",
        enabled: true,
        createdAt: Date.now(),
      };
      s.references.unshift(ref);
      log(`Captured ${ad.label} as a format reference.`, "good");
      return ok();
    }
    case "add-reference-image": {
      // The browser sends a data URL; only raster formats the model accepts.
      const m = /^data:(image\/(png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(
        String(body.text ?? ""),
      );
      if (!m) {
        return NextResponse.json({ error: "expected a png/jpeg/webp image" }, { status: 400 });
      }
      const buf = Buffer.from(m[3], "base64");
      if (buf.byteLength > 4_000_000) {
        return NextResponse.json({ error: "image over 4MB" }, { status: 400 });
      }
      const id = rid("ref");
      const ext = m[2] === "jpeg" ? "jpg" : m[2];
      const file = `${id}.${ext}`;
      fs.mkdirSync(REF_DIR, { recursive: true });
      fs.writeFileSync(path.join(REF_DIR, file), new Uint8Array(buf));

      const ref: ReferenceAd = {
        id,
        title: String(body.title || "Uploaded ad").slice(0, 80),
        body: String(body.name || "").slice(0, 2_000),
        source: "image",
        image: { file, mime: m[1] },
        enabled: true,
        createdAt: Date.now(),
      };
      s.references.unshift(ref);
      log(`Added image reference "${ref.title}".`, "good");
      return ok();
    }
    case "toggle-reference": {
      const r = s.references.find((x) => x.id === body.name);
      if (r) r.enabled = !r.enabled;
      return ok();
    }
    case "delete-reference": {
      const gone = s.references.find((x) => x.id === body.name);
      if (gone?.image) {
        // Deleting the row without the file would silently grow data/refs.
        try {
          fs.rmSync(path.join(REF_DIR, gone.image.file), { force: true });
        } catch {
          /* best effort */
        }
      }
      s.references = s.references.filter((x) => x.id !== body.name);
      return ok();
    }

    // --------------------------------------------------------------- assets
    case "add-asset": {
      const m = /^data:(image\/(png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(
        String(body.text ?? ""),
      );
      if (!m) {
        return NextResponse.json({ error: "expected a png/jpeg/webp image" }, { status: 400 });
      }
      const buf = Buffer.from(m[3], "base64");
      if (buf.byteLength > 4_000_000) {
        return NextResponse.json({ error: "image over 4MB" }, { status: 400 });
      }
      const id = rid("asset");
      const file = `${id}.${m[2] === "jpeg" ? "jpg" : m[2]}`;
      fs.mkdirSync(REF_DIR, { recursive: true });
      fs.writeFileSync(path.join(REF_DIR, file), new Uint8Array(buf));

      const asset: DesignAsset = {
        id,
        title: String(body.title || "Asset").slice(0, 80),
        file,
        mime: m[1],
        role: body.name === "logo" ? "logo" : "style",
        enabled: true,
        createdAt: Date.now(),
      };
      s.assets.unshift(asset);
      log(`Added design asset "${asset.title}" (${asset.role}).`, "good");
      return ok();
    }
    case "toggle-asset": {
      const a = s.assets.find((x) => x.id === body.name);
      if (a) a.enabled = !a.enabled;
      return ok();
    }
    case "asset-role": {
      const a = s.assets.find((x) => x.id === body.name);
      if (a) a.role = a.role === "logo" ? "style" : "logo";
      return ok();
    }
    case "delete-asset": {
      const gone = s.assets.find((x) => x.id === body.name);
      if (gone) {
        try {
          fs.rmSync(path.join(REF_DIR, gone.file), { force: true });
        } catch {
          /* best effort */
        }
      }
      s.assets = s.assets.filter((x) => x.id !== body.name);
      return ok();
    }

    // --------------------------------------------------------------- drafts
    case "rebuild-from-winners": {
      const pool = s.adOrder.map((id) => s.ads[id]).filter(Boolean) as Ad[];
      const winners = pool
        .filter((a) => a.score !== null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 6);
      if (winners.length < 2) {
        return NextResponse.json(
          { error: "Not enough scored ads yet — run at least one full cycle." },
          { status: 400 },
        );
      }

      const evidence = winners
        .map(
          (w) =>
            `- "${w.creative.headline}" — ${w.creative.primaryText.replace(/\s+/g, " ").slice(0, 220)} [angle=${w.genes.angle}, hook=${w.genes.hook}, audience=${w.genes.audience}, tone=${w.genes.tone}] CTR ${(w.metrics.ctr * 100).toFixed(2)}% · CPA $${w.metrics.cpa.toFixed(0)} · ROAS ${w.metrics.roas.toFixed(1)}x`,
        )
        .join("\n");

      // Reuse the ad generator rather than adding a second model path: ask for
      // one "ad" whose primaryText is the brief. Cheap, and it inherits the
      // same provider fallback chain, so this button can't hang the UI.
      const res = await generateAds({
        ...buildGenerateInput(s),
        count: 1,
        brief: [
          "You are rewriting the creative brief itself, not writing an ad.",
          "",
          "These ads measurably outperformed the rest of the account:",
          evidence,
          "",
          "In `primaryText`, write a replacement operator brief that captures why",
          "these worked and instructs the next batch to do more of it. Keep the",
          "structure of a brief: goal, positioning, then concrete rules. Be",
          "specific about the patterns you can actually see above — name the",
          "angles, hooks and audiences that won. Do not mention individual ads.",
          "Put a one-line summary of the change in `headline`.",
        ].join("\n"),
      });

      const draftBody = res.ads[0]?.primaryText?.trim();
      if (!draftBody) {
        return NextResponse.json({ error: "model returned no brief" }, { status: 502 });
      }
      const draft: PromptDraft = {
        id: rid("draft"),
        title: res.ads[0]?.headline?.slice(0, 80) || `Rebuilt from ${winners.length} winners`,
        body: draftBody,
        source: "winners",
        basis: winners.map((w) => w.creative.headline),
        createdAt: Date.now(),
      };
      s.drafts.unshift(draft);
      log(
        `Rebuilt a brief from ${winners.length} winning ads (${res.provider}). Review it before using it.`,
        "good",
      );
      return ok();
    }
    case "use-draft": {
      const d = s.drafts.find((x) => x.id === body.name);
      if (!d) return NextResponse.json({ error: "unknown draft" }, { status: 400 });
      activeCampaign(s).brief = d.body;
      log(`Brief for ${activeCampaign(s).name} replaced with "${d.title}". Takes effect next generate.`, "good");
      return ok();
    }
    case "delete-draft": {
      s.drafts = s.drafts.filter((x) => x.id !== body.name);
      return ok();
    }
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
