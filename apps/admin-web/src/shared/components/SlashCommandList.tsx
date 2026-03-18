'use client';

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useMemo,
} from 'react';
import { cn } from '@/shared/utils';

export interface SlashCommandItem {
  title: string;
  subtext?: string;
  group?: string;
  keywords?: string[];
  onSelect: (props: { editor: import('@tiptap/core').Editor; range: { from: number; to: number } }) => void;
}

export interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  query: string;
  editor: import('@tiptap/core').Editor;
  range: { from: number; to: number };
}

export interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

/**
 * Groups items by their group property.
 */
function groupBy<T extends { group?: string }>(items: T[], key: keyof T): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const groupKey = (item[key] as string) ?? 'Other';
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(item);
  }
  return groups;
}

export const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const groupedItems = useMemo(() => {
      const groups = groupBy(props.items, 'group');
      const order = ['Formatting', 'Lists', 'Blocks', 'Insert', 'Templates', 'Other'];
      const result: { group: string; items: SlashCommandItem[] }[] = [];
      const seen = new Set<string>();

      for (const groupName of order) {
        if (groups[groupName]) {
          result.push({ group: groupName, items: groups[groupName] });
          seen.add(groupName);
        }
      }

      for (const [groupName, items] of Object.entries(groups)) {
        if (!seen.has(groupName)) {
          result.push({ group: groupName, items });
        }
      }

      return result;
    }, [props.items]);

    const flatItems = useMemo(
      () => groupedItems.flatMap((g) => g.items),
      [groupedItems]
    );

    const selectItem = (index: number) => {
      const item = flatItems[index];
      if (item) props.command(item);
    };

    const safeLength = Math.max(flatItems.length, 1);

    const upHandler = () => {
      setSelectedIndex((prev) => (prev + safeLength - 1) % safeLength);
    };

    const downHandler = () => {
      setSelectedIndex((prev) => (prev + 1) % safeLength);
    };

    const enterHandler = () => {
      selectItem(selectedIndex);
    };

    useEffect(() => setSelectedIndex(0), [props.items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          upHandler();
          return true;
        }
        if (event.key === 'ArrowDown') {
          downHandler();
          return true;
        }
        if (event.key === 'Enter') {
          enterHandler();
          return true;
        }
        return false;
      },
    }));

    if (flatItems.length === 0) {
      return (
        <div className="bg-popover border rounded-md shadow-md px-3 py-4 text-sm text-muted-foreground min-w-[280px] max-w-[320px] pointer-events-auto">
          {props.query.trim() ? 'No matching commands' : 'Type to search...'}
        </div>
      );
    }

    let cumulativeIndex = 0;

    return (
      <div
        className="bg-popover border rounded-md shadow-md overflow-hidden min-w-[280px] max-w-[320px] max-h-[320px] flex flex-col pointer-events-auto"
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="flex-1 min-h-0 overflow-y-auto p-1">
          {groupedItems.map(({ group, items }) => (
            <div key={group} className="space-y-0.5 mb-2 last:mb-0">
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {group}
              </div>
              {items.map((item) => {
                const itemIndex = cumulativeIndex++;
                const isSelected = itemIndex === selectedIndex;

                return (
                  <button
                    key={`${item.title}-${itemIndex}`}
                    type="button"
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors',
                      isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectItem(itemIndex);
                    }}
                  >
                    <span className="font-medium truncate">{item.title}</span>
                    {item.subtext && (
                      <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                        {item.subtext}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }
);

SlashCommandList.displayName = 'SlashCommandList';
