"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@altitutor/ui";
import {
  tutorBtnOutline,
  tutorBtnPrimary,
  tutorSheetContentClass,
} from "@/shared/lib/tutor-visual";
import {
  roundRoomLabel,
  roundRoomPath,
  roundStatusLabel,
  type ScheduledInterviewRound,
} from "../lib/round-calendar";

export { InterviewRoundCalendarCard } from "@altitutor/ui";

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
    <Sheet
      open={!!round}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        className={`flex w-full flex-col gap-6 overflow-y-auto p-6 sm:max-w-[600px] ${tutorSheetContentClass}`}
      >
        {round ? (
          <>
            <SheetHeader>
              <SheetTitle>Interview details</SheetTitle>
              <SheetDescription>
                {round.name}
                {titleName ? ` · ${titleName}` : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {roundStatusLabel(round)} ·{" "}
                {round.delivery === "online" ? "Online" : "In person"} ·{" "}
                {round.mode === "exam" ? "Exam" : "Feedback"}
                {round.recordingEnabled ? " · Recording on" : ""}
              </p>
              <p>{format(new Date(round.scheduledAt), "EEE d MMM · h:mm a")}</p>
              <People title="Students" people={round.students} />
              <People title="Tutors" people={round.tutors} />
            </div>
            <div className="mt-auto flex justify-end gap-2 border-t pt-5">
              {onEdit ? (
                <Button
                  variant="outline"
                  className={tutorBtnOutline}
                  onClick={onEdit}
                >
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
      </SheetContent>
    </Sheet>
  );
}

function People({
  title,
  people,
}: {
  title: string;
  people: { id: string; name: string }[];
}) {
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
