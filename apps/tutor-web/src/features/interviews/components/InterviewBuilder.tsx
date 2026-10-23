"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  type JSONContent,
} from "@altitutor/ui";
import {
  resolveInterviewStations,
  type InterviewCatalog,
  type InterviewTemplate,
} from "@altitutor/shared";
import {
  useInterviewCatalog,
  useInterviewCommand,
} from "../hooks/use-interviews";
import { UcatPropertyRow } from "@/features/ucat/shared/components/UcatPropertyRow";
import {
  InterviewDocument,
  InterviewError,
  InterviewField,
  InterviewPanel,
  InterviewSearch,
  InterviewSelect,
} from "./interview-ui";
import { tutorBtnOutline, tutorBtnPrimary } from "@/shared/lib/tutor-visual";
import { cn } from "@/shared/utils";
import { useBuilderDraft } from "../hooks/use-builder-draft";
import { InterviewPageHeader } from "./interview-page";

export type InterviewEditorBind = {
  save: () => Promise<void>;
  canSave: boolean;
  saving: boolean;
  canPrint: boolean;
};
function EditorField({
  embedded,
  label,
  children,
}: {
  embedded: boolean;
  label: string;
  children: ReactNode;
}) {
  return embedded ? (
    <UcatPropertyRow label={label}>{children}</UcatPropertyRow>
  ) : (
    <InterviewField label={label}>{children}</InterviewField>
  );
}
export function BuilderEditor({
  original,
  catalog,
  embedded = false,
  onBind,
  onSaved,
}: {
  original: InterviewTemplate;
  catalog: InterviewCatalog;
  embedded?: boolean;
  onBind?: (state: InterviewEditorBind) => void;
  onSaved?: (id: string) => void;
}) {
  const recovery = useBuilderDraft(catalog.actorId, original);
  const { draft, dirty, change } = recovery;
  const [selected, setSelected] = useState(original.stations[0]?.id);
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const command = useInterviewCommand();
  const stations = resolveInterviewStations(draft, catalog.stations);
  const station = stations.find((s) => s.id === selected) ?? stations[0];
  const canSave =
    !command.isPending && !recovery.conflict && !!draft.name.trim();
  const canPrint = original.version > 0 && !dirty && stations.length > 0;
  const save = async () => {
    if (recovery.conflict)
      throw new Error("Load the latest saved interview before saving.");
    const result = await command.mutateAsync({
      type: "saveInterview",
      commandId: crypto.randomUUID(),
      expectedVersion: recovery.version,
      interview: draft,
    });
    recovery.saved(result.version, draft);
    onSaved?.(draft.id);
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(
    () =>
      onBind?.({
        save: () => saveRef.current(),
        canSave,
        saving: command.isPending,
        canPrint,
      }),
    [onBind, canSave, command.isPending, canPrint],
  );
  const move = (index: number, offset: number) => {
    const next = [...draft.stations];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    change({ ...draft, stations: next });
  };
  return (
    <div className={embedded ? "space-y-5 p-6" : "space-y-6 py-8"}>
      {!embedded && (
        <InterviewPageHeader
          title={draft.name || "New interview"}
          backHref="/interviews/bank"
          actions={
            <Button
              className={tutorBtnPrimary}
              disabled={!canSave}
              onClick={() => void save().catch(() => undefined)}
            >
              Save interview
            </Button>
          }
        />
      )}
      <InterviewError error={command.error} />
      {(recovery.recovered || recovery.conflict || recovery.storageError) && (
        <div role="status" className="space-y-2 rounded-lg border p-3 text-sm">
          {recovery.conflict
            ? "This interview changed while you were editing. Your draft is preserved; load the latest saved version before continuing."
            : recovery.storageError
              ? "Your browser could not store this draft. Save before leaving."
              : "Recovered your unsaved interview draft."}
          <Button variant="outline" size="sm" onClick={recovery.discard}>
            Load latest saved interview
          </Button>
        </div>
      )}
      <div className="space-y-3">
        <EditorField embedded={embedded} label="Interview name">
          <Input
            value={draft.name}
            onChange={(e) => change({ ...draft, name: e.target.value })}
          />
        </EditorField>
        <EditorField embedded={embedded} label="Reading time (seconds)">
          <Input
            type="number"
            min={1}
            max={3600}
            value={draft.readingTimeSeconds}
            onChange={(e) =>
              change({ ...draft, readingTimeSeconds: Number(e.target.value) })
            }
          />
        </EditorField>
        <EditorField
          embedded={embedded}
          label="Answer time per station (seconds)"
        >
          <Input
            type="number"
            min={1}
            max={7200}
            value={draft.questionTimeSeconds}
            onChange={(e) =>
              change({ ...draft, questionTimeSeconds: Number(e.target.value) })
            }
          />
        </EditorField>
        <EditorField embedded={embedded} label="Recording">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={draft.recordingEnabled}
              onCheckedChange={(checked) =>
                change({ ...draft, recordingEnabled: checked === true })
              }
            />
            Record by default
          </label>
        </EditorField>
      </div>
      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <InterviewPanel
          title="Stations"
          action={
            <Button
              variant="outline"
              size="sm"
              disabled={draft.stations.length >= 6}
              onClick={() => setPicker(true)}
            >
              Add station
            </Button>
          }
        >
          <div className="space-y-2">
            {stations.map((s, index) => (
              <div key={s.id} className="rounded-lg border p-2">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start",
                    station?.id === s.id && "bg-muted",
                  )}
                  onClick={() => setSelected(s.id)}
                >
                  {index + 1}. {s.name}
                </Button>
                {draft.stations.filter((p) => p.stationId === s.stationId)
                  .length > 1 && (
                  <p className="px-2 text-xs text-amber-700 dark:text-amber-300">
                    Repeated station
                  </p>
                )}
                <div className="mt-2 flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Move station ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Move station ${index + 1} down`}
                    disabled={index === stations.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      change({
                        ...draft,
                        stations: draft.stations.filter((p) => p.id !== s.id),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            {!stations.length && (
              <p className="text-sm text-muted-foreground">
                Add whole stations from the station bank.
              </p>
            )}
          </div>
        </InterviewPanel>
        {station && (
          <InterviewPanel
            title={station.name}
            action={
              <Badge variant="outline">{station.maximumPoints} points</Badge>
            }
          >
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                {
                  catalog.categories.find((c) => c.id === station.categoryId)
                    ?.name
                }{" "}
                · {station.questions.length} questions
                {station.archived ? " · Archived" : ""}
              </p>
              <InterviewField label="Reading / printed prompt">
                <InterviewDocument value={station.prompt as JSONContent} />
              </InterviewField>
              {station.questions.map((q, index) => (
                <section key={q.id} className="space-y-2 border-t pt-4">
                  <h3 className="text-sm font-semibold">
                    Question {index + 1} · recommended {q.suggestedTimeSeconds}s
                  </h3>
                  <InterviewDocument value={q.question as JSONContent} />
                </section>
              ))}
              <p className="text-sm text-muted-foreground">
                This station is shared. Edit its prompt, questions and maximum
                score in the station bank.
              </p>
              <Button asChild variant="outline" className={tutorBtnOutline}>
                <Link href="/interviews/stations">Open station bank</Link>
              </Button>
            </div>
          </InterviewPanel>
        )}
      </div>
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="max-h-[85dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add stations</DialogTitle>
            <DialogDescription>
              Choose whole stations with their complete question sequences.
            </DialogDescription>
          </DialogHeader>
          <InterviewSearch
            value={search}
            onChange={setSearch}
            placeholder="Search bank stations…"
          >
            <InterviewSelect
              label="Category"
              clear
              value={category}
              onChange={setCategory}
              options={catalog.categories.map((c) => ({
                id: c.id,
                label: c.name,
              }))}
            />
          </InterviewSearch>
          {catalog.stations
            .filter(
              (s) =>
                !s.archived &&
                (!category || s.categoryId === category) &&
                s.name.toLowerCase().includes(search.toLowerCase()),
            )
            .map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-4 border-b py-3"
              >
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.questions.length} questions · {s.maximumPoints} points
                  </p>
                  {draft.stations.some((p) => p.stationId === s.id) && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Already used in this interview; adding it again creates a
                      separate station occurrence.
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  disabled={draft.stations.length >= 6}
                  onClick={() => {
                    const id = crypto.randomUUID();
                    change({
                      ...draft,
                      stations: [...draft.stations, { id, stationId: s.id }],
                    });
                    setSelected(id);
                  }}
                >
                  Add
                </Button>
              </div>
            ))}
          <Button onClick={() => setPicker(false)}>Done adding</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export function InterviewBuilder({ id }: { id: string }) {
  const query = useInterviewCatalog();
  const interview = query.data?.interviews.find((i) => i.id === id);
  if (!query.data || !interview)
    return (
      <div className="py-8">
        <InterviewError
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.isPending ? "Loading interview…" : "Interview not found."}
      </div>
    );
  return (
    <BuilderEditor
      key={`${query.data.actorId}:${interview.id}`}
      original={interview}
      catalog={query.data}
    />
  );
}
export function InterviewPrint({ id }: { id: string }) {
  const query = useInterviewCatalog();
  const interview = query.data?.interviews.find((i) => i.id === id);
  if (!interview || !query.data) return <InterviewError error={query.error} />;
  return (
    <div className="space-y-6 py-8">
      <div className="print:hidden">
        <Button onClick={() => window.print()}>Print / save as PDF</Button>
        <p className="mt-3 text-sm text-muted-foreground">
          Each station starts on a new page. Station names are not shown to
          students.
        </p>
      </div>
      <style>
        {
          "@media print { nav, aside { display:none !important; } body { background:white!important; } .interview-print-page { break-after:page; min-height:90vh; } .interview-print-page:last-child { break-after:auto; } }"
        }
      </style>
      {resolveInterviewStations(interview, query.data.stations).map(
        (s, index) => (
          <section
            key={s.id}
            className="interview-print-page rounded-xl border p-10 print:border-0"
          >
            <h1 className="mb-8 text-3xl font-semibold">Station {index + 1}</h1>
            <InterviewDocument value={s.prompt as JSONContent} />
          </section>
        ),
      )}
    </div>
  );
}
