'use client';

import { Circle, Clock, CheckCircle } from 'lucide-react';
import type { IssueWithTags, IssueStatus } from '../types';
import { cn } from '@/shared/utils';
import { Badge } from '@altitutor/ui';

import { TextWithTags } from '@/shared/components/TextWithTags';

interface IssueCardProps {
  issue: IssueWithTags;
  visiblePillKeys?: string[];
  onClick?: () => void;
}

export function IssueCard({ issue, onClick }: IssueCardProps) {
  const status = issue.status as IssueStatus;
  const color = status === 'open' ? 'text-blue-500' : status === 'awaiting_response' ? 'text-yellow-500' : 'text-green-500';
  const Icon = status === 'open' ? Circle : status === 'awaiting_response' ? Clock : CheckCircle;

  return (
    <div
      onClick={onClick}
      className="group flex flex-col gap-2 p-3 bg-card border rounded-lg hover:border-primary transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
          <TextWithTags text={issue.name} />
        </h4>
      </div>

      <div className="flex items-center gap-2">
        <div className={cn("flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider", color)}>
          <Icon className="h-3 w-3" />
          <span>{status.replace('_', ' ')}</span>
        </div>
        
        {issue.tags.length > 0 && (
          <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal opacity-60">
            {issue.tags.length} tags
          </Badge>
        )}
      </div>
    </div>
  );
}
