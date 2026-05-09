'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  ResourceAccessDenied,
  ResourcesBreadcrumb,
  TopicTree,
  useResourceAccessBySubject,
  useResourceFileCountsBySubject,
  useResourceSubject,
  useResourceTopics,
} from '@/features/resources';
import { buildTopicTree } from '@/features/resources/lib/helpers';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentCardCn } from '@/shared/lib/student-visual';

export default function ResourceSubjectDetailPage() {
  const params = useParams<{ subjectShortName: string }>();
  const subjectShortName = params.subjectShortName;

  const { data: subject, isLoading: subjectLoading } = useResourceSubject(subjectShortName);
  const { data: topics } = useResourceTopics(subject?.id ?? null);
  const { data: fileCounts } = useResourceFileCountsBySubject(subject?.id ?? null);
  const { data: accessBySubject } = useResourceAccessBySubject();

  const hasAccess = Boolean(subject?.id && accessBySubject?.get(subject.id)?.length);

  const tree = useMemo(() => buildTopicTree(topics ?? []), [topics]);

  if (!subjectLoading && !subject) {
    return (
      <StudentPageContainer>
        <ResourceAccessDenied />
      </StudentPageContainer>
    );
  }

  if (!subjectLoading && !hasAccess) {
    return (
      <StudentPageContainer>
        <ResourceAccessDenied />
      </StudentPageContainer>
    );
  }

  return (
    <StudentPageContainer className="space-y-8">
      <ResourcesBreadcrumb
        items={[
          { label: 'Resources', href: '/resources' },
          { label: subject?.long_name || subject?.name || subject?.short_name || subjectShortName },
        ]}
      />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{subject?.long_name || subject?.name}</h1>
        <p className="mt-1 text-muted-foreground">Browse the full topic hierarchy for this subject.</p>
      </div>

      <section className={studentCardCn('p-5 sm:p-6')}>
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
    </StudentPageContainer>
  );
}
