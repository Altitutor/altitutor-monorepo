import { z } from "zod";
import { addBusinessDays } from "date-fns";
import type { Tables } from "@altitutor/shared";

const date = z.string().nullable();
export const evidenceSchema = z.object({
  trial_start_at: date,
  trial_booked_at: date,
  trial_session_id: date,
  trial_attended_at: date,
  trial_form_at: date,
  registration_link_at: date,
  billing_at: date,
  registered_at: date,
  subjects: z.array(z.object({ id: z.string(), name: z.string() })),
  classes: z.array(
    z.object({
      id: z.string(),
      subject_id: z.string(),
      name: z.string(),
      enrolled_at: z.string(),
      added_at: date.optional(),
      attended: z.number(),
      third_attended_at: date,
      checkin_due_at: date,
    }),
  ),
  followups: z.array(z.string()),
  checkin_booked_at: date,
  converted_at: date,
  paid_session_id: date,
  paid_invoice_id: date,
  checkin_at: date,
  checkin_session_id: date,
});
export type Evidence = z.infer<typeof evidenceSchema>;
export type Journey = Tables<"onboarding_journeys"> & {
  evidence: Evidence;
  preferences: Tables<"onboarding_action_preferences">[];
};
export const stages = [
  "Enquiry",
  "Trial booked",
  "Trial attended",
  "Registration",
  "Registered",
  "Classes added",
  "Converted",
] as const;
export type ActionKey =
  | "book_trial"
  | "trial_attendance"
  | "trial_form"
  | "registration_link"
  | "registration"
  | "enrol"
  | "paid_attendance"
  | "checkin";
export type Action = {
  key: ActionKey;
  label: string;
  waiting: boolean;
  dueAt: string | null;
  assigneeId: string | null;
  overdue: boolean;
};
export const defaultDeadlines: Record<string, number> = {
  book_trial: 1,
  registration_link: 1,
  enrol: 2,
  trial_form: 0,
};

export function lifecycle(j: Journey) {
  const e = j.evidence;
  if (e.converted_at) return 6;
  if (e.classes.length) return 5;
  if (e.registered_at) return 4;
  if (e.registration_link_at) return 3;
  if (e.trial_attended_at) return 2;
  if (e.trial_booked_at) return 1;
  return 0;
}
export function missingSubjects(e: Evidence) {
  return e.subjects.filter(
    (s) => !e.classes.some((c) => c.subject_id === s.id),
  );
}
export function allSubjectsPlaced(e: Evidence) {
  return e.subjects.length > 0 && missingSubjects(e).length === 0;
}
export function requiresTrialForm(j: Journey) {
  return (
    Boolean(j.evidence.trial_attended_at) &&
    !(
      j.is_returning &&
      j.enquiry_at &&
      j.evidence.trial_attended_at! < j.enquiry_at
    )
  );
}
export function isCompleted(j: Journey) {
  return Boolean(
    j.evidence.converted_at &&
      j.evidence.checkin_at &&
      (j.evidence.trial_form_at || !requiresTrialForm(j)) &&
      allSubjectsPlaced(j.evidence),
  );
}
export function isOpen(j: Journey) {
  return !j.closed_at && !isCompleted(j);
}
export function nextActions(
  j: Journey,
  deadlines: Record<string, number> = defaultDeadlines,
  now = new Date(),
  cadence: number[] = [2, 5, 10],
): Action[] {
  if (!isOpen(j)) return [];
  const e = j.evidence;
  const actions: Action[] = [];
  function add(
    key: ActionKey,
    label: string,
    waiting: boolean,
    since: string | null,
    deadline?: string | null,
  ) {
    const p = j.preferences.find((p) => p.action_key === key);
    const dueAt =
      p?.due_at ??
      deadline ??
      (since && deadlines[key] !== undefined
        ? addBusinessDays(new Date(since), deadlines[key]).toISOString()
        : null);
    actions.push({
      key,
      label,
      waiting,
      dueAt,
      assigneeId: p?.assignee_id ?? null,
      overdue: Boolean(dueAt && new Date(dueAt) < now),
    });
  }
  if (
    !e.trial_attended_at &&
    !e.registered_at &&
    !(j.is_returning && e.trial_attended_at)
  ) {
    if (e.trial_booked_at)
      add(
        "trial_attendance",
        "Waiting for trial attendance",
        true,
        null,
        e.trial_start_at,
      );
    else add("book_trial", "Book trial session", false, j.enquiry_at);
  }
  if (requiresTrialForm(j) && !e.trial_form_at)
    add(
      "trial_form",
      "Complete student trial form",
      false,
      e.trial_attended_at,
    );
  if (e.trial_attended_at && !e.registration_link_at && !e.registered_at)
    add(
      "registration_link",
      "Send registration link",
      false,
      e.trial_attended_at,
    );
  if (e.registration_link_at && !e.registered_at) {
    const followupDay =
      cadence[Math.min(e.followups.length, cadence.length - 1)];
    const due =
      j.next_contact_at ??
      (e.followups.length < cadence.length
        ? addBusinessDays(
            new Date(e.registration_link_at),
            followupDay,
          ).toISOString()
        : e.followups[e.followups.length - 1]);
    const review = e.followups.length >= cadence.length;
    add(
      "registration",
      review
        ? "Review follow-up outcome"
        : e.billing_at
          ? "Registration · billing complete"
          : "Registration · billing pending",
      !(due && new Date(due) <= now),
      e.registration_link_at,
      due,
    );
  }
  if (
    (e.registered_at || (j.is_returning && e.trial_attended_at)) &&
    !allSubjectsPlaced(e)
  )
    add(
      "enrol",
      e.subjects.length
        ? `Enrol in classes · ${missingSubjects(e)
            .map((s) => s.name)
            .join(", ")}`
        : "Confirm agreed subjects, then enrol",
      false,
      e.registered_at ?? j.enquiry_at,
    );
  if (e.classes.length && !e.converted_at)
    add(
      "paid_attendance",
      "Waiting for paid invoice + corresponding attendance",
      true,
      null,
    );
  if (e.classes.length && !e.checkin_at) {
    const third = e.classes
      .flatMap((c) => (c.checkin_due_at ? [c.checkin_due_at] : []))
      .sort()[0];
    add(
      "checkin",
      e.checkin_booked_at
        ? "Waiting for first check-in"
        : "Arrange first check-in",
      Boolean(e.checkin_booked_at),
      null,
      third ?? e.checkin_booked_at,
    );
  }
  return actions;
}
