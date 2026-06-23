'use client';

import { useParams } from 'next/navigation';
import {
  ResourceAccessDenied,
  ResourcesBackLink,
  ResourcesBreadcrumb,
  useResourceSubject,
  useResourceTopic,
} from '@/features/resources';
import { FlashcardManager } from '@/features/flashcards';
import { TutorPageContainer } from '@/shared/components/layouts';

export default function TutorFlashcardsPage() {
  const params = useParams<{ subjectShortName: string; topicCode: string }>();
  const { data: subject, isLoading: subjectLoading } = useResourceSubject(params.subjectShortName);
  const { data: topic, isLoading: topicLoading } = useResourceTopic(subject?.id ?? null, params.topicCode);

  if ((!subjectLoading && !subject) || (!topicLoading && !topic)) {
    return (
      <TutorPageContainer>
        <ResourceAccessDenied />
      </TutorPageContainer>
    );
  }

  const subjectLabel = subject?.long_name || subject?.name || subject?.short_name || params.subjectShortName;
  const subjectHref = `/resources/${encodeURIComponent(params.subjectShortName)}`;
  const topicLabel = topic?.code && topic?.name ? `Topic ${topic.code} · ${topic.name}` : params.topicCode;
  const topicHref = `/resources/${encodeURIComponent(params.subjectShortName)}/${encodeURIComponent(params.topicCode)}`;

  return (
    <TutorPageContainer className="space-y-8">
      <ResourcesBreadcrumb
        items={[
          { label: 'Resources', href: '/resources' },
          { label: subjectLabel, href: subjectHref },
          { label: topicLabel, href: topicHref },
          { label: 'Flashcards' },
        ]}
      />

      <div className="space-y-6">
        <ResourcesBackLink href={topicHref} label={`Back to ${topicLabel}`} />
        {topic?.id ? <FlashcardManager topicId={topic.id} /> : null}
      </div>
    </TutorPageContainer>
  );
}
