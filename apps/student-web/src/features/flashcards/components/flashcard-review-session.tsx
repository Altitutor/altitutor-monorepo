'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import type { FlashcardRating, FlashcardReviewCard } from '@altitutor/shared';
import { parseClozeParts } from '@altitutor/shared';
import { Check, Info, RotateCcw, X } from 'lucide-react';
import { studentCardCn } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';
import { useRateFlashcardReviewCard } from '../hooks/useFlashcards';
import { refreshFlashcardImageUrls } from '../lib/refresh-flashcard-image-urls';

const ratings: Array<{ value: FlashcardRating; label: string; key: string; className: string }> = [
  { value: 'again', label: 'Again', key: '1', className: 'bg-red-600 text-white hover:bg-red-700' },
  { value: 'hard', label: 'Hard', key: '2', className: 'bg-amber-600 text-white hover:bg-amber-700' },
  { value: 'good', label: 'Good', key: '3', className: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  { value: 'easy', label: 'Easy', key: '4', className: 'bg-blue-600 text-white hover:bg-blue-700' },
];

const maxSessionRequeueDelayMs = 60 * 60 * 1000;

function KeyBadge({ children, className }: { children: string; className?: string }) {
  return (
    <kbd className={cn('ml-2 rounded border bg-background/80 px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground', className)}>
      {children}
    </kbd>
  );
}

function clozeReviewHtml(card: FlashcardReviewCard, showAnswer: boolean): string {
  return parseClozeParts(card.cloze_text, card.cloze_index)
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
}: {
  topicId: string;
  mode: 'due' | 'all';
  cards: FlashcardReviewCard[];
  emptyDescription?: string;
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [studyQueue, setStudyQueue] = useState<FlashcardReviewCard[]>(cards);
  const [dueQueue, setDueQueue] = useState<FlashcardReviewCard[]>(cards);
  const [dueSessionTotal, setDueSessionTotal] = useState(cards.length);
  const [reviewedDueCount, setReviewedDueCount] = useState(0);
  const reviewedDueIdsRef = useRef<Set<string>>(new Set());
  const dueTimersRef = useRef<Map<string, number>>(new Map());
  const sessionKey = `${topicId}:${mode}`;
  const sessionKeyRef = useRef(sessionKey);
  const rateMutation = useRateFlashcardReviewCard(topicId, mode);
  const { mutateAsync: rateReviewCard } = rateMutation;
  const card = mode === 'all' ? studyQueue[0] ?? null : dueQueue[0] ?? null;
  const [displayCard, setDisplayCard] = useState<FlashcardReviewCard | null>(card);
  const freeStudyComplete = mode === 'all' && cards.length > 0 && studyQueue.length === 0;

  useEffect(() => {
    let cancelled = false;
    if (!card) {
      setDisplayCard(null);
      return;
    }

    setDisplayCard(card);
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
    const sessionChanged = sessionKeyRef.current !== sessionKey;
    if (sessionChanged) {
      sessionKeyRef.current = sessionKey;
      reviewedDueIdsRef.current = new Set();
      dueTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      dueTimersRef.current.clear();
      setReviewedDueCount(0);
      setShowAnswer(false);
    }
    if (mode === 'all') {
      setStudyQueue(cards);
      return;
    }
    setDueQueue(cards.filter((item) => !reviewedDueIdsRef.current.has(item.id)));
    setDueSessionTotal((current) => (sessionChanged ? cards.length : Math.max(current, cards.length)));
  }, [cards, mode, sessionKey]);

  useEffect(() => () => {
    dueTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    dueTimersRef.current.clear();
  }, []);

  const enqueueDueCard = useCallback((nextCard: FlashcardReviewCard) => {
    reviewedDueIdsRef.current.delete(nextCard.id);
    setDueQueue((current) => {
      if (current.some((item) => item.id === nextCard.id)) return current;
      return [...current, nextCard];
    });
    setDueSessionTotal((current) => current + 1);
  }, []);

  const scheduleDueCard = useCallback((nextCard: FlashcardReviewCard) => {
    const existingTimer = dueTimersRef.current.get(nextCard.id);
    if (existingTimer) window.clearTimeout(existingTimer);

    const delayMs = new Date(nextCard.due_at).getTime() - Date.now();
    if (delayMs <= 0) {
      enqueueDueCard(nextCard);
      return;
    }
    if (delayMs > maxSessionRequeueDelayMs) return;

    const timer = window.setTimeout(() => {
      dueTimersRef.current.delete(nextCard.id);
      enqueueDueCard(nextCard);
    }, delayMs);
    dueTimersRef.current.set(nextCard.id, timer);
  }, [enqueueDueCard]);

  const rateDueCard = useCallback((rating: FlashcardRating) => {
    if (!card || mode !== 'due') return;
    const reviewCardId = card.id;
    reviewedDueIdsRef.current.add(reviewCardId);
    setReviewedDueCount((current) => current + 1);
    setShowAnswer(false);
    setDueQueue((current) => current.filter((item) => item.id !== reviewCardId));
    void rateReviewCard({ reviewCardId, rating }).then(scheduleDueCard);
  }, [card, mode, rateReviewCard, scheduleDueCard]);

  const markFreeStudyCorrect = useCallback(() => {
    setShowAnswer(false);
    setStudyQueue((current) => current.slice(1));
  }, []);

  const markFreeStudyIncorrect = useCallback(() => {
    setShowAnswer(false);
    setStudyQueue((current) => (current.length > 1 ? [...current.slice(1), current[0]] : current));
  }, []);

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
      if (!card) return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (!showAnswer) {
          setShowAnswer(true);
          return;
        }
        if (mode === 'due') {
          rateDueCard('good');
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
  }, [card, markFreeStudyCorrect, markFreeStudyIncorrect, mode, rateDueCard, showAnswer]);

  if (freeStudyComplete) {
    return (
      <div className={studentCardCn('space-y-4 p-6 text-center')}>
        <div>
          <h2 className="text-xl font-semibold">Free study complete</h2>
          <p className="mt-2 text-sm text-muted-foreground">Every card in this topic has been marked correct.</p>
        </div>
        <Button onClick={restartFreeStudy} className="mx-auto gap-1.5">
          <RotateCcw className="h-4 w-4" />
          Restart
        </Button>
      </div>
    );
  }

  if (!card || !displayCard) {
    return (
      <div className={studentCardCn('p-6 text-center')}>
        <h2 className="text-xl font-semibold">No cards to review</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {emptyDescription ?? (mode === 'due' ? 'There are no due flashcards for this topic.' : 'This topic has no flashcards.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {mode === 'all'
            ? `${studyQueue.length} remaining`
            : `Card ${Math.min(reviewedDueCount + 1, dueSessionTotal)} of ${dueSessionTotal}`}
        </span>
        {mode === 'due' ? (
          <span>Due review</span>
        ) : (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1">
                  Free study
                  <Info className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[240px]">
                Free study reviews do not count towards daily review progress or change due dates.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className={studentCardCn('space-y-6 p-6')}>
        <div
          className="prose max-w-none whitespace-pre-wrap text-xl leading-9 dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: clozeReviewHtml(displayCard, showAnswer) }}
        />
        {showAnswer && displayCard.extra ? (
          <div
            className="prose prose-sm max-w-none rounded-lg border bg-muted/30 p-4 leading-6 dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: displayCard.extra }}
          />
        ) : null}
      </div>

      {!showAnswer ? (
        <Button onClick={() => setShowAnswer(true)} className="w-full">
          Show answer
          <KeyBadge>Space</KeyBadge>
        </Button>
      ) : mode === 'due' ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ratings.map((rating) => (
            <Button
              key={rating.value}
              variant="default"
              className={cn('h-14 flex-col gap-1', rating.className)}
              onClick={() => rateDueCard(rating.value)}
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
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={markFreeStudyIncorrect} className="h-12 gap-1.5 border-red-200 text-red-700 hover:bg-red-50">
            <X className="h-4 w-4" />
            Incorrect
            <KeyBadge>1</KeyBadge>
          </Button>
          <Button onClick={markFreeStudyCorrect} className="h-12 gap-1.5">
            <Check className="h-4 w-4" />
            Correct
            <KeyBadge>2</KeyBadge>
          </Button>
        </div>
      )}
    </div>
  );
}
