'use client';

import { MoreHorizontal } from 'lucide-react';
import { Button, SearchableSelect } from '@altitutor/ui';

export type SettingsTableAction = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
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
        renderItem={(action) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{action.label}</div>
            {action.description ? (
              <div className="truncate text-xs text-muted-foreground">{action.description}</div>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}
