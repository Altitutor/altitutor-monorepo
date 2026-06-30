'use client';

import type { LucideIcon } from 'lucide-react';
import { Copy, Eye, MoreHorizontal, Pencil, Play, Plus, RotateCcw, Star, Trash2 } from 'lucide-react';
import { Button, SearchableSelect } from '@altitutor/ui';
import { cn } from '@/shared/utils';

export type SettingsTableAction = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  icon?: LucideIcon;
  destructive?: boolean;
  onSelect: () => void;
};

export function SettingsTableActions({
  actions,
  className,
}: {
  actions: SettingsTableAction[];
  className?: string;
}) {
  return (
    <div className={className}>
      <SearchableSelect<SettingsTableAction>
        items={actions}
        value={null}
        onValueChange={(action) => action?.onSelect()}
        getItemId={(action) => action.id}
        getItemLabel={(action) => action.label}
        getItemValue={(action) => [action.label, action.description].filter(Boolean).join(' ')}
        getItemDisabled={(action) => action.disabled ?? false}
        placeholder="Actions"
        searchPlaceholder="Search actions..."
        emptyMessage="No actions found."
        align="end"
        contentWidth="280px"
        showChevron={false}
        trigger={
          <Button type="button" variant="outline" size="icon">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        }
        renderItem={(action) => {
          const Icon = action.icon ?? getActionIcon(action);
          const destructive = action.destructive ?? isDestructiveAction(action);

          return (
          <div className={cn('flex min-w-0 items-start gap-2', destructive && 'text-destructive')}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
            <div className="truncate font-medium">{action.label}</div>
            {action.description ? (
              <div className={cn('truncate text-xs text-muted-foreground', destructive && 'text-destructive/80')}>
                {action.description}
              </div>
            ) : null}
          </div>
          </div>
          );
        }}
      />
    </div>
  );
}

function getActionIcon(action: SettingsTableAction): LucideIcon {
  const value = `${action.id} ${action.label}`.toLowerCase();
  if (value.includes('delete') || value.includes('remove') || value.includes('revoke')) return Trash2;
  if (value.includes('edit')) return Pencil;
  if (value.includes('view')) return Eye;
  if (value.includes('duplicate') || value.includes('copy')) return Copy;
  if (value.includes('apply')) return Play;
  if (value.includes('grant') || value.includes('reset')) return RotateCcw;
  if (value.includes('default')) return Star;
  if (value.includes('add') || value.includes('create')) return Plus;
  return MoreHorizontal;
}

function isDestructiveAction(action: SettingsTableAction): boolean {
  const value = `${action.id} ${action.label}`.toLowerCase();
  return value.includes('delete') || value.includes('remove') || value.includes('revoke');
}
