# Ads Phase Machine

A working demonstration of a **phase machine**: an autonomous loop that writes
Facebook ads for [lightschool.com](https://lightschool.com), places them, reads
back performance every six hours, takes feedback from a human, and uses all of
that to write the next generation of ads.

You watch the whole thing happen on one screen.

```
research → generate → render → launch → observe ×N → evaluate → evolve
    ↑                                                              │
    └──────────────────────────────────────────────────────────────┘
```

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3737
```

Press **▶ Run demo**. Within a minute you will have your first generation of
ads on the wall with live spend, clicks and conversions climbing.

To make it fast, drop a key in `.env`:

```bash
cp .env.example .env
# then set ANTHROPIC_API_KEY=...
```

Without a key the app falls back to your local `claude` CLI (uses your existing
Claude Code auth, no key needed) — it works, but a generate phase takes 60–120
seconds instead of ~10. With neither, an offline composer keeps the loop
running so the demo never dies on stage.

---

## What each phase does

| Phase | What happens |
|---|---|
| **Research** | Loads the brand profile for Light School plus every enabled source in the Context panel and the live operator brief. |
| **Generate** | Asks the model for N *distinct* ads. Each one picks its own strategic DNA — angle, hook, audience, visual style, tone, offer — and must differ from every headline already running. Roughly ⅔ exploit measured winners, ⅓ explore untried combinations. Usually instant: see *No stalling* below. |
| **Render** | Every ad gets an image. Procedural artwork is written instantly so the wall is never empty; if AI imagery is on, a real image render is queued and the card swaps when it lands. |
| **Launch** | Ads go live on the simulated platform, split into ad sets by audience, with budget allocated across them. |
| **Observe** | Each tick is a 6-hour delivery window. Spend, impressions, clicks, conversions and revenue accrue with realistic auction pressure, creative fatigue and small-sample noise. |
| **Evaluate** | Every ad is scored on CTR, CPA and ROAS, discounted by how much delivery backs it up. Winners get more budget, the bottom slice is killed. Each strategic lever gets a performance index. |
| **Evolve** | Measured lift plus your feedback becomes the brief for the next generation. |

---

## Demo mode

The whole point is that you can compress weeks of ad testing into a few
minutes, in front of people, and have it visibly get better.

- **Speed** — one 6-hour window can take 0.3 seconds. Slide from 0.5× to 20×.
- **Ads per cycle**, **daily budget**, **windows per cycle**, **kill threshold**
  — all live, all take effect on the next phase.
- **Step 1 cycle** — run exactly one full loop and stop, for narrating it.
- **Procedural imagery** — skip AI image latency entirely for the fastest run.
- **Reset** — clear ads and metrics, keep the brief and context.

The numbers are simulated, but they are not noise. See below.

### No stalling in `generate`

The model call is the only step whose duration isn't ours to control, and
parking the rail on `generate` for a minute is the fastest way to kill a demo.
Three things prevent it:

1. **Pipelining.** The next generation's copy is written *during the observe
   phase*, while the current ads are still delivering. By the time the loop
   comes back around to `generate`, the batch is already sitting there. The
   pre-write recomputes insights live, so it sees fresher delivery data than a
   batch written after `evaluate` would have.
2. **Pre-write button.** Before an audience arrives, hit **Pre-write** — it
   writes the first batch without starting the loop, so the first **Run demo**
   is instant too. A pill in the header shows `pre-writing` → `next batch ready`.
3. **A hard timeout.** `ADS_LLM_TIMEOUT_MS` (default 100s) bounds every call.
   Past it, the offline composer takes over and the loop advances, with the
   fallback written into the log. The phase also posts an elapsed counter every
   10 seconds so a slow call reads as working, never as hung.

---

## The simulator is honest

If performance were random, the loop would *look* like it was learning while
doing nothing. So the simulator holds a fixed hidden preference vector over the
gene space — a "market truth" the machine never gets to see. Ads matching it
genuinely earn higher click-through and conversion rates.

The evaluate phase measures that lift with impression-weighted, shrunk indices
(a lucky 300-impression ad cannot declare a winner). The evolve phase exploits
what survives. So the improvement you watch on the learning curve is a real
search process finding a real signal.

On top of that, the simulator models:

- CPM that falls as expected relevance rises, the way an ad auction rewards
  engaging creative
- creative fatigue — the same ad decays as its impression count grows
- offer economics — a free lesson converts at ~9% and is worth $14; team
  training converts at ~0.5% and is worth $2,400
- audience↔offer fit — teams buy team training, career-switchers do not
- copy quality independent of strategy — headline length, specificity, numbers,
  and a penalty for hype words
- binomial noise, drawn exactly for small samples

A typical run: generation 1 lands around **$12 CPA / 2.5× ROAS**, and by
generation 4 the machine is running **~$5–6 CPA / 5–9× ROAS**.

---

## You are in the loop

Two controls put a human inside the machine, which is the part most autonomous
demos skip:

**The brief is the prompt.** The left panel holds the actual creative brief
sent to the model. Edit it mid-run and the very next generate phase uses it.
Change "get workshop bookings" to "get free-lesson signups" and watch the
offer mix shift a generation later.

**Keep / Reject / Note.** Every ad card takes a thumbs up or down plus a written
note. Those notes are injected into the next generation's prompt under the
heading *"OPERATOR FEEDBACK — this outranks the metrics"*, and the score of a
rejected ad is penalised directly. Reject the ad you hate, tell it why, and the
next batch reflects that.

**Collected context.** Add notes, audience insights, proof points, or a URL —
URLs get fetched and read. Everything enabled feeds the research phase.

---

## Facebook Ads

This build **simulates** the ad platform. Nothing is posted, no budget is spent,
and no account is touched.

The seam is deliberately narrow. `src/lib/simulator.ts` exposes one function,
`simulateWindow(ad, budget, windowIndex)`, and `src/lib/machine.ts` calls it in
exactly one place (`phaseObserve`) alongside two other platform touchpoints —
`phaseLaunch` (create) and `rebalanceBudget` (allocate). Swapping in the real
Facebook Ads MCP means implementing those three operations against it and
reading real insights instead of a simulated window. Everything else — the
phases, the scoring, the evolution, the UI — is unchanged.

---

## Configuration

All optional. See `.env.example`.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Fast copy generation. Strongly recommended. |
| `ADS_LLM_MODEL` | Default `claude-opus-5`. |
| `ADS_LLM_EFFORT` | `low` (default) keeps cycles quick; raise for richer strategy. |
| `ADS_LLM_TIMEOUT_MS` | Copy-generation ceiling before the offline fallback. Default 100000. |
| `ADS_IMAGE_PROVIDER` | `auto` \| `google` \| `openai` \| `claude-mcp` \| `procedural`. |
| `GEMINI_API_KEY` | Google "Nano Banana Pro" images. [Get one here](https://aistudio.google.com/apikey). |
| `GEMINI_IMAGE_MODEL` | Default `gemini-3-pro-image`. Set `gemini-3.1-flash-image` for faster, cheaper renders. |
| `OPENAI_API_KEY` | Enables the OpenAI images path. |
| `ADS_IMAGE_CONCURRENCY` | Parallel AI image renders. Default 2. |

**Image providers**, tried in that order. `google` is Nano Banana Pro on the
Gemini API — it returns the image inline as base64, so there's no second fetch.
`openai` calls the images endpoint directly. `claude-mcp` shells out to your
local `claude` CLI and uses whichever image MCP is connected — no key required,
but 30–90s per image. `procedural` draws deterministic generative artwork
instantly: same ad, same picture, every run, which matters when you re-run a
demo in front of an audience.

Rendering is always asynchronous — the card shows procedural artwork the
instant an ad exists and swaps to the real render when it lands, so image
latency never blocks the loop.

---

## Layout

```
src/lib/
  types.ts        domain model + the gene space
  brand.ts        ground truth about Light School (the one thing never generated)
  store.ts        JSON-backed state, single instance on globalThis
  bus.ts          SSE fan-out, coalesced
  machine.ts      the phase machine
  llm.ts          copy generation: anthropic → claude CLI → offline composer
  imagegen.ts     image providers + the procedural renderer
  simulator.ts    the ad platform, and the hidden market truth
  insights.ts     scoring, shrunk per-lever indices, the exploit plan
src/app/api/      state · stream (SSE) · control · brief · feedback · context · image
src/components/   Dashboard · AdCard · PhaseRail · PerfChart
data/             state.json + generated images (gitignored)
```

State survives a restart. The loop always starts paused after one.
