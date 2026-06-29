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
  useResourceSubject,
  useResourceTopic,
  useResourceTopicFiles,
} from '@/features/resources';
import {
  buildResourceFileTitle,
  flattenTopicFilesForNav,
  formatResourceTypeLabel,
  groupFilesByType,
  pairFilesWithSolutions,
} from '@/features/resources/lib/helpers';
import { FlashcardManager } from '@/features/flashcards';
import { TutorPageContainer } from '@/shared/components/layouts';

export default function TutorFlashcardsPage() {
  const params = useParams<{ subjectShortName: string; topicCode: string }>();
  const subjectShortName = params.subjectShortName;
  const topicCode = params.topicCode;
  const { data: subject, isLoading: subjectLoading } = useResourceSubject(subjectShortName);
  const { data: topic, isLoading: topicLoading } = useResourceTopic(subject?.id ?? null, topicCode);
  const { data: topicFiles } = useResourceTopicFiles(topic?.id ?? null);

  const subjectLabel = subject?.long_name || subject?.name || subject?.short_name || subjectShortName;
  const subjectHref = `/resources/${encodeURIComponent(subjectShortName)}`;
  const topicLabel = topic?.code && topic?.name ? `Topic ${topic.code} · ${topic.name}` : topicCode;
  const topicHref = `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}`;
  const flashcardsHref = `${topicHref}/flashcards`;

  const sidebarItems = useMemo((): ResourceSidebarItem[] => {
    const fileHref = (code: string) =>
      `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}/${encodeURIComponent(code.toLowerCase())}`;
    const fileGroups = topicFiles?.length
      ? Object.entries(groupFilesByType(topicFiles)).flatMap(([type, typeFiles]) => {
          const pairs = pairFilesWithSolutions(typeFiles);
          const items: ResourceSidebarItem[] = pairs.map(({ primary, solution }) => ({
            key: primary.id,
            label: `${primary.code} · ${primary.filename}`,
            href: fileHref(primary.code),
            children: solution
              ? [
                  {
                    key: solution.id,
                    label: `${solution.code} · ${solution.filename}`,
                    href: fileHref(solution.code),
                  },
                ]
              : undefined,
          }));

          return [
            {
              key: `type-${type}`,
              label: formatResourceTypeLabel(type),
              children: items,
            },
          ];
        })
      : [];

    return [
      ...fileGroups,
      {
        key: 'flashcards',
        label: 'Flashcards',
        href: flashcardsHref,
        active: true,
      },
    ];
  }, [flashcardsHref, subjectShortName, topicCode, topicFiles]);

  const { prev } = useMemo(() => {
    if (!topicFiles?.length) return { prev: null };
    const flat = flattenTopicFilesForNav(topicFiles);
    const lastFile = flat.at(-1) ?? null;
    return {
      prev: lastFile
        ? {
            href: `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}/${encodeURIComponent(lastFile.code.toLowerCase())}`,
            label: buildResourceFileTitle(lastFile, topic?.name ?? null, topicFiles),
          }
        : null,
    };
  }, [subjectShortName, topic?.name, topicCode, topicFiles]);

  if ((!subjectLoading && !subject) || (!topicLoading && !topic)) {
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
          { label: subjectLabel, href: subjectHref },
          { label: topicLabel, href: topicHref },
          { label: 'Flashcards' },
        ]}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-6">
          {topic?.id ? <FlashcardManager topicId={topic.id} /> : null}
        </div>

        <div className="flex w-full flex-col gap-3 lg:sticky lg:top-6 lg:w-72 lg:shrink-0 lg:self-start">
          <ResourcesBackLink
            href={topicHref}
            label={`Back to ${topicLabel}`}
            className="hidden lg:inline-flex"
          />
          <ResourcesSidebar title="Files in this topic" items={sidebarItems} className="hidden lg:block" />
          <ResourcesPager prev={prev} next={null} ariaLabel="File navigation" />
        </div>
      </div>
    </TutorPageContainer>
  );
}
