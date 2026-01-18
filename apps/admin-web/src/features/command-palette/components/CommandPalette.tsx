'use client';

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Loader2,
  Home,
  CheckSquare,
  AlertTriangle,
  GraduationCap,
  UserRound,
  Users,
  Calendar,
  ClipboardList,
  MessageCircle,
  CreditCard,
  FileText,
  Beaker,
  Newspaper,
} from 'lucide-react';
import { Input, Badge, Button } from '@altitutor/ui';
import { useCommandPaletteSearch, type CommandPaletteEntityResult } from '../hooks/useCommandPaletteSearch';
import {
  commands,
  additionalPages,
  extractPagesFromNavItems,
  entityTypes,
  type CommandPaletteCommand,
} from '../config/commandPalette.config';
import { useCommandPaletteCommandActions } from '../hooks/useCommandPaletteActions';
import { formatClassShortName, formatClassName, cn } from '@/shared/utils';
import type { LucideIcon } from 'lucide-react';
import type { Tables } from '@altitutor/shared';

// Map singular entity types to plural keys in entityTypes config
const ENTITY_TYPE_MAPPING: Record<string, string> = {
  'student': 'students',
  'staff': 'staff',
  'parent': 'parents',
  'class': 'classes',
  'subject': 'subjects',
  'topic': 'topics',
  'file': 'files',
};

// Nav items matching layout.tsx - pages will be automatically searchable
const navItems: Array<{ title: string; href: string; icon: LucideIcon }> = [
  { title: 'Dashboard', href: '/dashboard', icon: Home },
  { title: 'Tasks', href: '/tasks', icon: CheckSquare },
  { title: 'Reconciliation', href: '/reconciliation', icon: AlertTriangle },
  { title: 'Students', href: '/students', icon: GraduationCap },
  { title: 'Parents', href: '/parents', icon: UserRound },
  { title: 'Staff', href: '/staff', icon: Users },
  { title: 'Classes', href: '/classes', icon: Calendar },
  { title: 'Admin Shifts', href: '/admin-shifts', icon: Calendar },
  { title: 'Sessions', href: '/sessions', icon: ClipboardList },
  { title: 'Messages', href: '/messages', icon: MessageCircle },
  { title: 'Invoices', href: '/invoices', icon: CreditCard },
  { title: 'Reports', href: '/reports', icon: FileText },
  { title: 'Tutor logs', href: '/tutor-logs', icon: ClipboardList },
  { title: 'Subjects', href: '/subjects', icon: Beaker },
  { title: 'Topics', href: '/topics', icon: Newspaper },
];

export type CommandPaletteItem =
  | { type: 'command'; id: string; title: string; description?: string; icon: LucideIcon; action: () => void }
  | { type: 'page'; id: string; title: string; href: string; icon: LucideIcon }
  | { type: 'entity'; result: CommandPaletteEntityResult };

export type FilterType = 'command' | 'page' | 'student' | 'staff' | 'parent' | 'class' | 'subject' | 'topic' | 'file';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onEntitySelected?: (type: string, id: string) => void;
}

