'use client';

import { Calendar, Circle, Clock, CheckCircle } from 'lucide-react';
import type { IssueWithTags, IssueStatus } from '../types';
import { cn } from '@/shared/utils';
import { Badge } from '@altitutor/ui';
import { formatShortDate, isOverdue } from '@/shared/utils/datetime';
import { getIssueStatusColor, getIssueStatusLabel } from '../utils/issueUtils';

interface IssueCardProps {
  issue: IssueWithTags;
  visiblePillKeys?: string[];
  onClick?: () => void;
}

export function IssueCard({ issue, onClick, visiblePillKeys = [] }: IssueCardProps) {
  const status = issue.status as IssueStatus;
  const Icon = status === 'open' ? Circle : status === 'awaiting_response' ? Clock : CheckCircle;
  const overdue = isOverdue(issue.due_date);

  return (
    <div
      onClick={onClick}
      className="group flex flex-col gap-2 p-3 bg-card border rounded-lg hover:border-primary transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
          {issue.name ?? ''}
        </h4>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Status */}
        {visiblePillKeys.includes('status') && (
          <Badge className={cn('text-xs flex items-center gap-1', getIssueStatusColor(status))}>
            <Icon className="h-3 w-3 shrink-0" />
            {getIssueStatusLabel(status)}
          </Badge>
        )}

        {/* Due date */}
        {issue.due_date && visiblePillKeys.includes('due_date') && (
          <Badge
            variant="outline"
            className={cn(
              'text-xs flex items-center gap-1',
              overdue && 'border-red-500 text-red-700 dark:text-red-400'
            )}
          >
            <Calendar className="h-3 w-3 shrink-0" />
            {formatShortDate(issue.due_date)}
          </Badge>
        )}

        {/* Tags */}
        {issue.tags.length > 0 && visiblePillKeys.includes('tags') && (
          <Badge variant="outline" className="text-xs opacity-80">
            {issue.tags.length} tags
          </Badge>
        )}
      </div>
    </div>
  );
}
