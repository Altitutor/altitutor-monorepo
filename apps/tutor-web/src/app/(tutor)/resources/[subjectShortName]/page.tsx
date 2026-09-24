'use client';

import { useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ResourceAccessDenied,
  ResourcesBreadcrumb,
  TopicTree,
  useResourceFileCountsBySubject,
  useResourceSubject,
  useResourceTopics,
} from '@/features/resources';
import { buildTopicTree, normalizeSlug } from '@/features/resources/lib/helpers';
import { TutorPageContainer } from '@/shared/components/layouts';
import { tutorCardCn } from '@/shared/lib/tutor-visual';

export default function TutorResourceSubjectPage() {
  const params = useParams<{ subjectShortName: string }>();
  const router = useRouter();
  const subjectShortName = params.subjectShortName;

  useEffect(() => {
    if (normalizeSlug(subjectShortName) === 'ucat') {
      router.replace('/ucat');
    }
  }, [router, subjectShortName]);

  const { data: subject, isLoading: subjectLoading } = useResourceSubject(subjectShortName);
  const { data: topics } = useResourceTopics(subject?.id ?? null);
  const { data: fileCounts } = useResourceFileCountsBySubject(subject?.id ?? null);

  const tree = useMemo(() => buildTopicTree(topics ?? []), [topics]);

  if (normalizeSlug(subjectShortName) === 'ucat') {
    return null;
  }

  if (!subjectLoading && !subject) {
    return (
      <TutorPageContainer>
        <ResourceAccessDenied />
      </TutorPageContainer>
    );
  }

  return (
    <TutorPageContainer className="space-y-8">
      <ResourcesBreadcrumb
        items={[
          { label: 'Resources', href: '/resources' },
          { label: subject?.long_name || subject?.name || subject?.short_name || subjectShortName },
        ]}
      />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{subject?.long_name || subject?.name}</h1>
      </div>

      <section className={tutorCardCn('p-5 sm:p-6')}>
        <h2 className="mb-4 text-2xl font-semibold">Topics</h2>
        <TopicTree
          nodes={tree}
          getHref={(topic) =>
            `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topic.code.toLowerCase())}`
          }
          getCounts={(topic) => ({
            topics: topic.children.length,
            files: fileCounts?.get(topic.id) ?? 0,
          })}
        />
      </section>
    </TutorPageContainer>
  );
}
