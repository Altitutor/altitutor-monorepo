'use client';

import { useState } from 'react';
import { Circle, Clock } from 'lucide-react';
import { Badge } from '@altitutor/ui';
import { useOpenIssuesByEntity } from '../api/queries';
import { EditIssueDialog } from './EditIssueDialog';
import { cn } from '@/shared/utils';
import { TextWithTags } from '@/shared/components/TextWithTags';

interface IssuePillProps {
  entityType: 'student' | 'staff' | 'parent' | 'class' | 'session' | 'invoice';
  entityId: string | null;
  enabled?: boolean;
  className?: string;
}

export function IssuePill({ entityType, entityId, enabled = true, className }: IssuePillProps) {
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
      <div className={cn('flex items-center gap-2 flex-wrap', className)}>
        {issues.map((issue) => {
          const Icon = issue.status === 'open' ? Circle : Clock;
          const iconColor = issue.status === 'open' ? 'text-orange-500' : 'text-yellow-500';

          return (
            <Badge
              key={issue.id}
              variant="outline"
              className={cn(
                'cursor-pointer transition-colors flex items-center gap-1.5',
                'hover:bg-accent hover:text-accent-foreground',
                'dark:hover:bg-accent/80 dark:hover:border-accent-foreground/20'
              )}
              onClick={() => handleIssueClick(issue.id)}
            >
              <Icon className={cn('h-3 w-3', iconColor)} />
              <span className="text-xs">
                <TextWithTags text={issue.name} />
              </span>
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
