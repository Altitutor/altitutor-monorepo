'use client';

import { ResourcesBreadcrumb } from '@/features/resources';
import { FlashcardReviewSession, useDueFlashcardReviewCards } from '@/features/flashcards';
import {
  ManageFlashcardsDialog,
  type FlashcardManageFilter,
} from '@/features/flashcards/components/manage-flashcards-dialog';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentCardCn } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';
import type { FlashcardSubjectStudySummary } from '@altitutor/shared';
import { Alert, AlertDescription, AlertTitle, Button, clickableCardInteractiveCn } from '@altitutor/ui';
import { Settings, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type UndoCommandError = Error & {
  code?: string;
  status?: number;
};

const undoConflictRetryDelayMs = 100;

function formatStudyCounts(counts: { new: number; learning: number; review: number }) {
  return `${counts.new} new + ${counts.learning} learning + ${counts.review} review`;
}

function formatCardTotal(total: number) {
  return `${total} ${total === 1 ? 'card' : 'cards'}`;
}

function StudyChoice({
  href,
  title,
  total,
  counts,
}: {
  href: string;
  title: string;
  total: number;
  counts: { new: number; learning: number; review: number };
}) {
  return (
    <Link href={href} className={cn(studentCardCn('block p-4'), clickableCardInteractiveCn)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="shrink-0 text-sm text-muted-foreground">{formatCardTotal(total)}</p>
      </div>
      <p className="mt-2 text-sm tabular-nums text-muted-foreground">{formatStudyCounts(counts)}</p>
    </Link>
  );
}

async function submitUndoCommand(command: { requestId: string; answerLogId: string }): Promise<void> {
  const response = await fetch('/api/flashcards/review-cards/undo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (response.ok) return;

  const body = await response.json().catch(() => null) as { error?: string; code?: string } | null;
  const error = new Error(body?.error ?? 'Undo failed') as UndoCommandError;
  error.code = body?.code;
  error.status = response.status;
  throw error;
}

export default function DueFlashcardsPage() {
  const searchParams = useSearchParams();
  const [manageOpen, setManageOpen] = useState(false);
  const [manageFilter, setManageFilter] = useState<FlashcardManageFilter>('all');
  const [queueRevision, setQueueRevision] = useState(0);
  const [answerPending, setAnswerPending] = useState(false);
  const [undoAnswerLogId, setUndoAnswerLogId] = useState<string | null>(null);
  const [undoPending, setUndoPending] = useState(false);
  const undoPendingRef = useRef(false);
  const [undoMessage, setUndoMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const studyAll = searchParams.get('study') === 'all';
  const subjectId = searchParams.get('subject');
  const studying = studyAll || Boolean(subjectId);
  const menu = useDueFlashcardReviewCards();
  const selectedSubject = subjectId
    ? menu.data?.subjects.find((subject) => subject.id === subjectId) ?? null
    : null;
  const subjectStudy = useDueFlashcardReviewCards(subjectId ? selectedSubject?.topicIds ?? null : null);
  const snapshot = studyAll ? menu.data : subjectStudy.data;
  const cardsError = studyAll ? menu.error : subjectStudy.error;
  const cardsLoading = studyAll
    ? menu.isLoading
    : Boolean(subjectId) && (menu.isLoading || !menu.data || subjectStudy.isLoading);
  const refetch = studyAll ? menu.refetch : subjectStudy.refetch;
  const wasStudyingRef = useRef(false);
  useEffect(() => {
    if (wasStudyingRef.current && !studying) void menu.refetch();
    wasStudyingRef.current = studying;
  }, [menu.refetch, studying]);
  const subjectChoices = (menu.data?.subjects ?? []).filter((subject) => subject.total > 0);
  const undoLatest = async () => {
    if (answerPending || undoPendingRef.current || !undoAnswerLogId) return;
    undoPendingRef.current = true;
    setUndoPending(true);
    setUndoMessage(null);
    const command = { requestId: crypto.randomUUID(), answerLogId: undoAnswerLogId };
    try {
      try {
        await submitUndoCommand(command);
      } catch (error) {
        const commandError = error as UndoCommandError;
        if (commandError.status !== 409 || commandError.code !== 'flashcard_command_in_progress') throw error;
        await new Promise((resolve) => window.setTimeout(resolve, undoConflictRetryDelayMs));
        await submitUndoCommand(command);
      }
      const refreshed = await refetch();
      if (refreshed.error) throw refreshed.error;
      setQueueRevision((current) => current + 1);
      setUndoAnswerLogId(null);
      setUndoMessage({ kind: 'success', text: 'Your last answer was undone.' });
    } catch (error) {
      const commandError = error as UndoCommandError;
      const noAnswer = error instanceof Error && error.message.includes('no_flashcard_answer_to_undo');
      const staleAnswer = commandError.code === 'flashcard_undo_conflict';
      if (staleAnswer) setUndoAnswerLogId(null);
      setUndoMessage({
        kind: 'error',
        text: noAnswer
          ? 'There is no answer to undo.'
          : staleAnswer
            ? 'That answer can no longer be undone because the card has changed.'
            : 'Your last answer could not be undone. Please try again.',
      });
    } finally {
      undoPendingRef.current = false;
      setUndoPending(false);
    }
  };
  const openManager = (filter: FlashcardManageFilter) => {
    setManageFilter(filter);
    setManageOpen(true);
  };

  return (
    <StudentPageContainer className="flex h-[calc(100dvh-var(--navbar-height))] min-h-0 flex-col overflow-hidden py-4 md:h-[calc(100dvh-var(--navbar-height)-1.5rem)] md:py-4">
      <header id="tour-flashcards-header" className="shrink-0 space-y-3 pb-4">
        <ResourcesBreadcrumb
          items={[
            { label: 'Resources', href: '/resources' },
            { label: 'Flashcards', href: studying ? '/resources/flashcards' : undefined },
            ...(studying ? [{ label: studyAll ? 'Study all' : selectedSubject?.name ?? 'Subject' }] : []),
          ]}
        />
        {snapshot?.timezoneConfirmationRequired ? <Alert><AlertTitle>Confirm your study-day timezone</AlertTitle><AlertDescription>We’re using Australia/Adelaide for now. <Link className="underline" href="/settings/flashcards">Confirm or change it</Link>; studying is not blocked.</AlertDescription></Alert> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            {studyAll ? 'Study all' : selectedSubject?.name ?? 'Flashcards'}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => openManager('all')}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Manage
            </Button>
            <Button variant="outline" asChild>
              <Link href="/settings/flashcards">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
          </div>
        </div>
        {undoMessage ? (
          <div
            role={undoMessage.kind === 'error' ? 'alert' : 'status'}
            className={undoMessage.kind === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
          >
            {undoMessage.text}
          </div>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {!studying ? (
          menu.isLoading ? (
            <div className="min-h-0 flex-1" />
          ) : menu.error ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load flashcards</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>Your cards may still be due. Please try loading them again.</p>
                <Button variant="outline" size="sm" onClick={() => void menu.refetch()}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
              {(menu.data?.catalogTotal ?? 0) > 0 ? (
                <StudyChoice
                  href="/resources/flashcards?study=all"
                  title="Study all"
                  total={menu.data?.catalogTotal ?? 0}
                  counts={{
                    new: menu.data?.counts.new ?? 0,
                    learning: (menu.data?.counts.learning ?? 0) + (menu.data?.counts.relearning ?? 0),
                    review: menu.data?.counts.review ?? 0,
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No flashcards yet.</p>
              )}
              {subjectChoices.map((subject: FlashcardSubjectStudySummary) => (
                <StudyChoice
                  key={subject.id}
                  href={`/resources/flashcards?subject=${encodeURIComponent(subject.id)}`}
                  title={subject.name}
                  total={subject.total}
                  counts={subject}
                />
              ))}
            </div>
          )
        ) : subjectId && menu.data && !selectedSubject ? (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">This subject has no flashcards</h2>
            <Button variant="outline" asChild>
              <Link href="/resources/flashcards">Back to subjects</Link>
            </Button>
          </div>
        ) : cardsLoading ? (
          <div className="min-h-0 flex-1" />
        ) : cardsError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load flashcards</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>Your cards may still be due. Please try loading them again.</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <FlashcardReviewSession
            topicId={studyAll ? 'due-all' : `due-${subjectId ?? 'subject'}`}
            mode="due"
            cards={snapshot?.cards ?? []}
            queueRevision={queueRevision}
            pinnedLayout
            queueHold={snapshot ? {
              newLimit: snapshot.held.newLimit,
              reviewLimit: snapshot.held.reviewLimit,
              newBlockedByReviews: snapshot.held.newBlockedByReviews,
              futureLearning: snapshot.held.futureLearning,
              nextDueAt: snapshot.nextDueAt,
            } : undefined}
            onAnswerPendingChange={setAnswerPending}
            onAnswerCommitted={(answerLogId) => {
              setUndoAnswerLogId(answerLogId);
              setUndoMessage(null);
            }}
            onUndo={() => { void undoLatest(); }}
            undoDisabled={!undoAnswerLogId || answerPending || undoPending}
            undoPending={undoPending}
          />
        )}
      </div>

      <ManageFlashcardsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        initialFilter={manageFilter}
      />
    </StudentPageContainer>
  );
}
