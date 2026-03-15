'use client';

import { useState } from 'react';
import { Badge } from '@altitutor/ui';
import { useOpenIssuesByEntity } from '../api/queries';
import { EditIssueDialog } from './EditIssueDialog';
import { cn } from '@/shared/utils';
import { getIssueStatusColor, getIssueStatusIcon } from '../utils/issueUtils';

interface IssuePillProps {
  entityType: 'student' | 'staff' | 'parent' | 'class' | 'session' | 'invoice';
  entityId: string | null;
  enabled?: boolean;
  className?: string;
  /** When true, pills get max width, truncate, and show full name on hover */
  truncateWithTitle?: boolean;
}

export function IssuePill({ entityType, entityId, enabled = true, className, truncateWithTitle = false }: IssuePillProps) {
  const { data: issues = [], isLoading } = useOpenIssuesByEntity(entityType, entityId, enabled);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (!enabled || !entityId || isLoading || issues.length === 0) {
    return null;
  }

  const handleIssueClick = (issueId: string) => {
    setSelectedIssueId(issueId);
    setIsDialogOpen(true);
  };

  return (
    <>
      <div className={cn('flex items-center gap-2 flex-wrap min-w-0', className)}>
        {issues.map((issue) => {
          const Icon = getIssueStatusIcon(issue.status as 'open' | 'awaiting_response' | 'resolved');
          const colorClasses = getIssueStatusColor(issue.status as 'open' | 'awaiting_response' | 'resolved');
          const iconColor = colorClasses.replace('bg-', 'text-');

          const badgeContent = (
            <>
              <Icon className={cn('h-3 w-3 flex-shrink-0', iconColor)} />
              <span className={cn('text-xs', truncateWithTitle && 'truncate max-w-[140px] min-w-0')}>
                {issue.name ?? ''}
              </span>
            </>
          );

          return (
            <Badge
              key={issue.id}
              variant="outline"
              title={truncateWithTitle ? issue.name : undefined}
              className={cn(
                'cursor-pointer transition-colors flex items-center gap-1.5 max-w-[180px] min-w-0',
                truncateWithTitle && 'overflow-hidden',
                'hover:bg-accent hover:text-accent-foreground',
                'dark:hover:bg-accent/80 dark:hover:border-accent-foreground/20'
              )}
              onClick={() => handleIssueClick(issue.id)}
            >
              {badgeContent}
            </Badge>
          );
        })}
      </div>

      <EditIssueDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedIssueId(null);
        }}
        issueId={selectedIssueId}
      />
    </>
  );
}
