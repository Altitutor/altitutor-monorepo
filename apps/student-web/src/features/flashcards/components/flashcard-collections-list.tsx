'use client';

import Link from 'next/link';
import { ArrowRight, Layers } from 'lucide-react';
import type { FlashcardCollection } from '@altitutor/shared';
import { studentCardCn } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

export function FlashcardCollectionsList({
  collections,
  getCollectionHref,
}: {
  collections: FlashcardCollection[];
  getCollectionHref: (collectionId: string) => string;
}) {
  if (!collections.length) return null;

  return (
    <section>
      <h3 className="mb-4 text-2xl font-semibold">Flashcards</h3>
      <div className="space-y-3">
        {collections.map((collection) => (
          <div
            key={collection.id}
            className={cn(
              studentCardCn('group relative overflow-hidden p-4'),
              'hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] focus-within:-translate-y-0.5 focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.08)]',
            )}
          >
            <Link
              href={getCollectionHref(collection.id)}
              className="absolute inset-0 z-0 rounded-2xl"
              aria-label={`Open ${collection.title}`}
            />
            <div className="pointer-events-none relative z-[1] flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Layers className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-snug tracking-tight text-card-foreground transition-colors duration-300 group-hover:text-brand-darkBlue">
                  {collection.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {collection.due_review_card_count ?? 0} due · {collection.review_card_count ?? 0} cards
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
