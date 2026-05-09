'use client';

import Link from 'next/link';
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
            <div className="space-y-2">
              {pairs.map(({ primary, solution }) => (
                <div
                  key={primary.id}
                  className={cn(
                    studentCardCn('group relative overflow-hidden p-3.5'),
                    'hover:bg-muted/40 focus-within:bg-muted/40'
                  )}
                >
                  <Link
                    href={getFileHref(primary.code)}
                    className="absolute inset-0 z-0 rounded-2xl"
                    aria-label={`Open ${primary.filename}`}
                  />
                  <div className="relative z-[1] flex items-center justify-between gap-3 pointer-events-none">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {primary.code} · {primary.filename}
                    </span>
                    {solution ? (
                      <Link
                        href={getFileHref(solution.code)}
                        className="pointer-events-auto shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Solution: {solution.filename}
                      </Link>
                    ) : null}
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
