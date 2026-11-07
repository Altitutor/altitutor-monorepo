"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, useToast } from "@altitutor/ui";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { EmailInput } from "@/shared/components/EmailInput";
import { MeetingEntitySearchAdd } from "@/features/sessions/components/MeetingEntitySearchAdd";
import {
  ManualMeetingModal,
  formatMeetingStart,
  type PlannedTrial,
} from "@/features/bookings/components/ManualMeetingModal";
import type { NotifyRecipient } from "@/features/bookings/components/BookingNotifyMessageScreen";
import { BookSessionNotifyStep } from "@/features/bookings/components/BookSessionNotifyStep";
import { getMeetingFamilySuggestions } from "@/features/bookings/api/meeting-family";
import type { MeetingPerson } from "@/features/bookings/components/MeetingPeopleList";
import {
  createOnboardingEnquiry,
  enquiryPeopleSchema,
  type EnquiryPeople,
  type EnquirySender,
  type EnquirySource,
} from "../api/enquiries";
import type { Journey } from "../lib/model";
import { invalidateOnboarding } from "../api/queries";

type Child = EnquiryPeople["children"][number] & { label?: string };
type Parent = NonNullable<EnquiryPeople["parent"]> & { label?: string };

function personLabel(person: Child | Parent) {
  return person.kind === "existing"
    ? person.label ?? "Existing contact"
    : [person.firstName.trim(), person.lastName.trim()].filter(Boolean).join(" ");
}

function fullName(person: { first_name: string | null; last_name: string | null }) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ");
}

function PersonNameFields({
  firstName,
  lastName,
  onChange,
}: {
  firstName: string;
  lastName: string;
  onChange: (names: { firstName: string; lastName: string }) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="block text-sm">
        First name
        <Input value={firstName} onChange={(event) => onChange({ firstName: event.target.value, lastName })} />
      </label>
      <label className="block text-sm">
        Last name
        <Input value={lastName} onChange={(event) => onChange({ firstName, lastName: event.target.value })} />
      </label>
    </div>
  );
}

