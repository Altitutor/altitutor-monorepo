'use client';

import { Calendar, Circle, Clock3, CheckCircle2, Flag } from 'lucide-react';
import type { ProjectWithLead, ProjectStatus } from '../types';
import { cn } from '@/shared/utils';
import { Badge } from '@altitutor/ui';
import { formatProjectDate } from '../utils/projectUtils';
import { TextWithTags } from '@/shared/components/TextWithTags';

interface ProjectCardProps {
  project: ProjectWithLead;
  onClick?: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const status = project.status as ProjectStatus;
  const color = status === 'backlog'
    ? 'text-muted-foreground'
    : status === 'planned'
      ? 'text-blue-500'
      : status === 'in_progress'
        ? 'text-yellow-500'
        : 'text-green-500';
  const Icon = status === 'backlog' ? Circle : status === 'planned' ? Clock3 : status === 'in_progress' ? Flag : CheckCircle2;

  return (
    <div
      onClick={onClick}
      className="group flex flex-col gap-2 p-3 bg-card border rounded-lg hover:border-primary transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
          <TextWithTags text={project.name} />
        </h4>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className={cn('flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider', color)}>
          <Icon className="h-3 w-3" />
          <span>{status.replace('_', ' ')}</span>
        </div>

        {(project.priority ?? 0) > 0 && (
          <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal">
            P{project.priority}
          </Badge>
        )}

        {project.target_date && (
          <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatProjectDate(project.target_date)}
          </Badge>
        )}
      </div>
    </div>
  );
}
