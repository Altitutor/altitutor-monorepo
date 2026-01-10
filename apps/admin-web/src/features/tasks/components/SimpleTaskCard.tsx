'use client';

import { Badge } from '@altitutor/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { cn } from '@/shared/utils/index';
import type { TaskWithAssignee, TaskStatus, TaskPriority } from '../types';
import { getPriorityColor, getPriorityLabel, getStatusColor, getStatusLabel, isOverdue, formatDueDate, getUserInitials } from '../utils/taskUtils';
import { Calendar } from 'lucide-react';
import { useUpdateTask } from '../api/mutations';

interface SimpleTaskCardProps {
  task: TaskWithAssignee;
  onClick?: () => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

export function SimpleTaskCard({ task, onClick }: SimpleTaskCardProps) {
  const updateTask = useUpdateTask();
  const assigneeInitials = task.assignee
    ? getUserInitials(task.assignee.first_name, task.assignee.last_name)
    : null;
  const assigneeName = task.assignee
    ? `${task.assignee.first_name} ${task.assignee.last_name}`
    : 'Unassigned';

  const overdue = isOverdue(task.due_date);
  const descriptionPreview = task.description
    ? task.description.length > 100
      ? `${task.description.substring(0, 100)}...`
      : task.description
    : null;

  const handleStatusChange = (newStatus: TaskStatus, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (newStatus !== task.status) {
      updateTask.mutate({
        id: task.id,
        updates: { status: newStatus },
      });
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger card click if clicking on status dropdown
    if ((e.target as HTMLElement).closest('[role="menu"]')) {
      return;
    }
    onClick?.();
  };

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'bg-card border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors',
        'flex flex-col gap-2'
      )}
    >
      {/* Top row - Title/Description on left, Status on right */}
      <div className="flex items-start justify-between gap-3">
        {/* Left side - Title, description, assignee */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title */}
          <div className="font-medium text-sm">{task.title}</div>

          {/* Description preview */}
          {descriptionPreview && (
            <div className="text-xs text-muted-foreground line-clamp-2">
              {descriptionPreview}
            </div>
          )}

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

        {/* Right side - Status pill */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'text-xs cursor-pointer px-2 py-0.5 rounded-md font-medium transition-all flex-shrink-0',
                'hover:opacity-90 hover:scale-105 hover:shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current',
                getStatusColor(task.status as TaskStatus)
              )}
            >
              {getStatusLabel(task.status as TaskStatus)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {STATUS_OPTIONS.map((status) => (
              <DropdownMenuItem
                key={status.value}
                onClick={(e) => handleStatusChange(status.value, e)}
                className={cn(
                  task.status === status.value && 'bg-muted'
                )}
              >
                {status.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Bottom row - Other badges inline */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Priority */}
        {task.priority !== 0 && (
          <Badge className={cn('text-xs', getPriorityColor((task.priority ?? 0) as TaskPriority))}>
            {getPriorityLabel((task.priority ?? 0) as TaskPriority)}
          </Badge>
        )}

        {/* Estimate */}
        {task.estimate && (
          <Badge variant="outline" className="text-xs">
            {task.estimate} pts
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
    </div>
  );
}

