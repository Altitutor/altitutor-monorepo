'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  ResourceAccessDenied,
  ResourceFileViewer,
  ResourcesBackLink,
  ResourcesBreadcrumb,
  ResourcesPager,
  type ResourceSidebarItem,
  ResourcesSidebar,
  useResourceAccessBySubject,
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
import { StudentPageContainer } from '@/shared/components/layouts';

export default function ResourceFileDetailPage() {
  const params = useParams<{ subjectShortName: string; topicCode: string; fileCode: string }>();
  const subjectShortName = params.subjectShortName;
  const topicCode = params.topicCode;
  const fileCode = params.fileCode;

  const { data: subject, isLoading: subjectLoading } = useResourceSubject(subjectShortName);
  const { data: topic, isLoading: topicLoading } = useResourceTopic(subject?.id ?? null, topicCode);
  const { data: file, isLoading: fileLoading } = useResourceTopicFile(topic?.id ?? null, fileCode);
  const { data: topicFiles } = useResourceTopicFiles(topic?.id ?? null);
  const { data: signedUrl } = useResourceSignedFileUrl(topic?.id ?? null, fileCode);
  const { data: accessBySubject } = useResourceAccessBySubject();

  const hasAccess = Boolean(subject?.id && accessBySubject?.get(subject.id)?.length);

  const sidebarItems = useMemo((): ResourceSidebarItem[] => {
    if (!topicFiles?.length) return [];
    const fileHref = (code: string) =>
      `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}/${encodeURIComponent(code.toLowerCase())}`;

    const grouped = groupFilesByType(topicFiles);
    return Object.entries(grouped).flatMap(([type, typeFiles]) => {
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
    });
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
    const toEntry = (f: typeof file | null) =>
      f
        ? {
            href: fileHref(f.code),
            label: buildResourceFileTitle(f, topic?.name ?? null, topicFiles),
          }
        : null;
    return { prev: toEntry(prevFile), next: toEntry(nextFile) };
  }, [file, topicFiles, topic?.name, subjectShortName, topicCode]);

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

  const topicLabel =
    topic?.code && topic?.name
      ? `Topic ${topic.code} · ${topic.name}`
      : topic?.code
        ? `Topic ${topic.code}`
        : topicCode;
  const topicHref = `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}`;

  return (
    <StudentPageContainer className="space-y-8">
      <ResourcesBreadcrumb
        items={[
          { label: 'Resources', href: '/resources' },
          {
            label:
              subject?.long_name || subject?.name || subject?.short_name || subjectShortName,
            href: `/resources/${encodeURIComponent(subjectShortName)}`,
          },
          { label: topicLabel, href: topicHref },
          { label: file?.code || fileCode },
        ]}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {fileTitle ?? file?.code ?? fileCode}
            </h1>
            <p className="mt-1 truncate text-muted-foreground">{file?.filename}</p>
          </div>

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
          <ResourcesBackLink
            href={topicHref}
            label={`Back to ${topicLabel}`}
            className="hidden lg:inline-flex"
          />
          <ResourcesSidebar title="Files in this topic" items={sidebarItems} className="hidden lg:block" />
          <ResourcesPager prev={prev} next={next} ariaLabel="File navigation" />
        </div>
      </div>
    </StudentPageContainer>
  );
}