export function NewJourney({
  onClose,
  source,
  sender,
  familyJourney,
}: {
  onClose: () => void;
  source?: EnquirySource;
  sender?: EnquirySender;
  familyJourney?: Journey;
}) {
  const client = useQueryClient();
  const { toast } = useToast();
  const [requestId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [children, setChildren] = useState<Child[]>([]);
  const [parent, setParent] = useState<Parent | null>(() =>
    sender?.parentId
      ? { kind: "existing", id: sender.parentId, label: sender.label }
      : familyJourney?.enquiry_parent_id
        ? { kind: "existing", id: familyJourney.enquiry_parent_id, label: familyJourney.label }
        : null,
  );
  const [assignee, setAssignee] = useState<MeetingPerson>();
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [trials, setTrials] = useState<PlannedTrial[]>([]);
  const [planning, setPlanning] = useState<number | null>(null);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [notifyIndex, setNotifyIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const childIds = children.map((child) => child.id);
  const selectedStudentIds = children.filter((child) => child.kind === "existing").map((child) => child.id);
  const selectedParentIds = parent?.kind === "existing" ? [parent.id] : [];
  const family = useQuery({
    queryKey: ["meeting-family", selectedStudentIds, selectedParentIds],
    queryFn: () => getMeetingFamilySuggestions(selectedStudentIds, selectedParentIds),
    enabled: step === 0 && (selectedStudentIds.length > 0 || selectedParentIds.length > 0),
  });

  function addStudent(student: { id: string; first_name: string | null; last_name: string | null }) {
    setChildren((rows) => rows.some((row) => row.id === student.id)
      ? rows
      : [...rows, { kind: "existing", id: student.id, label: fullName(student) }]);
  }

  function removeChild(id: string) {
    setChildren((rows) => rows.filter((row) => row.id !== id));
    setTrials((slots) => slots
      .map((trial) => ({
        ...trial,
        input: { ...trial.input, studentIds: trial.input.studentIds.filter((studentId) => studentId !== id) },
      }))
      .filter((trial) => trial.input.studentIds.length > 0));
  }

  function removeParent() {
    if (parent?.kind === "new") {
      const id = parent.id;
      setTrials((slots) => slots.map((trial) => ({
        ...trial,
        input: { ...trial.input, parentIds: trial.input.parentIds.filter((parentId) => parentId !== id) },
        parents: trial.parents.filter((attendee) => attendee.id !== id),
      })));
    }
    setParent(null);
  }

  function people() {
    const result = enquiryPeopleSchema.safeParse({ children, parent, label, phone, email });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check the people on this enquiry.");
      return null;
    }
    if (familyJourney && !children.length) {
      setError("Add a child to continue this family enquiry.");
      return null;
    }
    if (!source && !children.length && !parent && !phone.trim() && !email.trim()) {
      setError("Link a Student, Parent, phone number or email address.");
      return null;
    }
    return result.data;
  }

  async function confirm() {
    if (busy) return;
    const details = people();
    if (!details) return;
    setError("");
    setBusy(true);
    try {
      const result = await createOnboardingEnquiry({
        ...details,
        requestId,
        familyJourneyId: familyJourney?.id,
        source,
        assigneeId: assignee?.id,
        trials: trials.map(({ input: { startAt, endAt, studentIds, parentIds, staffIds } }) =>
          ({ startAt, endAt, studentIds, parentIds, staffIds }),
        ),
      });
      void invalidateOnboarding(client);
      for (const key of ["students", "parents", "sessions", "email", "messages", "meeting-family"]) {
        void client.invalidateQueries({ queryKey: [key] });
      }
      toast({ title: "Enquiry created" });
      if (result.sessionIds.length) setSessionIds(result.sessionIds);
      else onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not create the enquiry.");
    } finally {
      setBusy(false);
    }
  }

  const usedStudentIds = trials
    .filter((_trial, index) => index !== planning)
    .flatMap((trial) => trial.input.studentIds);
  const availableChildren = children.filter((child) => !usedStudentIds.includes(child.id));
  const showManualContact = !source && !familyJourney && children.length === 0 && parent === null;
  const notificationId = sessionIds[notifyIndex];
  const parentLabel = parent ? personLabel(parent) : "";
  const notificationTrial = notificationId ? trials[notifyIndex] : undefined;
  const notificationStudentIds = notificationTrial?.input.studentIds ?? [];
  const notificationFamily = useQuery({
    queryKey: ["meeting-family", notificationStudentIds, []],
    queryFn: () => getMeetingFamilySuggestions(notificationStudentIds, []),
    enabled: Boolean(notificationId),
  });
  const notificationRecipients: NotifyRecipient[] = notificationTrial ? [
    ...children.filter((child) => notificationStudentIds.includes(child.id)).map((child) =>
      ({ id: child.id, label: personLabel(child), type: "student" as const })),
    ...notificationTrial.parents.map((person) => ({ ...person, type: "parent" as const })),
    ...notificationTrial.staff.map((person) => ({ ...person, type: "staff" as const })),
    ...(parent ? [{ id: parent.id, label: parentLabel, type: "parent" as const }] : []),
    ...(notificationFamily.data?.parents ?? []).map((person) =>
      ({ id: person.id, label: fullName(person), type: "parent" as const })),
  ] : [];
  const trialStudents = (trial: PlannedTrial) => trial.input.studentIds
    .map((id) => children.find((child) => child.id === id))
    .flatMap((child) => child ? [personLabel(child)] : []).join(", ");

  return (
    <>
      <AdminDialogShell
        open={planning === null}
        onClose={onClose}
        closeDisabled={busy}
        title={familyJourney ? "Identify children" : "New enquiry"}
        subtitle={notificationId ? "Enquiry created · optional trial notifications" : [
          "1 of 3 · People",
          "2 of 3 · Trial times",
          "3 of 3 · Review and confirm",
        ][step]}
        footer={notificationId ? (
          <Button onClick={() => sessionIds[notifyIndex + 1] ? setNotifyIndex(notifyIndex + 1) : onClose()}>
            {sessionIds[notifyIndex + 1] ? "Next trial" : "Done"}
          </Button>
        ) : (
          <>
            <Button variant="outline" disabled={busy} onClick={() => {
              setError("");
              if (step) setStep(step - 1);
              else onClose();
            }}>
              {step ? "Back" : "Cancel"}
            </Button>
            <Button disabled={busy} onClick={() => {
              if (step === 2) void confirm();
              else if (step !== 0 || people()) {
                setError("");
                setStep(step + 1);
              }
            }}>
              {step === 2 ? (busy ? "Saving…" : familyJourney ? "Save children" : "Create enquiry") : "Next"}
            </Button>
          </>
        )}
      >
        {notificationId ? (
          <BookSessionNotifyStep
            key={notificationId}
            sessionId={notificationId}
            sessionType="TRIAL_SESSION"
            additionalRecipients={notificationRecipients}
            successMessage={`Trial ${notifyIndex + 1} of ${sessionIds.length} booked`}
          />
        ) : step === 0 ? (
          <div className="space-y-5">
            {familyJourney && <p className="text-sm text-muted-foreground">{familyJourney.label}</p>}
            {sender && <p className="text-sm text-muted-foreground">From {sender.label}{sender.label !== sender.handle && ` · ${sender.handle}`}</p>}
            <section className="space-y-2" aria-label="Children">
              <h3 className="font-medium">Children</h3>
              <p className="text-sm text-muted-foreground">Each child gets a separate journey in the Trial queue. You can file a family enquiry while the children are still unknown.</p>
              {children.map((child, index) => (
                <fieldset key={child.id} className="space-y-2 rounded-md border p-3">
                  <legend className="px-1 text-sm font-medium">{child.kind === "new" ? `Child ${index + 1}` : personLabel(child)}</legend>
                  {child.kind === "new" && (
                    <PersonNameFields firstName={child.firstName} lastName={child.lastName} onChange={(names) =>
                      setChildren((rows) => rows.map((row) => row.id === child.id ? { ...child, ...names } : row))} />
                  )}
                  <Button variant="ghost" size="sm" onClick={() => removeChild(child.id)}>Remove child {index + 1}</Button>
                </fieldset>
              ))}
              <div className="flex flex-wrap gap-2">
                <MeetingEntitySearchAdd
                  includeInactive
                  kind="student"
                  placeholder="Search existing Students"
                  existingIds={childIds}
                  onPick={async (row) => addStudent(row)}
                />
                <Button variant="outline" size="sm" onClick={() => setChildren((rows) =>
                  [...rows, { kind: "new", id: crypto.randomUUID(), firstName: "", lastName: "" }])}>
                  Create student
                </Button>
              </div>
              {family.data?.students.filter((row) => !childIds.includes(row.id)).map((row) => (
                <Button key={row.id} variant="outline" size="sm" onClick={() => addStudent(row)}>Add sibling {fullName(row)}</Button>
              ))}
            </section>
            <section className="space-y-2" aria-label="Parent">
              <h3 className="font-medium">Parent <span className="font-normal text-muted-foreground">optional</span></h3>
              {parent ? (
                <>
                  {parent.kind === "existing" ? <p className="text-sm">{parentLabel}</p> : (
                    <>
                      <PersonNameFields firstName={parent.firstName} lastName={parent.lastName} onChange={(names) =>
                        setParent({ ...parent, ...names })} />
                      <label className="block text-sm">Parent email <EmailInput type="email" value={parent.email ?? ""}
                        onChange={(event) => setParent({ ...parent, email: event.target.value })} /></label>
                      <label className="block text-sm">Parent phone <Input type="tel" value={parent.phone ?? ""}
                        onChange={(event) => setParent({ ...parent, phone: event.target.value })} /></label>
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={removeParent}>Remove parent</Button>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <MeetingEntitySearchAdd kind="parent" placeholder="Search existing Parents" existingIds={[]}
                    onPick={async (row) => setParent({ kind: "existing", id: row.id, label: fullName(row) })} />
                  <Button variant="outline" size="sm" onClick={() => setParent({
                    kind: "new", id: crypto.randomUUID(), firstName: "", lastName: "",
                    email: sender?.handle.includes("@") ? sender.handle : "",
                    phone: sender?.handle.startsWith("+") ? sender.handle : "",
                  })}>Create parent</Button>
                  {family.data?.parents.map((row) => (
                    <Button key={row.id} variant="outline" size="sm" onClick={() =>
                      setParent({ kind: "existing", id: row.id, label: fullName(row) })}>Link parent {fullName(row)}</Button>
                  ))}
                </div>
              )}
            </section>
            {showManualContact && (
              <section className="space-y-2" aria-label="Family contact details">
                <label className="block text-sm">Family or enquiry name <Input value={label} onChange={(event) => setLabel(event.target.value)} /></label>
                <label className="block text-sm">Phone <Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+61412345678" /></label>
                <label className="block text-sm">Email <EmailInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              </section>
            )}
            <section className="space-y-2" aria-label="Follow-up">
              <h3 className="font-medium">Next follow-up <span className="font-normal text-muted-foreground">optional</span></h3>
              {assignee ? (
                <div className="flex items-center gap-2"><p className="text-sm">{assignee.label}</p>
                  <Button variant="ghost" size="sm" onClick={() => setAssignee(undefined)}>Clear assignee</Button></div>
              ) : <MeetingEntitySearchAdd kind="staff" placeholder="Search staff" existingIds={[]}
                onPick={async (row) => setAssignee({ id: row.id, label: fullName(row) })} />}
            </section>
          </div>
        ) : (
          <div className="space-y-4">
            {step === 2 && (
              <section className="space-y-1 text-sm" aria-label="Enquiry details">
                <h3 className="font-medium">Enquiry details</h3>
                <p>{children.length ? children.map(personLabel).join(", ") : `Family enquiry · ${label || parentLabel || sender?.label || email || phone}`}</p>
                {parent && <p className="text-muted-foreground">Parent · {parentLabel}</p>}
                {assignee && <p className="text-muted-foreground">Next follow-up · {assignee.label}</p>}
              </section>
            )}
            <section className="space-y-2" aria-label="Trial times">
              <h3 className="font-medium">Trial times</h3>
              {trials.length === 0 && <p className="text-sm text-muted-foreground">No trial booked. These enquiries can be booked from the Trial queue later.</p>}
              {trials.map((trial, index) => (
                <div key={index} className="space-y-1 rounded-md border p-3 text-sm">
                  <p className="font-medium">{formatMeetingStart(trial.input.startAt)} Adelaide</p>
                  <p>{trialStudents(trial)}</p>
                  {trial.staff.length > 0 && <p className="text-muted-foreground">Staff · {trial.staff.map((person) => person.label).join(", ")}</p>}
                  {step === 1 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPlanning(index)}>Edit trial {index + 1}</Button>
                      <Button variant="ghost" size="sm" onClick={() => setTrials((slots) => slots.filter((_slot, i) => i !== index))}>Remove trial {index + 1}</Button>
                    </div>
                  )}
                </div>
              ))}
              {step === 1 && availableChildren.length > 0 && (
                <Button variant="outline" onClick={() => setPlanning(trials.length)}>Add trial time</Button>
              )}
              {trials.length > 0 && availableChildren.length > 0 && (
                <p className="text-sm text-muted-foreground">Still to book · {availableChildren.map(personLabel).join(", ")}</p>
              )}
            </section>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      </AdminDialogShell>
      {planning !== null && (
        <ManualMeetingModal
          isOpen
          onClose={() => setPlanning(null)}
          sessionType="TRIAL_SESSION"
          trialPlan={{
            students: availableChildren.map((child) => ({ id: child.id, label: personLabel(child) })),
            parent: parent ? { id: parent.id, label: parentLabel } : undefined,
            initial: trials[planning],
            onConfirm: (trial) => {
              setTrials((slots) => planning < slots.length
                ? slots.map((slot, index) => index === planning ? trial : slot)
                : [...slots, trial]);
              setPlanning(null);
            },
          }}
        />
      )}
    </>
  );
}
