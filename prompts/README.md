# prompts/

Every `.md` file here drives ad creation. Edit them in your editor or in the
app — both write the same files, and the machine re-reads them on the next
phase that needs them, with no restart.

| File | Drives | Consumed by |
|---|---|---|
| `design.md` | Art direction appended to every image prompt | `designDirection()` → `brandedPrompt()` in `src/lib/imagegen.ts` |
| anything else | Extra context, sent when switched on | `buildPrompt()` in `src/lib/llm.ts` |

`design.md` is the only file with a fixed role. Delete it and image rendering
falls back to the built-in direction in `src/lib/brand.ts`, so the wall can
never stop rendering because a file went missing.

Only the body below the first `---` is sent to a model. Everything above it is
a note to yourself, so a file can explain what it is without polluting the
prompt. A file with no `---` is sent whole.

The operator brief is not a file — it lives in app state and is edited in the
Creative Brief panel, because it changes constantly during a run and is
persisted with the rest of the machine's state in `data/state.json`.

The project's own visual identity is documented separately in `DESIGN.md` at
the repo root. That describes the dashboard UI; the files here describe the
ads the dashboard produces.