export function CommandPalette({ isOpen, onClose, onEntitySelected }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<FilterType | null>(null);


  // Get command actions (may be null if QuickActionsProvider not available)
  const commandActions = useCommandPaletteCommandActions(onClose);

  // Extract pages from navItems
  const navPages = useMemo(() => extractPagesFromNavItems(navItems as any), []);
  const allPages = useMemo(() => [...navPages, ...additionalPages], [navPages]);

  // Setup command actions
  const commandsWithActions = useMemo<CommandPaletteCommand[]>(() => {
    if (!commandActions) {
      // If QuickActionsProvider not available, return commands with no-op actions
      return commands.map((cmd) => ({ ...cmd, action: () => {} }));
    }

    const mapped = commands.map((cmd) => {
      let action: () => void = () => {};
      switch (cmd.id) {
        case 'trial-session':
          action = commandActions.openTrialSession;
          break;
        case 'subsidy-interview':
          action = commandActions.openSubsidyInterview;
          break;
        case 'drafting':
          action = commandActions.openDrafting;
          break;
        case 'tutor-log':
          action = commandActions.openTutorLog;
          break;
        case 'log-student-absence':
          action = commandActions.openLogStudentAbsence;
          break;
        case 'log-staff-absence':
          action = commandActions.openLogStaffAbsence;
          break;
      }
      return { ...cmd, action };
    });
    
    return mapped;
  }, [commandActions]);

  // Search entities
  const { results: entityResults, isLoading: isSearching } = useCommandPaletteSearch({
    search: searchQuery,
    enabled: isOpen,
  });

  // Filter and sort commands by search query (sort by match quality for section prioritization)
  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) return commandsWithActions;
    const query = searchQuery.toLowerCase();
    const filtered = commandsWithActions.filter((cmd) => {
      const titleMatch = cmd.title.toLowerCase().includes(query);
      const descMatch = cmd.description?.toLowerCase().includes(query);
      const keywordMatch = cmd.keywords?.some((k) => k.toLowerCase().includes(query));
      return titleMatch || descMatch || keywordMatch;
    });
    
    // Sort by match quality so first item has highest score (for section prioritization)
    return filtered.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const queryLower = query.toLowerCase();
      
      // Exact match > starts with > contains
      if (aTitle === queryLower && bTitle !== queryLower) return -1;
      if (bTitle === queryLower && aTitle !== queryLower) return 1;
      if (aTitle.startsWith(queryLower) && !bTitle.startsWith(queryLower)) return -1;
      if (bTitle.startsWith(queryLower) && !aTitle.startsWith(queryLower)) return 1;
      return 0;
    });
  }, [searchQuery, commandsWithActions]);

  // Filter and sort pages by search query (sort by match quality for section prioritization)
  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return allPages;
    const query = searchQuery.toLowerCase();
    const filtered = allPages.filter((page) => {
      const titleMatch = page.title.toLowerCase().includes(query);
      const keywordMatch = page.keywords?.some((k) => k.toLowerCase().includes(query));
      return titleMatch || keywordMatch;
    });
    
    // Sort by match quality so first item has highest score (for section prioritization)
    return filtered.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const queryLower = query.toLowerCase();
      
      // Exact match > starts with > contains
      if (aTitle === queryLower && bTitle !== queryLower) return -1;
      if (bTitle === queryLower && aTitle !== queryLower) return 1;
      if (aTitle.startsWith(queryLower) && !bTitle.startsWith(queryLower)) return -1;
      if (bTitle.startsWith(queryLower) && !aTitle.startsWith(queryLower)) return 1;
      return 0;
    });
  }, [searchQuery, allPages]);

  // Combine all items
  const allItems: CommandPaletteItem[] = useMemo(() => {
    const items: CommandPaletteItem[] = [];
    
    // Commands first
    filteredCommands.forEach((cmd) => {
      items.push({ type: 'command', ...cmd });
    });
    
    // Pages second
    filteredPages.forEach((page) => {
      items.push({ type: 'page', ...page });
    });
    
    // Entities last
    entityResults.forEach((result) => {
      items.push({ type: 'entity', result });
    });
    
    return items;
  }, [filteredCommands, filteredPages, entityResults]);

  // Filter items by selected filter type
  const filteredItems: CommandPaletteItem[] = useMemo(() => {
    // If no filter selected, show all items
    if (selectedFilter === null) {
      return allItems;
    }

    return allItems.filter((item) => {
      if (item.type === 'command') {
        return selectedFilter === 'command';
      }
      if (item.type === 'page') {
        return selectedFilter === 'page';
      }
      if (item.type === 'entity') {
        return selectedFilter === item.result.type;
      }
      return false;
    });
  }, [allItems, selectedFilter]);

  // Reset selected index when items change
  useEffect(() => {
    if (filteredItems.length > 0) {
      setSelectedIndex(0);
    }
  }, [filteredItems.length]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearchQuery('');
      setSelectedIndex(0);
      setSelectedFilter(null);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
        return;
      }

      if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const selectedItem = filteredItems[selectedIndex];
        if (selectedItem) {
          handleSelectItem(selectedItem);
        }
      }
    },
    [filteredItems, selectedIndex, onClose]
  );

  const handleSelectItem = useCallback(
    (item: CommandPaletteItem) => {
      if (item.type === 'command') {
        // Execute the action
        if (item.action) {
          item.action();
        }
      } else if (item.type === 'page') {
        onClose();
        router.push(item.href);
      } else if (item.type === 'entity') {
        const { result } = item;
        setSearchQuery('');
        
        // Notify parent component to handle entity selection (modals will be rendered there)
        if (onEntitySelected) {
          onEntitySelected(result.type, result.id);
        }
        
        // Close the palette
        onClose();
      }
    },
    [onClose, router]
  );

  // Highlight matching text
  const highlightText = useCallback((text: string | null | undefined, query: string) => {
    if (!text || !query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="font-semibold text-brand-lightBlue">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }, []);

  // Render item
  const renderItem = useCallback(
    (item: CommandPaletteItem, index: number) => {
      const isSelected = index === selectedIndex;
      const baseClasses = cn(
        'w-full flex items-start gap-3 px-4 py-3 rounded-md cursor-pointer transition-colors text-left',
        isSelected
          ? 'bg-brand-lightBlue/10 dark:bg-brand-lightBlue/20'
          : 'hover:bg-muted'
      );

      if (item.type === 'command') {
        const Icon = item.icon;
        return (
          <button
            key={`command-${item.id}`}
            type="button"
            className={baseClasses}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSelectItem(item);
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <div className="font-medium">{highlightText(item.title, searchQuery)}</div>
              {item.description && (
                <div className="text-sm text-muted-foreground">{item.description}</div>
              )}
            </div>
            <Badge variant="outline" className="text-xs flex-shrink-0">
              Command
            </Badge>
          </button>
        );
      }

      if (item.type === 'page') {
        const Icon = item.icon;
        return (
          <button
            key={`page-${item.id}`}
            type="button"
            className={baseClasses}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSelectItem(item);
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <div className="font-medium">{highlightText(item.title, searchQuery)}</div>
            </div>
            <Badge variant="outline" className="text-xs flex-shrink-0">
              Page
            </Badge>
          </button>
        );
      }

      // Entity item
      const { result } = item;
      const configKey = ENTITY_TYPE_MAPPING[result.type] || result.type;
      const config = entityTypes[configKey];
      if (!config) return null;

      const Icon = config.icon;
      let title = '';
      let subtitle: string | null = null;

      if (result.type === 'student') {
        const studentData = result.data as Tables<'students'>;
        title = [studentData.first_name, studentData.last_name].filter(Boolean).join(' ').trim();
        // Fallback for students without names (e.g., some trial students)
        if (!title) {
          title = `Student ${studentData.id.slice(0, 8)}`;
        }
        subtitle = studentData.school || null;
      } else if (result.type === 'staff') {
        title = [result.data.first_name, result.data.last_name].filter(Boolean).join(' ').trim();
        subtitle = result.data.role || null;
      } else if (result.type === 'parent') {
        title = [result.data.first_name, result.data.last_name].filter(Boolean).join(' ').trim();
        subtitle = result.data.email || result.data.phone || null;
      } else if (result.type === 'class') {
        const classData = result.data;
        const subject = classData.subject;
        title = formatClassShortName(classData as any, subject);
        subtitle = formatClassName(classData as any, subject);
      } else if (result.type === 'subject') {
        title = result.data.long_name || result.data.short_name || result.data.name || '';
        subtitle = result.data.curriculum || null;
      } else if (result.type === 'topic') {
        title = result.data.name || '';
        subtitle = result.data.subject?.long_name || result.data.subject?.short_name || result.data.subject?.name || null;
      } else if (result.type === 'file') {
        const fileData = result.data;
        const subjectShortName = fileData.subject.short_name || '';
        const fileCode = fileData.code ? ` ${fileData.code}` : '';
        const topicName = fileData.topic.name || '';
        title = `${subjectShortName}${fileCode} ${topicName}`.trim();
        subtitle = fileData.file.filename;
      }

      return (
        <button
          key={`entity-${result.type}-${result.id}`}
          type="button"
          className={baseClasses}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSelectItem(item);
          }}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <div className="font-medium">{highlightText(title, searchQuery)}</div>
            {subtitle && (
              <div className="text-sm text-muted-foreground">{highlightText(subtitle, searchQuery)}</div>
            )}
          </div>
          <Badge variant="outline" className="text-xs flex-shrink-0">
            {config.label}
          </Badge>
        </button>
      );
    },
    [selectedIndex, searchQuery, handleSelectItem, highlightText]
  );

  // Calculate match quality score for an item (used to prioritize sections)
  const calculateMatchScore = useCallback((item: CommandPaletteItem, query: string): number => {
    if (!query.trim()) return 0;
    
    const queryLower = query.toLowerCase().trim();
    
    if (item.type === 'command') {
      const titleMatch = item.title.toLowerCase();
      if (titleMatch === queryLower) return 1000;
      if (titleMatch.startsWith(queryLower)) return 900;
      if (titleMatch.includes(queryLower)) return 800;
      return 0;
    }
    
    if (item.type === 'page') {
      const titleMatch = item.title.toLowerCase();
      if (titleMatch === queryLower) return 1000;
      if (titleMatch.startsWith(queryLower)) return 900;
      if (titleMatch.includes(queryLower)) return 800;
      return 0;
    }
    
    if (item.type === 'entity') {
      const { result } = item;
      let title = '';
      let subtitle: string | null = null;
      
      if (result.type === 'student') {
        const studentData = result.data as Tables<'students'>;
        title = [studentData.first_name, studentData.last_name].filter(Boolean).join(' ').trim();
        if (!title) title = `Student ${studentData.id.slice(0, 8)}`;
        subtitle = studentData.school || null;
      } else if (result.type === 'staff') {
        title = [result.data.first_name, result.data.last_name].filter(Boolean).join(' ').trim();
        subtitle = result.data.role || null;
      } else if (result.type === 'parent') {
        title = [result.data.first_name, result.data.last_name].filter(Boolean).join(' ').trim();
        subtitle = result.data.email || result.data.phone || null;
      } else if (result.type === 'class') {
        const classData = result.data;
        const subject = classData.subject;
        title = formatClassShortName(classData as any, subject);
        subtitle = formatClassName(classData as any, subject);
      } else if (result.type === 'subject') {
        title = result.data.long_name || result.data.short_name || result.data.name || '';
        subtitle = result.data.curriculum || null;
      } else if (result.type === 'topic') {
        title = result.data.name || '';
        subtitle = result.data.subject?.long_name || result.data.subject?.short_name || result.data.subject?.name || null;
      } else if (result.type === 'file') {
        const fileData = result.data;
        const subjectShortName = fileData.subject.short_name || '';
        const fileCode = fileData.code ? ` ${fileData.code}` : '';
        const topicName = fileData.topic.name || '';
        title = `${subjectShortName}${fileCode} ${topicName}`.trim();
        subtitle = fileData.file.filename;
      }
      
      const titleLower = title.toLowerCase();
      const subtitleLower = subtitle?.toLowerCase() || '';
      const combinedLower = `${titleLower} ${subtitleLower}`.trim();
      
      // Exact match in title (highest priority)
      if (titleLower === queryLower) return 1000;
      // Starts with query in title
      if (titleLower.startsWith(queryLower)) return 900;
      // Contains query in title
      if (titleLower.includes(queryLower)) return 800;
      // Exact match in combined (title + subtitle)
      if (combinedLower === queryLower) return 700;
      // Starts with query in combined
      if (combinedLower.startsWith(queryLower)) return 600;
      // Contains query in combined
      if (combinedLower.includes(queryLower)) return 500;
      // Contains query in subtitle only
      if (subtitleLower.includes(queryLower)) return 300;
      
      return 0;
    }
    
    return 0;
  }, []);

  // Group items by type for display, sorted by highest match score
  // Optimization: Only calculate score for first item in each section since results are already sorted by relevance
  const groupedItems = useMemo(() => {
    const groups: Array<{ label: string; items: CommandPaletteItem[]; maxScore: number }> = [];
    
    const commandItems = filteredItems.filter((i) => i.type === 'command');
    if (commandItems.length > 0) {
      // Commands are already sorted, so first item has highest match
      const maxScore = commandItems.length > 0 ? calculateMatchScore(commandItems[0], searchQuery) : 0;
      groups.push({ label: 'Commands', items: commandItems, maxScore });
    }
    
    const pageItems = filteredItems.filter((i) => i.type === 'page');
    if (pageItems.length > 0) {
      // Pages are already sorted, so first item has highest match
      const maxScore = pageItems.length > 0 ? calculateMatchScore(pageItems[0], searchQuery) : 0;
      groups.push({ label: 'Pages', items: pageItems, maxScore });
    }
    
    // Group entities by type
    const entityGroups: Record<string, CommandPaletteItem[]> = {};
    filteredItems
      .filter((i) => i.type === 'entity')
      .forEach((item) => {
        if (item.type === 'entity') {
          const type = item.result.type;
          if (!entityGroups[type]) entityGroups[type] = [];
          entityGroups[type].push(item);
        }
      });
    
    Object.entries(entityGroups).forEach(([type, items]) => {
      const configKey = ENTITY_TYPE_MAPPING[type] || type;
      const config = entityTypes[configKey];
      if (config) {
        // Calculate score for first item only - results are already sorted by relevance from database
        const maxScore = items.length > 0 ? calculateMatchScore(items[0], searchQuery) : 0;
        groups.push({ label: config.label, items, maxScore });
      }
    });
    
    // Sort groups by maxScore (highest first), then by label for consistency
    return groups.sort((a, b) => {
      if (b.maxScore !== a.maxScore) {
        return b.maxScore - a.maxScore;
      }
      return a.label.localeCompare(b.label);
    });
  }, [filteredItems, searchQuery, calculateMatchScore]);

  // Toggle filter (single select - clicking same filter deselects it)
  const toggleFilter = useCallback((filterType: FilterType) => {
    setSelectedFilter((prev) => {
      // If clicking the same filter, deselect it
      if (prev === filterType) {
        return null;
      }
      // Otherwise, select the new filter
      return filterType;
    });
  }, []);

  // Define available filters
  const availableFilters: Array<{ type: FilterType; label: string }> = useMemo(() => {
    return [
      { type: 'command', label: 'Commands' },
      { type: 'page', label: 'Pages' },
      { type: 'student', label: 'Students' },
      { type: 'staff', label: 'Staff' },
      { type: 'parent', label: 'Parents' },
      { type: 'class', label: 'Classes' },
      { type: 'subject', label: 'Subjects' },
      { type: 'topic', label: 'Topics' },
      { type: 'file', label: 'Files' },
    ];
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[101] flex items-center justify-center px-4 py-4 pointer-events-none">
        <div 
          className="w-full max-w-4xl bg-popover border rounded-lg shadow-xl pointer-events-auto flex flex-col h-[calc(100vh-2rem)] max-h-[800px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search commands, pages, students, staff, parents, classes, subjects, topics, files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
            />
            {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {/* Filter buttons */}
          <div className="px-4 py-2 border-b flex flex-wrap gap-2 flex-shrink-0">
            {availableFilters.map((filter) => {
              const isSelected = selectedFilter === filter.type;
              return (
                <Button
                  key={filter.type}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFilter(filter.type);
                  }}
                  className="h-7 text-xs"
                >
                  {filter.label}
                </Button>
              );
            })}
          </div>

          {/* Results */}
          <div
            ref={resultsRef}
            className="overflow-y-auto overscroll-contain flex-1 min-h-0"
          >
            {filteredItems.length === 0 && !isSearching && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {searchQuery.trim().length < 2 && searchQuery.trim().length > 0
                  ? 'Type at least 2 characters to search entities'
                  : 'No results found'}
              </div>
            )}

            {groupedItems.map((group) => (
              <div key={group.label} className="py-2">
                <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase text-left">
                  {group.label}
                </div>
                <div className="space-y-0">
                  {group.items.map((item) => {
                    const globalIndex = filteredItems.indexOf(item);
                    return renderItem(item, globalIndex);
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t text-xs text-muted-foreground flex items-center justify-between flex-shrink-0">
            <span>Navigate with ↑↓ or Tab, select with Enter</span>
            <span>Press Esc to close</span>
          </div>
        </div>
      </div>

    </>
  );
}
