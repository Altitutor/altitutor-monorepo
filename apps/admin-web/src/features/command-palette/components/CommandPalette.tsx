'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  FolderKanban,
} from 'lucide-react';
import { Input, Button } from '@altitutor/ui';
import { useCommandPaletteSearch } from '../hooks/useCommandPaletteSearch';
import {
  additionalPages,
  extractPagesFromNavItems,
  entityTypes,
} from '../config/commandPalette.config';
import { useCommandPaletteCommandActions } from '../hooks/useCommandPaletteActions';
import { useCommandPaletteCommands } from '../hooks/useCommandPaletteCommands';
import { useCommandPaletteFiltering } from '../hooks/useCommandPaletteFiltering';
import { useCommandPaletteKeyboard } from '../hooks/useCommandPaletteKeyboard';
import { CommandItem } from './CommandItem';
import { PageItem } from './PageItem';
import { EntityItem } from './EntityItem';
import type { LucideIcon } from 'lucide-react';
import type { FilterType } from '../utils/filtering';

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

// Nav items matching layout.tsx - pages will be automatically searchable
const navItems: Array<{ title: string; href: string; icon: LucideIcon }> = [
  { title: 'Dashboard', href: '/dashboard', icon: Home },
  { title: 'Tasks', href: '/tasks', icon: CheckSquare },
  { title: 'Projects', href: '/projects', icon: FolderKanban },
  { title: 'Reconciliation', href: '/reconciliation', icon: AlertTriangle },
  { title: 'Messages', href: '/messages', icon: MessageCircle },
  { title: 'Students', href: '/students', icon: GraduationCap },
  { title: 'Parents', href: '/parents', icon: UserRound },
  { title: 'Staff', href: '/staff', icon: Users },
  { title: 'Classes', href: '/classes', icon: Calendar },
  { title: 'Admin Shifts', href: '/admin-shifts', icon: Calendar },
  { title: 'Sessions', href: '/sessions', icon: ClipboardList },
  { title: 'Invoices', href: '/invoices', icon: CreditCard },
  { title: 'Reports', href: '/reports', icon: FileText },
  { title: 'Tutor logs', href: '/tutor-logs', icon: ClipboardList },
  { title: 'Subjects', href: '/subjects', icon: Beaker },
  { title: 'Topics', href: '/topics', icon: Newspaper },
  { title: 'Notes', href: '/notes', icon: FileText },
];

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

  // Setup commands with actions
  const { commandsWithActions } = useCommandPaletteCommands({
    commandActions,
  });

  // Search entities
  const { results: entityResults, isLoading: isSearching } = useCommandPaletteSearch({
    search: searchQuery,
    enabled: isOpen,
  });

  // Filter and sort items
  const { filteredItems, groupedItems } = useCommandPaletteFiltering({
    commands: commandsWithActions,
    pages: allPages,
    entityResults,
    searchQuery,
    selectedFilter,
    entityTypeMapping: ENTITY_TYPE_MAPPING,
    entityTypes,
  });

  // Reset selected index when items change
  useEffect(() => {
    if (filteredItems.length > 0) {
      setSelectedIndex(0);
    }
  }, [filteredItems.length]);

  // Reset state and focus input when opened (Radix Dialog focuses first focusable, but we ensure input gets it)
  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setSelectedIndex(0);
    setSelectedFilter(null);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Handle item selection
  const handleSelectItem = useCallback(
    (item: typeof filteredItems[number]) => {
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
    [onClose, router, onEntitySelected]
  );

  // Keyboard navigation
  const { handleKeyDown } = useCommandPaletteKeyboard({
    filteredItems,
    selectedIndex,
    onIndexChange: setSelectedIndex,
    onSelectItem: handleSelectItem,
    onClose,
  });

  // Render item helper
  const renderItem = useCallback(
    (item: typeof filteredItems[number], index: number) => {
      const isSelected = index === selectedIndex;

      if (item.type === 'command') {
        return (
          <CommandItem
            key={`command-${item.id}`}
            id={item.id}
            title={item.title}
            description={item.description}
            icon={item.icon}
            action={item.action}
            isSelected={isSelected}
            searchQuery={searchQuery}
            onSelect={() => handleSelectItem(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          />
        );
      }

      if (item.type === 'page') {
        return (
          <PageItem
            key={`page-${item.id}`}
            id={item.id}
            title={item.title}
            icon={item.icon}
            isSelected={isSelected}
            searchQuery={searchQuery}
            onSelect={() => handleSelectItem(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          />
        );
      }

      if (item.type === 'entity') {
        return (
          <EntityItem
            key={`entity-${item.result.type}-${item.result.id}`}
            result={item.result}
            isSelected={isSelected}
            searchQuery={searchQuery}
            onSelect={() => handleSelectItem(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          />
        );
      }

      return null;
    },
    [selectedIndex, searchQuery, handleSelectItem]
  );

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
      { type: 'task', label: 'Tasks' },
      { type: 'issue', label: 'Issues' },
      { type: 'project', label: 'Projects' },
      { type: 'topic', label: 'Topics' },
      { type: 'file', label: 'Files' },
    ];
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none">
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
              placeholder="Search commands, pages, students, staff, parents, classes, subjects, tasks, issues, projects, topics, files..."
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
