'use client';

import Link from 'next/link';
import { Layers } from 'lucide-react';
import {
  ClickableCardIcon,
  ClickableCardRevealChevron,
  clickableCardInteractiveCn,
} from '@altitutor/ui';
import { tutorCardCn } from '@/shared/lib/tutor-visual';
import { cn } from '@/shared/utils';
import { useFlashcards } from '../hooks/useFlashcards';

export function FlashcardsTopicLink({
  topicId,
  href,
}: {
  topicId: string;
  href: string;
}) {
  const { data: cards = [] } = useFlashcards(topicId);
  const reviewCardCount = cards.reduce((total, card) => total + (card.review_card_count ?? 0), 0);

  return (
    <section>
      <h3 className="mb-4 text-2xl font-semibold">Flashcards</h3>
      <div
        className={cn(
          tutorCardCn('group relative overflow-hidden p-4'),
          clickableCardInteractiveCn,
        )}
      >
        <Link href={href} className="absolute inset-0 z-0 rounded-2xl" aria-label="Open flashcards" />
        <div className="pointer-events-none relative z-[1] flex items-center gap-3">
          <ClickableCardIcon icon={Layers} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-snug tracking-tight text-card-foreground">
              Topic flashcards
            </p>
            <p className="text-xs text-muted-foreground">
              {cards.length} cards · {reviewCardCount} clozes
            </p>
          </div>
          <ClickableCardRevealChevron size="sm" />
        </div>
      </div>
    </section>
  );
}
