'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
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
import { Input, SearchFromDropdown } from '@altitutor/ui';
import { focusCommandPaletteInput } from '@altitutor/shared';
import { getEffectiveEntityFilters } from '../utils/entitySearchTypes';
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
  note: 'notes',
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
  { title: 'Documents', href: '/documents', icon: FileText },
];

const COMMAND_PALETTE_FILTER_OPTIONS: Array<{ type: FilterType; label: string }> = [
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
  { type: 'note', label: 'Notes' },
];

const ALL_COMMAND_PALETTE_FILTER_TYPES = COMMAND_PALETTE_FILTER_OPTIONS.map(
  (filter) => filter.type,
);

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
  const [selectedFilters, setSelectedFilters] = useState<FilterType[]>(
    ALL_COMMAND_PALETTE_FILTER_TYPES,
  );

  // Get command actions (may be null if QuickActionsProvider not available)
  const commandActions = useCommandPaletteCommandActions(onClose);

  // Extract pages from navItems
  const navPages = useMemo(() => extractPagesFromNavItems(navItems), []);
  const allPages = useMemo(() => [...navPages, ...additionalPages], [navPages]);

  // Setup commands with actions
  const { commandsWithActions } = useCommandPaletteCommands({
    commandActions,
  });

  const effectiveEntityFilters = useMemo(
    () => getEffectiveEntityFilters(selectedFilters, searchQuery),
    [selectedFilters, searchQuery],
  );

  // Search entities
  const { results: entityResults, isLoading: isSearching } = useCommandPaletteSearch({
    search: searchQuery,
    enabled: isOpen,
    selectedFilters,
    allFilterTypes: ALL_COMMAND_PALETTE_FILTER_TYPES,
  });

  // Filter and sort items
  const { filteredItems, groupedItems, displayItems } = useCommandPaletteFiltering({
    commands: commandsWithActions,
    pages: allPages,
    entityResults,
    searchQuery,
    selectedFilters: effectiveEntityFilters,
    allFilterTypes: ALL_COMMAND_PALETTE_FILTER_TYPES,
    entityTypeMapping: ENTITY_TYPE_MAPPING,
    entityTypes,
  });

  // Reset selected index when visible items change
  useEffect(() => {
    if (displayItems.length > 0) {
      setSelectedIndex(0);
    }
  }, [displayItems]);

  // Reset state and focus input when opened (Radix Dialog focuses first focusable, but we ensure input gets it)
  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setSelectedIndex(0);
    setSelectedFilters(ALL_COMMAND_PALETTE_FILTER_TYPES);
    focusCommandPaletteInput(inputRef.current);
  }, [isOpen]);

  // Handle item selection
  const handleSelectItem = useCallback(
    (item: typeof displayItems[number]) => {
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
    filteredItems: displayItems,
    selectedIndex,
    onIndexChange: setSelectedIndex,
    onSelectItem: handleSelectItem,
    onClose,
  });

  // Render item helper
  const renderItem = useCallback(
    (item: typeof displayItems[number], index: number) => {
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

  if (!isOpen) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 border-b px-3 py-2">
        <div className="flex h-10 min-w-0 flex-1 items-center rounded-md border border-input bg-background px-2 ring-offset-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <SearchFromDropdown
            options={COMMAND_PALETTE_FILTER_OPTIONS.map((filter) => ({
              label: filter.label,
              value: filter.type,
            }))}
            value={selectedFilters}
            onValueChange={(values) => setSelectedFilters(values as FilterType[])}
            menuLabel="Search in"
            allSelectedLabel="All types"
            partialSelectedSuffix="types"
            menuContentClassName="z-[110]"
            modal={false}
          />
          <Input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Search or try 12CHEM 2.2 for a topic/file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
          />
          {isSearching ? (
            <Loader2 className="mr-1 h-4 w-4 shrink-0 animate-spin opacity-50" />
          ) : null}
        </div>
      </div>

      <div
        ref={resultsRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
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
            <div className="px-4 py-1.5 text-left text-xs font-semibold uppercase text-muted-foreground">
              {group.label}
            </div>
            <div className="space-y-0">
              {group.items.map((item) => {
                const index = displayItems.indexOf(item);
                return renderItem(item, index);
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
        <span>Navigate with ↑↓ or Tab, select with Enter</span>
        <span>Press Esc to close</span>
      </div>
    </div>
  );
}
