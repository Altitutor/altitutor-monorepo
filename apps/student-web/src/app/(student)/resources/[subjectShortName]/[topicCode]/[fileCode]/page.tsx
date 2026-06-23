'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@altitutor/ui';
import {
  ResourceAccessDenied,
  ResourceFileViewer,
  ResourcesBreadcrumb,
  TopicResourceSidebar,
  buildTopicResourceSidebarItems,
  useResourceAccessBySubject,
  useResourceSubject,
  useResourceTopic,
  useResourceTopicFile,
  useResourceTopicFiles,
  useResourceSignedFileUrl,
} from '@/features/resources';
import { useFlashcardTopic } from '@/features/flashcards';
import {
  buildResourceFileTitle,
  flattenTopicFilesForNav,
} from '@/features/resources/lib/helpers';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentBtnOutline } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

export default function ResourceFileDetailPage() {
  const params = useParams<{ subjectShortName: string; topicCode: string; fileCode: string }>();
  const subjectShortName = params.subjectShortName;
  const topicCode = params.topicCode;
  const fileCode = params.fileCode;

  const { data: subject, isLoading: subjectLoading } = useResourceSubject(subjectShortName);
  const { data: topic, isLoading: topicLoading } = useResourceTopic(subject?.id ?? null, topicCode);
  const { data: file, isLoading: fileLoading } = useResourceTopicFile(topic?.id ?? null, fileCode);
  const { data: topicFiles } = useResourceTopicFiles(topic?.id ?? null);
  const { data: flashcardTopic } = useFlashcardTopic(topic?.id ?? null);
  const { data: signedUrl } = useResourceSignedFileUrl(topic?.id ?? null, fileCode);
  const { data: accessBySubject } = useResourceAccessBySubject();

  const hasAccess = Boolean(subject?.id && accessBySubject?.get(subject.id)?.length);

  const flashcardsHref = `/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}/flashcards`;
  const sidebarItems = useMemo(
    () =>
      buildTopicResourceSidebarItems({
        topicFiles: topicFiles ?? [],
        activeFileId: file?.id ?? null,
        subjectShortName,
        topicCode,
        flashcardsHref,
        showFlashcards: Boolean(flashcardTopic?.review_card_count),
      }),
    [flashcardTopic?.review_card_count, flashcardsHref, file?.id, subjectShortName, topicCode, topicFiles],
  );

  const fileTitle = useMemo(() => {
    if (!file) return null;
    return buildResourceFileTitle(file, topic?.name ?? null, topicFiles ?? []);
  }, [file, topic?.name, topicFiles]);

  const counterpartFile = useMemo(() => {
    if (!file || !topicFiles?.length) return null;
    if (file.isSolutions) {
      if (!file.isSolutionsOfId) return null;
      return topicFiles.find((f) => f.id === file.isSolutionsOfId) ?? null;
    }
    return topicFiles.find((f) => f.isSolutions && f.isSolutionsOfId === file.id) ?? null;
  }, [file, topicFiles]);

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
          <div className="space-y-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {fileTitle ?? file?.code ?? fileCode}
              </h1>
              <p className="mt-1 truncate text-muted-foreground">{file?.filename}</p>
            </div>
            {counterpartFile ? (
              <Button asChild variant="outline" size="sm" className={cn(studentBtnOutline, 'gap-1.5')}>
                <Link
                  href={`/resources/${encodeURIComponent(subjectShortName)}/${encodeURIComponent(topicCode)}/${encodeURIComponent(counterpartFile.code.toLowerCase())}`}
                >
                  {file?.isSolutions ? (
                    <>
                      <ArrowLeft className="h-4 w-4" />
                      <span>View questions</span>
                    </>
                  ) : (
                    <>
                      <span>View solutions</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Link>
              </Button>
            ) : null}
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

        <TopicResourceSidebar
          topicHref={topicHref}
          topicLabel={topicLabel}
          items={sidebarItems}
          prev={prev}
          next={next}
          pagerLabel="File navigation"
        />
      </div>
    </StudentPageContainer>
  );
}
