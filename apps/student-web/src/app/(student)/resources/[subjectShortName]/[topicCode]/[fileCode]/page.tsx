'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ResourceAccessDenied,
  ResourceFileViewer,
  type ResourceSidebarItem,
  ResourcesBreadcrumb,
  ResourcesSidebar,
  useResourceAccessBySubject,
  useResourceSubject,
  useResourceTopic,
  useResourceTopicFile,
  useResourceTopicFiles,
  useResourceSignedFileUrl,
} from '@/features/resources';
import { pairFilesWithSolutions } from '@/features/resources/lib/helpers';
import { StudentPageContainer } from '@/shared/components/layouts';

export default function ResourceFileDetailPage() {
  const params = useParams<{ subjectShortName: string; topicCode: string; fileCode: string }>();
  const subjectShortName = params.subjectShortName;
  const topicCode = params.topicCode;
  const fileCode = params.fileCode;

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { data: subject, isLoading: subjectLoading } = useResourceSubject(subjectShortName);
  const { data: topic, isLoading: topicLoading } = useResourceTopic(subject?.id ?? null, topicCode);
  const { data: file, isLoading: fileLoading } = useResourceTopicFile(topic?.id ?? null, fileCode);
  const { data: topicFiles } = useResourceTopicFiles(topic?.id ?? null);
  const { data: signedUrl } = useResourceSignedFileUrl(topic?.id ?? null, fileCode);
  const { data: accessBySubject } = useResourceAccessBySubject();

  const hasAccess = Boolean(subject?.id && accessBySubject?.get(subject.id)?.length);

  const sidebarItems = useMemo(() => {
    const pairs = pairFilesWithSolutions(topicFiles ?? []);
    const rows: ResourceSidebarItem[] = [];

    for (const pair of pairs) {
      rows.push({
        key: pair.primary.id,
        label: `${pair.primary.code} · ${pair.primary.filename}`,
        href: `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}/${encodeURIComponent(pair.primary.code.toLowerCase())}`,
        active: file?.id === pair.primary.id,
      });

      if (pair.solution) {
        rows.push({
          key: pair.solution.id,
          label: `Solution · ${pair.solution.filename}`,
          href: `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}/${encodeURIComponent(pair.solution.code.toLowerCase())}`,
          active: file?.id === pair.solution.id,
        });
      }
    }

    return rows;
  }, [topicFiles, subjectShortName, topicCode, file?.id]);

  if ((!subjectLoading && !subject) || (!topicLoading && !topic) || (!fileLoading && !file)) {
    return (
      <StudentPageContainer maxWidth="6xl">
        <ResourceAccessDenied />
      </StudentPageContainer>
    );
  }

  if (!subjectLoading && !hasAccess) {
    return (
      <StudentPageContainer maxWidth="6xl">
        <ResourceAccessDenied />
      </StudentPageContainer>
    );
  }

  return (
    <StudentPageContainer maxWidth="7xl" className="space-y-8">
      <ResourcesBreadcrumb
        items={[
          { label: 'Resources', href: '/resources' },
          { label: subject?.name || subject?.short_name || subjectShortName, href: `/resources/${encodeURIComponent(subjectShortName)}` },
          { label: topic?.code && topic?.name ? `${topic.code}. ${topic.name}` : topic?.code || topicCode, href: `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}` },
          { label: file?.code || fileCode },
        ]}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          {file ? (
            <ResourceFileViewer filename={file.filename} mimetype={file.mimetype} signedUrl={signedUrl ?? null} />
          ) : null}
        </div>

        <ResourcesSidebar
          title="Topic files"
          items={sidebarItems}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
        />
      </div>
    </StudentPageContainer>
  );
}
