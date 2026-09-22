'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ImageOcclusionViewer, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import type { FlashcardRating, FlashcardReviewCard, RateFlashcardCommand } from '@altitutor/shared';
import { getImageOcclusionGroupDescription, parseClozeParts } from '@altitutor/shared';
import { BookOpen, Check, ExternalLink, RotateCcw, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/shared/utils';
import { useRateFlashcardReviewCard } from '../hooks/useFlashcards';
import { preloadFlashcardImages, refreshFlashcardImageUrls } from '../lib/refresh-flashcard-image-urls';

const ratings: Array<{ value: FlashcardRating; label: string; key: string; className: string; description: string }> = [
  { value: 'again', label: 'Again', key: '1', description: 'You could not recall the answer.', className: 'bg-red-600 text-white hover:bg-red-700' },
  { value: 'hard', label: 'Hard', key: '2', description: 'You recalled it with serious difficulty.', className: 'bg-amber-600 text-white hover:bg-amber-700' },
  { value: 'good', label: 'Good', key: '3', description: 'You recalled it correctly.', className: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  { value: 'easy', label: 'Easy', key: '4', description: 'You recalled it effortlessly.', className: 'bg-blue-600 text-white hover:bg-blue-700' },
];

const maxSessionRequeueDelayMs = 60 * 60 * 1000;
const preloadCardCount = 4;

export type DueFlashcardQueueCounts = {
  new: number;
  learning: number;
  relearning: number;
  review: number;
  total: number;
};

const studyStatusParts = [
  {
    key: 'new',
    label: 'new',
    explanation: 'Cards you have not studied before.',
  },
  {
    key: 'learning',
    label: 'learning',
    explanation: 'Cards in learning or relearning, including cards you missed and are seeing again on a short step.',
  },
  {
    key: 'review',
    label: 'review',
    explanation: 'Cards you have learned that are due for review.',
  },
] as const;

export type FlashcardQueueHold = {
  newLimit: number;
  reviewLimit: number;
  newBlockedByReviews: number;
  futureLearning: number;
  nextDueAt: string | null;
};

function holdLines(hold: FlashcardQueueHold | undefined): string[] {
  if (!hold) return [];
  const lines: string[] = [];
  if (hold.newLimit > 0) {
    lines.push(`${hold.newLimit} new ${hold.newLimit === 1 ? 'card is' : 'cards are'} held by today's limit.`);
  }
  if (hold.reviewLimit > 0) {
    lines.push(`${hold.reviewLimit} review ${hold.reviewLimit === 1 ? 'card is' : 'cards are'} held by today's limit.`);
  }
  if (hold.newBlockedByReviews > 0) {
    lines.push(`${hold.newBlockedByReviews} new ${hold.newBlockedByReviews === 1 ? 'card waits' : 'cards wait'} until overdue reviews are cleared.`);
  }
  if (hold.futureLearning > 0 && hold.nextDueAt) {
    const minutes = Math.max(1, Math.ceil((new Date(hold.nextDueAt).getTime() - Date.now()) / 60_000));
    lines.push(`${hold.futureLearning} learning ${hold.futureLearning === 1 ? 'card is' : 'cards are'} not due yet. Next card in ${minutes}m.`);
  }
  return lines;
}

function countDueQueue(cards: FlashcardReviewCard[]): DueFlashcardQueueCounts {
  return {
    new: cards.filter((card) => card.state === 'New').length,
    learning: cards.filter((card) => card.state === 'Learning').length,
    relearning: cards.filter((card) => card.state === 'Relearning').length,
    review: cards.filter((card) => card.state === 'Review').length,
    total: cards.length,
  };
}

function insertLearningCardBehindCurrent(queue: FlashcardReviewCard[], card: FlashcardReviewCard): FlashcardReviewCard[] {
  if (queue.length === 0) return [card];
  const [current, ...upcoming] = queue;
  const dueAt = new Date(card.due_at).getTime();
  let insertAt = 0;
  while (
    insertAt < upcoming.length
    && (upcoming[insertAt].state === 'Learning' || upcoming[insertAt].state === 'Relearning')
    && new Date(upcoming[insertAt].due_at).getTime() <= dueAt
  ) {
    insertAt += 1;
  }
  return [current, ...upcoming.slice(0, insertAt), card, ...upcoming.slice(insertAt)];
}

type FeedbackState = {
  id: number;
  kind: 'correct' | 'incorrect';
  className: string;
};

function KeyBadge({ children, className }: { children: string; className?: string }) {
  return (
    <kbd className={cn('ml-2 rounded border bg-background/80 px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground', className)}>
      {children}
    </kbd>
  );
}

function clozeReviewHtml(card: FlashcardReviewCard, showAnswer: boolean): string {
  return parseClozeParts(card.cloze_text ?? '', card.cloze_index)
    .map((part) => {
      if (part.type === 'text') return part.text;
      if (!part.active) return part.answer;
      const className = showAnswer
        ? 'rounded-md bg-accent px-2 py-1 font-semibold text-brand-dark-bg'
        : 'rounded-md bg-muted px-2 py-1 font-semibold text-muted-foreground';
      return `<span class="${className}">${showAnswer ? part.answer : part.hint ? `... (${part.hint})` : '...'}</span>`;
    })
    .join('');
}

export function FlashcardReviewSession({
  topicId,
  mode,
  cards,
  emptyDescription,
  queueRevision,
  onAnswerPendingChange,
  onAnswerCommitted,
  onDueQueueChange,
  onUndo,
  undoDisabled = false,
  undoPending = false,
  queueHold,
  pinnedLayout = false,
}: {
  topicId: string;
  mode: 'due' | 'all';
  cards: FlashcardReviewCard[];
  emptyDescription?: string;
  queueRevision?: number;
  onAnswerPendingChange?: (pending: boolean) => void;
  onAnswerCommitted?: (answerLogId: string) => void;
  onDueQueueChange?: (counts: DueFlashcardQueueCounts) => void;
  onUndo?: () => void;
  undoDisabled?: boolean;
  undoPending?: boolean;
  queueHold?: FlashcardQueueHold;
  pinnedLayout?: boolean;
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [studyQueue, setStudyQueue] = useState<FlashcardReviewCard[]>(cards);
  const [dueQueue, setDueQueue] = useState<FlashcardReviewCard[]>(cards);
  const dueQueueRef = useRef(dueQueue);
  dueQueueRef.current = dueQueue;
  const reviewedDueIdsRef = useRef<Set<string>>(new Set());
  const dueTimersRef = useRef<Map<string, number>>(new Map());
  const feedbackTimerRef = useRef<number | null>(null);
  const cardShownAtRef = useRef<number>(Date.now());
  const answerInFlightRef = useRef(false);
  const queueRevisionRef = useRef(queueRevision);
  const failedCommandRef = useRef<RateFlashcardCommand | null>(null);
  const sessionKey = `${topicId}:${mode}`;
  const sessionKeyRef = useRef(sessionKey);
  const rateMutation = useRateFlashcardReviewCard(topicId, mode);
  const { mutateAsync: rateReviewCard } = rateMutation;
  const card = mode === 'all' ? studyQueue[0] ?? null : dueQueue[0] ?? null;
  const [displayCard, setDisplayCard] = useState<FlashcardReviewCard | null>(card);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isAnswerPending, setIsAnswerPending] = useState(false);
  const [buryPending, setBuryPending] = useState(false);
  const buryInFlightRef = useRef(false);
  const [imageStatus, setImageStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [imageAttempt, setImageAttempt] = useState(0);
  const freeStudyComplete = mode === 'all' && cards.length > 0 && studyQueue.length === 0;

  const showFeedback = useCallback((kind: FeedbackState['kind'], className: string) => {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    setFeedback({ id: Date.now(), kind, className });
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, 650);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!card) {
      setDisplayCard(null);
      return;
    }

    setDisplayCard(card);
    cardShownAtRef.current = Date.now();
    setImageStatus(card.card_type === 'image_occlusion' ? 'loading' : 'idle');
    setImageAttempt(0);
    void Promise.all([
      refreshFlashcardImageUrls(card.cloze_text),
      refreshFlashcardImageUrls(card.extra),
    ])
      .then(([clozeText, extra]) => {
        if (cancelled) return;
        setDisplayCard({
          ...card,
          cloze_text: clozeText,
          extra,
        });
      })
      .catch((error) => {
        console.error('Failed to refresh flashcard image URLs:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [card]);

  useEffect(() => {
    const queue = mode === 'all' ? studyQueue : dueQueue;
    const upcomingCards = queue.slice(1, preloadCardCount + 1);
    if (!upcomingCards.length) return;

    void Promise.allSettled(
      upcomingCards.flatMap((upcomingCard) => [
        upcomingCard.image_url
          ? new Promise<void>((resolve) => {
              const image = new Image();
              image.onload = () => resolve();
              image.onerror = () => resolve();
              image.src = upcomingCard.image_url!;
            })
          : preloadFlashcardImages(upcomingCard.cloze_text),
        preloadFlashcardImages(upcomingCard.extra),
      ]),
    );
  }, [dueQueue, mode, studyQueue]);

  useEffect(() => {
    const sessionChanged = sessionKeyRef.current !== sessionKey;
    const authoritativeQueueChanged = queueRevisionRef.current !== queueRevision;
    if (mode === 'all') {
      if (sessionChanged) {
        sessionKeyRef.current = sessionKey;
        setShowAnswer(false);
        setSaveError(null);
      }
      setStudyQueue(cards);
      return;
    }
    if (!sessionChanged && !authoritativeQueueChanged) return;
    sessionKeyRef.current = sessionKey;
    queueRevisionRef.current = queueRevision;
    reviewedDueIdsRef.current = new Set();
    dueTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    dueTimersRef.current.clear();
    failedCommandRef.current = null;
    setShowAnswer(false);
    setSaveError(null);
    setDueQueue(cards);
  }, [cards, mode, queueRevision, sessionKey]);

  useEffect(() => {
    if (mode !== 'due') return;
    onDueQueueChange?.(countDueQueue(dueQueue));
  }, [dueQueue, mode, onDueQueueChange]);

  useEffect(() => () => {
    dueTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    dueTimersRef.current.clear();
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
  }, []);

  useEffect(() => () => {
    onAnswerPendingChange?.(false);
  }, [onAnswerPendingChange]);

  const enqueueDueCard = useCallback((nextCard: FlashcardReviewCard) => {
    reviewedDueIdsRef.current.delete(nextCard.id);
    if (dueQueueRef.current.some((item) => item.id === nextCard.id)) return;
    setDueQueue((current) => (
      current.some((item) => item.id === nextCard.id) ? current : insertLearningCardBehindCurrent(current, nextCard)
    ));
  }, []);

  const scheduleDueCard = useCallback((nextCard: FlashcardReviewCard) => {
    const existingTimer = dueTimersRef.current.get(nextCard.id);
    if (existingTimer) window.clearTimeout(existingTimer);

    const dueAt = new Date(nextCard.due_at).getTime();
    const delayMs = dueAt - Date.now();
    if (delayMs <= 0) {
      enqueueDueCard(nextCard);
      return;
    }
    const studyDayEndsAt = nextCard.study_day_ends_at ? new Date(nextCard.study_day_ends_at).getTime() : null;
    const waitsUntilNextStudyDay = studyDayEndsAt == null
      ? delayMs > maxSessionRequeueDelayMs
      : dueAt >= studyDayEndsAt;
    if (waitsUntilNextStudyDay) return;

    const timer = window.setTimeout(() => {
      dueTimersRef.current.delete(nextCard.id);
      enqueueDueCard(nextCard);
    }, delayMs);
    dueTimersRef.current.set(nextCard.id, timer);
  }, [enqueueDueCard]);

  const rateDueCard = useCallback((rating: FlashcardRating) => {
    if (!card || mode !== 'due' || answerInFlightRef.current) return;
    setSaveError(null);
    const feedbackClassName =
      rating === 'again'
        ? 'bg-red-600 text-white'
        : rating === 'hard'
          ? 'bg-amber-600 text-white'
          : rating === 'good'
            ? 'bg-emerald-600 text-white'
            : 'bg-blue-600 text-white';
    const reviewCardId = card.id;
    const command = failedCommandRef.current?.reviewCardId === reviewCardId && failedCommandRef.current.rating === rating
      ? failedCommandRef.current
      : { reviewCardId, rating, requestId: crypto.randomUUID(), expectedRevision: card.revision,
          durationMs: Date.now() - cardShownAtRef.current,
          previewSeed: card.rating_preview_seed ?? `${card.id}:${card.revision}`, answeredAt: new Date().toISOString() };
    answerInFlightRef.current = true;
    setIsAnswerPending(true);
    onAnswerPendingChange?.(true);
    reviewedDueIdsRef.current.add(reviewCardId);
    setShowAnswer(false);
    setDueQueue((current) => current.filter((item) => item.id !== reviewCardId));
    showFeedback(rating === 'again' ? 'incorrect' : 'correct', feedbackClassName);
    void rateReviewCard(command).then((nextCard) => {
      failedCommandRef.current = null;
      if (nextCard.answer_log_id) onAnswerCommitted?.(nextCard.answer_log_id);
      const buriedSiblingIds = new Set(nextCard.buried_sibling_ids ?? []);
      if (buriedSiblingIds.size > 0) {
        for (const siblingId of buriedSiblingIds) {
          const timer = dueTimersRef.current.get(siblingId);
          if (timer) {
            window.clearTimeout(timer);
            dueTimersRef.current.delete(siblingId);
          }
          reviewedDueIdsRef.current.add(siblingId);
        }
        setDueQueue((current) => current.filter((item) => !buriedSiblingIds.has(item.id)));
      }
      scheduleDueCard(nextCard);
      if (nextCard.leech_suggested && window.confirm('This card has been repeatedly difficult. Suspend it for now?')) {
        void fetch(`/api/flashcards/review-cards/${encodeURIComponent(nextCard.id)}/manage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'suspend', requestId: crypto.randomUUID() }),
        });
      }
    }).catch((error: unknown) => {
      failedCommandRef.current = (error as { status?: number }).status === 409 ? null : command;
      reviewedDueIdsRef.current.delete(reviewCardId);
      setDueQueue((current) => current.some((item) => item.id === reviewCardId) ? current : [card, ...current]);
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
      setFeedback(null);
      setShowAnswer(true);
      setSaveError('Your answer was not saved. Please try again. Your card and progress have been restored.');
    }).finally(() => {
      answerInFlightRef.current = false;
      setIsAnswerPending(false);
      onAnswerPendingChange?.(false);
    });
  }, [card, mode, onAnswerCommitted, onAnswerPendingChange, rateReviewCard, scheduleDueCard, showFeedback]);

  const markFreeStudyCorrect = useCallback(() => {
    showFeedback('correct', 'bg-emerald-600 text-white');
    setShowAnswer(false);
    setStudyQueue((current) => current.slice(1));
  }, [showFeedback]);

  const markFreeStudyIncorrect = useCallback(() => {
    showFeedback('incorrect', 'bg-red-600 text-white');
    setShowAnswer(false);
    setStudyQueue((current) => (current.length > 1 ? [...current.slice(1), current[0]] : current));
  }, [showFeedback]);

  const buryDueCard = useCallback(() => {
    if (!card || mode !== 'due' || answerInFlightRef.current || buryInFlightRef.current) return;
    const reviewCardId = card.id;
    const buriedCard = card;
    buryInFlightRef.current = true;
    setBuryPending(true);
    setSaveError(null);
    reviewedDueIdsRef.current.add(reviewCardId);
    const timer = dueTimersRef.current.get(reviewCardId);
    if (timer) {
      window.clearTimeout(timer);
      dueTimersRef.current.delete(reviewCardId);
    }
    setShowAnswer(false);
    setDueQueue((current) => current.filter((item) => item.id !== reviewCardId));
    void fetch(`/api/flashcards/review-cards/${encodeURIComponent(reviewCardId)}/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bury', requestId: crypto.randomUUID() }),
    }).then((response) => {
      if (!response.ok) throw new Error('bury failed');
    }).catch(() => {
      reviewedDueIdsRef.current.delete(reviewCardId);
      setDueQueue((current) => (
        current.some((item) => item.id === reviewCardId) ? current : [buriedCard, ...current]
      ));
      setSaveError('This card could not be buried. Please try again.');
    }).finally(() => {
      buryInFlightRef.current = false;
      setBuryPending(false);
    });
  }, [card, mode]);

  const restartFreeStudy = useCallback(() => {
    setShowAnswer(false);
    setStudyQueue(cards);
  }, [cards]);

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'button, a, input, textarea, select, [contenteditable="true"], [role="button"], [role="menuitem"], [role="switch"], [role="checkbox"]',
        )
      ) {
        return;
      }
      if (mode === 'due' && (event.key === 'z' || event.key === 'Z') && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (!undoDisabled) onUndo?.();
        return;
      }
      if (mode === 'due' && event.key === '-' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        buryDueCard();
        return;
      }
      if (!card) return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (!showAnswer) {
          if (card.card_type === 'image_occlusion' && imageStatus !== 'loaded') return;
          setShowAnswer(true);
          return;
        }
        if (mode === 'due') {
          rateDueCard('good');
        } else {
          markFreeStudyCorrect();
        }
        return;
      }

      if (mode === 'all' && showAnswer) {
        if (event.key === '1') {
          event.preventDefault();
          markFreeStudyIncorrect();
          return;
        }
        if (event.key === '2') {
          event.preventDefault();
          markFreeStudyCorrect();
          return;
        }
      }

      if (mode !== 'due' || !showAnswer) return;
      const rating = ratings.find((item) => item.key === event.key);
      if (!rating) return;
      event.preventDefault();
      rateDueCard(rating.value);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [buryDueCard, card, imageStatus, markFreeStudyCorrect, markFreeStudyIncorrect, mode, onUndo, rateDueCard, showAnswer, undoDisabled]);

  const isImageCard = displayCard?.card_type === 'image_occlusion';
  const imageReady = !isImageCard || imageStatus === 'loaded';
  const imageUrl = displayCard?.image_url
    ? `${displayCard.image_url}${displayCard.image_url.includes('?') ? '&' : '?'}retry=${imageAttempt}`
    : null;
  const groupDescription = displayCard && showAnswer
    ? getImageOcclusionGroupDescription(displayCard.occlusion_data, displayCard.cloze_index)
    : null;
  const dueCounts = countDueQueue(dueQueue);
  const statusCounts = {
    new: dueCounts.new,
    learning: dueCounts.learning + dueCounts.relearning,
    review: dueCounts.review,
  };
  const exhaustedHoldLines = mode === 'due' && !card ? holdLines(queueHold) : [];

  return (
    <div className={cn('flex min-h-0 w-full flex-col', pinnedLayout && 'flex-1')}>
      {feedback ? (
        <div
          key={feedback.id}
          className={cn(
            'pointer-events-none fixed left-1/2 top-1/2 z-50 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-2xl animate-in fade-in-0 zoom-in-75 duration-150',
            feedback.className,
          )}
          aria-hidden="true"
        >
          {feedback.kind === 'correct' ? <Check className="h-14 w-14" /> : <X className="h-14 w-14" />}
        </div>
      ) : null}

      <div className={cn('min-w-0', pinnedLayout && 'min-h-0 flex-1 overflow-y-auto')}>
        {freeStudyComplete ? (
          <div className="py-6 text-center">
            <h2 className="text-xl font-semibold">Free study complete</h2>
            <p className="mt-2 text-sm text-muted-foreground">Every card in this topic has been marked correct.</p>
          </div>
        ) : !card || !displayCard ? (
          mode === 'due' && isAnswerPending ? (
            <div className="py-6 text-center" role="status">
              <h2 className="text-xl font-semibold">Saving answer…</h2>
              <p className="mt-2 text-sm text-muted-foreground">Your review will finish as soon as it is safely saved.</p>
            </div>
          ) : (
            <div className="space-y-2 py-6 text-center">
              <h2 className="text-xl font-semibold">{mode === 'due' ? 'No cards due' : 'No cards to review'}</h2>
              {mode === 'due' ? exhaustedHoldLines.map((line) => (
                <p key={line} className="text-sm text-muted-foreground">{line}</p>
              )) : (
                <p className="text-sm text-muted-foreground">
                  {emptyDescription ?? 'This topic has no flashcards.'}
                </p>
              )}
            </div>
          )
        ) : (
          <div className="space-y-6 py-2">
            {isImageCard && imageUrl && displayCard.occlusion_data ? (
              <div className="space-y-3">
                <ImageOcclusionViewer
                  key={`${displayCard.id}:${imageAttempt}`}
                  imageUrl={imageUrl}
                  alt={displayCard.image_alt_text ?? ''}
                  data={displayCard.occlusion_data}
                  activeClozeIndex={displayCard.cloze_index}
                  showAnswer={showAnswer}
                  onLoad={() => setImageStatus('loaded')}
                  onError={() => setImageStatus('error')}
                />
                {imageStatus === 'loading' ? <p className="text-center text-sm text-muted-foreground">Loading image…</p> : null}
                {imageStatus === 'error' ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-center">
                    <p className="text-sm text-destructive">The flashcard image could not be loaded.</p>
                    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { setImageStatus('loading'); setImageAttempt((value) => value + 1); }}>
                      <RotateCcw className="mr-1.5 h-4 w-4" />Retry
                    </Button>
                  </div>
                ) : null}
                {groupDescription ? <p className="text-sm">{groupDescription}</p> : null}
              </div>
            ) : isImageCard ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-center text-sm text-destructive">This flashcard has no accessible source image.</div>
            ) : (
              <div
                className="prose max-w-none whitespace-pre-wrap text-xl leading-9 dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: clozeReviewHtml(displayCard, showAnswer) }}
              />
            )}
            {showAnswer && displayCard.extra ? (
              <div
                className="prose prose-sm max-w-none leading-6 dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: displayCard.extra }}
              />
            ) : null}
            {showAnswer && displayCard.note_links?.length ? (
              <section className="space-y-3" aria-labelledby="flashcard-notes-heading">
                <div>
                  <h3 id="flashcard-notes-heading" className="flex items-center gap-2 text-sm font-semibold">
                    <BookOpen className="h-4 w-4" />
                    Notes and solutions
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">Review the source material for this subtopic.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {displayCard.note_links.map((noteLink) => (
                    <Button key={noteLink.id} variant="outline" size="sm" asChild>
                      <Link href={noteLink.href} target="_blank" rel="noreferrer">
                        {noteLink.is_solution ? 'Solution: ' : ''}{noteLink.label}
                        <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>

      <footer
        data-testid="flashcard-answer-controls"
        aria-busy={isAnswerPending}
        className="shrink-0 space-y-3 border-t border-border/60 pt-3"
      >
        {saveError ? (
          <div role="alert" className="text-sm text-destructive">
            {saveError}
          </div>
        ) : null}
        {mode === 'due' ? (
          <TooltipProvider delayDuration={100}>
            <p className="text-center text-sm text-muted-foreground">
              {studyStatusParts.map((part, index) => (
                <React.Fragment key={part.key}>
                  {index > 0 ? <span aria-hidden="true"> + </span> : null}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="cursor-help tabular-nums underline decoration-dotted underline-offset-4">
                        {statusCounts[part.key]} {part.label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[240px]">{part.explanation}</TooltipContent>
                  </Tooltip>
                </React.Fragment>
              ))}
            </p>
          </TooltipProvider>
        ) : (
          <TooltipProvider delayDuration={100}>
            <p className="text-center text-sm text-muted-foreground">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4">
                    {freeStudyComplete ? 'Free study complete' : `${studyQueue.length} remaining`}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[240px]">
                  Free study reviews do not count towards daily review progress or change due dates.
                </TooltipContent>
              </Tooltip>
            </p>
          </TooltipProvider>
        )}
        {isAnswerPending ? <p className="text-center text-xs text-muted-foreground" role="status">Saving answer…</p> : null}
        {mode === 'due' ? (
          <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => onUndo?.()}
              disabled={undoDisabled || undoPending || !onUndo}
            >
              {undoPending ? 'Undoing…' : 'Undo'}
              <KeyBadge>Z</KeyBadge>
            </Button>
            {card && !showAnswer ? (
              <div className="flex justify-center">
                <Button type="button" onClick={() => setShowAnswer(true)} className="px-8" disabled={!imageReady}>
                  Show answer
                  <KeyBadge>Space</KeyBadge>
                </Button>
              </div>
            ) : card && showAnswer ? (
              <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
                {ratings.map((rating) => (
                  <Button
                    key={rating.value}
                    variant="default"
                    className={cn('h-14 flex-col gap-1', rating.className)}
                    onClick={() => rateDueCard(rating.value)}
                    disabled={isAnswerPending}
                    title={rating.description}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {rating.label}
                      <KeyBadge className="ml-0 border-white/30 bg-white/20 text-white">{rating.key}</KeyBadge>
                    </span>
                    {card.rating_previews?.[rating.value]?.label ? (
                      <span className="text-xs font-medium text-white/85">{card.rating_previews[rating.value].label}</span>
                    ) : null}
                  </Button>
                ))}
              </div>
            ) : <span />}
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={buryDueCard}
              disabled={!card || isAnswerPending || buryPending}
            >
              {buryPending ? 'Burying…' : 'Bury'}
              <KeyBadge>-</KeyBadge>
            </Button>
          </div>
        ) : freeStudyComplete ? (
          <div className="flex justify-center">
            <Button onClick={restartFreeStudy} className="gap-1.5">
              <RotateCcw className="h-4 w-4" />
              Restart
            </Button>
          </div>
        ) : card && !showAnswer ? (
          <div className="flex justify-center">
            <Button type="button" onClick={() => setShowAnswer(true)} className="px-8" disabled={!imageReady}>
              Show answer
              <KeyBadge>Space</KeyBadge>
            </Button>
          </div>
        ) : card && showAnswer ? (
          <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
            <Button onClick={markFreeStudyIncorrect} className="h-12 gap-1.5 bg-red-600 text-white hover:bg-red-700">
              <X className="h-4 w-4" />
              Incorrect
              <KeyBadge className="border-white/30 bg-white/20 text-white">1</KeyBadge>
            </Button>
            <Button onClick={markFreeStudyCorrect} className="h-12 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
              <Check className="h-4 w-4" />
              Correct
              <KeyBadge className="border-white/30 bg-white/20 text-white">2</KeyBadge>
              <KeyBadge className="border-white/30 bg-white/20 text-white">Space</KeyBadge>
            </Button>
          </div>
        ) : null}
      </footer>
    </div>
  );
}
