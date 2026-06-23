'use client';

import { useMemo, useState } from 'react';
import { Button } from '@altitutor/ui';
import type { FlashcardRating, FlashcardReviewCard } from '@altitutor/shared';
import { parseClozeParts } from '@altitutor/shared';
import { studentCardCn } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';
import { useRateFlashcardReviewCard } from '../hooks/useFlashcards';

const ratings: Array<{ value: FlashcardRating; label: string; className: string }> = [
  { value: 'again', label: 'Again', className: 'border-red-200 text-red-700 hover:bg-red-50' },
  { value: 'hard', label: 'Hard', className: 'border-amber-200 text-amber-700 hover:bg-amber-50' },
  { value: 'good', label: 'Good', className: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
  { value: 'easy', label: 'Easy', className: 'border-blue-200 text-blue-700 hover:bg-blue-50' },
];

function ClozeText({
  card,
  showAnswer,
}: {
  card: FlashcardReviewCard;
  showAnswer: boolean;
}) {
  const parts = useMemo(
    () => parseClozeParts(card.cloze_text, card.cloze_index),
    [card.cloze_index, card.cloze_text],
  );

  return (
    <p className="whitespace-pre-wrap text-xl leading-9">
      {parts.map((part, index) => {
        if (part.type === 'text') return <span key={index}>{part.text}</span>;
        if (!part.active) return <span key={index}>{part.answer}</span>;
        return (
          <span
            key={index}
            className={cn(
              'rounded-md px-2 py-1 font-semibold',
              showAnswer ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground',
            )}
          >
            {showAnswer ? part.answer : part.hint ? `... (${part.hint})` : '...'}
          </span>
        );
      })}
    </p>
  );
}

export function FlashcardReviewSession({
  collectionId,
  mode,
  cards,
}: {
  collectionId: string;
  mode: 'due' | 'all';
  cards: FlashcardReviewCard[];
}) {
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const rateMutation = useRateFlashcardReviewCard(collectionId, mode);
  const card = cards[index] ?? null;

  const goNext = () => {
    setShowAnswer(false);
    setIndex((current) => Math.min(cards.length - 1, current + 1));
  };

  if (!card) {
    return (
      <div className={studentCardCn('p-6 text-center')}>
        <h2 className="text-xl font-semibold">No cards to review</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === 'due' ? 'There are no due flashcards in this collection.' : 'This collection has no flashcards.'}
        </p>
      </div>
    );
  }

  const isLast = index >= cards.length - 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Card {index + 1} of {cards.length}
        </span>
        <span>{mode === 'due' ? 'Due review' : 'Free study'}</span>
      </div>

      <div className={studentCardCn('space-y-6 p-6')}>
        {card.title ? <p className="text-sm font-medium text-muted-foreground">{card.title}</p> : null}
        <ClozeText card={card} showAnswer={showAnswer} />
        {showAnswer && card.extra ? (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-6">
            <p className="whitespace-pre-wrap">{card.extra}</p>
          </div>
        ) : null}
      </div>

      {!showAnswer ? (
        <Button onClick={() => setShowAnswer(true)} className="w-full">
          Show answer
        </Button>
      ) : mode === 'due' ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ratings.map((rating) => (
            <Button
              key={rating.value}
              variant="outline"
              disabled={rateMutation.isPending}
              className={cn('h-12', rating.className)}
              onClick={async () => {
                await rateMutation.mutateAsync({ reviewCardId: card.id, rating: rating.value });
                if (!isLast) goNext();
              }}
            >
              {rating.label}
            </Button>
          ))}
        </div>
      ) : (
        <Button onClick={goNext} disabled={isLast} className="w-full">
          {isLast ? 'End of collection' : 'Next card'}
        </Button>
      )}
    </div>
  );
}
