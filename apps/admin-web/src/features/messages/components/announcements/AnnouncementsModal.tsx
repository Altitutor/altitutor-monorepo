"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, startOfWeek } from "date-fns";
import {
  Button,
  Checkbox,
  SearchableSelect,
  Switch,
  Textarea,
} from "@altitutor/ui";
import type { Tables } from "@altitutor/shared";
import { X } from "lucide-react";
import { AdminDialogShell } from "@/shared/components";
import { EntityActionChip } from "@/shared/components/EntityActionChip";
import { dateStringToUtcStart } from "@/shared/utils/datetime";
import { useCurrentStaff } from "@/shared/hooks";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import { SessionSelect } from "@/features/sessions/components/SessionSelect";
import { useAvailableSenders } from "../../api/queries";
import {
  personKey,
  personName,
  prepareBulkRecipients,
  queueBulkMessages,
  searchBulkPeople,
  type BulkPerson,
  type BulkRecipient,
  type BulkResult,
} from "../../api/bulk-messaging";
import {
  getStudentsByClass,
  getStudentsBySubject,
  getStudentsByYearLevel,
} from "../../api/bulk";
import { MessageTemplatesPicker } from "../MessageTemplatesPicker";

const EMPTY_IDS: string[] = [];
interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialStudentIds?: string[];
  initialStaffIds?: string[];
}
export function AnnouncementsModal(props: Props) {
  return props.isOpen ? <BulkMessageWizard {...props} /> : null;
}

