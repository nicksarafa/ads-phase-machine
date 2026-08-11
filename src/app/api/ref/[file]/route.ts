import fs from "node:fs";
import path from "node:path";
import { REF_DIR } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** Serves an uploaded reference screenshot back to the panel. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;

  // Names are server-generated, but this is a path segment off the URL — treat
  // it as untrusted and keep it inside the refs directory regardless.
  if (!/^[A-Za-z0-9_-]+\.(png|jpg|webp|gif)$/.test(file)) {
    return new Response("bad name", { status: 400 });
  }
  const full = path.resolve(REF_DIR, file);
  if (full !== path.resolve(REF_DIR) && !full.startsWith(path.resolve(REF_DIR) + path.sep)) {
    return new Response("not found", { status: 404 });
  }
  if (!fs.existsSync(full)) return new Response("not found", { status: 404 });

  return new Response(new Uint8Array(fs.readFileSync(full)), {
    headers: {
      "content-type": TYPES[path.extname(full)] ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
