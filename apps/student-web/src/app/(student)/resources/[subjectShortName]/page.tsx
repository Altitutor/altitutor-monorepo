'use client';

import { useParams } from 'next/navigation';
import {
  ResourceAccessDenied,
  ResourcesBreadcrumb,
  TopicTree,
  useResourceAccessBySubject,
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
  const { data: accessBySubject } = useResourceAccessBySubject();

  const hasAccess = Boolean(subject?.id && accessBySubject?.get(subject.id)?.length);

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

  const tree = buildTopicTree(topics ?? []);

  return (
    <StudentPageContainer className="space-y-8">
      <ResourcesBreadcrumb
        items={[
          { label: 'Resources', href: '/resources' },
          { label: subject?.name || subject?.short_name || subjectShortName },
        ]}
      />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{subject?.long_name || subject?.name}</h1>
        <p className="text-muted-foreground mt-1">Browse the full topic hierarchy for this subject.</p>
      </div>

      <section className={studentCardCn('p-5 sm:p-6')}>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Topics</h2>
        </div>
        <TopicTree
          nodes={tree}
          getHref={(topic) =>
            `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topic.code.toLowerCase())}`
          }
        />
      </section>
    </StudentPageContainer>
  );
}
