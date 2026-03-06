'use client';

import { Calendar, Circle, Clock3, CheckCircle2, Flag } from 'lucide-react';
import type { ProjectWithLead, ProjectStatus, ProjectPriority } from '../types';
import { cn } from '@/shared/utils';
import { Badge } from '@altitutor/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import { formatShortDate, isOverdue } from '@/shared/utils/datetime';
import {
  getProjectStatusColor,
  getProjectStatusLabel,
  getProjectPriorityColor,
  getProjectPriorityLabel,
} from '../utils/projectUtils';
import { getUserInitials } from '@/shared/utils';

const PROJECT_STATUS_ICONS: Record<ProjectStatus, typeof Circle> = {
  backlog: Circle,
  planned: Clock3,
  in_progress: Flag,
  completed: CheckCircle2,
};

interface ProjectCardProps {
  project: ProjectWithLead;
  visiblePillKeys?: string[];
  onClick?: () => void;
}

export function ProjectCard({ project, onClick, visiblePillKeys = [] }: ProjectCardProps) {
  const status = project.status as ProjectStatus;
  const StatusIcon = PROJECT_STATUS_ICONS[status];
  const overdue = isOverdue(project.target_date ?? undefined);
  const projectLead = project.project_lead;
  const leadInitials = projectLead
    ? getUserInitials(projectLead.first_name, projectLead.last_name)
    : null;
  const leadName = projectLead
    ? `${projectLead.first_name ?? ''} ${projectLead.last_name ?? ''}`.trim() || 'Unnamed'
    : 'No lead';

  return (
    <div
      onClick={onClick}
      className="group flex flex-col gap-2 p-3 bg-card border rounded-lg hover:border-primary transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
          {project.name ?? ''}
        </h4>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Status */}
        {visiblePillKeys.includes('status') && (
          <Badge className={cn('text-xs flex items-center gap-1', getProjectStatusColor(status))}>
            <StatusIcon className="h-3 w-3 shrink-0" />
            {getProjectStatusLabel(status)}
          </Badge>
        )}

        {/* Start/target date */}
        {(project.start_date || project.target_date) && visiblePillKeys.includes('dates') && (
          <Badge
            variant="outline"
            className={cn(
              'text-xs flex items-center gap-1',
              overdue && 'border-red-500 text-red-700 dark:text-red-400'
            )}
          >
            <Calendar className="h-3 w-3 shrink-0" />
            {project.start_date && project.target_date
              ? `${formatShortDate(project.start_date)} → ${formatShortDate(project.target_date)}`
              : formatShortDate(project.target_date ?? project.start_date)}
          </Badge>
        )}

        {/* Priority */}
        {(project.priority ?? 0) > 0 && visiblePillKeys.includes('priority') && (
          <Badge className={cn('text-xs', getProjectPriorityColor((project.priority ?? 0) as ProjectPriority))}>
            {getProjectPriorityLabel((project.priority ?? 0) as ProjectPriority)}
          </Badge>
        )}
      </div>

      {/* Project lead */}
      {visiblePillKeys.includes('project_lead') && (
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium shrink-0">
                {leadInitials ?? '?'}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{leadName}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-xs text-muted-foreground truncate">{leadName}</span>
      </div>
      )}
    </div>
  );
}
