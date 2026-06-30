'use client';

import { Button } from '@altitutor/ui';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FlashcardManager } from '@/features/flashcards';
import { useTopicById } from '@/features/topics/hooks';
import { AdminLoadingSkeleton } from '@/shared/components';

export default function TopicFlashcardsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { cardId?: string };
}) {
  const router = useRouter();
  const { id } = params;
  const { data: topic, isLoading, error } = useTopicById(id);

  if (isLoading) {
    return <AdminLoadingSkeleton variant="card" />;
  }

  if (error || !topic) {
    return (
      <div className="space-y-4 p-6">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push('/topics')}>
          <ArrowLeft className="h-4 w-4" />
          Topics
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {error ? 'Error Loading Topic' : 'Topic Not Found'}
        </h1>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.push(`/topics/${id}`)} aria-label="Back to topic">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold tracking-tight">Flashcards</h1>
          <p className="truncate text-sm text-muted-foreground">{topic.name}</p>
        </div>
      </div>

      <FlashcardManager
        topicId={id}
        title="Flashcards"
        initialCardId={searchParams.cardId ?? null}
        showOpenInPage={false}
      />
    </div>
  );
}
