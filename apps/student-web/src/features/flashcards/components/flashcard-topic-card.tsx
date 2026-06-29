'use client';

import Link from 'next/link';
import { Layers } from 'lucide-react';
import type { FlashcardTopic } from '@altitutor/shared';
import {
  ClickableCardIcon,
  ClickableCardRevealChevron,
  clickableCardInteractiveCn,
} from '@altitutor/ui';
import {
  studentCardCn,
} from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

export function FlashcardTopicCard({
  topic,
  href,
}: {
  topic: FlashcardTopic | null;
  href: string;
}) {
  if (!topic || !topic.review_card_count) return null;

  return (
    <section>
      <h3 className="mb-4 text-2xl font-semibold">Flashcards</h3>
      <div
        className={cn(
          studentCardCn('group relative overflow-hidden p-4'),
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
              {topic.due_review_card_count ?? 0} due · {topic.review_card_count ?? 0} cards
            </p>
          </div>
          <ClickableCardRevealChevron size="sm" />
        </div>
      </div>
    </section>
  );
}
