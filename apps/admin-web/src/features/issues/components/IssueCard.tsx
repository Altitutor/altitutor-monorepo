'use client';

import type { EntityListPillColumn } from '@altitutor/ui';
import type { IssueWithTags } from '../types';
import { clickableCardInteractiveCn, cn } from '@/shared/utils';

interface IssueCardProps {
  issue: IssueWithTags;
  visiblePillKeys?: string[];
  rightPills?: EntityListPillColumn<IssueWithTags, unknown>[];
  onClick?: () => void;
}

export function IssueCard({ issue, onClick, visiblePillKeys = [], rightPills = [] }: IssueCardProps) {
  const visiblePills = rightPills.filter((pill) => visiblePillKeys.includes(pill.key));

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex cursor-pointer flex-col gap-2 rounded-lg border bg-card p-3 transition-all',
        clickableCardInteractiveCn,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium line-clamp-2">
          {issue.name ?? ''}
        </h4>
      </div>

      {visiblePills.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {visiblePills.map((pill) => (
            <div
              key={pill.key}
              className="max-w-full"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {pill.renderPill(issue, () => {}, false)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
