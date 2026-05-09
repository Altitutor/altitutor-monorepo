'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  ResourceAccessDenied,
  type ResourceSidebarItem,
  ResourcesBreadcrumb,
  ResourcesSidebar,
  TopicFilesList,
  TopicTree,
  useResourceAccessBySubject,
  useResourceSubject,
  useResourceTopic,
  useResourceTopicFiles,
  useResourceTopics,
} from '@/features/resources';
import { buildTopicTree, findTopicNodeInTree } from '@/features/resources/lib/helpers';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentCardCn } from '@/shared/lib/student-visual';
import type { ResourceTopicNode } from '@/features/resources/lib/types';

export default function ResourceTopicDetailPage() {
  const params = useParams<{ subjectShortName: string; topicCode: string }>();
  const subjectShortName = params.subjectShortName;
  const topicCode = params.topicCode;

  const { data: subject, isLoading: subjectLoading } = useResourceSubject(subjectShortName);
  const { data: topic, isLoading: topicLoading } = useResourceTopic(subject?.id ?? null, topicCode);
  const { data: topicFiles, isLoading: filesLoading } = useResourceTopicFiles(topic?.id ?? null);
  const { data: subjectTopics } = useResourceTopics(subject?.id ?? null);
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

  const subtopicNodes = useMemo(() => {
    if (!topic?.id || !subjectTopics?.length) return [];
    const tree = buildTopicTree(subjectTopics);
    const node = findTopicNodeInTree(tree, topic.id);
    return node?.children ?? [];
  }, [subjectTopics, topic?.id]);

  if ((!subjectLoading && !subject) || (!topicLoading && !topic)) {
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
          },
        ]}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {topic?.code && topic?.name
                ? `Topic ${topic.code} · ${topic.name}`
                : topic?.code
                  ? `Topic ${topic.code}`
                  : topicCode}
            </h1>
            <p className="text-muted-foreground mt-1">Files organised by type, with solutions paired where present.</p>
          </div>

          {filesLoading ? (
            <div className="space-y-3">
              <div className="h-14 rounded-2xl bg-muted/50 ring-1 ring-black/[0.05] dark:ring-white/10" />
              <div className="h-14 rounded-2xl bg-muted/50 ring-1 ring-black/[0.05] dark:ring-white/10" />
              <div className="h-14 rounded-2xl bg-muted/50 ring-1 ring-black/[0.05] dark:ring-white/10" />
            </div>
          ) : (
            <TopicFilesList
              files={topicFiles ?? []}
              getFileHref={(fileCode) =>
                `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}/${encodeURIComponent(fileCode.toLowerCase())}`
              }
            />
          )}

          {subtopicNodes.length > 0 ? (
            <section className={studentCardCn('p-5 sm:p-6')} aria-labelledby="subtopics-heading">
              <div className="mb-4">
                <h2 id="subtopics-heading" className="text-lg font-semibold">
                  Subtopics
                </h2>

              </div>
              <TopicTree
                nodes={subtopicNodes}
                getHref={(t) =>
                  `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(t.code.toLowerCase())}`
                }
              />
            </section>
          ) : null}
        </div>

        <ResourcesSidebar title="All topics" items={sidebarItems} />
      </div>
    </StudentPageContainer>
  );
}
