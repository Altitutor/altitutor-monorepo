'use client';

import { ResourcesBreadcrumb } from '@/features/resources';
import { FlashcardReviewSession, useDueFlashcardReviewCards, type DueFlashcardQueueCounts } from '@/features/flashcards';
import {
  ManageFlashcardsDialog,
  type FlashcardManageFilter,
} from '@/features/flashcards/components/manage-flashcards-dialog';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentCardCn } from '@/shared/lib/student-visual';
import { Alert, AlertDescription, AlertTitle, Button } from '@altitutor/ui';
import { Settings, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

type UndoCommandError = Error & {
  code?: string;
  status?: number;
};

const undoConflictRetryDelayMs = 100;

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
  const [liveCounts, setLiveCounts] = useState<DueFlashcardQueueCounts | null>(null);
  const handleDueQueueChange = useCallback((counts: DueFlashcardQueueCounts) => {
    setLiveCounts(counts);
  }, []);
  const scopedTopicIds = searchParams.get('topicIds')?.split(',').filter(Boolean);
  const {
    data: snapshot,
    error: cardsError,
    isLoading: cardsLoading,
    refetch,
  } = useDueFlashcardReviewCards(scopedTopicIds);
  const counts = liveCounts ?? snapshot?.counts;
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
    <StudentPageContainer className="space-y-8">
      <ResourcesBreadcrumb
        items={[
          { label: 'Resources', href: '/resources' },
          { label: 'Flashcards' },
        ]}
      />

      <div className="space-y-6">
        {snapshot?.timezoneConfirmationRequired ? <Alert><AlertTitle>Confirm your study-day timezone</AlertTitle><AlertDescription>We’re using Australia/Adelaide for now. <Link className="underline" href="/settings/flashcards">Confirm or change it</Link>; studying is not blocked.</AlertDescription></Alert> : null}
        <div id="tour-flashcards-header" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Flashcards</h1>
              <p className="mt-1 text-muted-foreground">Review what is due across all of your subjects.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => void undoLatest()}
                disabled={!undoAnswerLogId || answerPending || undoPending}
              >
                {undoPending ? 'Undoing…' : 'Undo last answer'}
              </Button>
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

          <div className={studentCardCn('grid overflow-hidden sm:grid-cols-3 xl:grid-cols-6')} aria-label="Flashcard study status">
            <div className="p-4 sm:col-span-3 xl:col-span-1">
              <p className="text-2xl font-bold tabular-nums">{cardsError ? '—' : counts?.total ?? 0}</p>
              <p className="text-sm text-muted-foreground">Due now</p>
            </div>
            {snapshot && counts ? ([
              ['New', counts.new],
              ['Learning', counts.learning],
              ['Relearning', counts.relearning],
              ['Review', counts.review],
            ] as const).map(([state, count]) => (
              <button
                key={state}
                type="button"
                className="border-t border-border/60 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:border-l sm:border-t-0"
                onClick={() => openManager(state)}
              >
                <p className="text-xl font-semibold tabular-nums">{count}</p>
                <p className="text-sm text-muted-foreground">{state}</p>
              </button>
            )) : null}
            <button
              type="button"
              className="border-t border-border/60 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:border-l sm:border-t-0"
              onClick={() => openManager('New')}
            >
              <p className="text-xl font-semibold tabular-nums">{snapshot?.held.newLimit ?? 0}</p>
              <p className="text-sm text-muted-foreground">New held by today&apos;s limit</p>
            </button>
          </div>
        </div>

        {cardsLoading ? (
          <div className="h-64 rounded-2xl bg-muted/50" />
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
            topicId="due-all"
            mode="due"
            cards={snapshot?.cards ?? []}
            emptyDescription="There are no due flashcards right now."
            queueRevision={queueRevision}
            onAnswerPendingChange={setAnswerPending}
            onAnswerCommitted={(answerLogId) => {
              setUndoAnswerLogId(answerLogId);
              setUndoMessage(null);
            }}
            onDueQueueChange={handleDueQueueChange}
          />
        )}
        {snapshot && snapshot.nextDueAt ? (
          <p className="text-center text-sm text-muted-foreground">{snapshot.held.futureLearning} learning {snapshot.held.futureLearning === 1 ? 'card is' : 'cards are'} not due yet. Next card in {Math.max(1,Math.ceil((new Date(snapshot.nextDueAt).getTime()-Date.now())/60_000))}m.</p>
        ) : null}
        {snapshot && (snapshot.held.reviewLimit || snapshot.held.newBlockedByReviews) ? (
          <p className="text-center text-sm text-muted-foreground">
            {snapshot.held.reviewLimit ? `${snapshot.held.reviewLimit} reviews held by today’s limit. ` : ''}
            {snapshot.held.newBlockedByReviews ? `${snapshot.held.newBlockedByReviews} new cards wait until overdue reviews are cleared.` : ''}
          </p>
        ) : null}
      </div>

      <ManageFlashcardsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        initialFilter={manageFilter}
      />
    </StudentPageContainer>
  );
}
