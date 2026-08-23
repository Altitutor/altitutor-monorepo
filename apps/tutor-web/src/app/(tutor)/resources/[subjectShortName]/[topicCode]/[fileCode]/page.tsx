'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ResourceAccessDenied,
  ResourceFileActionsMenu,
  ResourceFileViewer,
  ResourcesPageHeader,
  ResourcesPager,
  type ResourceSidebarItem,
  ResourcesSidebar,
  useResourceSubject,
  useResourceTopic,
  useResourceTopicFile,
  useResourceTopicFiles,
  useResourceSignedFileUrl,
} from '@/features/resources';
import {
  buildResourceFileTitle,
  flattenTopicFilesForNav,
  formatResourceTypeLabel,
  groupFilesByType,
  pairFilesWithSolutions,
} from '@/features/resources/lib/helpers';
import { canPrintToOffice } from '@/features/resources/lib/file-actions';
import { useTutorOfficePrintAccess } from '@/features/office-print/hooks/useTutorOfficePrintAccess';
import { isTutorOfficePrintVisible } from '@/features/office-print/lib/tutorOfficePrintAccess';
import { OfficePrintConfirmDialog } from '@/features/office-print/components/OfficePrintConfirmDialog';
import { TutorPageContainer } from '@/shared/components/layouts';
import type { ResourceFile } from '@/features/resources/lib/types';

export default function TutorResourceFilePage() {
  const params = useParams<{ subjectShortName: string; topicCode: string; fileCode: string }>();
  const subjectShortName = params.subjectShortName;
  const topicCode = params.topicCode;
  const fileCode = params.fileCode;
  const [officePrintOpen, setOfficePrintOpen] = useState(false);
  const { access } = useTutorOfficePrintAccess();
  const officePrintEnabled = isTutorOfficePrintVisible(access);

  const { data: subject, isLoading: subjectLoading } = useResourceSubject(subjectShortName);
  const { data: topic, isLoading: topicLoading } = useResourceTopic(subject?.id ?? null, topicCode);
  const { data: file, isLoading: fileLoading } = useResourceTopicFile(topic?.id ?? null, fileCode);
  const { data: topicFiles } = useResourceTopicFiles(topic?.id ?? null);
  const { data: signedUrl } = useResourceSignedFileUrl(topic?.id ?? null, fileCode);

  const sidebarItems = useMemo((): ResourceSidebarItem[] => {
    const fileHref = (code: string) =>
      `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}/${encodeURIComponent(code.toLowerCase())}`;
    const flashcardsHref = `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}/flashcards`;

    const fileGroups = topicFiles?.length
      ? Object.entries(groupFilesByType(topicFiles)).flatMap(([type, typeFiles]) => {
          const pairs = pairFilesWithSolutions(typeFiles);
          const items: ResourceSidebarItem[] = pairs.map(({ primary, solution }) => ({
            key: primary.id,
            label: `${primary.code} · ${primary.filename}`,
            href: fileHref(primary.code),
            active: primary.id === file?.id,
            children: solution
              ? [
                  {
                    key: solution.id,
                    label: `${solution.code} · ${solution.filename}`,
                    href: fileHref(solution.code),
                    active: solution.id === file?.id,
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
      },
    ];
  }, [topicFiles, file?.id, subjectShortName, topicCode]);

  const fileTitle = useMemo(() => {
    if (!file) return null;
    return buildResourceFileTitle(file, topic?.name ?? null, topicFiles ?? []);
  }, [file, topic?.name, topicFiles]);

  const { prev, next } = useMemo(() => {
    if (!file?.id || !topicFiles?.length) return { prev: null, next: null };
    const fileHref = (code: string) =>
      `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}/${encodeURIComponent(code.toLowerCase())}`;
    const flat = flattenTopicFilesForNav(topicFiles);
    const idx = flat.findIndex((f) => f.id === file.id);
    if (idx === -1) return { prev: null, next: null };
    const prevFile = idx > 0 ? flat[idx - 1] : null;
    const nextFile = idx < flat.length - 1 ? flat[idx + 1] : null;
    const toEntry = (navFile: ResourceFile | null) =>
      navFile
        ? {
            href: fileHref(navFile.code),
            label: buildResourceFileTitle(navFile, topic?.name ?? null, topicFiles),
          }
        : null;
    return { prev: toEntry(prevFile), next: toEntry(nextFile) };
  }, [file, topicFiles, topic?.name, subjectShortName, topicCode]);

  if ((!subjectLoading && !subject) || (!topicLoading && !topic) || (!fileLoading && !file)) {
    return (
      <TutorPageContainer>
        <ResourceAccessDenied />
      </TutorPageContainer>
    );
  }

  const topicLabel =
    topic?.code && topic?.name
      ? `Topic ${topic.code} · ${topic.name}`
      : topic?.code
        ? `Topic ${topic.code}`
        : topicCode;
  const topicHref = `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}`;
  const subjectLabel =
    subject?.long_name || subject?.name || subject?.short_name || subjectShortName;

  return (
    <TutorPageContainer className="space-y-8">
      <ResourcesPageHeader
        title={fileTitle ?? file?.code ?? fileCode}
        backHref={topicHref}
        backLabel={`Back to ${topicLabel}`}
        breadcrumbs={[
          { label: 'Resources', href: '/resources' },
          {
            label: subjectLabel,
            href: `/resources/${encodeURIComponent(subjectShortName)}`,
          },
          { label: topicLabel, href: topicHref },
          { label: file?.code || fileCode },
        ]}
        actions={
          file && officePrintEnabled && canPrintToOffice(file) ? (
            <ResourceFileActionsMenu
              file={file}
              onPrintToOffice={() => setOfficePrintOpen(true)}
              trigger="labeled"
            />
          ) : null
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-6">
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

        <div className="flex w-full flex-col gap-3 lg:sticky lg:top-6 lg:w-72 lg:shrink-0 lg:self-start">
          <ResourcesSidebar title="Files in this topic" items={sidebarItems} className="hidden lg:block" />
          <ResourcesPager prev={prev} next={next} ariaLabel="File navigation" />
        </div>
      </div>
      <OfficePrintConfirmDialog
        open={officePrintOpen}
        onOpenChange={setOfficePrintOpen}
        fileId={file?.fileId ?? null}
        filename={file?.filename ?? 'document.pdf'}
      />
    </TutorPageContainer>
  );
}
