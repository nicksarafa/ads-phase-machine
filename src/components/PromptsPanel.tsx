"use client";

import { useCallback, useEffect, useState } from "react";
import type { Ad, PromptDraft, ReferenceAd } from "@/lib/types";

/**
 * The prompt library.
 *
 * Everything that shapes an ad in one place: the files on disk, the ads whose
 * format should be copied, briefs rebuilt from measured winners, and — the
 * point of the panel — the exact prompt all of it currently produces. The Live
 * tab renders the same string the generate phase sends, so what you read here
 * is what the model reads.
 */

interface LibraryFile {
  name: string;
  title: string;
  note: string;
  body: string;
  bytes: number;
  enabled: boolean;
}

interface Payload {
  files: LibraryFile[];
  references: ReferenceAd[];
  drafts: PromptDraft[];
  live: { system: string; user: string; image: string; chars: number };
}

type Tab = "files" | "refs" | "live";

export default function PromptsPanel({
  ads,
  version,
}: {
  /** Active ads, for capturing one as a format reference. */
  ads: Ad[];
  /** Bumps on every state push so the live preview stays current. */
  version: number;
}) {
  const [tab, setTab] = useState<Tab>("files");
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openFile, setOpenFile] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [dirty, setDirty] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [refTitle, setRefTitle] = useState("");
  const [refBody, setRefBody] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/prompts");
    if (r.ok) setData((await r.json()) as Payload);
  }, []);

  useEffect(() => {
    void load();
  }, [load, version]);

  const act = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      setBusy(true);
      setError(null);
      try {
        const r = await fetch("/api/prompts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, ...body }),
        });
        const json = await r.json();
        if (!r.ok) setError(json.error ?? "failed");
        else setData(json as Payload);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  /** Read an uploaded .md/.txt in the browser — no upload endpoint needed. */
  const onUpload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      for (const f of Array.from(files).slice(0, 8)) {
        const text = await f.text();
        await act("create-file", { title: f.name.replace(/\.[^.]+$/, ""), text });
      }
    },
    [act],
  );

  const openEditor = (f: LibraryFile) => {
    if (openFile === f.name) {
      setOpenFile(null);
      return;
    }
    setOpenFile(f.name);
    setEditBody(f.body);
    setDirty(false);
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Prompts</h2>
        <span className="spacer" style={{ flex: 1 }} />
        {(
          [
            ["files", "Files"],
            ["refs", "Ads I like"],
            ["live", "Live"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            className={`btn sm ${tab === t ? "on" : ""}`}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="panel-body">
        {error && <div className="tag bad">{error}</div>}

        {/* ------------------------------------------------------------ files */}
        {tab === "files" && data && (
          <>
            <div className="lib-list">
              {data.files.map((f) => (
                <div key={f.name} className="lib-item">
                  <div className="lib-row">
                    <input
                      type="checkbox"
                      checked={f.enabled}
                      onChange={() => act("toggle-file", { name: f.name })}
                      title="Send this file with every generate"
                    />
                    <button className="lib-name" onClick={() => openEditor(f)}>
                      {f.title}
                    </button>
                    <span className="tag">{f.body.length}c</span>
                    <button
                      className="btn xs"
                      onClick={() => act("delete-file", { name: f.name })}
                    >
                      ×
                    </button>
                  </div>
                  {openFile === f.name && (
                    <div className="lib-edit">
                      {f.note && <div className="hint">{f.note}</div>}
                      <textarea
                        rows={12}
                        value={editBody}
                        onChange={(e) => {
                          setEditBody(e.target.value);
                          setDirty(true);
                        }}
                      />
                      <div className="row">
                        <button
                          className="btn primary sm"
                          disabled={!dirty || busy}
                          onClick={async () => {
                            await act("save-file", { name: f.name, text: editBody });
                            setDirty(false);
                          }}
                        >
                          Save to {f.name}
                        </button>
                        {dirty && <span className="tag warn">unsaved</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="row">
              <input
                placeholder="New file name"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <button
                className="btn sm"
                disabled={!newTitle.trim() || busy}
                onClick={async () => {
                  await act("create-file", { title: newTitle, text: "" });
                  setNewTitle("");
                }}
              >
                Add
              </button>
              <label className="btn sm upload">
                Upload
                <input
                  type="file"
                  accept=".md,.txt,text/plain,text/markdown"
                  multiple
                  hidden
                  onChange={(e) => {
                    void onUpload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="hint">
              Real files in <code>prompts/</code>. Ticked ones go into every
              generate. <code>design.md</code> always drives image art direction.
            </div>
          </>
        )}

        {/* ------------------------------------------------------------- refs */}
        {tab === "refs" && data && (
          <>
            <div className="lib-list">
              {data.references.length === 0 && (
                <div className="hint">
                  Nothing yet. Paste an ad below, or capture one off the wall.
                </div>
              )}
              {data.references.map((r) => (
                <div key={r.id} className="lib-item">
                  <div className="lib-row">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={() => act("toggle-reference", { name: r.id })}
                    />
                    <span className="lib-name">{r.title}</span>
                    <span className="tag">{r.source}</span>
                    <button
                      className="btn xs"
                      onClick={() => act("delete-reference", { name: r.id })}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <input
              placeholder="Label, e.g. Synthesia 3-step"
              value={refTitle}
              onChange={(e) => setRefTitle(e.target.value)}
            />
            <textarea
              rows={5}
              placeholder="Paste the ad copy whose format you want copied…"
              value={refBody}
              onChange={(e) => setRefBody(e.target.value)}
            />
            <div className="row">
              <button
                className="btn primary sm"
                disabled={!refBody.trim() || busy}
                onClick={async () => {
                  await act("add-reference", { title: refTitle, text: refBody });
                  setRefTitle("");
                  setRefBody("");
                }}
              >
                Add reference
              </button>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) act("capture-reference", { adId: e.target.value });
                  e.target.value = "";
                }}
              >
                <option value="">Capture from wall…</option>
                {ads.slice(0, 40).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {a.creative.headline}
                  </option>
                ))}
              </select>
            </div>
            <div className="hint">
              The model is told to match the structure and never the wording.
            </div>

            <div className="panel-head" style={{ marginTop: 12 }}>
              <h2>Rebuilt briefs</h2>
              <span className="spacer" style={{ flex: 1 }} />
              <button
                className="btn sm"
                disabled={busy}
                onClick={() => act("rebuild-from-winners")}
              >
                {busy ? "Writing…" : "Rebuild from winners"}
              </button>
            </div>
            {data.drafts.map((d) => (
              <div key={d.id} className="lib-item">
                <div className="lib-row">
                  <span className="lib-name">{d.title}</span>
                  <button className="btn xs" onClick={() => act("use-draft", { name: d.id })}>
                    Use
                  </button>
                  <button
                    className="btn xs"
                    onClick={() => act("delete-draft", { name: d.id })}
                  >
                    ×
                  </button>
                </div>
                <pre className="lib-pre">{d.body}</pre>
                <div className="hint">From: {d.basis.join(" · ")}</div>
              </div>
            ))}
          </>
        )}

        {/* ------------------------------------------------------------- live */}
        {tab === "live" && data && (
          <>
            <div className="hint">
              Exactly what the copy model receives on the next generate —{" "}
              {data.live.chars.toLocaleString()} characters.
            </div>
            <pre className="lib-pre tall">{data.live.user}</pre>
            <div className="hint">Image prompt wrapper</div>
            <pre className="lib-pre">{data.live.image}</pre>
          </>
        )}
      </div>
    </section>
  );
}
