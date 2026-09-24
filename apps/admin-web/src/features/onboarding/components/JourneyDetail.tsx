"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Badge, Input, SearchableSelect } from "@altitutor/ui";
import { CheckCircle2, Circle, User } from "lucide-react";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import { useStaffSearch } from "@/features/tasks/hooks/useStaffSearch";
import { adelaideWallDateTimeToUtcIso } from "@/features/bookings/utils/dateTimeHelpers";
import { useCurrentStaff } from "@/shared/hooks";
import { BookSessionModal } from "@/features/bookings/components/BookSessionModal";
import { CheckInBookSessionModal } from "@/features/sessions/components/CheckInBookSessionModal";
import { EnrollStudentModal } from "@/features/enrollments/components/EnrollStudentModal";
import { FillFormDialog } from "@/features/forms/components/FillFormDialog";
import { classesApi } from "@/features/classes/api/classes";
import { studentsApi } from "@/features/students/api/students";
import { JourneyCommunication } from "./JourneyCommunication";
import {
  allSubjectsPlaced,
  lifecycle,
  nextActions,
  stages,
  type Action,
  type Journey,
} from "../lib/model";
import { onboardingKey, useOnboardingSettings } from "../api/queries";
import type { ClassWithExpandedSubject } from "@altitutor/shared";

