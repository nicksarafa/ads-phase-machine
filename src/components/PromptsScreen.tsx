"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Ad, PromptDraft, ReferenceAd } from "@/lib/types";

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

/** Everything that shapes an ad, on one screen: the files, the ads to imitate,
 *  and the prompt they build. The Live column is always visible so an edit on
 *  the left can be seen landing on the right. */
export default function PromptsScreen({ ads }: { ads: Ad[] }) {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState("");
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
  }, [load]);

  const act = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
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
    } finally {
      setBusy(false);
    }
  }, []);

  const upload = useCallback(
    async (files: FileList | null) => {
      for (const f of Array.from(files ?? []).slice(0, 8)) {
        await act("create-file", { title: f.name.replace(/\.[^.]+$/, ""), text: await f.text() });
      }
    },
    [act],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-4 border-b border-border px-6 py-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ArrowLeft className="size-4" /> Wall
          </Link>
        </Button>
        <h1 className="text-base font-semibold">Prompts</h1>
        <span className="text-sm text-muted-foreground">
          What the machine reads before it writes
        </span>
        {error && (
          <Badge variant="destructive" className="ml-auto">
            {error}
          </Badge>
        )}
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------------------ inputs */}
        <Tabs defaultValue="files">
          <TabsList>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="refs">Ads I like</TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="mt-4 space-y-2">
            {data?.files.map((f) => (
              <Card key={f.name} className="py-0">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={f.enabled}
                      onCheckedChange={() => act("toggle-file", { name: f.name })}
                    />
                    <button
                      className="flex-1 truncate text-left text-sm hover:text-primary"
                      onClick={() => {
                        if (open === f.name) return setOpen(null);
                        setOpen(f.name);
                        setEdit(f.body);
                        setDirty(false);
                      }}
                    >
                      {f.title}
                    </button>
                    <Badge variant="secondary">{f.body.length}c</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => act("delete-file", { name: f.name })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  {open === f.name && (
                    <div className="mt-3 space-y-2">
                      {f.note && (
                        <p className="text-xs text-muted-foreground">{f.note}</p>
                      )}
                      <Textarea
                        rows={14}
                        className="font-mono text-xs"
                        value={edit}
                        onChange={(e) => {
                          setEdit(e.target.value);
                          setDirty(true);
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={!dirty || busy}
                        onClick={async () => {
                          await act("save-file", { name: f.name, text: edit });
                          setDirty(false);
                        }}
                      >
                        Save {f.name}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <div className="flex gap-2 pt-1">
              <Input
                placeholder="New file name"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <Button
                variant="secondary"
                disabled={!newTitle.trim() || busy}
                onClick={async () => {
                  await act("create-file", { title: newTitle, text: "" });
                  setNewTitle("");
                }}
              >
                <Plus className="size-4" /> Add
              </Button>
              <Button asChild variant="secondary">
                <label className="cursor-pointer">
                  <Upload className="size-4" /> Upload
                  <input
                    type="file"
                    accept=".md,.txt"
                    multiple
                    hidden
                    onChange={(e) => {
                      void upload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Real files in <code>prompts/</code>. Ticked ones go into every generate.
            </p>
          </TabsContent>

          <TabsContent value="refs" className="mt-4 space-y-2">
            {data?.references.map((r) => (
              <Card key={r.id} className="py-0">
                <CardContent className="flex items-center gap-3 p-3">
                  <Checkbox
                    checked={r.enabled}
                    onCheckedChange={() => act("toggle-reference", { name: r.id })}
                  />
                  <span className="flex-1 truncate text-sm">{r.title}</span>
                  <Badge variant="secondary">{r.source}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => act("delete-reference", { name: r.id })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}

            <Input
              placeholder="Label"
              value={refTitle}
              onChange={(e) => setRefTitle(e.target.value)}
            />
            <Textarea
              rows={5}
              placeholder="Paste the ad whose format you want copied…"
              value={refBody}
              onChange={(e) => setRefBody(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!refBody.trim() || busy}
                onClick={async () => {
                  await act("add-reference", { title: refTitle, text: refBody });
                  setRefTitle("");
                  setRefBody("");
                }}
              >
                Add reference
              </Button>
              <select
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) act("capture-reference", { adId: e.target.value });
                  e.target.value = "";
                }}
              >
                <option value="">Capture from wall…</option>
                {ads.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {a.creative.headline}
                  </option>
                ))}
              </select>
              <Button variant="secondary" disabled={busy} onClick={() => act("rebuild-from-winners")}>
                <Sparkles className="size-4" />
                {busy ? "Writing…" : "Rebuild from winners"}
              </Button>
            </div>

            {data?.drafts.map((d) => (
              <Card key={d.id}>
                <CardHeader>
                  <CardTitle className="text-sm">{d.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
                    {d.body}
                  </pre>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => act("use-draft", { name: d.id })}>
                      Use as brief
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => act("delete-draft", { name: d.id })}
                    >
                      Discard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        {/* -------------------------------------------------------------- live */}
        <Card className="lg:sticky lg:top-6 lg:self-start">
          <CardHeader>
            <CardTitle className="text-sm">
              Live prompt
              <span className="ml-2 font-normal text-muted-foreground">
                {data ? `${data.live.chars.toLocaleString()} characters` : "…"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {data?.live.user}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
