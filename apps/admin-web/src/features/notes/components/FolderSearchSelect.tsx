'use client';

import { useMemo } from 'react';
import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  SearchableSelect,
} from '@altitutor/ui';
import { Check, ChevronDown, Folder } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils';
import type { NoteFormData } from '../types';

/** Matches properties sidebar width; keeps lists readable without spanning the panel */
const NOTE_PROP_SELECT_POPOVER_WIDTH = '260px';

const PROPERTIES_GRID_CLASS = 'grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 space-y-0';

type FolderInput = { id: string; name: string; parent_id?: string | null };

type FolderRowItem = { id: string; name: string; depth: number };

/**
 * Depth-first order matching folder hierarchy; orphans / bad parent refs surface at root.
 */
function flattenFoldersForSelect(folders: FolderInput[]): FolderRowItem[] {
  if (folders.length === 0) return [];
  const ids = new Set(folders.map((f) => f.id));
  const byParent = new Map<string | null, FolderInput[]>();

  for (const f of folders) {
    let pid = f.parent_id ?? null;
    if (pid !== null && !ids.has(pid)) {
      pid = null;
    }
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(f);
  }

  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const out: FolderRowItem[] = [];
  const visited = new Set<string>();

  const walk = (parentId: string | null, depth: number) => {
    for (const f of byParent.get(parentId) ?? []) {
      if (visited.has(f.id)) continue;
      visited.add(f.id);
      out.push({ id: f.id, name: f.name, depth });
      walk(f.id, depth + 1);
    }
  };

  walk(null, 0);

  const remainder = folders
    .filter((f) => !visited.has(f.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const f of remainder) {
    out.push({ id: f.id, name: f.name, depth: 0 });
  }

  return out;
}

interface FolderSearchSelectProps {
  form: UseFormReturn<NoteFormData>;
  folders?: FolderInput[];
  variant?: 'default' | 'pill' | 'properties';
  editable?: boolean;
  onDisabledInteract?: () => void;
}

export function FolderSearchSelect({
  form,
  folders = [],
  variant = 'default',
  editable = true,
  onDisabledInteract,
}: FolderSearchSelectProps) {
  const folderRows = useMemo(() => flattenFoldersForSelect(folders), [folders]);
  const isProperties = variant === 'properties';

  return (
    <FormField
      control={form.control}
      name="folder_id"
      render={({ field }) => {
        const selected = field.value ? folders.find((f) => f.id === field.value) ?? null : null;
        const displayLabel = selected?.name || 'No folder';

        const propertiesTrigger = (
          <Button
            type="button"
            variant="field"
            disabled={!editable}
            className="w-full justify-start"
            onPointerDown={(event) => {
              if (!editable) {
                event.preventDefault();
                onDisabledInteract?.();
              }
            }}
          >
            <div className="flex items-center gap-2 w-full min-w-0">
              <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className={cn('truncate', !field.value && 'text-muted-foreground')}>
                {displayLabel}
              </span>
            </div>
          </Button>
        );

        const defaultTrigger = (
          <button
            type="button"
            disabled={!editable}
            onPointerDown={(event) => {
              if (!editable) {
                event.preventDefault();
                onDisabledInteract?.();
              }
            }}
            className={cn(
              'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border hover:bg-muted h-10 px-4 py-2 justify-start',
              !editable && 'opacity-50',
              variant === 'default' && 'w-full max-w-[260px]',
              variant === 'pill' && 'h-8 px-3 text-xs border rounded-full w-auto min-w-[120px]'
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Folder className={cn('text-muted-foreground flex-shrink-0', variant === 'pill' && 'h-3 w-3')} />
              <span className="text-muted-foreground shrink-0">Folder</span>
              <span className={cn('truncate', !field.value && 'text-muted-foreground')}>
                {displayLabel}
              </span>
              <ChevronDown
                className={cn('text-muted-foreground ml-auto flex-shrink-0', variant === 'pill' && 'h-3 w-3')}
              />
            </div>
          </button>
        );

        const searchableSelect = (
          <SearchableSelect<FolderRowItem>
            items={folderRows}
            disabled={!editable}
            fullWidth={isProperties}
            value={
              selected
                ? folderRows.find((r) => r.id === selected.id) ?? {
                    id: selected.id,
                    name: selected.name,
                    depth: 0,
                  }
                : null
            }
            onValueChange={(row) => field.onChange(row?.id ?? null)}
            getItemId={(r) => r.id}
            getItemLabel={(r) => r.name}
            placeholder="No folder"
            searchPlaceholder="Search folders..."
            emptyMessage="No folders found"
            trigger={isProperties ? propertiesTrigger : defaultTrigger}
            allowClear
            clearLabel="None"
            contentWidth={NOTE_PROP_SELECT_POPOVER_WIDTH}
            renderItem={(folderItem, isSelected) => (
              <div
                className="flex items-center gap-2 flex-1 min-w-0"
                style={{ paddingLeft: folderItem.depth * 14 }}
              >
                <Check
                  className={
                    isSelected ? 'h-4 w-4 flex-shrink-0 opacity-100' : 'h-4 w-4 flex-shrink-0 opacity-0'
                  }
                />
                <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className={cn('truncate', isSelected && 'font-medium')}>{folderItem.name}</span>
              </div>
            )}
          />
        );

        if (isProperties) {
          return (
            <FormItem className={PROPERTIES_GRID_CLASS}>
              <FormLabel className="text-muted-foreground">Folder</FormLabel>
              <FormControl>{searchableSelect}</FormControl>
              <FormMessage className="col-start-2" />
            </FormItem>
          );
        }

        return (
          <FormItem>
            <FormControl>{searchableSelect}</FormControl>
          </FormItem>
        );
      }}
    />
  );
}
