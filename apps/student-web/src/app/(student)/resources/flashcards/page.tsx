'use client';

import { ResourcesBreadcrumb } from '@/features/resources';
import { FlashcardReviewSession, useDueFlashcardReviewCards } from '@/features/flashcards';
import { StudentPageContainer } from '@/shared/components/layouts';

export default function DueFlashcardsPage() {
  const { data: cards, isLoading: cardsLoading } = useDueFlashcardReviewCards();

  return (
    <StudentPageContainer className="space-y-8">
      <ResourcesBreadcrumb
        items={[
          { label: 'Resources', href: '/resources' },
          { label: 'Flashcards' },
        ]}
      />

      <div className="space-y-6">
        <div id="tour-flashcards-header">
          <h1 className="text-3xl font-bold tracking-tight">Flashcards</h1>
          <p className="mt-1 text-muted-foreground">{cards?.length ?? 0} due now</p>
        </div>

        {cardsLoading ? (
          <div className="h-64 rounded-2xl bg-muted/50" />
        ) : (
          <FlashcardReviewSession
            topicId="due-all"
            mode="due"
            cards={cards ?? []}
            emptyDescription="There are no due flashcards right now."
          />
        )}
      </div>
    </StudentPageContainer>
  );
}
