// One-off: render a single Light School ad with Gemini and write it to disk.
import fs from "node:fs";
import path from "node:path";

const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("GEMINI_API_KEY is not set");
const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image";

const prompt = fs.readFileSync(process.argv[2], "utf8");
const out = process.argv[3];

const mark = path.join(process.cwd(), "public", "lightschool-mark.png");
const input = [{ type: "text", text: prompt }];
if (fs.existsSync(mark)) {
  input.push({
    type: "text",
    text: "Reference image: the Light School logo. Reproduce it exactly as given — do not redraw, restyle or add text to it.",
  });
  input.push({
    type: "image",
    mime_type: "image/png",
    data: fs.readFileSync(mark).toString("base64"),
  });
}

const res = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/interactions",
  {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      model,
      input,
      response_format: {
        type: "image",
        mime_type: "image/jpeg",
        aspect_ratio: "1:1",
        image_size: "1K",
      },
    }),
    signal: AbortSignal.timeout(180_000),
  },
);

if (!res.ok) {
  console.error(`gemini ${res.status}: ${(await res.text()).slice(0, 400)}`);
  process.exit(1);
}

const json = await res.json();
const blocks = (json.steps ?? []).flatMap((s) => s.content ?? []);
const image = blocks.find((c) => c.type === "image" && c.data);
if (!image) {
  const why = blocks.find((c) => c.type === "text" && c.text)?.text ?? "no image block";
  console.error(`no image: ${why.slice(0, 400)}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(image.data, "base64"));
console.log(out);
