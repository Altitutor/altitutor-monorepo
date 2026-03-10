import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useMemo,
} from 'react';
import { Badge, Skeleton } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { entityTypes } from '@/features/command-palette/config/commandPalette.config';
import { getEntityDisplayText } from '@/features/command-palette/utils/entityFormatters';
import { calculateMatchScore } from '@/features/command-palette/utils/matchScoring';
import { useEntitySearch } from '@/shared/hooks/useEntitySearch';
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
  note: 'notes',
};

// Map plural entity types to singular for pill ordering
const PLURAL_TO_SINGULAR: Record<string, string> = {
  students: 'student',
  staff: 'staff',
  parents: 'parent',
  classes: 'class',
  subjects: 'subject',
  tasks: 'task',
  issues: 'issue',
  projects: 'project',
  topics: 'topic',
  files: 'file',
  notes: 'note',
};

const ENTITY_PILL_ORDER = ['student', 'staff', 'parent', 'class', 'subject', 'task', 'issue', 'project', 'topic', 'file', 'note'] as const;

const DEFAULT_TYPES = ['students', 'staff', 'parents', 'classes', 'subjects', 'tasks', 'issues', 'projects', 'topics', 'files', 'notes'] as const;

export interface MentionListProps {
  items: CommandPaletteEntityResult[];
  command: (item: CommandPaletteEntityResult) => void;
  query: string;
  types?: readonly string[];
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);

  const effectiveTypes = (props.types ?? DEFAULT_TYPES) as string[];
  const { results, isLoading } = useEntitySearch({
    search: props.query ?? '',
    enabled: true,
    debounceMs: 200,
    types: effectiveTypes,
  });

  const items = results;

  const { groupedItems, flatItems, typesWithResults } = useMemo(() => {
    const groups: Record<string, { type: string; label: string; items: CommandPaletteEntityResult[]; maxScore: number }> = {};

    items.forEach(item => {
      const type = item.type;
      const configKey = ENTITY_TYPE_MAPPING[type] || type;
      const config = entityTypes[configKey];
      const label = config?.label || type;

      const score = calculateMatchScore({ type: 'entity', result: item }, props.query || '');

      if (!groups[type]) {
        groups[type] = { type, label, items: [], maxScore: 0 };
      }

      groups[type].items.push(item);
      groups[type].maxScore = Math.max(groups[type].maxScore, score);
    });

    let sortedGroups = Object.values(groups).sort((a, b) => {
      if (b.maxScore !== a.maxScore) return b.maxScore - a.maxScore;
      return a.label.localeCompare(b.label);
    });

    if (selectedTypeFilter) {
      sortedGroups = sortedGroups.filter(g => g.type === selectedTypeFilter);
    }

    const flatItems = sortedGroups.flatMap(group => group.items);
    const typesWithResults = Object.keys(groups);

    return { groupedItems: sortedGroups, flatItems, typesWithResults };
  }, [items, props.query, selectedTypeFilter]);

  const selectItem = (index: number) => {
    const item = flatItems[index];
    if (!item) return;
    const { title } = getEntityDisplayText(item);
    props.command({ ...item, label: title } as CommandPaletteEntityResult & { label: string });
  };

  const safeLength = Math.max(flatItems.length, 1);
  const upHandler = () => {
    setSelectedIndex((selectedIndex + safeLength - 1) % safeLength);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % safeLength);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [items, selectedTypeFilter]);

  useEffect(() => {
    if (selectedTypeFilter && !items.some(i => i.type === selectedTypeFilter)) {
      setSelectedTypeFilter(null);
    }
  }, [items, selectedTypeFilter]);

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

  const pillTypes = typesWithResults.length > 0
    ? ENTITY_PILL_ORDER.filter(t => typesWithResults.includes(t))
    : effectiveTypes.map(t => PLURAL_TO_SINGULAR[t] ?? t).filter(Boolean);

  const showSkeleton = isLoading;
  const emptyMessage = props.query.trim().length < 2 ? 'Start typing to search...' : 'No results found';

  if (groupedItems.length === 0 && !showSkeleton) {
    const filterLabel = selectedTypeFilter
      ? entityTypes[ENTITY_TYPE_MAPPING[selectedTypeFilter]]?.label ?? selectedTypeFilter
      : null;
    return (
      <div className="bg-popover border rounded-md shadow-md overflow-hidden min-w-[300px] max-w-[400px] max-h-[300px] flex flex-col pointer-events-auto">
        <div className="flex flex-wrap gap-1 p-2 border-b border-muted/50 shrink-0">
          {pillTypes.map((type) => {
            const configKey = ENTITY_TYPE_MAPPING[type] || type;
            const config = entityTypes[configKey];
            const Icon = config?.icon;
            const label = config?.label || type;
            const isActive = selectedTypeFilter === type;
            return (
              <button
                key={type}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedTypeFilter((prev) => (prev === type ? null : type));
                }}
                onMouseDown={(e) => e.preventDefault()}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {Icon && <Icon className="h-3 w-3" />}
                {label}
              </button>
            );
          })}
        </div>
        <div className="p-2 text-sm text-muted-foreground">
          {filterLabel ? `No ${filterLabel} found` : emptyMessage}
        </div>
      </div>
    );
  }

  if (groupedItems.length === 0 && showSkeleton) {
    return (
      <div className="bg-popover border rounded-md shadow-md overflow-hidden min-w-[300px] max-w-[400px] max-h-[300px] flex flex-col pointer-events-auto">
        <div className="flex flex-wrap gap-1 p-2 border-b border-muted/50 shrink-0">
          {pillTypes.map((type) => {
            const configKey = ENTITY_TYPE_MAPPING[type] || type;
            const config = entityTypes[configKey];
            const Icon = config?.icon;
            const label = config?.label || type;
            return (
              <button
                key={type}
                type="button"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-muted/50 text-muted-foreground cursor-default"
                disabled
              >
                {Icon && <Icon className="h-3 w-3" />}
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-2">
              <Skeleton className="h-4 w-4 shrink-0 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  let cumulativeIndex = 0;

  return (
    <div 
      className="bg-popover border rounded-md shadow-md overflow-hidden min-w-[300px] max-w-[400px] max-h-[300px] flex flex-col pointer-events-auto"
      onMouseDown={(e) => {
        e.preventDefault();
      }}
    >
      <div className="flex flex-wrap gap-1 p-2 border-b border-muted/50 shrink-0">
        {ENTITY_PILL_ORDER.filter(t => typesWithResults.includes(t)).map((type) => {
          const configKey = ENTITY_TYPE_MAPPING[type] || type;
          const config = entityTypes[configKey];
          const Icon = config?.icon;
          const label = config?.label || type;
          const isActive = selectedTypeFilter === type;
          return (
            <button
              key={type}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setSelectedTypeFilter((prev) => (prev === type ? null : type));
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
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
      </div>
    </div>
  );
});

MentionList.displayName = 'MentionList';
