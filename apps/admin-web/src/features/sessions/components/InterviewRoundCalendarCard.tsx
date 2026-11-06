"use client";
import Link from "next/link";
import { format } from "date-fns";
import { BUSINESS_TIMEZONE } from "@altitutor/shared";
import {
  Badge,
  Button,
  formatInterviewCalendarRange,
  InterviewRoundCalendarCard as RoundCard,
} from "@altitutor/ui";
import { AdminDialogShell } from "@/shared/components";
import { CalendarDetailsTooltip } from "@/shared/components/CalendarDetailsTooltip";
import {
  interviewRoundRoomUrl,
  interviewRoundStatus,
  type InterviewRoundCalendarEvent,
} from "../utils/interviewRoundEvents";

const calendarPeople = (people: { id: string; name: string }[]) =>
  people.map((person) => ({
    id: person.id,
    first_name: person.name,
    last_name: "",
  }));
export function InterviewRoundCalendarCard({
  round,
  onOpen,
}: {
  round: InterviewRoundCalendarEvent;
  onOpen: () => void;
}) {
  return (
    <CalendarDetailsTooltip
      enabled
      title={round.name}
      subtitle={formatInterviewCalendarRange({
        start: round.scheduledAt,
        end: round.endAt,
        timeZone: BUSINESS_TIMEZONE,
      })}
      status={interviewRoundStatus(round)}
      students={calendarPeople(round.students)}
      staff={calendarPeople(round.tutors)}
      openEntity={{
        href: interviewRoundRoomUrl(round),
        label: "Open interview",
      }}
    >
      <RoundCard name={round.name} onClick={onOpen} />
    </CalendarDetailsTooltip>
  );
}
export function InterviewRoundInfoDialog({
  round,
  onClose,
}: {
  round: InterviewRoundCalendarEvent | null;
  onClose: () => void;
}) {
  return (
    <AdminDialogShell
      open={!!round}
      onClose={onClose}
      title={round?.name ?? "Interview"}
      subtitle="Interview session"
      contentClassName="md:max-w-3xl"
      footer={
        round ? (
          <Button asChild>
            <Link href={interviewRoundRoomUrl(round)}>Open interview</Link>
          </Button>
        ) : undefined
      }
    >
      {round && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{interviewRoundStatus(round)}</Badge>
            <Badge variant="outline">
              {round.delivery === "online" ? "Online" : "In person"}
            </Badge>
            <Badge variant="outline">
              {round.mode === "exam" ? "Exam mode" : "Feedback mode"}
            </Badge>
            {round.recordingEnabled && (
              <Badge variant="outline">Recording enabled</Badge>
            )}
          </div>
          <section>
            <h3 className="font-medium">Time</h3>
            <p className="text-sm text-muted-foreground">
              {format(new Date(round.scheduledAt), "EEE d MMM yyyy · h:mm a")} –{" "}
              {format(new Date(round.endAt), "h:mm a")}
            </p>
          </section>
          <div className="grid gap-6 sm:grid-cols-2">
            {(["students", "tutors"] as const).map((kind) => (
              <section key={kind}>
                <h3 className="mb-2 font-medium capitalize">{kind}</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {round[kind].map((person) => (
                    <li key={person.id} className="rounded-lg border p-3">
                      {person.name}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </AdminDialogShell>
  );
}
