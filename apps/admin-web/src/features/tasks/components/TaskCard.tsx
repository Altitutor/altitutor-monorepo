'use client';

import { Badge } from '@altitutor/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import { cn } from '@/shared/utils/index';
import type { TaskWithAssignee, TaskPriority } from '../types';
import { getPriorityColor, getPriorityLabel, isOverdue, formatDueDate, getUserInitials, getEstimateLabel } from '../utils/taskUtils';
import { Calendar } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskTextWithTags } from './fields/TaskTextWithTags';

interface TaskCardProps {
  task: TaskWithAssignee;
  onClick?: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const assigneeInitials = task.assignee
    ? getUserInitials(task.assignee.first_name, task.assignee.last_name)
    : null;
  const assigneeName = task.assignee
    ? `${task.assignee.first_name} ${task.assignee.last_name}`
    : 'Unassigned';

  const overdue = isOverdue(task.due_date);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow',
        'space-y-2',
        isDragging && 'opacity-50'
      )}
    >
      {/* Title */}
      <div className="font-medium text-sm">
        <TaskTextWithTags text={task.title} />
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Priority */}
        {task.priority !== 0 && (
          <Badge className={cn('text-xs', getPriorityColor((task.priority ?? 0) as TaskPriority))}>
            {getPriorityLabel((task.priority ?? 0) as TaskPriority)}
          </Badge>
        )}

        {/* Estimate */}
        {task.estimate && getEstimateLabel(task.estimate) && (
          <Badge variant="outline" className="text-xs">
            {getEstimateLabel(task.estimate)}
          </Badge>
        )}

        {/* Due date */}
        {task.due_date && (
          <Badge
            variant="outline"
            className={cn(
              'text-xs flex items-center gap-1',
              overdue && 'border-red-500 text-red-700 dark:text-red-400'
            )}
          >
            <Calendar className="h-3 w-3" />
            {formatDueDate(task.due_date)}
          </Badge>
        )}
      </div>

      {/* Assignee */}
      {task.assignee && (
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium">
                  {assigneeInitials}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{assigneeName}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-xs text-muted-foreground">{assigneeName}</span>
        </div>
      )}
    </div>
  );
}

