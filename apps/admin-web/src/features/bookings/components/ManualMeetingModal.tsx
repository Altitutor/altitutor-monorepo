"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  SmartDatePickerField,
  TimePicker,
  DurationPicker,
  useToast,
} from "@altitutor/ui";
import { Loader2, AlertTriangle } from "lucide-react";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import {
  PropertyForm,
  PropertyFormRow,
} from "@/shared/components/PropertyForm";
import { MeetingEntitySearchAdd } from "@/features/sessions/components/MeetingEntitySearchAdd";
import { SessionsCalendarView } from "@/features/sessions/components/SessionsCalendarView";
import { SubjectSelectPopover } from "@/features/subjects/components/SubjectSelectPopover";
import { AddStudentModal } from "@/features/students/components/AddStudentModal";
import { AddStaffModal } from "@/features/staff/components/AddStaffModal";
import { useSessionWithTutorLog } from "@/features/sessions/hooks/useSessionsQuery";
import { BookSessionNotifyStep } from "./BookSessionNotifyStep";
import { StaffInterviewMessageStep } from "./staff-interview/StaffInterviewMessageStep";
import { studentsApi } from "@/features/students/api/students";
import { staffApi } from "@/features/staff/api/staff";
import type { Tables } from "@altitutor/shared";
import type { CheckInModalPrefill } from "@/shared/contexts/QuickActionsContext";
import { formatSessionType } from "@/shared/utils";
import {
  utcToAdelaideDate,
  getTodayAdelaideDate,
  adelaideWallDateTimePlusMinutesUtcIso,
} from "../utils/dateTimeHelpers";
import {
  createManualMeeting,
  getManualMeetingWarnings,
  type ManualMeetingType,
  type ManualMeetingInput,
} from "../api/admin-meetings";
import { getMeetingFamilySuggestions } from "../api/meeting-family";
import { MeetingPeopleTable, type MeetingPerson } from "./MeetingPeopleTable";
import {
  BookingNotifyMessageScreen,
  type NotifyRecipient,
} from "./BookingNotifyMessageScreen";
import { useSessionDurationMinutes } from "../hooks/useBookingSettings";

