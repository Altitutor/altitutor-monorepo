'use client';

import { memo } from 'react';
import type { EntityListPillColumn } from '@altitutor/ui';
import { clickableCardInteractiveCn, cn } from '@/shared/utils/index';
import type { TaskWithAssignee } from '../types';

interface TaskCardProps {
  task: TaskWithAssignee;
  onOpen?: (taskId: string) => void;
  visiblePillKeys?: string[];
  rightPills?: EntityListPillColumn<TaskWithAssignee, unknown>[];
}

export const TaskCard = memo(function TaskCard({
  task,
  onOpen,
  visiblePillKeys = [],
  rightPills = [],
}: TaskCardProps) {
  const renderedPills = rightPills
    .filter((pill) => visiblePillKeys.includes(pill.key))
    .map((pill) => ({ key: pill.key, content: pill.renderPill(task, () => {}, false) }))
    .filter((pill) => pill.content != null);

  return (
    <div
      onClick={() => onOpen?.(task.id)}
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

      {renderedPills.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {renderedPills.map((pill) => (
            <div
              key={pill.key}
              className="max-w-full"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {pill.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
