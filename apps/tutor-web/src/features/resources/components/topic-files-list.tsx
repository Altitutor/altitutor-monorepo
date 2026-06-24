'use client';

import Link from 'next/link';
import { formatResourceTypeLabel, groupFilesByType, pairFilesWithSolutions } from '@altitutor/shared';
import { getResourceTypeIcon } from '../lib/resource-type-icons';
import type { ResourceFile } from '../lib/types';
import {
  ClickableCardIcon,
  ClickableCardRevealChevron,
  clickableCardInteractiveCn,
} from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { tutorCardCn } from '@/shared/lib/tutor-visual';

export function TopicFilesList({
  files,
  getFileHref,
}: {
  files: ResourceFile[];
  getFileHref: (fileCode: string) => string;
}) {
  if (!files.length) {
    return <p className="text-sm text-muted-foreground">No files available for this topic.</p>;
  }

  const grouped = groupFilesByType(files);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([type, typeFiles]) => {
        const pairs = pairFilesWithSolutions(typeFiles);
        const Icon = getResourceTypeIcon(type);
        return (
          <section key={type}>
            <h3 className="mb-4 text-2xl font-semibold">{formatResourceTypeLabel(type)}</h3>
            <div className="space-y-3">
              {pairs.map(({ primary, solution }) => (
                <div
                  key={primary.id}
                  className={cn(
                    tutorCardCn('group relative overflow-hidden p-4'),
                    clickableCardInteractiveCn,
                  )}
                >
                  <Link
                    href={getFileHref(primary.code)}
                    className="absolute inset-0 z-0 rounded-2xl"
                    aria-label={`Open ${primary.filename}`}
                  />
                  <div className="pointer-events-none relative z-[1] flex items-center gap-3">
                    <ClickableCardIcon icon={Icon} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium leading-snug tracking-tight text-card-foreground">
                      {primary.code} · {primary.filename}
                    </span>
                    <div className="flex shrink-0 items-center gap-3">
                      {solution ? (
                        <Link
                          href={getFileHref(solution.code)}
                          className="pointer-events-auto text-xs text-muted-foreground transition-colors duration-300 hover:text-foreground"
                        >
                          Solution: {solution.filename}
                        </Link>
                      ) : null}
                      <ClickableCardRevealChevron size="sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