export type ManualMeetingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sessionType: ManualMeetingType;
  onBookingCreated?: (id: string, staffIds: string[]) => void;
  initialStudentId?: string;
  initialPrefill?: CheckInModalPrefill | null;
  initialCreateStudent?: {
    phone: string;
    phoneOwner: "student" | "parent";
  } | null;
  initialStaffPhone?: string;
  originalSessionId?: string | null;
  originalSubjectId?: string | null;
};
const personName = (person: {
  first_name?: string | null;
  last_name?: string | null;
}) =>
  `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() ||
  "Unnamed person";
const pick = (person: {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
}): MeetingPerson => ({ id: person.id, label: personName(person) });
const append = (people: MeetingPerson[], person: MeetingPerson) =>
  people.some((row) => row.id === person.id) ? people : [...people, person];

export function ManualMeetingModal(props: ManualMeetingModalProps) {
  const {
    isOpen,
    onClose,
    sessionType,
    initialPrefill,
    initialStudentId,
    originalSessionId,
    originalSubjectId,
  } = props;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [students, setStudents] = useState<MeetingPerson[]>([]);
  const [parents, setParents] = useState<MeetingPerson[]>([]);
  const [staff, setStaff] = useState<MeetingPerson[]>([]);
  const [date, setDate] = useState(getTodayAdelaideDate);
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [subject, setSubject] = useState<Tables<"subjects"> | null>(null);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const opened = useRef(false);
  const durationEdited = useRef(false);
  const [hydratedOriginal, setHydratedOriginal] = useState<string | null>(null);
  const original = useSessionWithTutorLog(
    originalSessionId ?? null,
    isOpen && !!originalSessionId,
  );
  const durationType =
    sessionType === "DRAFTING" ||
    sessionType === "TRIAL_SESSION" ||
    sessionType === "SUBSIDY_INTERVIEW"
      ? sessionType
      : "DRAFTING";
  const { data: configuredDuration } = useSessionDurationMinutes(durationType);
  const defaultDuration =
    sessionType === "STAFF_INTERVIEW"
      ? 45
      : sessionType === "CHECK_IN" || sessionType === "ADMIN_MEETING"
        ? 60
        : (configuredDuration ?? (sessionType === "DRAFTING" ? 60 : 45));
  useEffect(() => {
    if (!isOpen) {
      opened.current = false;
      setHydratedOriginal(null);
      return;
    }
    if (opened.current) return;
    opened.current = true;
    durationEdited.current = false;
    setStep(0);
    setCreatedId(null);
    setSubject(null);
    setDate(getTodayAdelaideDate());
    setTime("09:00");
    setDuration(defaultDuration);
    setStudents((initialPrefill?.students ?? []).map(pick));
    setParents((initialPrefill?.parents ?? []).map(pick));
    setStaff((initialPrefill?.staff ?? []).map(pick));
    setAddStudentOpen(Boolean(props.initialCreateStudent));
    setAddStaffOpen(Boolean(props.initialStaffPhone));
  }, [
    isOpen,
    initialPrefill,
    defaultDuration,
    props.initialCreateStudent,
    props.initialStaffPhone,
  ]);
  useEffect(() => {
    if (
      !isOpen ||
      !originalSessionId ||
      !original.data ||
      hydratedOriginal === originalSessionId
    )
      return;
    const data = original.data;
    setHydratedOriginal(originalSessionId);
    setStudents(
      data.sessionsStudents.flatMap((row) =>
        row.student && !row.planned_absence
          ? [{ ...pick(row.student), locked: true }]
          : [],
      ),
    );
    setParents(
      data.sessionsParents.flatMap((row) =>
        row.parent ? [pick(row.parent)] : [],
      ),
    );
    setStaff(
      data.sessionsStaff.flatMap((row) =>
        row.staff && !row.planned_absence
          ? [
              {
                ...pick(row.staff),
                receiver:
                  row.type === "CHECK_IN_RECEIVER" ||
                  (sessionType === "STAFF_INTERVIEW" &&
                    row.type === "TRIAL_TUTOR"),
              },
            ]
          : [],
      ),
    );
    setSubject(data.session.subject ?? null);
    if (data.session.start_at && data.session.end_at) {
      setDate(utcToAdelaideDate(data.session.start_at));
      setTime(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Australia/Adelaide",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(data.session.start_at)),
      );
      setDuration(
        (new Date(data.session.end_at).getTime() -
          new Date(data.session.start_at).getTime()) /
          60000,
      );
    }
  }, [isOpen, originalSessionId, original.data, sessionType, hydratedOriginal]);
  useEffect(() => {
    if (isOpen && !originalSessionId && !durationEdited.current)
      setDuration(defaultDuration);
  }, [isOpen, originalSessionId, defaultDuration]);
  const initialStudent = useQuery({
    queryKey: ["students", initialStudentId],
    queryFn: () => studentsApi.getStudent(initialStudentId!),
    enabled: isOpen && !!initialStudentId,
  });
  useEffect(() => {
    if (isOpen && initialStudent.data)
      setStudents((rows) => append(rows, pick(initialStudent.data!)));
  }, [isOpen, initialStudent.data]);
  const studentIds = students.map((row) => row.id);
  const parentIds = parents.map((row) => row.id);
  const staffIds = staff.map((row) => row.id);
  const family = useQuery({
    queryKey: ["meeting-family", studentIds, parentIds],
    queryFn: () => getMeetingFamilySuggestions(studentIds, parentIds),
    enabled: isOpen && !createdId,
  });
  let input: ManualMeetingInput | null = null;
  try {
    if (date && time && duration > 0) {
      const { startAt, endAt } = adelaideWallDateTimePlusMinutesUtcIso(
        date,
        time,
        duration,
      );
      input = {
        type: sessionType,
        startAt,
        endAt,
        studentIds,
        parentIds,
        staffIds,
        receiverStaffIds: staff
          .filter((row) => row.receiver)
          .map((row) => row.id),
        subjectId: subject?.id ?? originalSubjectId ?? null,
        originalSessionId,
      };
    }
  } catch {
    /* Incomplete date/time fields are validated before proceeding. */
  }
  const warnings = useQuery({
    queryKey: ["manual-meeting-warnings", input],
    queryFn: () => getManualMeetingWarnings(input!),
    enabled: isOpen && step > 0 && !!input && !createdId,
  });
  const title = formatSessionType(sessionType);
  const recipients: NotifyRecipient[] = useMemo(
    () => [
      ...students.map((row) => ({ ...row, type: "student" as const })),
      ...(family.data?.parents ?? []).map((row) => ({
        ...pick(row),
        type: "parent" as const,
      })),
      ...parents.map((row) => ({ ...row, type: "parent" as const })),
      ...staff.map((row) => ({ ...row, type: "staff" as const })),
    ],
    [students, parents, staff, family.data?.parents],
  );
  const originalReady =
    !originalSessionId ||
    (hydratedOriginal === originalSessionId && !original.isError);
  const submit = async () => {
    if (!input || busy || !originalReady) return;
    setBusy(true);
    try {
      const id = await createManualMeeting(input);
      setCreatedId(id);
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch (error) {
      toast({
        title: "Could not book meeting",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };
  const finish = () => {
    if (createdId) props.onBookingCreated?.(createdId, staffIds);
    onClose();
  };
  const staffControl = (
    <MeetingEntitySearchAdd
      includeInactive
      kind="staff"
      placeholder="Search staff…"
      existingIds={staffIds}
      onPick={async (row) =>
        setStaff((rows) =>
          append(rows, {
            ...pick(row),
            receiver: step === 0 && sessionType === "STAFF_INTERVIEW",
          }),
        )
      }
      onCreate={
        step === 0 && sessionType === "STAFF_INTERVIEW"
          ? () => setAddStaffOpen(true)
          : undefined
      }
    />
  );
  return (
    <>
      <AdminDialogShell
        open={isOpen}
        onClose={createdId ? finish : onClose}
        title={`Book ${title}`}
        subtitle={
          createdId
            ? "Meeting booked — send an optional message"
            : `${step + 1} of 3 · ${["People", "Schedule", "Preview and confirm"][step]}`
        }
        fillHeight
        closeDisabled={busy}
        contentClassName={step === 1 ? "md:max-w-6xl" : undefined}
        footer={
          createdId ? (
            <Button onClick={finish}>Done</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => (step ? setStep(step - 1) : onClose())}
                disabled={busy}
              >
                {step ? "Back" : "Cancel"}
              </Button>
              <Button
                onClick={() => (step === 2 ? void submit() : setStep(step + 1))}
                disabled={
                  busy ||
                  !originalReady ||
                  (step > 0 &&
                    (!input ||
                      (sessionType === "DRAFTING" && !input.subjectId)))
                }
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {step === 2 ? "Confirm booking" : "Next"}
              </Button>
            </>
          )
        }
      >
        {createdId ? (
          sessionType === "DRAFTING" ||
          sessionType === "TRIAL_SESSION" ||
          sessionType === "SUBSIDY_INTERVIEW" ? (
            <BookSessionNotifyStep
              sessionId={createdId}
              sessionType={sessionType}
              successMessage={`${title} booked successfully`}
              additionalRecipients={recipients}
            />
          ) : sessionType === "STAFF_INTERVIEW" ? (
            <StaffInterviewMessageStep
              sessionId={createdId}
              additionalRecipients={recipients}
            />
          ) : (
            <BookingNotifyMessageScreen
              successMessage={`${title} booked successfully`}
              recipients={recipients}
              defaultDraft={`Hi, your ${title.toLowerCase()} is booked for ${date} at ${time} (Adelaide time).`}
            />
          )
        ) : step === 0 ? (
          <div className="space-y-6">
            {!originalReady && (
              <p role="status">
                {original.isError ? (
                  <>
                    Could not load the existing meeting.{" "}
                    <Button
                      variant="outline"
                      onClick={() => void original.refetch()}
                    >
                      Retry
                    </Button>
                  </>
                ) : (
                  "Loading existing meeting…"
                )}
              </p>
            )}
            {originalSessionId && (
              <p className="text-sm text-muted-foreground">
                Remove existing students through Log absence on the session,
                where you can choose their billing treatment.
              </p>
            )}
            <MeetingPeopleTable
              title="Students"
              people={students}
              onRemove={(id) =>
                setStudents((rows) => rows.filter((row) => row.id !== id))
              }
              addControl={
                <MeetingEntitySearchAdd
                  includeInactive
                  kind="student"
                  placeholder="Search students…"
                  existingIds={studentIds}
                  onPick={async (row) =>
                    setStudents((rows) => append(rows, pick(row)))
                  }
                  onCreate={
                    sessionType === "TRIAL_SESSION"
                      ? () => setAddStudentOpen(true)
                      : undefined
                  }
                />
              }
            />
            <MeetingPeopleTable
              title="Parents"
              people={parents}
              onRemove={(id) =>
                setParents((rows) => rows.filter((row) => row.id !== id))
              }
              addControl={
                <MeetingEntitySearchAdd
                  includeInactive
                  kind="parent"
                  placeholder="Search parents…"
                  existingIds={parentIds}
                  onPick={async (row) =>
                    setParents((rows) => append(rows, pick(row)))
                  }
                />
              }
            />
            <MeetingPeopleTable
              title="Staff"
              people={staff}
              onRemove={(id) =>
                setStaff((rows) => rows.filter((row) => row.id !== id))
              }
              addControl={staffControl}
              onRoleChange={
                sessionType === "CHECK_IN" || sessionType === "STAFF_INTERVIEW"
                  ? (id, receiver) =>
                      setStaff((rows) =>
                        rows.map((row) =>
                          row.id === id ? { ...row, receiver } : row,
                        ),
                      )
                  : undefined
              }
              receiverLabel={
                sessionType === "STAFF_INTERVIEW"
                  ? "Interview candidate"
                  : "Receiving"
              }
            />
            {family.isError && (
              <p role="status" className="text-sm text-muted-foreground">
                Family suggestions could not be loaded. You can still add people
                manually.
              </p>
            )}
            {!!(
              family.data?.parents.length || family.data?.students.length
            ) && (
              <section className="space-y-2">
                <h3 className="font-semibold">Suggested family members</h3>
                <div className="flex flex-wrap gap-2">
                  {family.data?.parents.map((row) => (
                    <Button
                      key={`parent-${row.id}`}
                      variant="outline"
                      onClick={() =>
                        setParents((rows) => append(rows, pick(row)))
                      }
                    >
                      Add parent {personName(row)}
                    </Button>
                  ))}
                  {family.data?.students.map((row) => (
                    <Button
                      key={`student-${row.id}`}
                      variant="outline"
                      onClick={() =>
                        setStudents((rows) => append(rows, pick(row)))
                      }
                    >
                      Add student {personName(row)}
                    </Button>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : step === 1 ? (
          <div className="space-y-5">
            <PropertyForm>
              <PropertyFormRow label="Date">
                <SmartDatePickerField
                  value={date}
                  onChange={(value) => setDate(value ?? "")}
                />
              </PropertyFormRow>
              <PropertyFormRow label="Start time (Adelaide)">
                <TimePicker
                  aria-label="Start time"
                  value={time}
                  onChange={setTime}
                />
              </PropertyFormRow>
              <PropertyFormRow label="Duration">
                <DurationPicker
                  aria-label="Duration"
                  value={duration}
                  onChange={(value) => {
                    durationEdited.current = true;
                    setDuration(value);
                  }}
                />
              </PropertyFormRow>
              <PropertyFormRow label="Staff member">
                {staffControl}
              </PropertyFormRow>
              {sessionType === "DRAFTING" && (
                <PropertyFormRow label="Subject">
                  <SubjectSelectPopover
                    selectedSubject={subject}
                    onSelectSubject={setSubject}
                  />
                </PropertyFormRow>
              )}
            </PropertyForm>
            <p className="text-sm text-muted-foreground">
              Selected staff:{" "}
              {staff.map((row) => row.label).join(", ") || "None"}
            </p>
            {warnings.isError ? (
              <p
                role="status"
                className="rounded-md border border-amber-300 p-3 text-sm"
              >
                Availability could not be checked. You can still proceed.
              </p>
            ) : warnings.data?.length ? (
              <div
                role="status"
                className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
              >
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Staff may be unavailable. You can still proceed.
                </p>
                <ul className="mt-2 list-disc pl-5">
                  {warnings.data.map((warning, index) => (
                    <li key={index}>
                      {staff.find((row) => row.id === warning.staff_id)?.label}:{" "}
                      {warning.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <SessionsCalendarView
              initialDate={date}
              initialViewMode="week"
              expandToSessions
            />
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="font-semibold">{title}</h3>
            <p>
              {date} at {time} (Adelaide) · {duration} minutes
            </p>
            {subject && <p>Subject: {subject.long_name}</p>}
            <p>
              Students: {students.map((row) => row.label).join(", ") || "None"}
            </p>
            <p>
              Parents: {parents.map((row) => row.label).join(", ") || "None"}
            </p>
            <p>
              Staff:{" "}
              {staff
                .map(
                  (row) =>
                    `${row.label}${row.receiver ? (sessionType === "STAFF_INTERVIEW" ? " (candidate)" : " (receiving)") : ""}`,
                )
                .join(", ") || "None"}
            </p>
            {!!warnings.data?.length && (
              <p className="text-amber-700">
                Availability warnings remain. Confirming will book this meeting
                anyway.
              </p>
            )}
          </div>
        )}
      </AdminDialogShell>
      {addStudentOpen && (
        <AddStudentModal
          isOpen={isOpen && addStudentOpen}
          onClose={() => setAddStudentOpen(false)}
          initialPhone={
            props.initialCreateStudent?.phoneOwner === "student"
              ? props.initialCreateStudent.phone
              : undefined
          }
          initialParentPhone={
            props.initialCreateStudent?.phoneOwner === "parent"
              ? props.initialCreateStudent.phone
              : undefined
          }
          onStudentAdded={(person) => {
            setAddStudentOpen(false);
            if (person)
              void studentsApi
                .getStudent(person.id)
                .then((row) => {
                  if (row) setStudents((rows) => append(rows, pick(row)));
                })
                .catch(() =>
                  toast({
                    title: "Student created",
                    description: "Select the new student using Add student.",
                  }),
                );
          }}
        />
      )}
      {addStaffOpen && (
        <AddStaffModal
          isOpen={isOpen && addStaffOpen}
          onClose={() => setAddStaffOpen(false)}
          initialPhone={props.initialStaffPhone}
          initialStatus="TRIAL"
          onStaffAdded={(person) => {
            setAddStaffOpen(false);
            if (person)
              void staffApi
                .getStaff(person.id)
                .then((row) => {
                  if (row)
                    setStaff((rows) =>
                      append(rows, { ...pick(row), receiver: true }),
                    );
                })
                .catch(() =>
                  toast({
                    title: "Staff created",
                    description: "Select the new staff member using Add staff.",
                  }),
                );
          }}
        />
      )}
    </>
  );
}
