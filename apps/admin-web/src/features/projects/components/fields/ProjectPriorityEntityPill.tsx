'use client';

import { Select, SelectContent, SelectItem, SelectTrigger } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import type { ProjectPriority } from '../../types';
import {
  getProjectPriorityIcon,
  getProjectPriorityLabel,
  getProjectPriorityIconColor,
  PRIORITY_OPTIONS,
} from '../../utils/projectUtils';

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
  const Icon = getProjectPriorityIcon(priority);
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
        {PRIORITY_OPTIONS.map((opt) => {
          const OptionIcon = getProjectPriorityIcon(opt.value);
          const optionColor = getProjectPriorityIconColor(opt.value);
          return (
            <SelectItem key={opt.value} value={String(opt.value)}>
              <div className={cn('flex items-center gap-2')}>
                <OptionIcon className={cn('h-4 w-4', optionColor)} />
                <span>{opt.label}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
