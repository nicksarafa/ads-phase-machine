import fs from "node:fs";
import path from "node:path";

/**
 * The prompt library on disk.
 *
 * Everything that shapes an ad — art direction, extra context — is a real `.md`
 * file in `prompts/`, so it can be edited in the app or in an editor, and
 * reviewed in a diff like any other source. Files are re-read on every access
 * rather than cached, because the whole point is that editing one changes the
 * next render without a restart.
 *
 * A file may open with a note to the reader, separated from the prompt by a
 * `---` line. Only what follows the separator is sent to a model.
 */

export const PROMPTS_DIR = path.join(process.cwd(), "prompts");

/** Filenames are user-supplied, so they are an allowlist, not a sanitisation. */
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}\.md$/;

export interface PromptFile {
  /** Filename including the .md extension — the id used by the API. */
  name: string;
  /** Human label: the filename without extension. */
  title: string;
  /** The explanatory note above the `---`, shown in the UI but never sent. */
  note: string;
  /** What actually reaches the model. */
  body: string;
  bytes: number;
}

function resolveInside(name: string): string | null {
  if (!SAFE_NAME.test(name)) return null;
  const full = path.resolve(PROMPTS_DIR, name);
  // `..` can't survive SAFE_NAME, but resolve-then-verify is the invariant
  // that stays correct if that pattern is ever loosened.
  const root = path.resolve(PROMPTS_DIR);
  return full === root || full.startsWith(root + path.sep) ? full : null;
}

/** Split a file into its note and the part that is actually a prompt. */
export function splitPrompt(raw: string): { note: string; body: string } {
  const sep = raw.indexOf("\n---");
  if (sep === -1) return { note: "", body: raw.trim() };
  const note = raw.slice(0, sep).trim();
  const body = raw.slice(raw.indexOf("\n", sep + 1) + 1).trim();
  return { note, body };
}

export function listPromptFiles(): PromptFile[] {
  let names: string[];
  try {
    names = fs.readdirSync(PROMPTS_DIR);
  } catch {
    return [];
  }
  return names
    .filter((n) => n.endsWith(".md") && SAFE_NAME.test(n) && n !== "README.md")
    .sort()
    .map((n) => readPromptFile(n))
    .filter((f): f is PromptFile => f !== null);
}

export function readPromptFile(name: string): PromptFile | null {
  const full = resolveInside(name);
  if (!full) return null;
  let raw: string;
  try {
    raw = fs.readFileSync(full, "utf8");
  } catch {
    return null;
  }
  const { note, body } = splitPrompt(raw);
  return {
    name,
    title: name.replace(/\.md$/, ""),
    note,
    body,
    bytes: Buffer.byteLength(raw),
  };
}

/**
 * Write a file back, preserving its note. The body is what the UI edits; the
 * note is authored on disk and survives a round trip through the panel.
 */
export function writePromptFile(name: string, body: string): PromptFile | null {
  const full = resolveInside(name);
  if (!full) return null;

  const existing = readPromptFile(name);
  const note = existing?.note ?? "";
  const trimmed = String(body).slice(0, 50_000).trim();
  const out = note ? `${note}\n\n---\n\n${trimmed}\n` : `${trimmed}\n`;

  fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  fs.writeFileSync(full, out, "utf8");
  return readPromptFile(name);
}

export function createPromptFile(title: string, body: string): PromptFile | null {
  const slug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  if (!slug) return null;
  return writePromptFile(`${slug}.md`, body);
}

export function deletePromptFile(name: string): boolean {
  const full = resolveInside(name);
  if (!full) return false;
  try {
    fs.unlinkSync(full);
    return true;
  } catch {
    return false;
  }
}

/**
 * Files that replace a built-in section of the prompt rather than adding to
 * it. They are always in play, so they are never listed as toggleable extras.
 */
export const SECTION_FILES = ["design.md", "brand-block.md", "hook-patterns.md"];

/**
 * The main prompt. Unlike a section file this has no switch: it *is* the
 * brief, so there is nothing sensible for "off" to mean. Edit the file or the
 * Brief tab — same file, same edit.
 */
export const MAIN_FILE = "main.md";

export function mainPrompt(fallback: string): string {
  const f = readPromptFile(MAIN_FILE);
  return f?.body ? f.body : fallback;
}

/**
 * A prompt section, overridden by a file when one exists. The code default is
 * the fallback so emptying or deleting a file degrades to the built-in text
 * rather than punching a hole in the prompt.
 */
export function sectionOr(name: string, fallback: string, enabled: string[]): string {
  if (!enabled.includes(name)) return fallback;
  const f = readPromptFile(name);
  return f?.body ? f.body : fallback;
}

/**
 * Art direction for image prompts. `design.md` owns this; the built-in string
 * is the fallback so a missing or emptied file can never stop the wall from
 * rendering mid-demo.
 */
export function designDirection(fallback: string, enabled: string[]): string {
  if (!enabled.includes("design.md")) return fallback;
  const f = readPromptFile("design.md");
  return f?.body ? f.body : fallback;
}

/** Extra files the operator has switched on, as prompt-ready blocks. */
export function extraContextBlocks(enabled: string[]): string[] {
  return enabled
    .filter((n) => !SECTION_FILES.includes(n) && n !== MAIN_FILE)
    .map((n) => readPromptFile(n))
    .filter((f): f is PromptFile => f !== null && f.body.length > 0)
    .map((f) => `[${f.title}]\n${f.body}`);
}
