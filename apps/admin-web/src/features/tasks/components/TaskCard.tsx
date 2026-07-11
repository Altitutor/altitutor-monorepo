'use client';

import type { EntityListPillColumn } from '@altitutor/ui';
import { clickableCardInteractiveCn, cn } from '@/shared/utils/index';
import type { TaskWithAssignee } from '../types';

interface TaskCardProps {
  task: TaskWithAssignee;
  onClick?: () => void;
  visiblePillKeys?: string[];
  rightPills?: EntityListPillColumn<TaskWithAssignee, unknown>[];
}

export function TaskCard({ task, onClick, visiblePillKeys = [], rightPills = [] }: TaskCardProps) {
  const visiblePills = rightPills.filter((pill) => visiblePillKeys.includes(pill.key));

  return (
    <div
      onClick={onClick}
      className={cn(
        'group rounded-lg border bg-card p-3 cursor-pointer transition-all',
        'space-y-2',
        clickableCardInteractiveCn
      )}
    >
      {/* Title */}
      <div className="font-medium text-sm">
        {task.title ?? ''}
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
              {pill.renderPill(task, () => {}, false)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
