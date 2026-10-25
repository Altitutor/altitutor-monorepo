"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@altitutor/ui";
import { tutorBtnOutline, tutorBtnPrimary } from "@/shared/lib/tutor-visual";
import {
  roundRoomLabel,
  roundRoomPath,
  roundStatusLabel,
  type ScheduledInterviewRound,
} from "../lib/round-calendar";

export function InterviewRoundCalendarCard({
  name,
  start,
  onClick,
}: {
  name: string;
  start: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Interview round ${name}`}
      className="h-full w-full overflow-hidden rounded-lg border border-violet-300 bg-violet-50 p-2 text-left shadow-sm dark:border-violet-700 dark:bg-violet-950/40"
    >
      <p className="truncate text-xs font-medium text-violet-700 dark:text-violet-200">Interview</p>
      <p className="truncate text-sm font-medium">{name}</p>
      <p className="truncate text-xs text-muted-foreground">{format(new Date(start), "h:mm a")}</p>
    </button>
  );
}

export function InterviewRoundInfoDialog({
  round,
  interviewName,
  onClose,
  onEdit,
  waitingLabel = "Enter waiting room",
}: {
  round: ScheduledInterviewRound | null;
  interviewName?: string;
  onClose: () => void;
  onEdit?: () => void;
  waitingLabel?: string;
}) {
  const router = useRouter();
  const titleName = interviewName || round?.interviewName;
  return (
    <Dialog open={!!round} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        {round ? (
          <>
            <DialogHeader>
              <DialogTitle>{round.name}</DialogTitle>
              <DialogDescription>{titleName || "Interview round"}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {roundStatusLabel(round)} · {round.delivery === "online" ? "Online" : "In person"} ·{" "}
                {round.mode === "exam" ? "Exam" : "Feedback"}
                {round.recordingEnabled ? " · Recording on" : ""}
              </p>
              <p>{format(new Date(round.scheduledAt), "EEE d MMM · h:mm a")}</p>
              <People title="Students" people={round.students} />
              <People title="Tutors" people={round.tutors} />
            </div>
            <div className="flex justify-end gap-2">
              {onEdit ? (
                <Button variant="outline" className={tutorBtnOutline} onClick={onEdit}>
                  Edit
                </Button>
              ) : null}
              <Button
                className={tutorBtnPrimary}
                onClick={() => router.push(roundRoomPath(round))}
              >
                {roundRoomLabel(round, waitingLabel)}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function People({ title, people }: { title: string; people: { id: string; name: string }[] }) {
  return (
    <section className="space-y-1">
      <h3 className="font-medium">{title}</h3>
      {people.length ? (
        <ul className="space-y-0.5 text-muted-foreground">
          {people.map((person) => (
            <li key={person.id}>{person.name}</li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">None</p>
      )}
    </section>
  );
}
