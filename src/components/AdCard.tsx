"use client";

import { useState } from "react";
import type { Ad } from "@/lib/types";
import { money, pct, int, mult } from "@/lib/format";

const CTA_LABELS: Record<string, string> = {
  "Learn More": "Learn more",
  "Sign Up": "Sign up",
  "Get Offer": "Get offer",
  "Book Now": "Book now",
  Download: "Download",
};

export default function AdCard({
  ad,
  onFeedback,
}: {
  ad: Ad;
  onFeedback: (adId: string, rating: 1 | -1 | 0, note?: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const vote = ad.feedback.reduce((s, f) => s + f.rating, 0);
  const cls = [
    "adcard",
    ad.status === "killed" || ad.status === "paused" ? "killed" : "",
    ad.verdict === "winner" ? "winner" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const rendering = ad.image.status === "rendering";

  return (
    <article className={cls}>
      <div className="ad-meta">
        <span>{ad.label}</span>
        <span className={`tag ${statusTone(ad.status)}`}>{ad.status}</span>
        {ad.verdict && (
          <span className={`tag ${ad.verdict === "winner" ? "good" : ad.verdict === "loser" ? "bad" : ""}`}>
            {ad.verdict}
          </span>
        )}
        <span className="spacer" />
        <span>{money(ad.dailyBudget, 0)}/day</span>
      </div>

      <div className="fb">
        <div className="fb-head">
          <div className="fb-avatar">
            <img src="/lightschool-logo.svg" alt="Light School" width={34} height={34} />
          </div>
          <div>
            <div className="fb-name">Light School</div>
            <div className="fb-sponsored">Sponsored · 🌐</div>
          </div>
        </div>

        <div className="fb-body">{ad.creative.primaryText}</div>

        <div className="fb-image">
          {ad.image.url && <img src={ad.image.url} alt="" />}
          {rendering && <div className="shimmer" />}
          <div className="imgbadge">
            {rendering
              ? "generating image…"
              : ad.image.status === "failed"
                ? "procedural (AI failed)"
                : (ad.image.provider ?? "procedural")}
          </div>
        </div>

        <div className="fb-foot">
          <div className="txt">
            <div className="fb-domain">lightschool.com</div>
            <div className="fb-headline">{ad.creative.headline}</div>
            {ad.creative.description && (
              <div className="fb-desc">{ad.creative.description}</div>
            )}
          </div>
          <div className="fb-cta">{CTA_LABELS[ad.creative.cta] ?? ad.creative.cta}</div>
        </div>
      </div>

      <div className="ad-stats">
        <Stat label="Spend" value={money(ad.metrics.spend, 0)} />
        <Stat label="CTR" value={pct(ad.metrics.ctr)} />
        <Stat
          label="CPA"
          value={ad.metrics.conversions ? money(ad.metrics.cpa) : "—"}
        />
        <Stat label="ROAS" value={mult(ad.metrics.roas)} />
      </div>
      <div className="ad-stats">
        <Stat label="Impr" value={int(ad.metrics.impressions)} />
        <Stat label="Clicks" value={int(ad.metrics.clicks)} />
        <Stat label="Conv" value={int(ad.metrics.conversions)} />
        <Stat label="Score" value={ad.score === null ? "—" : ad.score.toFixed(2)} />
      </div>

      <div className="ad-genes">
        {Object.entries(ad.genes).map(([k, v]) => (
          <span className="tag" key={k} title={k}>
            {v}
          </span>
        ))}
      </div>

      {ad.creative.rationale && (
        <div className="ad-rationale">{ad.creative.rationale}</div>
      )}

      <div className="ad-actions">
        <button
          className={`btn sm ${vote > 0 ? "on" : ""}`}
          onClick={() => onFeedback(ad.id, 1)}
          title="Tell the next generation to make more like this"
        >
          Keep
        </button>
        <button
          className={`btn sm ${vote < 0 ? "on" : ""}`}
          onClick={() => onFeedback(ad.id, -1)}
          title="Tell the next generation to avoid this"
        >
          Reject
        </button>
        <button className="btn sm icon" onClick={() => setNoteOpen((v) => !v)}>
          Note
        </button>
        <span className="spacer" />
        {vote !== 0 && (
          <button className="btn sm icon" onClick={() => onFeedback(ad.id, 0)}>
            clear
          </button>
        )}
      </div>

      {noteOpen && (
        <div className="ad-note">
          <textarea
            rows={2}
            placeholder="Why? e.g. 'the objection framing works, the CTA is wrong'"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="row" style={{ marginTop: 6 }}>
            <button
              className="btn sm primary"
              onClick={() => {
                if (!note.trim()) return;
                onFeedback(ad.id, 1, note.trim());
                setNote("");
                setNoteOpen(false);
              }}
            >
              Keep with note
            </button>
            <button
              className="btn sm danger"
              onClick={() => {
                if (!note.trim()) return;
                onFeedback(ad.id, -1, note.trim());
                setNote("");
                setNoteOpen(false);
              }}
            >
              Reject with note
            </button>
          </div>
        </div>
      )}

      {ad.feedback.length > 0 && (
        <div className="ad-rationale">
          {ad.feedback.map((f, i) => (
            <div key={i}>
              <span className={`tag ${f.rating > 0 ? "good" : "bad"}`}>
                {f.rating > 0 ? "keep" : "reject"}
              </span>{" "}
              {f.note || <em>no note</em>}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ad-stat">
      <div className="l">{label}</div>
      <div className="v">{value}</div>
    </div>
  );
}

function statusTone(status: Ad["status"]) {
  if (status === "active") return "good";
  if (status === "killed") return "bad";
  if (status === "paused") return "warn";
  return "";
}
