'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, GraduationCap, UserRound, Users, Calendar, Beaker, Newspaper, File, CheckSquare, AlertTriangle, FolderKanban } from 'lucide-react';
import { useEntitySearch, type EntitySearchResult } from '@/shared/hooks/useEntitySearch';
import { cn } from '@/shared/utils';
import { getDayShortName } from '@/shared/utils/datetime';
import type { LucideIcon } from 'lucide-react';

const ENTITY_PILL_ORDER = ['student', 'staff', 'parent', 'class', 'subject', 'task', 'issue', 'project', 'topic', 'file'] as const;
const TYPE_TO_SEARCH_KEY: Record<string, string> = {
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

interface MentionAutocompleteProps {
  searchQuery: string;
  isOpen: boolean;
  onSelect: (result: EntitySearchResult) => void;
  onClose: () => void;
  position?: { top: number; left: number };
  /** Portal target. Use nearest dialog when inside one so Radix overlay does not block clicks. */
  portalContainer?: HTMLElement | null;
  /** Optional: restrict search to these entity types (plural keys: students, staff, etc.) */
  types?: readonly string[];
}

const entityIcons: Record<string, LucideIcon> = {
  student: GraduationCap,
  staff: Users,
  parent: UserRound,
  class: Calendar,
  subject: Beaker,
  task: CheckSquare,
  issue: AlertTriangle,
  project: FolderKanban,
  topic: Newspaper,
  file: File,
};

const entityLabels: Record<string, string> = {
  student: 'Students',
  staff: 'Staff',
  parent: 'Parents',
  class: 'Classes',
  subject: 'Subjects',
  task: 'Tasks',
  issue: 'Issues',
  project: 'Projects',
  topic: 'Topics',
  file: 'Files',
};

/**
 * Format entity display text for autocomplete
 */
function getEntityDisplayText(result: EntitySearchResult): { title: string; subtitle: string | null } {
  if (result.type === 'student') {
    const title = [result.data.first_name, result.data.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || `Student ${result.id.slice(0, 8)}`;
    return {
      title,
      subtitle: result.data.school || null,
    };
  }

  if (result.type === 'staff') {
    return {
      title: [result.data.first_name, result.data.last_name]
        .filter(Boolean)
        .join(' ')
        .trim(),
      subtitle: result.data.role || null,
    };
  }

  if (result.type === 'parent') {
    return {
      title: [result.data.first_name, result.data.last_name]
        .filter(Boolean)
        .join(' ')
        .trim(),
      subtitle: result.data.email || result.data.phone || null,
    };
  }

  if (result.type === 'class') {
    const classData = result.data;
    const subject = classData.subject;
    // day_of_week is a number (0-6), convert to day name using utility
    const dayAbbr = typeof classData.day_of_week === 'number' ? getDayShortName(classData.day_of_week) : '';
    const time = classData.start_time || '';
    const subjectName = subject?.short_name || subject?.long_name || '';
    return {
      title: `${subjectName} ${dayAbbr} ${time}`.trim(),
      subtitle: classData.room || null,
    };
  }

  if (result.type === 'subject') {
    return {
      title: result.data.long_name || result.data.short_name || result.data.name || '',
      subtitle: result.data.curriculum || null,
    };
  }

  if (result.type === 'task') {
    return {
      title: result.data.title || '',
      subtitle: result.data.status || null,
    };
  }

  if (result.type === 'issue') {
    return {
      title: result.data.name || '',
      subtitle: result.data.status || null,
    };
  }

  if (result.type === 'project') {
    return {
      title: result.data.name || '',
      subtitle: result.data.status || null,
    };
  }

  if (result.type === 'topic') {
    return {
      title: result.data.name || '',
      subtitle:
        result.data.subject?.long_name ||
        result.data.subject?.short_name ||
        result.data.subject?.name ||
        null,
    };
  }

  if (result.type === 'file') {
    const fileData = result.data;
    const subjectShortName = fileData.subject.short_name || '';
    const fileCode = fileData.code ? ` ${fileData.code}` : '';
    const topicName = fileData.topic.name || '';
    return {
      title: `${subjectShortName}${fileCode} ${topicName}`.trim(),
      subtitle: fileData.file.filename,
    };
  }

  return { title: '', subtitle: null };
}

const DEFAULT_SEARCH_TYPES = ['students', 'staff', 'parents', 'classes', 'subjects', 'tasks', 'issues', 'projects', 'topics', 'files'] as const;

export function MentionAutocomplete({
  searchQuery,
  isOpen,
  onSelect,
  onClose,
  position,
  portalContainer = typeof document !== 'undefined' ? document.body : null,
  types: typesProp,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveTypes = selectedTypeFilter
    ? [TYPE_TO_SEARCH_KEY[selectedTypeFilter] ?? selectedTypeFilter]
    : (typesProp as string[] | undefined) ?? DEFAULT_SEARCH_TYPES;

  const { results, isLoading } = useEntitySearch({
    search: searchQuery,
    enabled: isOpen,
    types: effectiveTypes as ('students' | 'staff' | 'parents' | 'classes' | 'subjects' | 'tasks' | 'issues' | 'projects' | 'topics' | 'files')[],
  });

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<string, EntitySearchResult[]> = {};
    results.forEach((result) => {
      if (!groups[result.type]) {
        groups[result.type] = [];
      }
      groups[result.type].push(result);
    });
    return groups;
  }, [results]);

  useEffect(() => {
    if (!isOpen) setSelectedTypeFilter(null);
  }, [isOpen]);

  useEffect(() => {
    if (results.length > 0) {
      setSelectedIndex(0);
    }
  }, [results.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (containerRef.current && selectedIndex >= 0) {
      const selectedElement = containerRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const allResults: Array<EntitySearchResult & { groupType: string }> = [];
  Object.entries(groupedResults).forEach(([type, items]) => {
    items.forEach((item) => {
      allResults.push({ ...item, groupType: type });
    });
  });

  const isInDialog = portalContainer && portalContainer !== document.body;
  const positionStyle = position
    ? isInDialog && portalContainer
      ? (() => {
          const rect = portalContainer.getBoundingClientRect();
          return {
            position: 'absolute' as const,
            left: `${position.left - rect.left}px`,
            top: `${position.top - rect.top}px`,
          };
        })()
      : { position: 'fixed' as const, left: `${position.left}px`, top: `${position.top}px` }
    : undefined;

  const content = (
    <div
      ref={containerRef}
      className="fixed z-[200] bg-popover border rounded-lg shadow-lg max-h-[300px] overflow-y-auto min-w-[300px] max-w-[400px]"
      style={positionStyle}
      onMouseDown={(e) => {
        // Prevent blur on contentEditable when clicking autocomplete
        e.preventDefault();
      }}
    >
      <div className="flex flex-wrap gap-1 p-2 border-b border-muted/50 shrink-0">
        {ENTITY_PILL_ORDER.map((type) => {
          const Icon = entityIcons[type];
          const label = entityLabels[type];
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
      {isLoading && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && allResults.length === 0 && (
        <div className="px-4 py-3 text-sm text-muted-foreground text-center">
          {searchQuery.trim().length < 2 ? 'Start typing to search...' : 'No results found'}
        </div>
      )}

      {!isLoading && allResults.length > 0 && (
        <div className="py-1">
          {Object.entries(groupedResults).map(([type, items]) => {
            const Icon = entityIcons[type];
            const label = entityLabels[type];

            return (
              <div key={type} className="py-1">
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                  {Icon && <Icon className="h-3 w-3" />}
                  {label}
                </div>
                {items.map((result) => {
                  const globalIndex = allResults.findIndex(
                    (r) => r.id === result.id && r.type === result.type
                  );
                  const isSelected = globalIndex === selectedIndex;
                  const { title, subtitle } = getEntityDisplayText(result);

                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      data-index={globalIndex}
                      type="button"
                      className={cn(
                        'w-full flex items-start gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors text-left',
                        isSelected
                          ? 'bg-brand-lightBlue/10 dark:bg-brand-lightBlue/20'
                          : 'hover:bg-muted'
                      )}
                      onMouseDown={(e) => {
                        // Use onMouseDown instead of onClick to fire before blur
                        e.preventDefault();
                        e.stopPropagation();
                        onSelect(result);
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      {Icon && (
                        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="font-medium text-sm">{title}</div>
                        {subtitle && (
                          <div className="text-xs text-muted-foreground">
                            {subtitle}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' && portalContainer
    ? createPortal(content, portalContainer)
    : content;
}
