'use client';

import { useMemo } from 'react';
import { FormControl, FormField, FormItem, SearchableSelect } from '@altitutor/ui';
import { Check, ChevronDown, Folder } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils';
import type { NoteFormData } from '../types';

/** Matches properties sidebar width; keeps lists readable without spanning the panel */
const NOTE_PROP_SELECT_POPOVER_WIDTH = '260px';

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
  variant?: 'default' | 'pill';
}

export function FolderSearchSelect({ form, folders = [], variant = 'default' }: FolderSearchSelectProps) {
  const folderRows = useMemo(() => flattenFoldersForSelect(folders), [folders]);

  return (
    <FormField
      control={form.control}
      name="folder_id"
      render={({ field }) => {
        const selected = field.value ? folders.find((f) => f.id === field.value) ?? null : null;

        const trigger = (
          <FormControl>
            <button
              type="button"
              className={cn(
                'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border hover:bg-muted h-10 px-4 py-2',
                'justify-start',
                variant === 'default' && 'w-full max-w-[260px]',
                variant === 'pill' && 'h-8 px-3 text-xs border rounded-full w-auto min-w-[120px]'
              )}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Folder className={cn('text-muted-foreground flex-shrink-0', variant === 'pill' && 'h-3 w-3')} />
                <span className="text-muted-foreground shrink-0">Folder</span>
                <span className={cn('truncate', !field.value && 'text-muted-foreground')}>
                  {selected?.name || 'No folder'}
                </span>
                <ChevronDown
                  className={cn('text-muted-foreground ml-auto flex-shrink-0', variant === 'pill' && 'h-3 w-3')}
                />
              </div>
            </button>
          </FormControl>
        );

        return (
          <FormItem>
            <SearchableSelect<FolderRowItem>
              items={folderRows}
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
              trigger={trigger}
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
          </FormItem>
        );
      }}
    />
  );
}
