'use client';

import Link from 'next/link';
import { groupFilesByType, pairFilesWithSolutions } from '../lib/helpers';
import type { ResourceFile } from '../lib/types';

function typeLabel(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
                <div key={primary.id} className="rounded-lg border bg-card p-3 shadow-sm transition-shadow duration-200 hover:shadow-md">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={getFileHref(primary.code)} className="text-sm font-medium hover:underline">
                      {primary.code} · {primary.filename}
                    </Link>
                    {solution ? (
                      <Link href={getFileHref(solution.code)} className="text-xs text-muted-foreground hover:underline">
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
