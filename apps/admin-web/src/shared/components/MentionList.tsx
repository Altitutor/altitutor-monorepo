import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useMemo,
} from 'react';
import { Badge, ScrollArea } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { entityTypes } from '@/features/command-palette/config/commandPalette.config';
import { getEntityDisplayText } from '@/features/command-palette/utils/entityFormatters';
import { calculateMatchScore } from '@/features/command-palette/utils/matchScoring';
import type { CommandPaletteEntityResult } from '@/features/command-palette/types';

// Map singular entity types to plural keys in entityTypes config
const ENTITY_TYPE_MAPPING: Record<string, string> = {
  student: 'students',
  staff: 'staff',
  parent: 'parents',
  class: 'classes',
  subject: 'subjects',
  task: 'tasks',
  issue: 'issues',
  project: 'projects',
  topic: 'topics',
  file: 'files',
};

export interface MentionListProps {
  items: CommandPaletteEntityResult[];
  command: (item: any) => void;
  query: string;
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Group items by category and calculate max score for each group to sort groups
  const { groupedItems, flatItems } = useMemo(() => {
    const groups: Record<string, { label: string; items: CommandPaletteEntityResult[]; maxScore: number }> = {};
    
    props.items.forEach(item => {
      const type = item.type;
      const configKey = ENTITY_TYPE_MAPPING[type] || type;
      const config = entityTypes[configKey];
      const label = config?.label || type;
      
      const score = calculateMatchScore({ type: 'entity', result: item }, props.query || '');
      
      if (!groups[type]) {
        groups[type] = {
          label,
          items: [],
          maxScore: 0
        };
      }
      
      groups[type].items.push(item);
      groups[type].maxScore = Math.max(groups[type].maxScore, score);
    });

    // Sort groups: highest maxScore first, then alphabetically by label
    const sortedGroups = Object.values(groups).sort((a, b) => {
      if (b.maxScore !== a.maxScore) {
        return b.maxScore - a.maxScore;
      }
      return a.label.localeCompare(b.label);
    });

    // Flatten items for index-based selection
    const flatItems = sortedGroups.flatMap(group => group.items);

    return { groupedItems: sortedGroups, flatItems };
  }, [props.items, props.query]);

  const selectItem = (index: number) => {
    const item = flatItems[index];

    if (item) {
      const { title } = getEntityDisplayText(item);
      props.command({ id: item.id, label: title, type: item.type });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + flatItems.length - 1) % flatItems.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % flatItems.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
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

  if (props.items.length === 0) {
    return (
      <div className="bg-popover border rounded-md shadow-md p-2 text-sm text-muted-foreground">
        No results found
      </div>
    );
  }

  let cumulativeIndex = 0;

  return (
    <div 
      className="bg-popover border rounded-md shadow-md overflow-hidden min-w-[300px] max-w-[400px] pointer-events-auto"
      onMouseDown={(e) => {
        // Prevent the editor from losing focus when clicking on the list
        e.preventDefault();
      }}
    >
      <ScrollArea className="max-h-[400px]">
        <div className="p-1 space-y-3">
          {groupedItems.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-2 py-0.5 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-muted/50 mb-1">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const itemIndex = cumulativeIndex++;
                  const configKey = ENTITY_TYPE_MAPPING[item.type] || item.type;
                  const config = entityTypes[configKey];
                  const Icon = config?.icon;
                  const { title, subtitle } = getEntityDisplayText(item);
                  const isSelected = itemIndex === selectedIndex;

                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      className={cn(
                        'w-full flex items-start gap-2 px-2 py-1.5 rounded-sm text-left transition-colors',
                        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectItem(itemIndex);
                      }}
                    >
                      {Icon && <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{title}</div>
                        {subtitle && (
                          <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
                        {config?.label || item.type}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});

MentionList.displayName = 'MentionList';
