'use client';

import { format } from 'date-fns';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@altitutor/ui';
import {
  interviewRoundRoomLabel,
  interviewRoundRoomUrl,
  interviewRoundStatus,
  type InterviewRoundCalendarEvent,
} from '../utils/interviewRoundEvents';

export function InterviewRoundCalendarCard({
  round,
  onOpen,
}: {
  round: InterviewRoundCalendarEvent;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Interview round ${round.name}`}
      className="h-full w-full overflow-hidden rounded-lg border border-violet-300 bg-violet-50 p-2 text-left shadow-sm dark:border-violet-700 dark:bg-violet-950/40"
    >
      <p className="truncate text-xs font-medium text-violet-700 dark:text-violet-200">Interview</p>
      <p className="truncate text-sm font-medium">{round.name}</p>
      <p className="truncate text-xs text-muted-foreground">{format(new Date(round.scheduledAt), 'h:mm a')}</p>
    </button>
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
    <Dialog open={!!round} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        {round ? (
          <>
            <DialogHeader>
              <DialogTitle>{round.name}</DialogTitle>
              <DialogDescription>Interview round</DialogDescription>
            </DialogHeader>
            <RoundDetails round={round} />
            <div className="flex justify-end">
              <Button asChild>
                <a href={interviewRoundRoomUrl(round)} target="_blank" rel="noreferrer">
                  {interviewRoundRoomLabel(round)}
                </a>
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RoundDetails({ round }: { round: InterviewRoundCalendarEvent }) {
  const start = new Date(round.scheduledAt);
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        {interviewRoundStatus(round)} · {round.delivery === 'online' ? 'Online' : 'In person'} ·{' '}
        {round.mode === 'exam' ? 'Exam' : 'Feedback'}
        {round.recordingEnabled ? ' · Recording on' : ''}
      </p>
      <p>{format(start, 'EEE d MMM · h:mm a')}</p>
      <People title="Students" people={round.students} />
      <People title="Tutors" people={round.tutors} />
    </div>
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
