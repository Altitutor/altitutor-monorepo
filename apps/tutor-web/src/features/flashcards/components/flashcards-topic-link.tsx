'use client';

import Link from 'next/link';
import { ArrowRight, Layers } from 'lucide-react';
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
          'hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] focus-within:-translate-y-0.5 focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.32)] dark:focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.32)]',
        )}
      >
        <Link href={href} className="absolute inset-0 z-0 rounded-2xl" aria-label="Open flashcards" />
        <div className="pointer-events-none relative z-[1] flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Layers className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-snug tracking-tight text-card-foreground transition-colors duration-300 group-hover:text-brand-darkBlue dark:group-hover:text-brand-lightBlue">
              Topic flashcards
            </p>
            <p className="text-xs text-muted-foreground">
              {cards.length} cards · {reviewCardCount} clozes
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
      </div>
    </section>
  );
}
