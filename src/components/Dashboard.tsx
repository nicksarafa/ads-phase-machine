"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdCard from "./AdCard";
import PhaseRail from "./PhaseRail";
import PerfChart from "./PerfChart";
import Link from "next/link";
import { clock, hours, int, money, mult, pct } from "@/lib/format";
import {
  PHASE_LABELS,
  type AppState,
  type Settings,
} from "@/lib/types";

type Filter = "all" | "active" | "winner" | "killed";

export default function Dashboard({ initial }: { initial: AppState }) {
  const [state, setState] = useState<AppState>(initial);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  // ------------------------------------------------------------ live feed
  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.addEventListener("open", () => setConnected(true));
    es.addEventListener("state", (e) => {
      const next = JSON.parse((e as MessageEvent).data) as AppState;
      setState(next);
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  // -------------------------------------------------------------- actions
  const post = useCallback(async (url: string, body: unknown, method = "POST") => {
    await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }, []);

  const control = useCallback(
    (action: string, extra: Record<string, unknown> = {}) =>
      post("/api/control", { action, ...extra }),
    [post],
  );

  const setSetting = useCallback(
    (patch: Partial<Settings>) => control("settings", { settings: patch }),
    [control],
  );

  const feedback = useCallback(
    (adId: string, rating: 1 | -1 | 0, note?: string) =>
      post("/api/feedback", { adId, rating, note }),
    [post],
  );


  // --------------------------------------------------------------- derived
  const campaign = useMemo(
    () =>
      state.campaigns?.find((c) => c.id === state.settings.offerFocus) ??
      state.campaigns?.[0],
    [state],
  );

  // The wall shows one campaign at a time. Mixing them would put two different
  // offers, sold to two different buyers, into a single set of averages.
  const ads = useMemo(
    () =>
      state.adOrder
        .map((id) => state.ads[id])
        .filter((a) => a && a.campaign === state.settings.offerFocus),
    [state],
  );

  const totals = useMemo(() => {
    const t = ads.reduce(
      (acc, a) => {
        acc.spend += a.metrics.spend;
        acc.impressions += a.metrics.impressions;
        acc.clicks += a.metrics.clicks;
        acc.conversions += a.metrics.conversions;
        acc.revenue += a.metrics.revenue;
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
    );
    return {
      ...t,
      ctr: t.impressions ? t.clicks / t.impressions : 0,
      cpc: t.clicks ? t.spend / t.clicks : 0,
      cpa: t.conversions ? t.spend / t.conversions : 0,
      roas: t.spend ? t.revenue / t.spend : 0,
      live: ads.filter((a) => a.status === "active").length,
      /**
       * Whether revenue is measurable at all.
       *
       * The connected account has no pixel, so conversions and revenue come
       * back as zero from Meta forever. Rendering that as "0.00x ROAS" would
       * read as a catastrophic result rather than an absent one, so a missing
       * signal is shown as missing.
       */
      tracked: t.spend > 0 && t.conversions > 0,
      delivering: t.impressions > 0,
    };
  }, [ads]);

  const visible = useMemo(() => {
    const sorted = [...ads].reverse();
    if (filter === "all") return sorted;
    if (filter === "active") return sorted.filter((a) => a.status === "active");
    if (filter === "winner") return sorted.filter((a) => a.verdict === "winner");
    return sorted.filter((a) => a.status === "killed" || a.status === "paused");
  }, [ads, filter]);

  const m = state.machine;

  return (
    <div className="shell">
      {/* ---------------------------------------------------------- topbar */}
      <header className="topbar">
        <div className="brand">
          <h1>Ads Phase Machine</h1>
          <span>
            lightschool.com ·{" "}
            {state.settings.live ? (
              <strong className="sub-live">live Meta account</strong>
            ) : (
              "simulated Meta account"
            )}
          </span>
        </div>

        <Link className="btn" href="/prompts">
          Prompts
        </Link>

        {/* Status is three dots and a phase name. The pills that used to spell
            out cycle, clock, providers and key presence were the densest copy
            on the page, and all of it is in the machine log already. */}
        <div className="statuspill" title={`cycle ${m.cycle + 1} · T+${hours(m.clockHours)}`}>
          <span className={`dot ${m.running ? "live" : ""}`} />
          {m.running ? PHASE_LABELS[m.phase] : "Paused"}
        </div>

        <div
          className="statuspill"
          title={[
            `copy: ${m.llmProvider ?? "not run yet"}`,
            m.imageProvider ? `images: ${m.imageProvider}` : null,
            m.credentials
              ? `keys: anthropic ${m.credentials.anthropic ? "✓" : "✗"}, gemini ${m.credentials.gemini ? "✓" : "✗"}`
              : null,
            m.prefetch !== "none" ? `next batch: ${m.prefetch}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          <span className="dot" style={{ background: connected ? "var(--info)" : "var(--bad)" }} />
          <span
            className="dot"
            style={{
              background: m.credentials?.anthropic ? "var(--good)" : "var(--ink-faint)",
            }}
          />
          <span
            className="dot"
            style={{
              background: m.credentials?.gemini ? "var(--good)" : "var(--ink-faint)",
            }}
          />
          {m.prefetch !== "none" && (
            <span
              className={`dot ${m.prefetch === "writing" ? "live" : ""}`}
              style={{ background: m.prefetch === "ready" ? "var(--good)" : "var(--warn)" }}
            />
          )}
        </div>

        <div className="topbar-spacer" />

        {/* One primary action. "Step" runs exactly one cycle and stops, which
            is what "generate me some ads" actually means — the continuous loop
            is the specialist option, not the default. */}
        {m.running ? (
          <button className="btn" onClick={() => control("pause")}>
            Pause
          </button>
        ) : (
          <button
            className="btn primary"
            onClick={() => control("step")}
            title={`Write, render and place ${state.settings.adsPerCycle} ads for ${campaign?.name ?? "this campaign"}`}
          >
            ▶ Generate ads
          </button>
        )}
        <button
          className="btn"
          onClick={() => control("start")}
          disabled={m.running}
          title="Keep cycling: generate, measure, evolve, repeat"
        >
          Run loop
        </button>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm("Clear all ads and metrics? Briefs and context are kept.")) {
              control("reset");
            }
          }}
        >
          Reset
        </button>
      </header>

      {/* ------------------------------------------------- campaign switcher */}
      {state.campaigns?.length ? (
        <div className="campaignbar">
          <div className="campaign-tabs">
            {state.campaigns.map((c) => (
              <button
                key={c.id}
                className={`campaign-tab ${c.id === state.settings.offerFocus ? "on" : ""}`}
                onClick={() => setSetting({ offerFocus: c.id })}
                disabled={m.running}
                title={m.running ? "Pause the machine to switch campaigns" : c.audience}
              >
                <strong>{c.name}</strong>
                <span>{c.audience}</span>
              </button>
            ))}
          </div>

          {campaign ? (
            <div className="campaign-meta">
              <div className="campaign-dest">
                <span className="lbl">Sends clicks to</span>
                {m.live?.destinations?.[campaign.id] ? (
                  <a
                    href={m.live.destinations[campaign.id]}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {m.live.destinations[campaign.id].replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span className="missing">no destination set</span>
                )}
              </div>

              <div className="campaign-dest">
                <span className="lbl">Budget</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={campaign.dailyBudget}
                  disabled={m.running}
                  onChange={(e) =>
                    post("/api/control", {
                      action: "budget",
                      campaign: campaign.id,
                      dailyBudget: Number(e.target.value),
                    })
                  }
                />
                <span className="lbl">
                  /day{" "}
                  {state.settings.live
                    ? `· $${state.campaigns.reduce((n, c) => n + c.dailyBudget, 0)} of $${m.live?.maxDailyUsd} total`
                    : ""}
                </span>
              </div>

              <div className="campaign-dest">
                <span className="lbl">Targeting</span>
                <span>{m.live?.geoLabel || "Lisbon 40km · PT"}</span>
              </div>

              <div className="campaign-dest">
                <span className="lbl">On Meta</span>
                {campaign.placement ? (
                  <span className="ok">paused · {Object.keys(campaign.placement.adIds).length} ads placed</span>
                ) : state.settings.live ? (
                  <span className="missing">nothing placed yet</span>
                ) : (
                  <span className="missing">simulation</span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <PhaseRail machine={m} />

      {/* ------------------------------------------------------------ kpis */}
      <div className="kpis">
        <Kpi label="Ad spend" value={money(totals.spend, 0)} sub={`${totals.live} live ads`} />
        <Kpi label="Impressions" value={int(totals.impressions)} sub={`${int(totals.clicks)} clicks`} />
        <Kpi label="CTR" value={pct(totals.ctr)} sub={`CPC ${money(totals.cpc)}`} />
        {/* Conversions and ROAS are only shown as numbers when something has
            actually been measured. Against an account with no pixel they would
            otherwise render as a confident 0 and 0.00x — a missing signal
            dressed up as a terrible result. */}
        <Kpi
          label="Conversions"
          value={totals.tracked ? int(totals.conversions) : "—"}
          sub={totals.tracked ? `CPA ${money(totals.cpa)}` : "no pixel"}
        />
        <Kpi
          label="Revenue"
          value={totals.tracked ? money(totals.revenue, 0) : "—"}
          sub={totals.tracked ? `ROAS ${mult(totals.roas)}` : "ROAS unavailable"}
        />
        <Kpi
          label="Generations"
          value={String(state.generations.length)}
          sub={`${ads.length} ads made`}
        />
      </div>

      <div className="main">
        {/* ------------------------------------------------------ left col */}
        <aside className="col left">
          <section className="panel">
            <div className="panel-head">
              <h2>Settings</h2>
            </div>
            <div className="panel-body">
              <div className="field">
                <label>Speed — {state.settings.speed}x</label>
                <input
                  type="range"
                  min={0.5}
                  max={20}
                  step={0.5}
                  value={state.settings.speed}
                  onChange={(e) => setSetting({ speed: Number(e.target.value) })}
                />
                <div className="hint">
                  {humanWindow(state.settings.secondsPerWindow / state.settings.speed)}{" "}
                  per 6h window · {state.settings.windowsPerCycle} per cycle
                </div>
              </div>

              <div className="row wrap">
                <button
                  className="btn sm"
                  onClick={() => setSetting({ secondsPerWindow: 6, speed: 20 })}
                >
                  Fast
                </button>
                <button
                  className="btn sm"
                  onClick={() => setSetting({ secondsPerWindow: 6, speed: 1 })}
                >
                  Readable
                </button>
                <button
                  className="btn sm"
                  onClick={() => setSetting({ secondsPerWindow: 21600, speed: 1 })}
                  title="One observation window = one real 6-hour period"
                >
                  Real 6h cadence
                </button>
              </div>

              <div className="grid2">
                <div className="field">
                  <label>Ads / cycle</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={state.settings.adsPerCycle}
                    onChange={(e) => setSetting({ adsPerCycle: Number(e.target.value) })}
                  />
                </div>
                {/* Budget deliberately lives on the campaign bar, next to the
                    destination it pays for. A second budget field here would be
                    a second source of truth for the number that spends money. */}
                <div className="field">
                  <label>Windows / cycle</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={state.settings.windowsPerCycle}
                    onChange={(e) =>
                      setSetting({ windowsPerCycle: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="field">
                  <label>AI images / cycle</label>
                  <input
                    type="number"
                    min={0}
                    max={12}
                    value={state.settings.aiImagesPerCycle}
                    onChange={(e) =>
                      setSetting({ aiImagesPerCycle: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="field">
                  <label>Kill bottom %</label>
                  <input
                    type="number"
                    min={0}
                    max={80}
                    step={5}
                    value={Math.round(state.settings.killThreshold * 100)}
                    onChange={(e) =>
                      setSetting({ killThreshold: Number(e.target.value) / 100 })
                    }
                  />
                </div>
              </div>

              <div className="row">
                <button
                  className={`btn sm ${state.settings.brandLogo ? "on" : ""}`}
                  onClick={() => setSetting({ brandLogo: !state.settings.brandLogo })}
                  title="Send the real Light School mark to the image model as a reference"
                >
                  {state.settings.brandLogo ? "Logo in creative ✓" : "Logo in creative"}
                </button>
              </div>

              {/*
                Real money. This block is deliberately the loudest thing in the
                panel, and it only appears at all when the environment has
                already authorised live placement — there is nothing to toggle,
                and nothing to explain away, on a fresh clone.
              */}
              {state.machine.live?.gateOpen ? (
                <div className={`live-box ${state.settings.live ? "armed" : ""}`}>
                  <div className="row">
                    <button
                      className={`btn sm ${state.settings.live ? "on" : ""}`}
                      onClick={() => setSetting({ live: !state.settings.live })}
                      disabled={!state.machine.live.ready && !state.settings.live}
                      title={
                        state.machine.live.ready
                          ? "Place real ads on the connected Meta ad account"
                          : `Not configured: missing ${state.machine.live.missing.join(", ")}`
                      }
                    >
                      {state.settings.live ? "● LIVE — real ads" : "Simulation"}
                    </button>
                    {state.settings.live ? (
                      <span className="live-cap">
                        capped ${state.machine.live.maxDailyUsd}/day
                      </span>
                    ) : null}
                  </div>

                  {!state.machine.live.ready ? (
                    <div className="hint warn">
                      Live mode needs {state.machine.live.missing.join(", ")} in
                      .env, then a restart.
                    </div>
                  ) : state.settings.live ? (
                    <div className="hint">
                      Ads are created <strong>PAUSED</strong> on the real ad
                      account. Nothing spends until you activate the campaign in
                      Meta Ads Manager. Delivery is read back on a real clock, so
                      metrics stay at zero until it is live.
                    </div>
                  ) : (
                    <div className="hint">
                      Delivery is simulated. No ad reaches Meta and no money moves.
                    </div>
                  )}

                  {state.machine.live.lastVerify?.length ? (
                    <div className="hint warn">
                      Last placement did not match the plan:{" "}
                      {state.machine.live.lastVerify.join("; ")}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="row">
                <button
                  className={`btn sm ${state.settings.imageMode === "ai" ? "on" : ""}`}
                  onClick={() => setSetting({ imageMode: "ai" })}
                >
                  AI imagery
                </button>
                <button
                  className={`btn sm ${state.settings.imageMode === "procedural" ? "on" : ""}`}
                  onClick={() => setSetting({ imageMode: "procedural" })}
                >
                  Procedural (instant)
                </button>
              </div>
              <div className="hint">
                In AI mode the first {state.settings.aiImagesPerCycle} ad
                {state.settings.aiImagesPerCycle === 1 ? "" : "s"} of each cycle
                call an image model; the rest keep procedural artwork.
                Generation is async — cards fill in as images land.
              </div>
            </div>
          </section>

        </aside>

        {/* ------------------------------------------------------ centre col */}
        <main className="col">
          <div className="wall-head">
            <h2>Ad wall</h2>
            <span className="tag">{visible.length} shown</span>
            <span className="spacer" style={{ flex: 1 }} />
            {(["all", "active", "winner", "killed"] as Filter[]).map((f) => (
              <button
                key={f}
                className={`btn sm ${filter === f ? "on" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="empty">
              No ads yet. Press <strong>Generate ads</strong>.
            </div>
          ) : (
            <div className="wall">
              {visible.map((ad) => (
                <AdCard key={ad.id} ad={ad} onFeedback={feedback} />
              ))}
            </div>
          )}
        </main>

        {/* ------------------------------------------------------ right col */}
        <aside className="col right">
          <section className="panel">
            <div className="panel-head">
              <h2>Learning curve</h2>
            </div>
            <div className="panel-body tight">
              <PerfChart generations={state.generations} ads={state.ads} />
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>What the machine believes</h2>
            </div>
            <div className="panel-body tight">
              {state.insights.length === 0 ? (
                <div className="hint" style={{ padding: "16px 14px" }}>
                  No measured signal yet. After the first evaluate phase, every
                  strategic lever gets an index — 100 is average.
                </div>
              ) : (
                <>
                  <div className="insight-head">
                    <span>Lever</span>
                    <span>CTR</span>
                    <span>CPA</span>
                  </div>
                  {state.insights.slice(0, 14).map((i) => (
                    <div className="insight" key={`${i.key}:${i.value}`}>
                      <div className="k" title={`${i.samples} ads · ${int(i.impressions)} impr`}>
                        {i.key}={i.value}
                      </div>
                      <div className={`n ${i.ctrIndex >= 105 ? "up" : i.ctrIndex <= 95 ? "down" : ""}`}>
                        {i.ctrIndex}
                      </div>
                      <div className={`n ${i.cpaIndex >= 105 ? "up" : i.cpaIndex <= 95 ? "down" : ""}`}>
                        {i.cpaIndex}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>

          {state.generations.at(-1)?.learnings?.length ? (
            <section className="panel">
              <div className="panel-head">
                <h2>Last evolve</h2>
              </div>
              <div className="panel-body">
                {state.generations.at(-1)!.learnings.map((l, i) => (
                  <div className="hint" key={i} style={{ color: "var(--ink-dim)" }}>
                    • {l}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel-head">
              <h2>Machine log</h2>
              <span className="spacer" />
              <span className="tag">{state.log.length}</span>
            </div>
            <div className="panel-body tight">
              <div className="logfeed">
                {state.log.slice(0, 60).map((l) => (
                  <div className={`logline ${l.level}`} key={l.id}>
                    <span className="t">{clock(l.at)}</span>
                    <span className="m">{l.message}</span>
                  </div>
                ))}
                {state.log.length === 0 && (
                  <div className="hint" style={{ padding: "16px 14px" }}>
                    Nothing yet.
                  </div>
                )}
              </div>
            </div>
          </section>

          {m.lastError && (
            <section className="panel">
              <div className="panel-head">
                <h2>Last error</h2>
              </div>
              <div className="panel-body">
                <div className="hint" style={{ color: "var(--bad)" }}>
                  {m.lastError}
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function humanWindow(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)} hours`;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

