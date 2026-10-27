"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ResponsiveResizablePanels,
  type JSONContent,
} from "@altitutor/ui";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import {
  resolveInterviewStations,
  type InterviewCatalog,
  type InterviewStation,
  type InterviewTemplate,
} from "@altitutor/shared";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import {
  useInterviewCatalog,
  useInterviewCommand,
} from "../hooks/use-interviews";
import { UcatSetPropertyRow } from "@/features/ucat/sets/components/UcatSetPropertyRow";
import { InterviewDocument, InterviewError } from "./interview-ui";
import { tutorBtnOutline, tutorBtnPrimary, tutorCardCn } from "@/shared/lib/tutor-visual";
import { useBuilderDraft } from "../hooks/use-builder-draft";
import { blankStation } from "../lib/station-draft";
import { InterviewPageHeader } from "./interview-page";

const InterviewStationEditor = lazy(() =>
  import("./InterviewStationEditor").then((module) => ({
    default: module.InterviewStationEditor,
  })),
);

const MAX_STATIONS = 6;

function StationBody({ station }: { station: InterviewStation }) {
  return (
    <div className="space-y-3">
      <InterviewDocument value={station.prompt as JSONContent} />
      {station.questions.map((question, index) => (
        <div key={question.id} className="flex gap-2">
          <span className="pt-0.5 text-sm font-semibold tabular-nums">
            {index + 1}.
          </span>
          <div className="min-w-0 flex-1">
            <InterviewDocument value={question.question as JSONContent} />
          </div>
        </div>
      ))}
    </div>
  );
}

