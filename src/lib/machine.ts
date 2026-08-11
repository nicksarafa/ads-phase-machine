import fs from "node:fs";
import path from "node:path";
import { pushState } from "./bus";
import { REF_DIR, getState, log, persist } from "./store";
import { generateAds, type GenerateResult } from "./llm";
import {
  clearQueue,
  enqueue,
  findImageFile,
  renderAiImage,
  resolveProvider,
  writeProcedural,
} from "./imagegen";
import { simulateWindow } from "./simulator";
import { extraContextBlocks, mainPrompt, sectionOr } from "./library";
import { brandBlock } from "./brand";
import { hookBriefBlock } from "./hooks";
import { computeInsights, exploitPlan, learningsFrom, scoreAd } from "./insights";
import {
  EMPTY_METRICS,
  PHASES,
  deriveMetrics,
  type Ad,
  type AppState,
  type Generation,
  type Phase,
} from "./types";

/**
 * The phase machine.
 *
 * research -> generate -> render -> launch -> observe xN -> evaluate -> evolve
 *
 * Every phase reads state, mutates it, and pushes a snapshot. The loop is a
 * plain async function with a cancellation token rather than a scheduler, so
 * the whole cycle is readable top to bottom.
 */

interface Runtime {
  running: boolean;
  token: number;
  loop: Promise<void> | null;
  /** Next generation's copy, written ahead of time during the observe phase. */
  prefetch: {
    cycle: number;
    count: number;
    promise: Promise<GenerateResult>;
  } | null;
}

const g = globalThis as unknown as { __adsMachine?: Runtime };
const rt: Runtime = (g.__adsMachine ??= {
  running: false,
  token: 0,
  loop: null,
  prefetch: null,
});

const MAX_ACTIVE_ADS = 18;

// ------------------------------------------------------------------ helpers

function snapshot(): AppState {
  return getState();
}

function flush(immediate = false) {
  persist();
  pushState(snapshot, immediate);
}

function sleep(ms: number): Promise<void> {
  // Resolves unconditionally; cancellation is checked by the caller's token
  // guard on the next line after every await.
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/** Sleep while animating phase progress so the UI shows the machine working. */
async function phaseWait(totalMs: number, token: number) {
  const s = getState();
  const steps = Math.max(1, Math.min(24, Math.round(totalMs / 90)));
  for (let i = 0; i < steps; i++) {
    if (token !== rt.token) return;
    await sleep(totalMs / steps);
    s.machine.phaseProgress = (i + 1) / steps;
    flush();
  }
}

function setPhase(phase: Phase, note?: string) {
  const s = getState();
  s.machine.phase = phase;
  s.machine.phaseProgress = 0;
  if (note) log(note, "info", phase);
  flush(true);
}

function speedMs(base: number) {
  const s = getState();
  return base / Math.max(0.25, s.settings.speed);
}

let adSeq = 0;
function nextAdId() {
  return `ad-${Date.now().toString(36)}-${(adSeq++).toString(36)}`;
}

function activeAds(s: AppState): Ad[] {
  return s.adOrder.map((id) => s.ads[id]).filter((a) => a && a.status === "active");
}

function allAds(s: AppState): Ad[] {
  return s.adOrder.map((id) => s.ads[id]).filter(Boolean);
}

/** Load an uploaded reference screenshot for the model, or undefined. */
function refImage(r: { image?: { file: string; mime: string } }) {
  if (!r.image) return undefined;
  try {
    return {
      base64: fs.readFileSync(path.join(REF_DIR, r.image.file)).toString("base64"),
      mime: r.image.mime,
    };
  } catch {
    // A deleted file must not take the generate phase down.
    return undefined;
  }
}

// ------------------------------------------------------------------- phases

async function phaseResearch(token: number) {
  setPhase("research");
  const s = getState();
  const enabled = s.context.filter((c) => c.enabled).length;
  log(
    `Reading brand profile for lightschool.com, ${enabled} context source(s), and the live operator brief.`,
    "info",
    "research",
  );
  await phaseWait(speedMs(900), token);
}

/** Everything the copywriter needs, assembled from current state. */
export function buildGenerateInput(s: AppState, insights = s.insights) {
  const pool = allAds(s);
  const scoredPool = pool.filter((a) => a.score !== null);

  return {
    count: s.settings.adsPerCycle,
    cycle: s.machine.cycle,
    brief: mainPrompt(s.brief),
    offerFocus: s.settings.offerFocus,
    context: s.context,
    insights,
    exploit: exploitPlan(insights),
    learnings: s.generations.at(-1)?.learnings ?? [],
    winners: [...scoredPool].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3),
    losers: pool.filter((a) => a.status === "killed").slice(-4),
    feedbackNotes: pool
      .flatMap((a) =>
        a.feedback.map((f) => ({
          headline: a.creative.headline,
          rating: f.rating,
          note: f.note,
        })),
      )
      .slice(-8),
    usedHeadlines: pool.map((a) => a.creative.headline),
    references: s.references
      .filter((r) => r.enabled)
      .map((r) => ({ title: r.title, body: r.body, image: refImage(r) })),
    files: extraContextBlocks(s.enabledFiles),
    sections: {
      brand: sectionOr("brand-block.md", brandBlock(), s.enabledFiles),
      hooks: sectionOr("hook-patterns.md", hookBriefBlock(), s.enabledFiles),
    },
  };
}

