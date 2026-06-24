'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Input, SearchFromDropdown } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { tutorToolbarSearchContainerClassName, tutorToolbarSearchInputClassName } from '@/shared/lib/tutor-visual';
import { entityTypes } from '../config/commandPalette.config';
import { useCommandPaletteSearch } from '../hooks/useCommandPaletteSearch';
import { useCommandPaletteFiltering } from '../hooks/useCommandPaletteFiltering';
import { useCommandPaletteKeyboard } from '../hooks/useCommandPaletteKeyboard';
import { useCommandPalettePages } from '../hooks/useCommandPalettePages';
import { PageItem } from './PageItem';
import { EntityItem } from './EntityItem';
import type { FilterType } from '../utils/filtering';

const ENTITY_TYPE_MAPPING: Record<string, string> = {
  subject: 'subjects',
  topic: 'topics',
  file: 'files',
  flashcards: 'flashcards',
  class: 'classes',
};

const COMMAND_PALETTE_FILTER_OPTIONS: Array<{ type: FilterType; label: string }> = [
  { type: 'page', label: 'Pages' },
  { type: 'subject', label: 'Subjects' },
  { type: 'topic', label: 'Topics' },
  { type: 'file', label: 'Files' },
  { type: 'flashcards', label: 'Flashcards' },
  { type: 'class', label: 'Classes' },
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

  const allPages = useCommandPalettePages();

  const { results: entityResults, isLoading: isSearching } = useCommandPaletteSearch({
    search: searchQuery,
    enabled: isOpen,
    selectedFilters,
    allFilterTypes: ALL_COMMAND_PALETTE_FILTER_TYPES,
  });

  const { filteredItems, groupedItems } = useCommandPaletteFiltering({
    pages: allPages,
    entityResults,
    searchQuery,
    selectedFilters,
    allFilterTypes: ALL_COMMAND_PALETTE_FILTER_TYPES,
    entityTypeMapping: ENTITY_TYPE_MAPPING,
    entityTypes,
  });

  useEffect(() => {
    if (filteredItems.length > 0) setSelectedIndex(0);
  }, [filteredItems.length]);

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setSelectedIndex(0);
    setSelectedFilters(ALL_COMMAND_PALETTE_FILTER_TYPES);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const handleSelectItem = useCallback(
    (item: (typeof filteredItems)[number]) => {
      if (item.type === 'page') {
        onClose();
        router.push(item.href);
        return;
      }

      if (item.type === 'entity') {
        if (item.result.type === 'class') {
          onEntitySelected?.('class', item.result.id);
          onClose();
          return;
        }

        onClose();
        router.push(item.result.href);
      }
    },
    [onClose, onEntitySelected, router],
  );

  const { handleKeyDown } = useCommandPaletteKeyboard({
    filteredItems,
    selectedIndex,
    onIndexChange: setSelectedIndex,
    onSelectItem: handleSelectItem,
    onClose,
  });

  const renderItem = useCallback(
    (item: (typeof filteredItems)[number], index: number) => {
      const isSelected = index === selectedIndex;

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
    [selectedIndex, searchQuery, handleSelectItem],
  );

  if (!isOpen) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn('mx-3 mt-3 flex shrink-0 items-center', tutorToolbarSearchContainerClassName)}>
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
          type="text"
          placeholder="Search pages, subjects, topics, files, flashcards..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            'h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
            tutorToolbarSearchInputClassName,
          )}
        />
        {isSearching ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin opacity-50" /> : null}
      </div>

      <div ref={resultsRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-2">
        {filteredItems.length === 0 && !isSearching ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {searchQuery.trim().length > 0 && searchQuery.trim().length < 2
              ? 'Type at least 2 characters to search resources'
              : 'No results found'}
          </div>
        ) : null}

        {groupedItems.map((group) => (
          <div key={group.label} className="py-1">
            <div className="px-4 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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

      <div className="flex shrink-0 items-center justify-between border-t border-black/[0.06] px-4 py-2 text-xs text-muted-foreground dark:border-white/10">
        <span>Navigate with ↑↓ or Tab, select with Enter</span>
        <span>Press Esc to close</span>
      </div>
    </div>
  );
}