export type InterviewEditorBind = {
  save: () => Promise<void>;
  canSave: boolean;
  saving: boolean;
  canPrint: boolean;
};
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
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [savedStations, setSavedStations] = useState<InterviewStation[]>([]);
  const [stationDialog, setStationDialog] = useState<{
    mode: "create" | "edit";
    station: InterviewStation;
  } | null>(null);
  const command = useInterviewCommand();
  const stationFor = (stationId: string) => {
    const saved = savedStations.find((station) => station.id === stationId);
    const bank = catalog.stations.find((station) => station.id === stationId);
    if (saved && (!bank || saved.version >= bank.version)) return saved;
    return bank;
  };
  const resolvedCount = draft.stations.filter((placement) =>
    stationFor(placement.stationId),
  ).length;
  const canSave =
    !command.isPending && !recovery.conflict && !!draft.name.trim();
  const canPrint = original.version > 0 && !dirty && resolvedCount > 0;
  const persistInterview = async (interview: InterviewTemplate) => {
    if (recovery.conflict)
      throw new Error("Load the latest saved interview before saving.");
    const result = await command.mutateAsync({
      type: "saveInterview",
      commandId: randomUuid(),
      expectedVersion: recovery.version,
      interview,
    });
    recovery.saved(result.version, interview);
    onSaved?.(interview.id);
  };
  const bankStations = [
    ...catalog.stations,
    ...savedStations.filter(
      (saved) => !catalog.stations.some((bank) => bank.id === saved.id),
    ),
  ]
    .map((station) => stationFor(station.id) ?? station)
    .filter((station) => !station.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
  const preview =
    bankStations.find((station) => station.id === previewId) ?? null;
  const appendStation = (stationId: string) => {
    const current = draftRef.current;
    if (current.stations.length >= MAX_STATIONS) return;
    change({
      ...current,
      stations: [
        ...current.stations,
        { id: randomUuid(), stationId },
      ],
    });
  };
  const rememberStation = (station: InterviewStation) =>
    setSavedStations((previous) => [
      ...previous.filter((saved) => saved.id !== station.id),
      station,
    ]);
  const save = () => persistInterview(draft);
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
    <div
      className={
        embedded
          ? "flex h-full min-h-0 flex-col"
          : "flex h-[75vh] min-h-0 flex-col gap-6 py-8"
      }
    >
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
      {(command.error ||
        recovery.recovered ||
        recovery.conflict ||
        recovery.storageError) && (
        <div
          className={embedded ? "shrink-0 space-y-3 px-4 pt-4" : "space-y-3"}
        >
          <InterviewError error={command.error} />
          {(recovery.recovered ||
            recovery.conflict ||
            recovery.storageError) && (
            <div
              role="status"
              className="space-y-2 rounded-lg border p-3 text-sm"
            >
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
        </div>
      )}
      <div className="min-h-0 flex-1">
        <ResponsiveResizablePanels
          id="interview-editor"
          breakpoint="lg"
          stackOnNarrow
          primaryDefaultSize="70%"
          primaryMinSize={480}
          secondaryDefaultSize={320}
          secondaryMinSize={280}
          secondaryMaxSize={420}
          handleLabel="Resize interview properties sidebar"
          primary={
            <section className="flex h-full min-h-0 flex-col overflow-y-auto p-4 lg:p-6">
              <div className="space-y-4">
                {draft.stations.map((placement, index) => {
                  const station = stationFor(placement.stationId);
                  const repeated =
                    draft.stations.filter(
                      (item) => item.stationId === placement.stationId,
                    ).length > 1;
                  return (
                    <article
                      key={placement.id}
                      className={tutorCardCn("p-4")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold">Station {index + 1}</h3>
                          <p className="text-sm text-muted-foreground">
                            {station?.name || "Unavailable station"}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 px-0"
                            aria-label={`Move station ${index + 1} up`}
                            title="Move up"
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 px-0"
                            aria-label={`Move station ${index + 1} down`}
                            title="Move down"
                            disabled={index === draft.stations.length - 1}
                            onClick={() => move(index, 1)}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 px-0"
                            aria-label={`Edit station ${index + 1}`}
                            title="Edit"
                            disabled={!station}
                            onClick={() =>
                              station &&
                              setStationDialog({ mode: "edit", station })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 px-0"
                            aria-label={`Remove station ${index + 1}`}
                            title="Remove"
                            onClick={() =>
                              change({
                                ...draft,
                                stations: draft.stations.filter(
                                  (item) => item.id !== placement.id,
                                ),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {station ? (
                        <div className="mt-4">
                          <StationBody station={station} />
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-muted-foreground">
                          This station is no longer in the bank.
                        </p>
                      )}
                      {repeated && (
                        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                          Repeated station
                        </p>
                      )}
                    </article>
                  );
                })}
                {!draft.stations.length && (
                  <p className="text-sm text-muted-foreground">
                    Add a station to this interview.
                  </p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Popover
                  open={pickerOpen}
                  onOpenChange={(open) => {
                    setPickerOpen(open);
                    if (!open) setPreviewId(null);
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={tutorBtnOutline}
                      disabled={draft.stations.length >= MAX_STATIONS}
                    >
                      Add existing station
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    enableModalScroll
                    className="z-[100] w-[min(42rem,calc(100vw-2rem))] p-0"
                  >
                    <div className="grid grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
                      <Command>
                        <CommandInput placeholder="Search stations…" />
                        <CommandList className="max-h-80">
                          <CommandEmpty>No stations found.</CommandEmpty>
                          <CommandGroup>
                            {bankStations.map((station) => (
                              <CommandItem
                                key={station.id}
                                value={station.id}
                                keywords={[station.name]}
                                onMouseEnter={() => setPreviewId(station.id)}
                                onSelect={() => {
                                  appendStation(station.id);
                                  setPickerOpen(false);
                                  setPreviewId(null);
                                }}
                              >
                                {station.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                      <div className="max-h-96 overflow-y-auto border-l p-3">
                        {preview ? (
                          <article className={tutorCardCn("p-4")}>
                            <h3 className="font-semibold">{preview.name}</h3>
                            <div className="mt-3">
                              <StationBody station={preview} />
                            </div>
                          </article>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Hover a station to preview it.
                          </p>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  className={tutorBtnOutline}
                  disabled={draft.stations.length >= MAX_STATIONS}
                  onClick={() =>
                    setStationDialog({
                      mode: "create",
                      station: blankStation(catalog.categories[0]?.id ?? ""),
                    })
                  }
                >
                  Create new station
                </Button>
              </div>
            </section>
          }
          secondary={
            <aside className="flex h-full min-h-0 flex-col overflow-y-auto bg-background p-4">
              <h2 className="mb-3 text-sm font-semibold">Properties</h2>
              <div className={tutorCardCn("space-y-1 p-3")}>
                <UcatSetPropertyRow label="Interview name">
                  <Input
                    value={draft.name}
                    onChange={(e) => change({ ...draft, name: e.target.value })}
                  />
                </UcatSetPropertyRow>
                <UcatSetPropertyRow label="Reading time (seconds)">
                  <Input
                    type="number"
                    min={1}
                    max={3600}
                    value={draft.readingTimeSeconds}
                    onChange={(e) =>
                      change({
                        ...draft,
                        readingTimeSeconds: Number(e.target.value),
                      })
                    }
                  />
                </UcatSetPropertyRow>
                <UcatSetPropertyRow label="Answer time per station (seconds)">
                  <Input
                    type="number"
                    min={1}
                    max={7200}
                    value={draft.questionTimeSeconds}
                    onChange={(e) =>
                      change({
                        ...draft,
                        questionTimeSeconds: Number(e.target.value),
                      })
                    }
                  />
                </UcatSetPropertyRow>
                <UcatSetPropertyRow label="Recording">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={draft.recordingEnabled}
                      onCheckedChange={(checked) =>
                        change({
                          ...draft,
                          recordingEnabled: checked === true,
                        })
                      }
                    />
                    Record by default
                  </label>
                </UcatSetPropertyRow>
              </div>
            </aside>
          }
        />
      </div>
      {stationDialog ? (
        <Suspense fallback={null}>
          <InterviewStationEditor
            station={stationDialog.station}
            catalog={catalog}
            close={() => setStationDialog(null)}
            onSaved={(saved) => {
              rememberStation(saved);
              if (stationDialog.mode !== "create") return;
              const current = draftRef.current;
              if (current.stations.length >= MAX_STATIONS) return;
              const next = {
                ...current,
                stations: [
                  ...current.stations,
                  { id: randomUuid(), stationId: saved.id },
                ],
              };
              change(next);
              if (!next.name.trim()) return;
              void persistInterview(next).catch(() => undefined);
            }}
          />
        </Suspense>
      ) : null}
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