function PersonPicker({
  kind,
  onAdd,
}: {
  kind: BulkPerson["kind"];
  onAdd: (people: BulkPerson[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ["bulk-people", kind, debounced],
    queryFn: () => searchBulkPeople(kind, debounced),
    enabled: debounced.trim().length > 0,
    staleTime: 60_000,
  });
  return (
    <div>
      <SearchableSelect
        items={query.data ?? []}
        value={null}
        onValueChange={(person) => {
          if (person) onAdd([person]);
        }}
        getItemId={personKey}
        getItemLabel={(person) => personName(person.person)}
        onSearchChange={setSearch}
        placeholder={`Add ${kind === "student" ? "individual student" : kind}`}
        searchPlaceholder="Search name…"
        loading={query.isFetching}
      />
      {query.isError && (
        <p role="alert" className="text-xs text-destructive">
          Unable to search {kind}s.
        </p>
      )}
    </div>
  );
}

function BulkMessageWizard({
  onClose,
  initialStudentIds = EMPTY_IDS,
  initialStaffIds = EMPTY_IDS,
}: Props) {
  const db = getSupabaseClient();
  const { data: staff } = useCurrentStaff();
  const { data: senders = [] } = useAvailableSenders();
  const [step, setStep] = useState<
    "recipients" | "compose" | "review" | "results"
  >("recipients");
  const [people, setPeople] = useState<BulkPerson[]>([]);
  const [senderId, setSenderId] = useState("");
  const [message, setMessage] = useState("");
  const [prepared, setPrepared] = useState<BulkRecipient[]>([]);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [week, setWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessions, setSessions] = useState<Map<string, Tables<"sessions">>>(
    new Map(),
  );
  const [groupSearch, setGroupSearch] = useState("");
  const [groupTerm, setGroupTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setGroupTerm(groupSearch), 250);
    return () => clearTimeout(timer);
  }, [groupSearch]);
  const addPeople = (incoming: BulkPerson[]) =>
    setPeople((current) => [
      ...current,
      ...incoming.filter(
        (person) =>
          !current.some(
            (existing) => personKey(existing) === personKey(person),
          ),
      ),
    ]);
  const loadedPrefill = useRef(false);
  const prefill = useQuery({
    queryKey: ["bulk-message-prefill", initialStudentIds, initialStaffIds],
    queryFn: async () => {
      const incoming: BulkPerson[] = [];
      if (initialStudentIds.length) {
        const { data, error } = await db
          .from("students")
          .select("*")
          .in("id", initialStudentIds)
          .is("deleted_at", null);
        if (error) throw error;
        if (data.length !== new Set(initialStudentIds).size)
          throw new Error("Some selected students are unavailable.");
        incoming.push(
          ...data.map((person) => ({
            kind: "student" as const,
            person,
            included: true,
            parents: false,
          })),
        );
      }
      if (initialStaffIds.length) {
        const { data, error } = await db
          .from("staff")
          .select("*")
          .in("id", initialStaffIds)
          .is("deleted_at", null);
        if (error) throw error;
        if (data.length !== new Set(initialStaffIds).size)
          throw new Error("Some selected staff are unavailable.");
        incoming.push(
          ...data.map((person) => ({
            kind: "staff" as const,
            person,
            included: true,
          })),
        );
      }
      return incoming;
    },
    enabled: initialStudentIds.length + initialStaffIds.length > 0,
    staleTime: Infinity,
    retry: false,
  });
  useEffect(() => {
    if (prefill.data && !loadedPrefill.current) {
      loadedPrefill.current = true;
      setPeople(prefill.data);
    }
  }, [prefill.data]);
  const effectiveSender =
    senderId ||
    senders.find((row) => row.is_default)?.id ||
    senders[0]?.id ||
    "";
  const sender = senders.find((row) => row.id === effectiveSender);
  const sessionQuery = useQuery({
    queryKey: ["bulk-session-week", format(week, "yyyy-MM-dd")],
    enabled: sessionOpen,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db
        .from("sessions")
        .select("*")
        .eq("status", "ACTIVE")
        .is("calendar_tombstone_until", null)
        .gte("start_at", dateStringToUtcStart(format(week, "yyyy-MM-dd")))
        .lt(
          "start_at",
          dateStringToUtcStart(format(addDays(week, 7), "yyyy-MM-dd")),
        )
        .order("start_at")
        .limit(500);
      if (error) throw error;
      if (data.length === 500)
        throw new Error(
          "Too many sessions in this week. Narrow the date range.",
        );
      return data;
    },
  });
  const groupQuery = useQuery({
    queryKey: ["bulk-groups", groupTerm],
    queryFn: async () => {
      const [classes, subjects] = await Promise.all([
        db
          .from("classes")
          .select("id,long_name,short_name")
          .is("deleted_at", null)
          .ilike("long_name", `%${groupTerm.replace(/[%_]/g, "")}%`)
          .limit(40),
        db
          .from("subjects")
          .select("id,name")
          .is("deleted_at", null)
          .ilike("name", `%${groupTerm.replace(/[%_]/g, "")}%`)
          .limit(40),
      ]);
      if (classes.error) throw classes.error;
      if (subjects.error) throw subjects.error;
      return { classes: classes.data, subjects: subjects.data };
    },
    enabled: step === "recipients",
    staleTime: 60_000,
  });
  const applyGroup = async (kind: "class" | "subject" | "year" | "session") => {
    setError("");
    setBusy(true);
    try {
      if (kind === "session") {
        const ids = [...sessions.keys()];
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await db
            .from("sessions_students")
            .select("student:students(*)")
            .in("session_id", ids)
            .order("id")
            .range(offset, offset + 999);
          if (error) throw error;
          addPeople(
            (data ?? []).flatMap((row) =>
              row.student && !row.student.deleted_at
                ? [
                    {
                      kind: "student" as const,
                      person: row.student,
                      included: true,
                      parents: false,
                    },
                  ]
                : [],
            ),
          );
          if (!data || data.length < 1000) break;
        }
        setSessionOpen(false);
        setSessions(new Map());
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to add recipients.",
      );
    } finally {
      setBusy(false);
    }
  };
  const addGroup = async (kind: "class" | "subject" | "year", id: string) => {
    setBusy(true);
    setError("");
    try {
      const rows = await (kind === "class"
        ? getStudentsByClass(id)
        : kind === "subject"
          ? getStudentsBySubject(id)
          : getStudentsByYearLevel(Number(id)));
      addPeople(
        rows.map((person) => ({
          kind: "student",
          person,
          included: true,
          parents: false,
        })),
      );
    } catch {
      setError("Unable to add this group. Please retry.");
    } finally {
      setBusy(false);
    }
  };
  const review = async () => {
    setBusy(true);
    setError("");
    try {
      const rows = await prepareBulkRecipients(
        people,
        message,
        staff ? personName(staff) : "",
      );
      if (!rows.length) throw new Error("Select at least one recipient.");
      setPrepared(rows);
      setStep("review");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to prepare preview.",
      );
    } finally {
      setBusy(false);
    }
  };
  const send = async () => {
    if (inFlight.current || !staff || !effectiveSender) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const rows = await prepareBulkRecipients(
        people,
        message,
        personName(staff),
        true,
      );
      if (
        rows.length !== prepared.length ||
        rows.some(
          (row) =>
            !prepared.some(
              (previous) =>
                previous.key === row.key && previous.phone === row.phone,
            ),
        )
      )
        throw new Error(
          "Recipients changed since review. Go back and review again.",
        );
      setResults(rows.map((row) => ({ ...row, status: "PENDING" })));
      setStep("results");
      await queueBulkMessages(rows, effectiveSender, staff.id, (result) =>
        setResults((current) =>
          current.map((row) => (row.key === result.key ? result : row)),
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to prepare messages.",
      );
      setResults((current) =>
        current.map((row) =>
          row.status === "PENDING"
            ? {
                ...row,
                status: "NOT_QUEUED",
                error:
                  "Queueing stopped before this recipient. No delivery attempt confirmed.",
              }
            : row,
        ),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const ids = results.flatMap((row) => (row.messageId ? [row.messageId] : []));
  const delivery = useQuery({
    queryKey: ["bulk-message-delivery", ids],
    enabled: step === "results" && ids.length > 0 && !busy,
    refetchInterval: (query) =>
      query.state.data?.length === ids.length &&
      query.state.data.every((row) =>
        [
          "SENT",
          "DELIVERED",
          "READ",
          "FAILED",
          "AMBIGUOUS",
          "CANCELLED",
        ].includes(row.status ?? ""),
      )
        ? false
        : 5000,
    queryFn: async () => {
      const rows: Array<
        Pick<Tables<"messages">, "id" | "status" | "error_message">
      > = [];
      for (let index = 0; index < ids.length; index += 100) {
        const { data, error } = await db
          .from("messages")
          .select("id,status,error_message")
          .in("id", ids.slice(index, index + 100));
        if (error) throw error;
        rows.push(...data);
      }
      return rows;
    },
  });
  const displayed = results.map((row) => {
    const live = delivery.data?.find((item) => item.id === row.messageId);
    return live
      ? {
          ...row,
          status: live.status ?? row.status,
          error: live.error_message ?? row.error,
        }
      : row;
  });
  const enabledCount = people.filter(
    (person) =>
      person.included || (person.kind === "student" && person.parents),
  ).length;
  const students = people.filter(
    (row): row is Extract<BulkPerson, { kind: "student" }> =>
      row.kind === "student",
  );
  return (
    <AdminDialogShell
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Bulk message"
      subtitle={
        step === "results"
          ? "Delivery progress"
          : `${step === "recipients" ? "Step 1 of 3 · Recipients" : step === "compose" ? "Step 2 of 3 · Compose" : "Step 3 of 3 · Review"}`
      }
      contentClassName="md:max-w-4xl"
      footer={
        <div className="flex w-full justify-between">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              step === "recipients" || step === "results"
                ? onClose()
                : setStep(step === "review" ? "compose" : "recipients")
            }
          >
            {step === "recipients" || step === "results" ? "Close" : "Back"}
          </Button>
          {step !== "results" && (
            <Button
              disabled={
                busy ||
                prefill.isFetching ||
                prefill.isError ||
                !enabledCount ||
                (step !== "recipients" && (!message.trim() || !effectiveSender))
              }
              onClick={() =>
                step === "recipients"
                  ? setStep("compose")
                  : step === "compose"
                    ? void review()
                    : void send()
              }
            >
              {busy
                ? "Working…"
                : step === "recipients"
                  ? "Compose"
                  : step === "compose"
                    ? "Review"
                    : `Queue ${prepared.length} messages`}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5 p-4">
        {(error || prefill.isError) && (
          <p role="alert" className="text-sm text-destructive">
            {error || prefill.error?.message}
          </p>
        )}
        {prefill.isFetching && (
          <p role="status">Loading selected recipients…</p>
        )}
        {step === "recipients" && (
          <>
            <div className="flex flex-wrap gap-2">
              {(["student", "staff", "parent"] as const).map((kind) => (
                <PersonPicker key={kind} kind={kind} onAdd={addPeople} />
              ))}
              <SessionSelect
                items={sessionQuery.data ?? []}
                value={null}
                onValueChange={() => {}}
                getItemId={(row) => row.id}
                getItemLabel={(row) =>
                  row.long_name || row.short_name || "Session"
                }
                selectedIds={new Set(sessions.keys())}
                onToggle={(row) =>
                  setSessions((current) => {
                    const next = new Map(current);
                    if (next.has(row.id)) next.delete(row.id);
                    else next.set(row.id, row);
                    return next;
                  })
                }
                onWeekChange={setWeek}
                open={sessionOpen}
                onOpenChange={setSessionOpen}
                loading={sessionQuery.isFetching}
                placeholder="Add by session"
                footer={
                  <Button
                    disabled={!sessions.size || busy}
                    onClick={() => void applyGroup("session")}
                  >
                    Add students from {sessions.size} sessions
                  </Button>
                }
              />
            </div>
            {sessionQuery.isError && (
              <p role="alert">Unable to load sessions.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <SearchableSelect
                items={groupQuery.data?.classes ?? []}
                value={null}
                onValueChange={(row) => {
                  if (row) void addGroup("class", row.id);
                }}
                getItemId={(row) => row.id}
                getItemLabel={(row) =>
                  row.long_name || row.short_name || "Class"
                }
                placeholder="Add by class"
                onSearchChange={setGroupSearch}
                disabled={busy}
              />
              <SearchableSelect
                items={groupQuery.data?.subjects ?? []}
                value={null}
                onValueChange={(row) => {
                  if (row) void addGroup("subject", row.id);
                }}
                getItemId={(row) => row.id}
                getItemLabel={(row) => row.name}
                placeholder="Add by subject"
                onSearchChange={setGroupSearch}
                disabled={busy}
              />
              <SearchableSelect
                items={[7, 8, 9, 10, 11, 12, 13]}
                value={null}
                onValueChange={(year) => {
                  if (year) void addGroup("year", String(year));
                }}
                getItemId={String}
                getItemLabel={(year) => `Year ${year}`}
                placeholder="Add by year"
                disabled={busy}
              />
            </div>
            <div className="rounded-lg border">
              <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
                <span>{people.length} selected people</span>
                <label className="flex items-center gap-2 text-xs">
                  All parents
                  <Switch
                    aria-label="Toggle all parents"
                    disabled={!students.length}
                    checked={
                      students.length > 0 &&
                      students.every((row) => row.parents)
                    }
                    onCheckedChange={(parents) =>
                      setPeople((current) =>
                        current.map((row) =>
                          row.kind === "student" ? { ...row, parents } : row,
                        ),
                      )
                    }
                  />
                </label>
              </div>
              {people.map((row) => (
                <div
                  key={personKey(row)}
                  className="flex items-center gap-2 border-b px-3 py-3 last:border-0"
                >
                  <Checkbox
                    aria-label={`Include ${personName(row.person)}`}
                    checked={row.included}
                    onCheckedChange={(checked) =>
                      setPeople((current) =>
                        current.map((item) =>
                          personKey(item) === personKey(row)
                            ? { ...item, included: checked === true }
                            : item,
                        ),
                      )
                    }
                  />
                  <EntityActionChip
                    entityType={row.kind}
                    entityId={row.person.id}
                    label={personName(row.person)}
                  />
                  <span className="flex-1" />
                  {row.kind === "student" && (
                    <label className="flex items-center gap-2 text-xs">
                      Parent
                      <Switch
                        aria-label={`Send to parent of ${personName(row.person)}`}
                        checked={row.parents}
                        onCheckedChange={(parents) =>
                          setPeople((current) =>
                            current.map((item) =>
                              item.kind === "student" &&
                              item.person.id === row.person.id
                                ? { ...item, parents }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${personName(row.person)}`}
                    onClick={() =>
                      setPeople((current) =>
                        current.filter(
                          (item) => personKey(item) !== personKey(row),
                        ),
                      )
                    }
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {!people.length && (
                <p className="p-4 text-sm text-muted-foreground">
                  Add people or a session to begin.
                </p>
              )}
            </div>
          </>
        )}
        {step === "compose" && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <SearchableSelect
                items={senders}
                value={sender ?? null}
                onValueChange={(row) => setSenderId(row?.id ?? "")}
                getItemId={(row) => row.id}
                getItemLabel={(row) => row.label || row.phone_e164 || "Sender"}
                placeholder="Select sender"
              />
              <MessageTemplatesPicker
                onSelect={(template) => setMessage(template.content)}
              />
              <label
                className="block text-sm font-medium"
                htmlFor="bulk-message"
              >
                Message
              </label>
              <Textarea
                id="bulk-message"
                className="min-h-56"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{first_name}"}, {"{full_name}"} and {"{sender_name}"}.
                Student templates also support class and invitation variables.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-4 text-sm font-medium">Message preview</p>
              <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
                {message ||
                  "Your message appears here. Review shows the personalised text for every recipient."}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {enabledCount} selected people · parents are resolved once at
                review.
              </p>
            </div>
          </div>
        )}
        {step === "review" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {prepared.length} unique recipients. Queued messages are waiting
              for dispatch; they are not yet sent.
            </p>
            {prepared.map((row) => (
              <div
                key={row.key}
                className="grid gap-3 rounded-lg border p-3 md:grid-cols-[180px_1fr]"
              >
                <div>
                  <EntityActionChip
                    entityType={row.kind}
                    entityId={row.id}
                    label={row.name}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {row.phone || "No phone · will be skipped"}
                  </p>
                </div>
                <p className="whitespace-pre-wrap text-sm">{row.body}</p>
              </div>
            ))}
          </div>
        )}
        {step === "results" && (
          <div className="space-y-3">
            <p className="text-sm">
              Queued means waiting for dispatch. A transport timeout does not
              mean delivery failed. Keep this view open to check progress.
            </p>
            {delivery.isError && (
              <p role="alert">
                Delivery status unavailable. Messages have not been retried.{" "}
                <Button
                  variant="outline"
                  onClick={() => void delivery.refetch()}
                >
                  Refresh status
                </Button>
              </p>
            )}
            {displayed.map((row) => (
              <div key={row.key} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <EntityActionChip
                    entityType={row.kind}
                    entityId={row.id}
                    label={row.name}
                  />
                  <span className="text-xs font-medium">{row.status}</span>
                </div>
                {row.error && (
                  <p className="break-words text-xs text-destructive">
                    {row.error}
                  </p>
                )}
                {row.messageId && (
                  <EntityActionChip
                    entityType="message"
                    entityId={row.messageId}
                    label="Open message"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminDialogShell>
  );
}
