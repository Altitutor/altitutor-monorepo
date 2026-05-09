'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { groupFilesByType, pairFilesWithSolutions } from '../lib/helpers';
import type { ResourceFile } from '../lib/types';
import { cn } from '@/shared/utils';
import { studentCardCn } from '@/shared/lib/student-visual';

function typeLabel(type: string) {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

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
        return (
          <section key={type}>
            <h3 className="mb-3 text-lg font-semibold">{typeLabel(type)}</h3>
            <div className="space-y-3">
              {pairs.map(({ primary, solution }) => (
                <div
                  key={primary.id}
                  className={cn(
                    studentCardCn('group relative overflow-hidden p-4'),
                    'hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] focus-within:-translate-y-0.5 focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.32)] dark:focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.32)]'
                  )}
                >
                  <Link
                    href={getFileHref(primary.code)}
                    className="absolute inset-0 z-0 rounded-2xl"
                    aria-label={`Open ${primary.filename}`}
                  />
                  <div className="pointer-events-none relative z-[1] flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium leading-snug tracking-tight text-card-foreground transition-colors duration-300 group-hover:text-brand-darkBlue dark:group-hover:text-brand-lightBlue">
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
