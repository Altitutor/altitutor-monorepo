'use client';

import { Badge } from '@altitutor/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import { cn } from '@/shared/utils/index';
import type { TaskWithAssignee, TaskPriority, TaskStatus } from '../types';
import {
  getPriorityColor,
  getPriorityLabel,
  getStatusColor,
  getStatusLabel,
  getUserInitials,
  getEstimateLabel,
} from '../utils/taskUtils';
import { formatShortDate, isOverdue } from '@/shared/utils/datetime';
import { Calendar, Circle, Clock, Eye, CheckCircle, FolderKanban, Link2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const TASK_STATUS_ICONS: Record<TaskStatus, typeof Circle> = {
  backlog: Circle,
  todo: Circle,
  in_progress: Clock,
  in_review: Eye,
  done: CheckCircle,
};

interface TaskCardProps {
  task: TaskWithAssignee;
  onClick?: () => void;
  visiblePillKeys?: string[];
}

export function TaskCard({ task, onClick, visiblePillKeys = [] }: TaskCardProps) {
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
  const taskStatus = (task.status ?? 'backlog') as TaskStatus;
  const StatusIcon = TASK_STATUS_ICONS[taskStatus];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'group bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary transition-colors',
        'space-y-2',
        isDragging && 'opacity-50'
      )}
    >
      {/* Title */}
      <div className="font-medium text-sm group-hover:text-primary transition-colors">
        {task.title ?? ''}
      </div>

      {/* Badges row - order: status, due date, tags, priority, estimate */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status */}
        {visiblePillKeys.includes('status') && (
          <Badge className={cn('text-xs flex items-center gap-1', getStatusColor(taskStatus))}>
            <StatusIcon className="h-3 w-3 shrink-0" />
            {getStatusLabel(taskStatus)}
          </Badge>
        )}

        {/* Due date */}
        {task.due_date && visiblePillKeys.includes('due_date') && (
          <Badge
            variant="outline"
            className={cn(
              'text-xs flex items-center gap-1',
              overdue && 'border-red-500 text-red-700 dark:text-red-400'
            )}
          >
            <Calendar className="h-3 w-3 shrink-0" />
            {formatShortDate(task.due_date)}
          </Badge>
        )}

        {/* Priority */}
        {task.priority !== 0 && visiblePillKeys.includes('priority') && (
          <Badge className={cn('text-xs', getPriorityColor((task.priority ?? 0) as TaskPriority))}>
            {getPriorityLabel((task.priority ?? 0) as TaskPriority)}
          </Badge>
        )}

        {/* Estimate */}
        {task.estimate && getEstimateLabel(task.estimate) && visiblePillKeys.includes('estimate') && (
          <Badge variant="outline" className="text-xs">
            {getEstimateLabel(task.estimate)}
          </Badge>
        )}

        {/* Issue */}
        {task.issue_id && visiblePillKeys.includes('issue_id') && (
          <Badge variant="outline" className="text-xs max-w-[220px]">
            <span className="inline-flex items-center gap-1 truncate">
              <Link2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{task.issue?.name || 'Linked issue'}</span>
            </span>
          </Badge>
        )}

        {/* Project */}
        {task.project_id && visiblePillKeys.includes('project_id') && (
          <Badge variant="outline" className="text-xs max-w-[220px]">
            <span className="inline-flex items-center gap-1 truncate">
              <FolderKanban className="h-3 w-3 shrink-0" />
              <span className="truncate">{task.project?.name || 'Linked project'}</span>
            </span>
          </Badge>
        )}
      </div>

      {/* Assignee */}
      {task.assignee && visiblePillKeys.includes('assignee') && (
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium shrink-0">
                  {assigneeInitials}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{assigneeName}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-xs text-muted-foreground truncate">{assigneeName}</span>
        </div>
      )}
    </div>
  );
}
