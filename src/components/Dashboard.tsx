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
  const ads = useMemo(
    () => state.adOrder.map((id) => state.ads[id]).filter(Boolean),
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
          <span>lightschool.com · simulated Meta account</span>
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

        {m.running ? (
          <button className="btn" onClick={() => control("pause")}>
            Pause
          </button>
        ) : (
          <button className="btn primary" onClick={() => control("start")}>
            ▶ Run demo
          </button>
        )}
        <button className="btn" onClick={() => control("step")} disabled={m.running}>
          Step 1 cycle
        </button>
        <button
          className="btn"
          onClick={() => control("warm")}
          disabled={m.running || m.prefetch !== "none"}
          title="Write the first batch of copy now so Run demo starts instantly"
        >
          Pre-write
        </button>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm("Clear all ads and metrics? Brief and context are kept.")) {
              control("reset");
            }
          }}
        >
          Reset
        </button>
      </header>

      <PhaseRail machine={m} />

      {/* ------------------------------------------------------------ kpis */}
      <div className="kpis">
        <Kpi label="Ad spend" value={money(totals.spend, 0)} sub={`${totals.live} live ads`} />
        <Kpi label="Impressions" value={int(totals.impressions)} sub={`${int(totals.clicks)} clicks`} />
        <Kpi label="CTR" value={pct(totals.ctr)} sub={`CPC ${money(totals.cpc)}`} />
        <Kpi
          label="Conversions"
          value={int(totals.conversions)}
          sub={totals.conversions ? `CPA ${money(totals.cpa)}` : "—"}
        />
        <Kpi label="Revenue" value={money(totals.revenue, 0)} sub={`ROAS ${mult(totals.roas)}`} />
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
              <h2>Demo controls</h2>
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
                  Stage demo
                </button>
                <button
                  className="btn sm"
                  onClick={() => setSetting({ secondsPerWindow: 6, speed: 1 })}
                >
                  Walkthrough
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
                <div className="field">
                  <label>Daily budget</label>
                  <input
                    type="number"
                    min={10}
                    step={10}
                    value={state.settings.dailyBudget}
                    onChange={(e) => setSetting({ dailyBudget: Number(e.target.value) })}
                  />
                </div>
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
                In AI mode every ad calls an image model. Generation is async —

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
              No ads yet. Press <strong>Run demo</strong>.
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

