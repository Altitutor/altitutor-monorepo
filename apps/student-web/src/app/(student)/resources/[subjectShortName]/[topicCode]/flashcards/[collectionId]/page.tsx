'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@altitutor/ui';
import {
  ResourceAccessDenied,
  ResourcesBackLink,
  ResourcesBreadcrumb,
  useResourceAccessBySubject,
  useResourceSubject,
  useResourceTopic,
} from '@/features/resources';
import {
  FlashcardReviewSession,
  useFlashcardCollections,
  useFlashcardReviewCards,
} from '@/features/flashcards';
import { StudentPageContainer } from '@/shared/components/layouts';
import { cn } from '@/shared/utils';

export default function FlashcardCollectionPage() {
  const params = useParams<{ subjectShortName: string; topicCode: string; collectionId: string }>();
  const [mode, setMode] = useState<'due' | 'all'>('due');

  const { data: subject, isLoading: subjectLoading } = useResourceSubject(params.subjectShortName);
  const { data: topic, isLoading: topicLoading } = useResourceTopic(subject?.id ?? null, params.topicCode);
  const { data: accessBySubject } = useResourceAccessBySubject();
  const { data: collections } = useFlashcardCollections(topic?.id ?? null);
  const { data: cards, isLoading: cardsLoading } = useFlashcardReviewCards(params.collectionId, mode);

  const hasAccess = Boolean(subject?.id && accessBySubject?.get(subject.id)?.length);
  const collection = useMemo(
    () => collections?.find((item) => item.id === params.collectionId) ?? null,
    [collections, params.collectionId],
  );

  if ((!subjectLoading && !subject) || (!topicLoading && !topic) || (!subjectLoading && !hasAccess)) {
    return (
      <StudentPageContainer>
        <ResourceAccessDenied />
      </StudentPageContainer>
    );
  }

  const subjectLabel = subject?.long_name || subject?.name || subject?.short_name || params.subjectShortName;
  const subjectHref = `/resources/${encodeURIComponent(params.subjectShortName)}`;
  const topicLabel = topic?.code && topic?.name ? `Topic ${topic.code} · ${topic.name}` : params.topicCode;
  const topicHref = `/resources/${encodeURIComponent(params.subjectShortName)}/${encodeURIComponent(params.topicCode)}`;

  return (
    <StudentPageContainer className="space-y-8">
      <ResourcesBreadcrumb
        items={[
          { label: 'Resources', href: '/resources' },
          { label: subjectLabel, href: subjectHref },
          { label: topicLabel, href: topicHref },
          { label: collection?.title ?? 'Flashcards' },
        ]}
      />

      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-3">
          <ResourcesBackLink href={topicHref} label={`Back to ${topicLabel}`} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{collection?.title ?? 'Flashcards'}</h1>
              {collection?.description ? (
                <p className="mt-1 text-muted-foreground">{collection.description}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 rounded-lg border bg-background p-1">
              <Button
                variant="ghost"
                className={cn(mode === 'due' && 'bg-muted')}
                onClick={() => setMode('due')}
              >
                Due
              </Button>
              <Button
                variant="ghost"
                className={cn(mode === 'all' && 'bg-muted')}
                onClick={() => setMode('all')}
              >
                Study all
              </Button>
            </div>
          </div>
        </div>

        {cardsLoading ? (
          <div className="h-64 rounded-2xl bg-muted/50" />
        ) : (
          <FlashcardReviewSession collectionId={params.collectionId} mode={mode} cards={cards ?? []} />
        )}

        <div className="text-center text-sm text-muted-foreground">
          <Link href={topicHref} className="underline underline-offset-4">
            Return to topic resources
          </Link>
        </div>
      </div>
    </StudentPageContainer>
  );
}