/**
 * Start writing the *next* generation while the current one is still
 * delivering. The model call is the only step whose duration we do not
 * control, so overlapping it with the observe phase is what keeps the rail
 * moving instead of parking on `generate` for a minute.
 *
 * Insights are recomputed live at this moment, so the pre-written batch sees
 * fresher delivery data than a batch written after evaluate would have.
 */
export function beginPrefetch(forCycle?: number) {
  const s = getState();
  if (rt.prefetch) return;
  const cycle = forCycle ?? s.machine.cycle + 1;
  const count = s.settings.adsPerCycle;
  const insights = computeInsights(allAds(s).filter((a) => a.status !== "draft"));

  log(
    `Pre-writing generation ${cycle + 1} in the background.`,
    "info",
    s.machine.phase,
  );
  s.machine.prefetch = "writing";
  flush(true);

  rt.prefetch = {
    cycle,
    count,
    promise: generateAds({ ...buildGenerateInput(s, insights), cycle })
      .then((r) => {
        getState().machine.prefetch = "ready";
        log(`Generation ${cycle + 1} pre-written by ${r.provider}.`, "good");
        flush(true);
        return r;
      })
      .catch((e) => {
        getState().machine.prefetch = "none";
        log(`Pre-write failed, will write live instead: ${msgOf(e)}`, "warn");
        flush(true);
        throw e;
      }),
  };
}

function clearPrefetch() {
  rt.prefetch = null;
  getState().machine.prefetch = "none";
}

