"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { ExternalLink, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResolvedInsightPreview } from "@/features/insights/model/insight-preview";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";

const ALL_FAMILIES = "all";

export function InsightPreviewPage({
  previews,
}: {
  previews: ResolvedInsightPreview[];
}) {
  const [family, setFamily] = useState(ALL_FAMILIES);
  const [query, setQuery] = useState("");
  const families = useMemo(
    () => [...new Set(previews.map((preview) => preview.family))],
    [previews],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return previews.filter(
      (preview) =>
        (family === ALL_FAMILIES || preview.family === family) &&
        (!needle ||
          [
            preview.family,
            preview.label,
            preview.condition,
            preview.ruleId,
            preview.title,
            preview.body,
          ].some((value) => value.toLowerCase().includes(needle))),
    );
  }, [family, previews, query]);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 px-5 pb-10 sm:px-6 lg:px-8">
      <header className="space-y-5 pt-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="secondary">Development preview</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Insight gallery
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Every feature-owned insight rule, the condition that selects it,
              and representative inputs. These cases execute the same decision
              modules used by the product and its tests. Attempt rules are
              shared by practice sessions, sets, and mocks.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/preview">Dashboard states</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/progress/preview">Progress states</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/progress/attempts/preview">Attempt states</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,320px)_auto] sm:items-end">
          <label className="text-sm font-medium">
            Search rules and copy
            <span className="relative mt-2 block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm"
                placeholder="e.g. rushed, baseline, 1.10×"
              />
            </span>
          </label>
          <label className="text-sm font-medium">
            Family
            <select
              value={family}
              onChange={(event) => setFamily(event.target.value)}
              className="mt-2 block h-10 w-full rounded-lg border bg-background px-3 text-sm"
            >
              <option value={ALL_FAMILIES}>All families</option>
              {families.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <p className="pb-2 text-sm tabular-nums text-muted-foreground">
            {filtered.length} of {previews.length} rules
          </p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {filtered.map((preview) => (
          <Card key={preview.ruleId} className={UCAT_CARD_CHROME}>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{preview.family}</Badge>
                {preview.tone ? (
                  <Badge variant="secondary">{preview.tone}</Badge>
                ) : null}
                <code className="ml-auto text-xs text-muted-foreground">
                  {preview.ruleId}
                </code>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {preview.label}
                </p>
                <CardTitle className="mt-2 flex items-start gap-2 text-lg">
                  <Sparkles
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  {preview.title}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {preview.body}
              </p>
              {preview.actionLabel ? (
                <p className="text-sm font-medium">
                  Action: {preview.actionLabel}
                  {preview.actionHref ? ` → ${preview.actionHref}` : ""}
                </p>
              ) : null}
              <div className="rounded-xl border bg-muted/35 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Shown when
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  {preview.condition}
                </p>
              </div>
              <details className="rounded-xl border px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Representative inputs
                </summary>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
                  {JSON.stringify(preview.input, null, 2)}
                </pre>
              </details>
              <Button asChild variant="ghost" className="px-0">
                <Link href={preview.contextHref}>
                  Open contextual preview
                  <ExternalLink className="ml-1.5 size-4" aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No insight rules match these filters.
        </div>
      ) : null}
    </div>
  );
}
