'use client';

import { Select, SelectContent, SelectItem, SelectTrigger } from '@altitutor/ui';
import { Circle, AlertCircle, AlertTriangle, Info, Gauge } from 'lucide-react';
import { cn } from '@/shared/utils';
import type { ProjectPriority } from '../../types';
import { getProjectPriorityLabel, getProjectPriorityIconColor } from '../../utils/projectUtils';

const PRIORITY_OPTIONS: { value: ProjectPriority; label: string }[] = [
  { value: 0, label: 'No priority' },
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
];

function getPriorityIcon(priority: ProjectPriority) {
  switch (priority) {
    case 1:
      return AlertCircle;
    case 2:
      return AlertTriangle;
    case 3:
      return Gauge;
    case 4:
      return Info;
    case 0:
    default:
      return Circle;
  }
}

interface ProjectPriorityEntityPillProps {
  priority: ProjectPriority;
  collapsed?: boolean;
  onChange: (priority: ProjectPriority) => void;
}

export function ProjectPriorityEntityPill({
  priority,
  collapsed,
  onChange,
}: ProjectPriorityEntityPillProps) {
  const label = getProjectPriorityLabel(priority);
  const iconColor = getProjectPriorityIconColor(priority);
  const Icon = getPriorityIcon(priority);
  const isEmpty = priority === 0;

  return (
    <Select
      value={String(priority)}
      onValueChange={(v) => onChange(Number(v) as ProjectPriority)}
    >
      <SelectTrigger
        className={cn(
          'h-8 border rounded-full bg-background group gap-1.5',
          collapsed ? 'px-2 w-auto' : 'px-3 text-xs w-auto'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Icon
          className={cn(
            'h-3 w-3 flex-shrink-0',
            isEmpty ? 'text-muted-foreground opacity-40 group-hover:opacity-100' : iconColor
          )}
        />
        {!collapsed && (
          <span
            className={cn(
              'truncate',
              isEmpty && 'text-muted-foreground opacity-40 group-hover:opacity-100'
            )}
          >
            {label}
          </span>
        )}
      </SelectTrigger>
      <SelectContent>
        {PRIORITY_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
