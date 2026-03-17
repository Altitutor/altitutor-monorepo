'use client';

import { Button, SearchableSelect } from '@altitutor/ui';
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

type PriorityOption = (typeof PRIORITY_OPTIONS)[number];

export function ProjectPriorityEntityPill({
  priority,
  collapsed,
  onChange,
}: ProjectPriorityEntityPillProps) {
  const label = getProjectPriorityLabel(priority);
  const iconColor = getProjectPriorityIconColor(priority);
  const Icon = getProjectPriorityIcon(priority);
  const isEmpty = priority === 0;
  const selectedItem = PRIORITY_OPTIONS.find((o) => o.value === priority) ?? PRIORITY_OPTIONS[0];

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <SearchableSelect<PriorityOption>
        items={PRIORITY_OPTIONS}
        value={selectedItem}
        onValueChange={(item) => onChange(item ? (item.value as ProjectPriority) : 0)}
        getItemLabel={(opt) => opt.label}
        getItemId={(opt) => String(opt.value)}
        trigger={
          <Button
            type="button"
            variant="outline"
            className={cn(
              'h-8 border rounded-full bg-background group gap-1.5',
              collapsed ? 'px-2 w-auto' : 'px-3 text-xs w-auto'
            )}
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
          </Button>
        }
      />
    </div>
  );
}
