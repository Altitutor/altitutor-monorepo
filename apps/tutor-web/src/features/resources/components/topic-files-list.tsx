'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { formatResourceTypeLabel, groupFilesByType, pairFilesWithSolutions } from '@altitutor/shared';
import { getResourceTypeAccent, getResourceTypeIcon } from '../lib/resource-type-icons';
import type { ResourceFile } from '../lib/types';
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
        const accentClass = getResourceTypeAccent(type);
        return (
          <section key={type}>
            <h3 className="mb-4 text-2xl font-semibold">{formatResourceTypeLabel(type)}</h3>
            <div className="space-y-3">
              {pairs.map(({ primary, solution }) => (
                <div
                  key={primary.id}
                  className={cn(
                    tutorCardCn('group relative overflow-hidden p-4'),
                    'hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] focus-within:-translate-y-0.5 focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.32)] dark:focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.32)]',
                  )}
                >
                  <Link
                    href={getFileHref(primary.code)}
                    className="absolute inset-0 z-0 rounded-2xl"
                    aria-label={`Open ${primary.filename}`}
                  />
                  <div className="pointer-events-none relative z-[1] flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300',
                        accentClass,
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium leading-snug tracking-tight text-card-foreground transition-colors duration-300 group-hover:text-brand-darkBlue dark:group-hover:text-brand-lightBlue">
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
                      <ArrowRight
                        className="h-4 w-4 text-muted-foreground transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-foreground"
                        aria-hidden
                      />
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