function msgOf(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

async function phaseGenerate(token: number): Promise<Generation | null> {
  setPhase("generate");
  const s = getState();
  const input = buildGenerateInput(s);

  // Take the pre-written batch if it matches this cycle and the operator has
  // not changed the batch size since it was queued.
  const pre =
    rt.prefetch &&
    rt.prefetch.cycle === s.machine.cycle &&
    rt.prefetch.count === s.settings.adsPerCycle
      ? rt.prefetch
      : null;
  if (rt.prefetch && !pre) {
    log("Discarded the pre-written batch — settings changed since it was queued.", "warn");
  }
  clearPrefetch();

  log(
    `${pre ? "Collecting the pre-written" : "Asking the copywriter for"} ${s.settings.adsPerCycle} distinct ads${
      Object.keys(input.exploit).length
        ? ` (exploiting ${Object.keys(input.exploit).join(", ")})`
        : " (no measured signal yet — exploring the full space)"
    }.`,
    "info",
    "generate",
  );
  flush(true);

  // Creep the progress bar and post an elapsed counter so a slow model call
  // reads as "working", never as "hung".
  const startedAt = Date.now();
  let waiting = true;
  void (async () => {
    let p = 0;
    let announced = 0;
    while (waiting && token === rt.token) {
      await sleep(400);
      p = Math.min(0.92, p + (0.92 - p) * 0.06);
      s.machine.phaseProgress = p;
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      if (secs >= 10 && secs - announced >= 10) {
        announced = secs;
        // Only suggest the key when one is genuinely missing — telling someone
        // to set a variable they have already set sends them hunting for a
        // bug that is not there.
        const hint = process.env.ANTHROPIC_API_KEY
          ? "Using the Anthropic API."
          : "No ANTHROPIC_API_KEY in this process — falling back to the claude CLI. Set it in .env and restart to cut this to a few seconds.";
        log(`Still writing — ${secs}s elapsed. ${hint}`, "warn", "generate");
      }
      flush();
    }
  })();

  let result;
  try {
    result = pre ? await pre.promise : await generateAds(input);
  } catch {
    result = await generateAds(input);
  } finally {
    waiting = false;
  }

  if (token !== rt.token) return null;

  s.machine.llmProvider = result.provider;

  const generation: Generation = {
    index: s.machine.cycle,
    createdAt: Date.now(),
    brief: s.brief,
    adIds: [],
    learnings: input.learnings,
    exploitGenes: input.exploit,
    llmProvider: result.provider,
  };

  const cycleStamp = s.machine.cycle;
  const focus = s.settings.offerFocus;
  result.ads.forEach((draft, i) => {
    // The account sells one offer, so this is a hard constraint rather than a
    // suggestion — the model does not get to wander back to a consumer offer.
    draft.genes = { ...draft.genes, offer: focus };
    const id = nextAdId();
    const ad: Ad = {
      id,
      label: `G${cycleStamp + 1}·${String(i + 1).padStart(2, "0")}`,
      generation: cycleStamp,
      createdAt: Date.now(),
      parentId: input.winners[0]?.id ?? null,
      genes: draft.genes,
      creative: {
        headline: draft.headline,
        primaryText: draft.primaryText,
        description: draft.description,
        cta: draft.cta,
        imagePrompt: draft.imagePrompt,
        rationale: draft.rationale,
      },
      image: { status: "pending", url: null, provider: null, error: null },
      status: "draft",
      dailyBudget: 0,
      platform: {
        campaignId: `cmp_${cycleStamp + 1}`,
        adSetId: `adset_${cycleStamp + 1}_${draft.genes.audience}`,
        adId: `sim_${id}`,
      },
      metrics: { ...EMPTY_METRICS },
      history: [],
      feedback: [],
      verdict: null,
      score: null,
      judgement: null,
    };
    s.ads[id] = ad;
    s.adOrder.push(id);
    generation.adIds.push(id);
  });

  s.generations.push(generation);
  log(
    `${result.ads.length} ads written by ${result.provider}.`,
    "good",
    "generate",
  );
  await phaseWait(speedMs(500), token);
  return generation;
}

async function phaseRender(generation: Generation, token: number) {
  setPhase("render");
  const s = getState();

  // Start the next generation's copy now so it overlaps render, launch and all
  // of delivery — the longest stretch of the cycle.
  if (!s.settings.stepMode) beginPrefetch();

  const provider = await resolveProvider();
  s.machine.imageProvider = s.settings.imageMode === "ai" ? provider : "procedural";

  for (const id of generation.adIds) {
    const ad = s.ads[id];
    if (!ad) continue;
    // Procedural artwork lands instantly so the wall is never empty.
    writeProcedural(ad.id, ad.genes, ad.creative.headline);
    ad.image = {
      status: s.settings.imageMode === "ai" ? "rendering" : "ready",
      url: `/api/image/${ad.id}?v=${Date.now()}`,
      provider: "procedural",
      error: null,
    };
    ad.status = "rendering";
  }
  flush(true);

  if (s.settings.imageMode === "ai" && provider !== "procedural") {
    log(
      `Queued ${generation.adIds.length} image renders on ${provider}. Cards update as each lands.`,
      "info",
      "render",
    );
    for (const id of generation.adIds) {
      const ad = s.ads[id];
      if (!ad) continue;
      enqueue(async () => {
        try {
          const res = await renderAiImage(ad.id, ad.creative.imagePrompt, {
            withLogo: getState().settings.brandLogo,
          });
          const live = getState().ads[ad.id];
          if (!live) return;
          live.image = {
            status: "ready",
            url: `/api/image/${ad.id}?v=${Date.now()}`,
            provider: res.provider,
            error: null,
          };
          log(`Image ready for ${live.label}.`, "good", "render");
        } catch (e) {
          const live = getState().ads[ad.id];
          if (!live) return;
          live.image = {
            ...live.image,
            status: "failed",
            provider: "procedural",
            error: e instanceof Error ? e.message : String(e),
          };
          log(
            `Image generation failed for ${live.label} — keeping procedural artwork. ${live.image.error}`,
            "warn",
            "render",
          );
        }
        flush(true);
      });
    }
  } else {
    log(
      `Rendered ${generation.adIds.length} procedural creatives.`,
      "good",
      "render",
    );
  }

  await phaseWait(speedMs(700), token);
}

async function phaseLaunch(generation: Generation, token: number) {
  setPhase("launch");
  const s = getState();

  for (const id of generation.adIds) {
    const ad = s.ads[id];
    if (!ad) continue;
    ad.status = "active";
  }

  rebalanceBudget(s);

  log(
    `Placed ${generation.adIds.length} ads into ${new Set(generation.adIds.map((id) => s.ads[id]?.platform.adSetId)).size} ad set(s). Daily budget $${s.settings.dailyBudget} across ${activeAds(s).length} live ads.`,
    "good",
    "launch",
  );
  await phaseWait(speedMs(700), token);
}

async function phaseObserve(token: number) {
  setPhase("observe");
  const s = getState();
  const windows = s.settings.windowsPerCycle;

  // Delivery is the one phase that always has something to show, so it is also
  // where we absorb the model's latency: once the configured windows are done,
  // keep running extra ones until the next batch of copy is written. The ads on
  // screen keep spending and the chart keeps moving instead of the rail parking
  // on `generate`. With a fast provider this never triggers.
  const MAX_HELD_WINDOWS = 60;
  let announcedHold = false;

  for (let w = 0; ; w++) {
    if (token !== rt.token) return;

    if (w >= windows) {
      const copyPending = s.machine.prefetch === "writing";
      if (!copyPending) break;
      if (w >= windows + MAX_HELD_WINDOWS) {
        log("Held delivery as long as is reasonable — writing inline.", "warn", "observe");
        break;
      }
      if (!announcedHold) {
        announcedHold = true;
        log(
          "Holding delivery open — the ads keep running while the next batch is written.",
          "info",
          "observe",
        );
      }
    }

    const perWindowMs = speedMs(s.settings.secondsPerWindow * 1000);
    // Tick the clock in slices so numbers visibly climb rather than jumping.
    const slices = Math.max(4, Math.min(20, Math.round(perWindowMs / 120)));
    const live = activeAds(s);
    const totalWeight = live.reduce((sum, a) => sum + a.dailyBudget, 0) || 1;

    const results = live.map((ad) => {
      const share = ad.dailyBudget / totalWeight;
      const windowBudget = (s.settings.dailyBudget / 4) * share;
      return {
        ad,
        result: simulateWindow(ad, windowBudget, Math.round(s.machine.clockHours / 6) + w),
      };
    });

    for (let i = 0; i < slices; i++) {
      if (token !== rt.token) return;
      await sleep(perWindowMs / slices);
      const f = 1 / slices;
      for (const { ad, result } of results) {
        ad.metrics = deriveMetrics({
          spend: ad.metrics.spend + result.spend * f,
          impressions: ad.metrics.impressions + result.impressions * f,
          clicks: ad.metrics.clicks + result.clicks * f,
          conversions: ad.metrics.conversions + result.conversions * f,
          revenue: ad.metrics.revenue + result.revenue * f,
        });
      }
      s.machine.phaseProgress = Math.min(1, (w + (i + 1) / slices) / windows);
      flush();
    }

    // Snap to integers at the window boundary so the ledger stays clean.
    s.machine.clockHours += 6;
    for (const { ad } of results) {
      ad.metrics = deriveMetrics({
        spend: Math.round(ad.metrics.spend * 100) / 100,
        impressions: Math.round(ad.metrics.impressions),
        clicks: Math.round(ad.metrics.clicks),
        conversions: Math.round(ad.metrics.conversions),
        revenue: Math.round(ad.metrics.revenue * 100) / 100,
      });
      ad.history.push({
        ...ad.metrics,
        atHour: s.machine.clockHours,
        cycle: s.machine.cycle,
      });
      if (ad.history.length > 80) ad.history.shift();
    }

    const spent = results.reduce((sum, r) => sum + r.result.spend, 0);
    const clicks = results.reduce((sum, r) => sum + r.result.clicks, 0);
    const conv = results.reduce((sum, r) => sum + r.result.conversions, 0);
    log(
      `+6h · $${spent.toFixed(2)} spent · ${clicks} clicks · ${conv} conversions across ${results.length} ads.`,
      "info",
      "observe",
    );
    flush(true);
  }
}

async function phaseEvaluate(token: number) {
  setPhase("evaluate");
  const s = getState();
  const pool = allAds(s).filter((a) => a.status !== "draft");

  for (const ad of pool) {
    ad.score = scoreAd(ad, pool);
  }

  const live = activeAds(s).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  if (live.length) {
    const cut = Math.max(1, Math.floor(live.length * s.settings.killThreshold));
    const killers = live.slice(-cut).filter((a) => a.metrics.impressions > 1200);
    const keepers = live.slice(0, Math.max(1, live.length - killers.length));

    for (const ad of keepers) ad.verdict = "neutral";
    for (const ad of keepers.slice(0, Math.max(1, Math.ceil(keepers.length / 3))))
      ad.verdict = "winner";
    for (const ad of killers) {
      ad.verdict = "loser";
      ad.status = "killed";
      ad.dailyBudget = 0;
    }

    // Cap the live pool so budget stays meaningful as generations accumulate.
    const stillLive = activeAds(s).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    for (const ad of stillLive.slice(MAX_ACTIVE_ADS)) {
      ad.status = "paused";
      ad.dailyBudget = 0;
      ad.verdict = ad.verdict ?? "neutral";
    }

    if (killers.length) {
      log(
        `Killed ${killers.length} underperformer(s): ${killers.map((a) => a.label).join(", ")}.`,
        "warn",
        "evaluate",
      );
    }
    const best = stillLive[0];
    if (best) {
      log(
        `Best live ad ${best.label} — CTR ${(best.metrics.ctr * 100).toFixed(2)}%, CPA ${best.metrics.cpa ? `$${best.metrics.cpa.toFixed(2)}` : "—"}, ROAS ${best.metrics.roas.toFixed(2)}x.`,
        "good",
        "evaluate",
      );
    }
  }

  s.insights = computeInsights(pool);
  rebalanceBudget(s);
  await phaseWait(speedMs(800), token);
}

async function phaseEvolve(token: number) {
  setPhase("evolve");
  const s = getState();
  const pool = allAds(s);
  const learnings = learningsFrom(s.insights, pool);
  const exploit = exploitPlan(s.insights);

  const gen = s.generations.at(-1);
  if (gen) {
    gen.learnings = learnings;
    gen.exploitGenes = exploit;
  }

  if (learnings.length) {
    for (const l of learnings.slice(0, 3)) log(l, "good", "evolve");
  } else {
    log("Not enough delivery yet to separate signal from noise. Widening the search.", "warn", "evolve");
  }

  s.machine.cycle += 1;
  await phaseWait(speedMs(900), token);
}

// -------------------------------------------------------------- allocation

/** Concentrate spend on what is working, but never starve a new ad of data. */
function rebalanceBudget(s: AppState) {
  const live = activeAds(s);
  if (!live.length) return;
  const weights = live.map((ad) => {
    if (ad.metrics.impressions < 2500) return 1.2; // learning budget
    const score = ad.score ?? 0.6;
    return Math.max(0.25, Math.min(3, score));
  });
  const total = weights.reduce((a, b) => a + b, 0);
  live.forEach((ad, i) => {
    ad.dailyBudget =
      Math.round(((weights[i] / total) * s.settings.dailyBudget) * 100) / 100;
  });
}

// -------------------------------------------------------------------- loop

async function runCycle(token: number) {
  await phaseResearch(token);
  if (token !== rt.token) return;

  const generation = await phaseGenerate(token);
  if (!generation || token !== rt.token) return;

  await phaseRender(generation, token);
  if (token !== rt.token) return;

  await phaseLaunch(generation, token);
  if (token !== rt.token) return;

  await phaseObserve(token);
  if (token !== rt.token) return;

  await phaseEvaluate(token);
  if (token !== rt.token) return;

  await phaseEvolve(token);
}

async function loop(token: number) {
  const s = getState();
  try {
    while (token === rt.token && s.machine.running) {
      await runCycle(token);
      if (token !== rt.token) break;
      if (s.settings.stepMode) {
        s.machine.running = false;
        s.machine.phase = "idle";
        log("Step complete. Machine paused.", "info", "idle");
        flush(true);
        break;
      }
    }
  } catch (e) {
    s.machine.lastError = e instanceof Error ? e.message : String(e);
    s.machine.running = false;
    s.machine.phase = "idle";
    log(`Machine halted: ${s.machine.lastError}`, "warn", "idle");
  } finally {
    if (token === rt.token) {
      rt.running = false;
      if (!s.machine.running) {
        s.machine.phase = "idle";
        s.machine.phaseProgress = 0;
      }
      flush(true);
    }
  }
}

// ------------------------------------------------------------------ control

export function startMachine(step = false) {
  const s = getState();
  if (s.machine.running) return;
  s.settings.stepMode = step;
  s.machine.running = true;
  s.machine.lastError = null;
  rt.running = true;
  rt.token += 1;
  const token = rt.token;
  log(step ? "Running one cycle." : "Machine started.", "good", "idle");
  // Start writing this cycle's copy immediately so it overlaps the research
  // phase rather than blocking on `generate`.
  if (!rt.prefetch) beginPrefetch(s.machine.cycle);
  flush(true);
  rt.loop = loop(token);
}

export function pauseMachine() {
  const s = getState();
  if (!s.machine.running) return;
  rt.token += 1; // cancels the in-flight cycle at its next checkpoint
  rt.running = false;
  s.machine.running = false;
  s.machine.phase = "idle";
  s.machine.phaseProgress = 0;
  log("Machine paused.", "warn", "idle");
  flush(true);
}

export function haltForReset() {
  rt.token += 1;
  rt.running = false;
  rt.prefetch = null;
  clearQueue();
}

export function machinePhases() {
  return PHASES;
}

export { findImageFile };
