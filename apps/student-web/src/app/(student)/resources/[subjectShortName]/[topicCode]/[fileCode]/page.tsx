'use client';

import { useMemo } from 'react';
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
  useResourceTopics,
  useResourceSignedFileUrl,
} from '@/features/resources';
import { buildTopicTree } from '@/features/resources/lib/helpers';
import { StudentPageContainer } from '@/shared/components/layouts';
import type { ResourceTopicNode } from '@/features/resources/lib/types';

export default function ResourceFileDetailPage() {
  const params = useParams<{ subjectShortName: string; topicCode: string; fileCode: string }>();
  const subjectShortName = params.subjectShortName;
  const topicCode = params.topicCode;
  const fileCode = params.fileCode;

  const { data: subject, isLoading: subjectLoading } = useResourceSubject(subjectShortName);
  const { data: topic, isLoading: topicLoading } = useResourceTopic(subject?.id ?? null, topicCode);
  const { data: file, isLoading: fileLoading } = useResourceTopicFile(topic?.id ?? null, fileCode);
  const { data: subjectTopics } = useResourceTopics(subject?.id ?? null);
  const { data: signedUrl } = useResourceSignedFileUrl(topic?.id ?? null, fileCode);
  const { data: accessBySubject } = useResourceAccessBySubject();

  const hasAccess = Boolean(subject?.id && accessBySubject?.get(subject.id)?.length);

  const sidebarItems = useMemo(() => {
    const toSidebarItem = (node: ResourceTopicNode): ResourceSidebarItem => ({
      key: node.id,
      label: `${node.code} · ${node.name}`,
      href: `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(node.code.toLowerCase())}`,
      active: node.id === topic?.id,
      children: node.children.map(toSidebarItem),
    });

    return buildTopicTree(subjectTopics ?? []).map(toSidebarItem);
  }, [subjectTopics, topic?.id, subjectShortName]);

  if ((!subjectLoading && !subject) || (!topicLoading && !topic) || (!fileLoading && !file)) {
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
          { label: subject?.name || subject?.short_name || subjectShortName, href: `/resources/${encodeURIComponent(subjectShortName)}` },
          {
            label:
              topic?.code && topic?.name
                ? `Topic ${topic.code} · ${topic.name}`
                : topic?.code
                  ? `Topic ${topic.code}`
                  : topicCode,
            href: `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}`,
          },
          { label: file?.code || fileCode },
        ]}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          {file ? (
            <ResourceFileViewer
              filename={file.filename}
              mimetype={file.mimetype}
              resourceType={file.type}
              externalUrl={file.externalUrl}
              signedUrl={signedUrl ?? null}
            />
          ) : null}
        </div>

        <ResourcesSidebar title="All topics" items={sidebarItems} />
      </div>
    </StudentPageContainer>
  );
}
