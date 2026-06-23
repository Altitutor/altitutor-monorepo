'use client';

import { ResourcesBreadcrumb } from '@/features/resources';
import { FlashcardReviewSession, useDueFlashcardReviewCards } from '@/features/flashcards';
import { StudentPageContainer } from '@/shared/components/layouts';

export default function DueFlashcardsPage() {
  const { data: cards, isLoading } = useDueFlashcardReviewCards();

  return (
    <StudentPageContainer className="space-y-8">
      <ResourcesBreadcrumb
        items={[
          { label: 'Resources', href: '/resources' },
          { label: 'Flashcards' },
        ]}
      />

      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Flashcards</h1>
          <p className="mt-1 text-muted-foreground">{cards?.length ?? 0} due today</p>
        </div>

        {isLoading ? (
          <div className="h-64 rounded-2xl bg-muted/50" />
        ) : (
          <FlashcardReviewSession topicId="due-all" mode="due" cards={cards ?? []} />
        )}
      </div>
    </StudentPageContainer>
  );
}
