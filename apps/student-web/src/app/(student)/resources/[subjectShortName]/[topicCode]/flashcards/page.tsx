'use client';

import { useParams } from 'next/navigation';
import {
  ResourceAccessDenied,
  ResourcesBreadcrumb,
  TopicResourceSidebar,
  buildTopicResourceSidebarItems,
  useResourceAccessBySubject,
  useResourceSubject,
  useResourceTopic,
  useResourceTopicFiles,
} from '@/features/resources';
import {
  FlashcardReviewSession,
  useFlashcardReviewCards,
  useFlashcardTopic,
} from '@/features/flashcards';
import { StudentPageContainer } from '@/shared/components/layouts';

export default function FlashcardsPage() {
  const params = useParams<{ subjectShortName: string; topicCode: string }>();

  const { data: subject, isLoading: subjectLoading } = useResourceSubject(params.subjectShortName);
  const { data: topic, isLoading: topicLoading } = useResourceTopic(subject?.id ?? null, params.topicCode);
  const { data: topicFiles } = useResourceTopicFiles(topic?.id ?? null);
  const { data: accessBySubject } = useResourceAccessBySubject();
  const { data: flashcardTopic } = useFlashcardTopic(topic?.id ?? null);
  const { data: cards, isLoading: cardsLoading } = useFlashcardReviewCards(topic?.id ?? null, 'all');

  const hasAccess = Boolean(subject?.id && accessBySubject?.get(subject.id)?.length);

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
  const flashcardsHref = `${topicHref}/flashcards`;
  const sidebarItems = buildTopicResourceSidebarItems({
    topicFiles: topicFiles ?? [],
    subjectShortName: params.subjectShortName,
    topicCode: params.topicCode,
    flashcardsHref,
    flashcardsActive: true,
    showFlashcards: true,
  });

  return (
    <StudentPageContainer className="space-y-8">
      <ResourcesBreadcrumb
        items={[
          { label: 'Resources', href: '/resources' },
          { label: subjectLabel, href: subjectHref },
          { label: topicLabel, href: topicHref },
          { label: 'Flashcards' },
        ]}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-6">
          <div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Flashcards</h1>
              <p className="mt-1 text-muted-foreground">
                {flashcardTopic?.due_review_card_count ?? 0} due · {flashcardTopic?.review_card_count ?? 0} cards
              </p>
            </div>
          </div>

          {cardsLoading ? (
            <div className="h-64 rounded-2xl bg-muted/50" />
          ) : topic?.id ? (
            <FlashcardReviewSession topicId={topic.id} mode="all" cards={cards ?? []} />
          ) : null}
        </div>

        <TopicResourceSidebar
          topicHref={topicHref}
          topicLabel={topicLabel}
          items={sidebarItems}
        />
      </div>
    </StudentPageContainer>
  );
}
