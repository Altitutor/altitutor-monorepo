'use client';

import Link from 'next/link';
import {
  formatResourceFileLabel,
  formatResourceTypeLabel,
  groupFilesByType,
  pairFilesWithSolutions,
} from '../lib/helpers';
import { getResourceTypeIcon } from '../lib/resource-type-icons';
import type { ResourceFile } from '../lib/types';
import {
  ClickableCardIcon,
  ClickableCardRevealChevron,
  clickableCardFocusWithinCn,
  clickableCardHoverCn,
} from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { studentCardCn } from '@/shared/lib/student-visual';

export function TopicFilesList({
  files,
  getFileHref,
  fileTypeHeadingClassName = 'mb-4 text-2xl font-semibold',
  staticDisplay = false,
}: {
  files: ResourceFile[];
  getFileHref?: (fileCode: string) => string;
  /** Override for denser layouts (e.g. session sheet). */
  fileTypeHeadingClassName?: string;
  /** Same card visuals without links (e.g. inside another clickable region). */
  staticDisplay?: boolean;
}) {
  if (!files.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No files available for this topic.
      </p>
    );
  }

  const grouped = groupFilesByType(files);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([type, typeFiles]) => {
        const pairs = pairFilesWithSolutions(typeFiles);
        const Icon = getResourceTypeIcon(type);
        return (
          <section key={type}>
            <h3 className={cn(fileTypeHeadingClassName)}>
              {formatResourceTypeLabel(type)}
            </h3>
            <div className="space-y-3">
              {pairs.map(({ primary, solution }) => (
                <div
                  key={primary.id}
                  className={cn(
                    'grid gap-3',
                    solution ? 'md:grid-cols-2' : undefined,
                  )}
                >
                  <TopicFileCard
                    file={primary}
                    icon={Icon}
                    getFileHref={getFileHref}
                    staticDisplay={staticDisplay}
                  />
                  {solution ? (
                    <TopicFileCard
                      file={solution}
                      icon={Icon}
                      eyebrow="Solution"
                      getFileHref={getFileHref}
                      staticDisplay={staticDisplay}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TopicFileCard({
  file,
  icon: Icon,
  eyebrow,
  getFileHref,
  staticDisplay,
}: {
  file: ResourceFile;
  icon: ReturnType<typeof getResourceTypeIcon>;
  eyebrow?: string;
  getFileHref?: (fileCode: string) => string;
  staticDisplay: boolean;
}) {
  const label = formatResourceFileLabel(file);
  const href = !staticDisplay && getFileHref ? getFileHref(file.code) : null;

  return (
    <div
      className={cn(
        studentCardCn('group relative overflow-hidden p-4'),
        href ? clickableCardHoverCn : undefined,
        href ? clickableCardFocusWithinCn : undefined,
      )}
    >
      {href ? (
        <Link
          href={href}
          className="absolute inset-0 z-0 rounded-2xl"
          aria-label={`Open ${label}`}
        />
      ) : null}
      <div
        className={cn(
          'relative z-[1] flex items-center gap-3',
          href ? 'pointer-events-none' : undefined,
        )}
      >
        <ClickableCardIcon icon={Icon} size="sm" />
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <span className="block truncate text-sm font-medium leading-snug tracking-tight text-card-foreground">
            {label}
          </span>
        </div>
        {href ? <ClickableCardRevealChevron size="sm" /> : null}
      </div>
    </div>
  );
}
