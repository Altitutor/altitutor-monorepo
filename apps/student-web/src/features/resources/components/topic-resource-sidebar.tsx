'use client';

import {
  formatResourceTypeLabel,
  groupFilesByType,
  pairFilesWithSolutions,
} from '../lib/helpers';
import type { ResourceFile } from '../lib/types';
import { ResourcesBackLink, ResourcesPager } from './resources-nav';
import { type ResourceSidebarItem, ResourcesSidebar } from './resources-sidebar';

type PagerEntry = {
  href: string;
  label: string;
} | null;

export function buildTopicResourceSidebarItems({
  topicFiles,
  activeFileId,
  subjectShortName,
  topicCode,
  flashcardsHref,
  flashcardsActive = false,
  showFlashcards = false,
}: {
  topicFiles: ResourceFile[];
  activeFileId?: string | null;
  subjectShortName: string;
  topicCode: string;
  flashcardsHref: string;
  flashcardsActive?: boolean;
  showFlashcards?: boolean;
}): ResourceSidebarItem[] {
  const fileHref = (code: string) =>
    `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}/${encodeURIComponent(code.toLowerCase())}`;

  const grouped = groupFilesByType(topicFiles);
  const fileItems = Object.entries(grouped).flatMap(([type, typeFiles]) => {
    const pairs = pairFilesWithSolutions(typeFiles);
    const items: ResourceSidebarItem[] = pairs.map(({ primary, solution }) => ({
      key: primary.id,
      label: `${primary.code} · ${primary.filename}`,
      href: fileHref(primary.code),
      active: primary.id === activeFileId,
      children: solution
        ? [
            {
              key: solution.id,
              label: `${solution.code} · ${solution.filename}`,
              href: fileHref(solution.code),
              active: solution.id === activeFileId,
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
  });

  return [
    ...fileItems,
    ...(showFlashcards
      ? [
          {
            key: 'topic-flashcards',
            label: 'Flashcards',
            href: flashcardsHref,
            active: flashcardsActive,
          },
        ]
      : []),
  ];
}

export function TopicResourceSidebar({
  topicHref,
  topicLabel,
  items,
  prev,
  next,
  pagerLabel,
}: {
  topicHref: string;
  topicLabel: string;
  items: ResourceSidebarItem[];
  prev?: PagerEntry;
  next?: PagerEntry;
  pagerLabel?: string;
}) {
  return (
    <div className="flex w-full flex-col gap-3 lg:sticky lg:top-6 lg:w-72 lg:shrink-0 lg:self-start">
      <ResourcesBackLink
        href={topicHref}
        label={`Back to ${topicLabel}`}
        className="hidden lg:inline-flex"
      />
      <ResourcesSidebar title="Files in this topic" items={items} className="hidden lg:block" />
      {pagerLabel ? <ResourcesPager prev={prev ?? null} next={next ?? null} ariaLabel={pagerLabel} /> : null}
    </div>
  );
}
