"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  SCORED_COMPONENTS,
  type Ad,
  type ContextSource,
  type DesignAsset,
  type PromptDraft,
  type ReferenceAd,
  type Scorecard,
  type ScoredComponent,
} from "@/lib/types";

interface LibraryFile {
  name: string;
  title: string;
  note: string;
  body: string;
  bytes: number;
  enabled: boolean;
  section: boolean;
}

interface Payload {
  brief: string;
  context: ContextSource[];
  files: LibraryFile[];
  references: ReferenceAd[];
  assets: DesignAsset[];
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
  const [ctxTitle, setCtxTitle] = useState("");
  const [ctxBody, setCtxBody] = useState("");
  const [ctxKind, setCtxKind] = useState<ContextSource["kind"]>("note");
  const [cards, setCards] = useState<Scorecard[]>([]);
  const [ruleLabel, setRuleLabel] = useState("");
  const [rulePoints, setRulePoints] = useState(10);
  const [ruleComp, setRuleComp] = useState<ScoredComponent>("primaryText");
  const [judgeMsg, setJudgeMsg] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [briefDirty, setBriefDirty] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/prompts");
    if (r.ok) {
      const j = (await r.json()) as Payload;
      setData(j);
      // Never stomp on text being edited right now.
      setBrief((b) => (briefDirty ? b : j.brief));
    }
  }, [briefDirty]);
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

  const loadCards = useCallback(async () => {
    const r = await fetch("/api/scorecard");
    if (r.ok) setCards(((await r.json()) as { scorecards: Scorecard[] }).scorecards);
  }, []);
  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const cardAct = useCallback(
    async (p: Record<string, unknown>) => {
      setBusy(true);
      setJudgeMsg(null);
      try {
        const r = await fetch("/api/scorecard", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(p),
        });
        const j = await r.json();
        if (!r.ok) setJudgeMsg(j.error ?? "failed");
        else setCards(j.scorecards as Scorecard[]);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  /** Context lives on its own endpoint; refresh the payload after each call. */
  const ctxAct = useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(true);
      try {
        await fetch("/api/context", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  /** Upload a design asset for the image model. */
  const uploadAsset = useCallback(
    async (files: FileList | null, role: "style" | "logo") => {
      for (const f of Array.from(files ?? []).slice(0, 6)) {
        const dataUrl: string = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.onerror = () => rej(fr.error);
          fr.readAsDataURL(f);
        });
        await act("add-asset", {
          title: f.name.replace(/\.[^.]+$/, ""),
          text: dataUrl,
          name: role,
        });
      }
    },
    [act],
  );

  /** Read an image in the browser and post it as a data URL. */
  const uploadImage = useCallback(
    async (files: FileList | null) => {
      for (const f of Array.from(files ?? []).slice(0, 6)) {
        const dataUrl: string = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.onerror = () => rej(fr.error);
          fr.readAsDataURL(f);
        });
        await act("add-reference-image", {
          title: f.name.replace(/\.[^.]+$/, ""),
          text: dataUrl,
        });
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
        <Tabs defaultValue="brief">
          <TabsList>
            <TabsTrigger value="brief">Brief</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="context">Context</TabsTrigger>
            <TabsTrigger value="refs">Ads I like</TabsTrigger>
            <TabsTrigger value="assets">Design assets</TabsTrigger>
            <TabsTrigger value="score">Scorecard</TabsTrigger>
          </TabsList>

          <TabsContent value="brief" className="mt-4 space-y-2">
            <Textarea
              rows={26}
              className="font-mono text-xs"
              value={brief}
              onChange={(e) => {
                setBrief(e.target.value);
                setBriefDirty(true);
              }}
            />
            <div className="flex items-center gap-2">
              <Button
                disabled={!briefDirty || busy}
                onClick={async () => {
                  await act("save-file", { name: "main.md", text: brief });
                  setBriefDirty(false);
                }}
              >
                Save brief
              </Button>
              {briefDirty && <Badge variant="secondary">unsaved</Badge>}
              <span className="text-xs text-muted-foreground">
                Saved to <code>prompts/main.md</code>. Always in effect, no
                switch. Takes effect on the next generate.
              </span>
            </div>
          </TabsContent>

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
                    {f.section && (
                      <Badge
                        variant="outline"
                        title="Replaces a built-in section of the prompt. Off means the built-in text is used instead."
                      >
                        overrides
                      </Badge>
                    )}
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
              Real files in <code>prompts/</code>. Ticked files go into every
              generate. One marked <em>overrides</em> replaces a built-in
              section of the prompt; untick it and the built-in text comes back.
            </p>
          </TabsContent>

          <TabsContent value="context" className="mt-4 space-y-2">
            {data?.context.map((c) => (
              <Card key={c.id} className="py-0">
                <CardContent className="flex items-start gap-3 p-3">
                  <Checkbox
                    className="mt-1"
                    checked={c.enabled}
                    onCheckedChange={() => ctxAct({ op: "toggle", id: c.id })}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm">{c.title}</span>
                      <Badge variant="secondary">{c.kind}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {c.body}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => ctxAct({ op: "delete", id: c.id })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}

            <div className="flex gap-2">
              <select
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={ctxKind}
                onChange={(e) => setCtxKind(e.target.value as ContextSource["kind"])}
              >
                <option value="note">note</option>
                <option value="url">url (fetched and read)</option>
                <option value="audience">audience insight</option>
                <option value="proof">proof / testimonial</option>
              </select>
              <Input
                placeholder="Title"
                value={ctxTitle}
                onChange={(e) => setCtxTitle(e.target.value)}
              />
            </div>
            <Textarea
              rows={4}
              placeholder={ctxKind === "url" ? "https://…" : "What the machine should know…"}
              value={ctxBody}
              onChange={(e) => setCtxBody(e.target.value)}
            />
            <Button
              disabled={!ctxTitle.trim() || !ctxBody.trim() || busy}
              onClick={async () => {
                await ctxAct({ title: ctxTitle, body: ctxBody, kind: ctxKind });
                setCtxTitle("");
                setCtxBody("");
              }}
            >
              {busy ? "Adding…" : "Add context"}
            </Button>
          </TabsContent>

          <TabsContent value="refs" className="mt-4 space-y-2">
            {data?.references.map((r) => (
              <Card key={r.id} className="py-0">
                <CardContent className="flex items-center gap-3 p-3">
                  <Checkbox
                    checked={r.enabled}
                    onCheckedChange={() => act("toggle-reference", { name: r.id })}
                  />
                  {r.image && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`/api/ref/${r.image.file}`}
                      alt=""
                      className="size-10 rounded object-cover"
                    />
                  )}
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
              <Button asChild variant="secondary">
                <label className="cursor-pointer">
                  <ImagePlus className="size-4" /> Upload ad image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    hidden
                    onChange={(e) => {
                      void uploadImage(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </Button>
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
          <TabsContent value="score" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              A rubric an ad is graded against before it earns budget. Each rule
              targets one part of the generated ad and is worth points; an ad
              clears the bar when it scores above the threshold. This is separate
              from measured performance, which only exists after delivery.
            </p>
            {judgeMsg && <Badge variant="destructive">{judgeMsg}</Badge>}

            {cards.map((c) => {
              const max = c.rules.reduce((n, r) => n + r.points, 0);
              return (
                <Card key={c.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={c.enabled}
                        onCheckedChange={() => cardAct({ action: "toggle-scorecard", id: c.id })}
                      />
                      <span className="flex-1">{c.name}</span>
                      <Badge variant="secondary">{max} pts</Badge>
                      <label className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                        pass at
                        <Input
                          type="number"
                          className="h-7 w-16"
                          value={c.threshold}
                          onChange={(e) =>
                            cardAct({
                              action: "set-threshold",
                              id: c.id,
                              threshold: Number(e.target.value),
                            })
                          }
                        />
                        %
                      </label>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => cardAct({ action: "delete-scorecard", id: c.id })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {c.rules.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="w-24 justify-center">
                          {r.component}
                        </Badge>
                        <span className="flex-1">{r.label}</span>
                        <Badge variant="secondary">{r.points}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            cardAct({ action: "delete-rule", id: c.id, ruleId: r.id })
                          }
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))}

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <select
                        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                        value={ruleComp}
                        onChange={(e) => setRuleComp(e.target.value as ScoredComponent)}
                      >
                        {SCORED_COMPONENTS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                      <Input
                        className="flex-1 min-w-40"
                        placeholder="What must be true, e.g. names a real number"
                        value={ruleLabel}
                        onChange={(e) => setRuleLabel(e.target.value)}
                      />
                      <Input
                        type="number"
                        className="w-20"
                        value={rulePoints}
                        onChange={(e) => setRulePoints(Number(e.target.value))}
                      />
                      <Button
                        size="sm"
                        disabled={!ruleLabel.trim() || busy}
                        onClick={async () => {
                          await cardAct({
                            action: "add-rule",
                            id: c.id,
                            label: ruleLabel,
                            component: ruleComp,
                            points: rulePoints,
                          });
                          setRuleLabel("");
                        }}
                      >
                        <Plus className="size-4" /> Rule
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => cardAct({ action: "add-scorecard", name: "New scorecard" })}
              >
                <Plus className="size-4" /> New scorecard
              </Button>
              <Button
                disabled={busy}
                onClick={() => cardAct({ action: "judge", limit: 6 })}
                title="Grades the live ads. One model call per ad, so it is never automatic."
              >
                <Sparkles className="size-4" />
                {busy ? "Scoring…" : "Score live ads"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="assets" className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              Images handed to the image model with every render. A{" "}
              <strong>logo</strong> is reproduced exactly; a <strong>style</strong>{" "}
              reference contributes palette, lighting and mood only. Nano Banana Pro
              follows a supplied image far more closely than a written description.
            </p>

            {data?.assets.map((a) => (
              <Card key={a.id} className="py-0">
                <CardContent className="flex items-center gap-3 p-3">
                  <Checkbox
                    checked={a.enabled}
                    onCheckedChange={() => act("toggle-asset", { name: a.id })}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/ref/${a.file}`}
                    alt=""
                    className="size-12 rounded object-cover"
                  />
                  <span className="flex-1 truncate text-sm">{a.title}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => act("asset-role", { name: a.id })}
                    title="Switch between exact reproduction and style-only"
                  >
                    {a.role}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => act("delete-asset", { name: a.id })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}

            <div className="flex gap-2">
              <Button asChild variant="secondary">
                <label className="cursor-pointer">
                  <ImagePlus className="size-4" /> Upload style reference
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    hidden
                    onChange={(e) => {
                      void uploadAsset(e.target.files, "style");
                      e.target.value = "";
                    }}
                  />
                </label>
              </Button>
              <Button asChild variant="secondary">
                <label className="cursor-pointer">
                  <ImagePlus className="size-4" /> Upload logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    hidden
                    onChange={(e) => {
                      void uploadAsset(e.target.files, "logo");
                      e.target.value = "";
                    }}
                  />
                </label>
              </Button>
            </div>
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