export function ActionBadges({ actions }: { actions: Action[] }) {
  return (
    <span className="inline-flex gap-1 flex-wrap">
      {actions.some((a) => !a.waiting) && (
        <Badge variant="secondary">Our action</Badge>
      )}
      {actions.some((a) => a.waiting) && (
        <Badge variant="outline">Waiting</Badge>
      )}
      {actions.some((a) => a.overdue) && (
        <Badge variant="destructive">Overdue</Badge>
      )}
    </span>
  );
}
function Assignment({
  journey,
  action,
  onError,
}: {
  journey: Journey;
  action: Action;
  onError: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const { staff, isLoading } = useStaffSearch(search, true);
  const qc = useQueryClient();
  const selected = staff.find((s) => s.id === action.assigneeId);
  async function save(values: {
    assignee_id?: string | null;
    due_at?: string | null;
  }) {
    const { error } = await getSupabaseClient()
      .from("onboarding_action_preferences")
      .upsert({
        journey_id: journey.id,
        action_key: action.key,
        assignee_id: action.assigneeId,
        due_at: action.dueAt,
        ...values,
      });
    if (error) onError(error.message);
    else await qc.invalidateQueries({ queryKey: onboardingKey });
  }
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <SearchableSelect
        items={staff}
        getItemId={(s) => s.id}
        getItemLabel={(s) => `${s.first_name} ${s.last_name}`}
        value={selected ?? null}
        onValueChange={(person) =>
          void save({ assignee_id: person?.id ?? null })
        }
        onSearchChange={setSearch}
        loading={isLoading}
        placeholder="Assignee"
        allowClear
        trigger={
          <Button size="sm" variant="outline" className="rounded-full">
            <User size={13} className="mr-1" />
            {selected
              ? `${selected.first_name} ${selected.last_name}`
              : action.assigneeId
                ? "Assigned"
                : "Assignee"}
          </Button>
        }
      />
      <Input
        aria-label={`Due date for ${action.label}`}
        type="date"
        className="h-8 w-36"
        value={
          action.dueAt
            ? new Date(action.dueAt).toLocaleDateString("en-CA", {
                timeZone: "Australia/Adelaide",
              })
            : ""
        }
        onChange={(e) =>
          void save({
            due_at: e.target.value
              ? adelaideWallDateTimeToUtcIso(e.target.value, "09:00")
              : null,
          })
        }
      />
    </div>
  );
}
export function JourneyDetail({
  journey,
  onClose,
  deadlines,
}: {
  journey: Journey;
  onClose: () => void;
  deadlines: Record<string, number>;
}) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<
    "book" | "enrol" | "form" | "checkin" | null
  >(null);
  const [error, setError] = useState("");
  const [closure, setClosure] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const commRef = useRef<{
    prepare: (purpose: "registration_link" | "ucat_link" | "followup") => void;
  }>(null);
  const { data: staff } = useCurrentStaff();
  const { data: student } = useQuery({
    queryKey: [...onboardingKey, journey.student_id, "student"],
    enabled: Boolean(journey.student_id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from("students")
        .select("*")
        .eq("id", journey.student_id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const { data: subjects = [] } = useQuery({
    queryKey: [...onboardingKey, journey.student_id, "subjects"],
    enabled: Boolean(journey.student_id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from("students_subjects")
        .select("subjects(*)")
        .eq("student_id", journey.student_id!);
      if (error) throw error;
      return data.flatMap((r) => (r.subjects ? [r.subjects] : []));
    },
  });
  const e = journey.evidence;
  const { data: settings } = useOnboardingSettings();
  const actions = nextActions(
    journey,
    deadlines,
    new Date(),
    settings?.followup_business_days,
  );
  function refresh() {
    void qc.invalidateQueries({ queryKey: onboardingKey });
  }
  function act(action: Action) {
    if (action.key === "registration_link")
      commRef.current?.prepare("registration_link");
    else if (action.key === "registration")
      commRef.current?.prepare("followup");
    else
      setModal(
        (
          {
            book_trial: "book",
            trial_form: "form",
            enrol: "enrol",
            checkin: "checkin",
          } as const
        )[action.key as "book_trial" | "trial_form" | "enrol" | "checkin"] ??
          null,
      );
  }
  async function closeJourney() {
    if (!closure || !reason.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (journey.student_id) {
        if (!staff) throw new Error("Staff identity is still loading.");
        const result = await studentsApi.discontinueStudent(
          journey.student_id,
          staff.id,
        );
        if (!result.success)
          throw new Error(
            result.error ||
              "Resolve the student’s upcoming sessions before discontinuing.",
          );
      }
      const { error } = await getSupabaseClient()
        .from("onboarding_journeys")
        .update({
          closed_at: new Date().toISOString(),
          closure_reason: closure,
          closure_detail: reason,
        })
        .eq("id", journey.id);
      if (error) throw error;
      refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not close journey.");
    } finally {
      setBusy(false);
    }
  }
  const milestones: [string, string | null | boolean][] = [
    ["Trial booked", e.trial_booked_at],
    ["Trial attended", e.trial_attended_at],
    ["Student trial form · completed by staff", e.trial_form_at],
    ["Registration link sent", e.registration_link_at],
    ["Billing setup verified", e.billing_at],
    ["Registration completed", e.registered_at],
    ["First class added", e.classes[0]?.enrolled_at ?? null],
    ["All agreed subjects placed", allSubjectsPlaced(e)],
    ["Paid invoice + corresponding attendance", e.converted_at],
    ["First check-in completed", e.checkin_at],
  ];
  return (
    <>
      <AdminDialogShell
        open
        onClose={onClose}
        title={journey.label}
        subtitle={e.subjects.map((s) => s.name).join(" · ")}
        fillHeight
        defaultExpanded
        headerActions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{stages[lifecycle(journey)]}</Badge>
            <ActionBadges actions={actions} />
          </div>
        }
        bodyClassName="!p-0 !overflow-hidden"
      >
        <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[minmax(0,1fr)_350px] overflow-y-auto md:overflow-hidden">
          <main className="min-h-[500px] md:min-h-0 md:h-full overflow-y-auto p-5">
            <JourneyCommunication
              ref={commRef}
              journey={journey}
              onRefresh={refresh}
            />
          </main>
          <aside className="space-y-5 p-5 md:overflow-y-auto md:h-full min-h-0 md:border-l bg-background">
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              {journey.is_returning && (
                <Badge variant="secondary">Returning</Badge>
              )}
              {journey.historical && (
                <Badge variant="outline">Historical</Badge>
              )}
            </div>
            <section className="space-y-3">
              <h3 className="font-semibold">
                Next actions <Badge variant="outline">{actions.length}</Badge>
              </h3>
              {actions.map((a) => (
                <div className="rounded-lg border p-3 space-y-2" key={a.key}>
                  <p className="text-sm font-medium">{a.label}</p>
                  <ActionBadges actions={[a]} />
                  <Assignment journey={journey} action={a} onError={setError} />
                  {a.key !== "paid_attendance" &&
                    a.key !== "trial_attendance" &&
                    !(a.key === "book_trial" && a.waiting) && (
                      <Button size="sm" onClick={() => act(a)}>
                        {a.key === "registration"
                          ? "Send follow-up"
                          : a.label.split(" · ")[0]}
                      </Button>
                    )}
                </div>
              ))}
              {!actions.length && (
                <p className="text-sm text-muted-foreground">
                  {journey.closed_at
                    ? `Closed · ${journey.closure_detail}`
                    : "All onboarding actions completed."}
                </p>
              )}
            </section>
            <section className="space-y-3">
              <h3 className="font-semibold">Milestones</h3>
              {milestones.map(([label, done]) => (
                <div key={label}>
                  {label === "First check-in completed" &&
                    e.classes.length > 0 && (
                      <div className="ml-5 border-l pl-3 my-4 space-y-3">
                        <p className="text-sm font-medium">
                          First check-in progress
                        </p>
                        {e.classes.map((c) => (
                          <div key={c.id}>
                            <div className="text-sm">{c.name}</div>
                            <div className="flex gap-1 my-1">
                              {[1, 2, 3].map((n) => (
                                <span
                                  key={n}
                                  className={`rounded-full w-6 h-6 flex items-center justify-center text-xs border ${c.attended >= n ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                                >
                                  {c.attended >= n ? "✓" : n}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground">
                          Due on or before the earliest third attended session
                          in any one class.
                        </p>
                      </div>
                    )}
                  <div className="flex items-start gap-2 text-sm">
                    {done ? (
                      <CheckCircle2
                        size={16}
                        className="shrink-0 mt-0.5 text-primary"
                      />
                    ) : (
                      <Circle
                        size={16}
                        className="shrink-0 mt-0.5 text-muted-foreground"
                      />
                    )}
                    <span>
                      {label}
                      {typeof done === "string" && (
                        <small className="block text-muted-foreground">
                          {new Date(done).toLocaleDateString("en-AU")}
                        </small>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </section>
            {!journey.closed_at && (
              <label className="block text-sm">
                Agreed next contact date
                <Input
                  type="date"
                  defaultValue={
                    journey.next_contact_at
                      ? new Date(journey.next_contact_at).toLocaleDateString(
                          "en-CA",
                          { timeZone: "Australia/Adelaide" },
                        )
                      : ""
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    void getSupabaseClient()
                      .from("onboarding_journeys")
                      .update({
                        next_contact_at: value
                          ? adelaideWallDateTimeToUtcIso(value, "09:00")
                          : null,
                      })
                      .eq("id", journey.id)
                      .then(({ error }) => {
                        if (error) setError(error.message);
                        else refresh();
                      });
                  }}
                />
              </label>
            )}
            {!journey.closed_at && (
              <details>
                <summary className="text-sm cursor-pointer">
                  Close journey
                </summary>
                <div className="space-y-2 mt-2">
                  <select
                    aria-label="Closure reason"
                    className="bg-background border rounded p-2 w-full"
                    value={closure}
                    onChange={(e) => setClosure(e.target.value)}
                  >
                    <option value="">Choose outcome</option>
                    <option value="withdrawn">Explicit withdrawal</option>
                    <option value="unable_to_contact">
                      Unable to contact · reviewed by staff
                    </option>
                  </select>
                  <Input
                    aria-label="Closure detail"
                    placeholder="Reason / follow-up attempts"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <Button
                    variant="destructive"
                    disabled={busy || !closure || !reason.trim()}
                    onClick={() => void closeJourney()}
                  >
                    Close and discontinue
                  </Button>
                </div>
              </details>
            )}
          </aside>
        </div>
      </AdminDialogShell>
      {modal === "book" && (
        <BookSessionModal
          isOpen
          onClose={() => setModal(null)}
          initialStudentId={journey.student_id ?? undefined}
          sessionType="TRIAL_SESSION"
          onBookingCreated={(sessionId) => {
            void (async () => {
              if (!journey.student_id) {
                const result = await getSupabaseClient()
                  .from("sessions_students")
                  .select("student_id, students(first_name,last_name)")
                  .eq("session_id", sessionId)
                  .single();
                if (result.error) {
                  setError(result.error.message);
                  return;
                }
                const linked = await getSupabaseClient()
                  .from("onboarding_journeys")
                  .update({
                    student_id: result.data.student_id,
                    label:
                      `${result.data.students?.first_name ?? ""} ${result.data.students?.last_name ?? ""}`.trim() ||
                      journey.label,
                  })
                  .eq("id", journey.id);
                if (linked.error) setError(linked.error.message);
              }
              refresh();
            })();
          }}
        />
      )}
      {modal === "enrol" && student && staff && (
        <EnrollStudentModal
          isOpen
          onClose={() => setModal(null)}
          context="student"
          student={student}
          studentSubjects={subjects}
          enrolledClassIds={e.classes.map((c) => c.id)}
          currentStaffId={staff.id}
          onFetchClasses={async () => {
            const d = await classesApi.getAllClassesWithDetails();
            return d.classes.map(
              (c) =>
                ({
                  ...c,
                  subject: d.classSubjects[c.id],
                  staff: d.classStaff[c.id] ?? [],
                  students: d.classStudents[c.id] ?? [],
                }) as ClassWithExpandedSubject,
            );
          }}
          onEnroll={async (p) => {
            if (student.status === "DISCONTINUED")
              await studentsApi.reEnrollStudent(student.id);
            await classesApi.enrollStudent(
              p.classId,
              p.studentId,
              p.enrolledAt,
              p.staffId,
            );
            refresh();
          }}
        />
      )}
      {modal === "form" && e.trial_session_id && journey.student_id && (
        <FillFormDialog
          open
          onClose={() => setModal(null)}
          sessionId={e.trial_session_id}
          purposeFilter="trial_session"
          initialRespondent={{ type: "student", id: journey.student_id }}
          onSaved={() => {
            setModal(null);
            refresh();
          }}
        />
      )}
      {modal === "checkin" && student && (
        <CheckInBookSessionModal
          isOpen
          onClose={() => setModal(null)}
          initialPrefill={{ students: [student] }}
          onCreated={() => {
            setModal(null);
            refresh();
          }}
        />
      )}
    </>
  );
}
