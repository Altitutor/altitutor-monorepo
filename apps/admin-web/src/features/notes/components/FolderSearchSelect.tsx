'use client';

import { FormControl, FormField, FormItem, SearchableSelect } from '@altitutor/ui';
import { Check, ChevronDown, Folder } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils';
import type { NoteFormData } from '../types';

interface FolderSearchSelectProps {
  form: UseFormReturn<NoteFormData>;
  folders?: Array<{ id: string; name: string }>;
  variant?: 'default' | 'pill';
}

export function FolderSearchSelect({ form, folders = [], variant = 'default' }: FolderSearchSelectProps) {
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
                variant === 'default' && 'w-full',
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
            <SearchableSelect<{ id: string; name: string }>
              items={folders}
              value={selected}
              onValueChange={(f) => field.onChange(f?.id ?? null)}
              getItemId={(f) => f.id}
              getItemLabel={(f) => f.name}
              placeholder="No folder"
              searchPlaceholder="Search folders..."
              emptyMessage="No folders found"
              trigger={trigger}
              allowClear
              clearLabel="None"
              contentWidth={variant === 'default' ? '400px' : undefined}
              renderItem={(folderItem, isSelected) => (
                <>
                  <Check
                    className={
                      isSelected ? 'h-4 w-4 flex-shrink-0 opacity-100' : 'h-4 w-4 flex-shrink-0 opacity-0'
                    }
                  />
                  <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className={cn('truncate', isSelected && 'font-medium')}>{folderItem.name}</span>
                </>
              )}
            />
          </FormItem>
        );
      }}
    />
  );
}
