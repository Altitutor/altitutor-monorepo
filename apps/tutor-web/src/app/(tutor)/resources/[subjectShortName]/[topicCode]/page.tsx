'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  ResourceAccessDenied,
  ResourcesBackLink,
  ResourcesBreadcrumb,
  ResourcesPager,
  type ResourceSidebarItem,
  ResourcesSidebar,
  TopicFilesList,
  TopicTree,
  useResourceFileCountsBySubject,
  useResourceSubject,
  useResourceTopic,
  useResourceTopicFiles,
  useResourceTopics,
} from '@/features/resources';
import {
  buildTopicTree,
  findTopicNodeInTree,
  flattenTopicsDfs,
} from '@/features/resources/lib/helpers';
import { TutorPageContainer } from '@/shared/components/layouts';
import { tutorCardCn } from '@/shared/lib/tutor-visual';
import type { ResourceTopicNode } from '@/features/resources/lib/types';

export default function TutorResourceTopicPage() {
  const params = useParams<{ subjectShortName: string; topicCode: string }>();
  const subjectShortName = params.subjectShortName;
  const topicCode = params.topicCode;

  const { data: subject, isLoading: subjectLoading } = useResourceSubject(subjectShortName);
  const { data: topic, isLoading: topicLoading } = useResourceTopic(subject?.id ?? null, topicCode);
  const { data: topicFiles, isLoading: filesLoading } = useResourceTopicFiles(topic?.id ?? null);
  const { data: subjectTopics } = useResourceTopics(subject?.id ?? null);
  const { data: fileCounts } = useResourceFileCountsBySubject(subject?.id ?? null);

  const topicHref = (code: string) =>
    `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(code.toLowerCase())}`;

  const tree = useMemo(() => buildTopicTree(subjectTopics ?? []), [subjectTopics]);

  const sidebarItems = useMemo(() => {
    const toSidebarItem = (node: ResourceTopicNode): ResourceSidebarItem => ({
      key: node.id,
      label: `${node.code} · ${node.name}`,
      href: topicHref(node.code),
      active: node.id === topic?.id,
      children: node.children.map(toSidebarItem),
    });

    return tree.map(toSidebarItem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, topic?.id, subjectShortName]);

  const subtopicNodes = useMemo(() => {
    if (!topic?.id || !tree.length) return [];
    const node = findTopicNodeInTree(tree, topic.id);
    return node?.children ?? [];
  }, [tree, topic?.id]);

  const { prev, next } = useMemo(() => {
    if (!topic?.id || !tree.length) return { prev: null, next: null };
    const flat = flattenTopicsDfs(tree);
    const idx = flat.findIndex((n) => n.id === topic.id);
    if (idx === -1) return { prev: null, next: null };
    const prevNode = idx > 0 ? flat[idx - 1] : null;
    const nextNode = idx < flat.length - 1 ? flat[idx + 1] : null;
    const toEntry = (node: ResourceTopicNode | null) =>
      node
        ? {
            href: topicHref(node.code),
            label: `${node.code} ${node.name}`,
          }
        : null;
    return { prev: toEntry(prevNode), next: toEntry(nextNode) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, topic?.id, subjectShortName]);

  if ((!subjectLoading && !subject) || (!topicLoading && !topic)) {
    return (
      <TutorPageContainer>
        <ResourceAccessDenied />
      </TutorPageContainer>
    );
  }

  const subjectLabel =
    subject?.long_name || subject?.name || subject?.short_name || subjectShortName;
  const subjectHref = `/resources/${encodeURIComponent(subjectShortName)}`;

  return (
    <TutorPageContainer className="space-y-8">
      <ResourcesBreadcrumb
        items={[
          { label: 'Resources', href: '/resources' },
          { label: subjectLabel, href: subjectHref },
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
            <section className={tutorCardCn('p-5 sm:p-6')} aria-labelledby="subtopics-heading">
              <h2 id="subtopics-heading" className="mb-4 text-2xl font-semibold">
                Subtopics
              </h2>
              <TopicTree
                nodes={subtopicNodes}
                getHref={(t) => topicHref(t.code)}
                getCounts={(t) => ({
                  topics: t.children.length,
                  files: fileCounts?.get(t.id) ?? 0,
                })}
              />
            </section>
          ) : null}
        </div>

        <div className="flex w-full flex-col gap-3 lg:sticky lg:top-6 lg:w-72 lg:shrink-0 lg:self-start">
          <ResourcesBackLink
            href={subjectHref}
            label={`Back to ${subjectLabel}`}
            className="hidden lg:inline-flex"
          />
          <ResourcesSidebar title="All topics" items={sidebarItems} className="hidden lg:block" />
          <ResourcesPager prev={prev} next={next} ariaLabel="Topic navigation" />
        </div>
      </div>
    </TutorPageContainer>
  );
}
