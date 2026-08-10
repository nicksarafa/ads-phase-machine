"use client";

import type { Ad, Generation } from "@/lib/types";

/**
 * Per-generation aggregate performance. This is the chart that shows whether
 * the loop is actually learning: CTR should trend up and CPA down as the
 * evolve phase exploits what the evaluate phase measured.
 */
export default function PerfChart({
  generations,
  ads,
}: {
  generations: Generation[];
  ads: Record<string, Ad>;
}) {
  const points = generations
    .map((g) => {
      const list = g.adIds.map((id) => ads[id]).filter(Boolean);
      const impressions = list.reduce((s, a) => s + a.metrics.impressions, 0);
      const clicks = list.reduce((s, a) => s + a.metrics.clicks, 0);
      const spend = list.reduce((s, a) => s + a.metrics.spend, 0);
      const conv = list.reduce((s, a) => s + a.metrics.conversions, 0);
      const revenue = list.reduce((s, a) => s + a.metrics.revenue, 0);
      return {
        gen: g.index + 1,
        impressions,
        ctr: impressions ? clicks / impressions : 0,
        cpa: conv ? spend / conv : 0,
        roas: spend ? revenue / spend : 0,
      };
    })
    .filter((p) => p.impressions > 0);

  if (points.length < 2) {
    return (
      <div className="hint" style={{ padding: "18px 14px" }}>
        Two completed generations are needed before a trend means anything. Run
        the loop — this chart is where you watch it learn.
      </div>
    );
  }

  const W = 320;
  const H = 130;
  const PAD = { l: 6, r: 6, t: 12, b: 18 };

  const xs = (i: number) =>
    PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);

  const line = (values: number[], invert = false) => {
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || max || 1;
    return values
      .map((v, i) => {
        const norm = (v - min) / span;
        const y =
          PAD.t + (invert ? norm : 1 - norm) * (H - PAD.t - PAD.b);
        return `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const ctrPath = line(points.map((p) => p.ctr));
  const cpaValues = points.map((p) => p.cpa || 0);
  const cpaPath = cpaValues.some((v) => v > 0) ? line(cpaValues, true) : null;
  const roasPath = line(points.map((p) => p.roas));

  const first = points[0];
  const last = points[points.length - 1];
  const ctrDelta = first.ctr ? (last.ctr / first.ctr - 1) * 100 : 0;

  return (
    <div style={{ padding: "10px 14px 14px" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
        {points.map((p, i) => (
          <line
            key={p.gen}
            x1={xs(i)}
            y1={PAD.t - 4}
            x2={xs(i)}
            y2={H - PAD.b}
            stroke="#171b22"
            strokeWidth="1"
          />
        ))}
        {cpaPath && (
          <path d={cpaPath} fill="none" stroke="#5aa9ff" strokeWidth="1.8" />
        )}
        <path d={roasPath} fill="none" stroke="#35d39a" strokeWidth="1.8" />
        <path d={ctrPath} fill="none" stroke="#f2994a" strokeWidth="2.2" />
        {points.map((p, i) => (
          <g key={`l-${p.gen}`}>
            <circle cx={xs(i)} cy={H - PAD.b + 8} r="0" />
            <text
              x={xs(i)}
              y={H - 5}
              textAnchor="middle"
              fontSize="9"
              fill="#5f6b7a"
              fontFamily="ui-monospace, monospace"
            >
              G{p.gen}
            </text>
          </g>
        ))}
      </svg>

      <div className="legend" style={{ marginTop: 6 }}>
        <span>
          <i style={{ background: "#f2994a" }} />
          CTR
        </span>
        <span>
          <i style={{ background: "#5aa9ff" }} />
          CPA (inverted — up is cheaper)
        </span>
        <span>
          <i style={{ background: "#35d39a" }} />
          ROAS
        </span>
      </div>

      <div className="hint" style={{ marginTop: 8 }}>
        CTR from generation 1 to {last.gen}:{" "}
        <strong style={{ color: ctrDelta >= 0 ? "#35d39a" : "#ff5d73" }}>
          {ctrDelta >= 0 ? "+" : ""}
          {ctrDelta.toFixed(0)}%
        </strong>
        {" · "}latest ROAS {last.roas.toFixed(2)}x
      </div>
    </div>
  );
}
