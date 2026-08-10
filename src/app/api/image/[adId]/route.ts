import fs from "node:fs";
import path from "node:path";
import { findImageFile } from "@/lib/imagegen";
import { IMAGE_DIR } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ adId: string }> },
) {
  const { adId } = await params;

  // Ad IDs are machine-generated, but this route takes a path segment from the
  // URL — keep it inside the image directory regardless.
  if (!/^[A-Za-z0-9_-]+$/.test(adId)) {
    return new Response("bad id", { status: 400 });
  }

  const file = findImageFile(adId);
  if (!file || !path.resolve(file).startsWith(path.resolve(IMAGE_DIR))) {
    return new Response("not found", { status: 404 });
  }

  const buf = fs.readFileSync(file);
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
