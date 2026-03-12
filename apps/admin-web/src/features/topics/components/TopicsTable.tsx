'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  SkeletonTable,
  DataTableToolbar,
  TablePagination,
} from "@altitutor/ui";
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { Tables, DataTableFilterDefinition, DataTableSortOption, DataTableColumnDefinition } from '@altitutor/shared';
import { getSubjectColorHex } from '@/shared/utils/index';
import { useSearchTopics, useChildTopics } from '../hooks/useTopicsQuery';
import { useTopicFilesByTopic } from '../hooks/useTopicsFilesQuery';
import { getFileTypeLabel } from '@/shared/utils/file-type-icons';
import { FilePreviewModal } from './FilePreviewModal';
import { useSubjectSearch } from '@/features/subjects/hooks';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
import { useCurrentStaff } from '@/shared/hooks';

interface TopicsTableProps {
  onRefresh?: number;
  onViewTopic?: (topicId: string) => void;
  subjectId?: string; // Optional: filter to a specific subject
  basePath?: string; // Optional: base path for navigation (defaults to /topics)
  hideSubjectFilter?: boolean; // Optional: hide subject filter UI when filtered to one subject
}

type TopicWithSubject = Tables<'topics'> & { subject: Tables<'subjects'> };

export function TopicsTable({ 
  onRefresh: _onRefresh, 
  onViewTopic,
  subjectId,
  basePath: _basePath = '/topics',
  hideSubjectFilter = false,
}: TopicsTableProps) {
  useRouter(); // Required for URL sync in useDataTable
  const { data: currentStaff } = useCurrentStaff();
  const { data: quickFilters = [] } = useQuickFilters('topics');
  
  const defaultFilters = useMemo(() => {
    const filters: Record<string, unknown[]> = {};
    if (subjectId) {
      filters.subject = [subjectId];
    }
    return filters;
  }, [subjectId]);
  
  const defaultSort = useMemo(() => ({ field: 'name', direction: 'asc' as const }), []);
  const defaultVisibleColumns = useMemo(() => ['subject', 'name', 'files'], []);

  const {
    state,
    setSearch,
    setSort,
    setFilters,
    setPage,
    setPageSize,
    setVisibleColumns,
    applyQuickFilter,
    resetFilters,
  } = useDataTable({
    defaultFilters,
    defaultSort,
    defaultVisibleColumns,
    filterKeys: ['subject'],
  });

  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);

  // Subject filter popover state
  const [isSubjectPopoverOpen] = useState(false);
  const [subjectSearchQuery] = useState('');

  // Use React Query hook for debounced subject search
  const { subjects: subjectSearchResults } = useSubjectSearch({
    searchQuery: subjectSearchQuery,
    isOpen: isSubjectPopoverOpen,
    limit: 100,
  });

  // React Query hook for data fetching with server-side filtering
  const effectiveSubjectIds = subjectId ? [subjectId] : (state.filters.subject as string[] || undefined);
  
  const { 
    data: topicsData, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useSearchTopics({
    search: state.search || undefined,
    subjectIds: effectiveSubjectIds,
    limit: state.pageSize,
    offset: (state.page - 1) * state.pageSize,
  });

  const allTopicsFromSearch = useMemo(() => {
    return topicsData?.topics || [];
  }, [topicsData?.topics]);
  
  const total = topicsData?.total || 0;

  // Filter to show only root topics initially (for pagination)
  // Children will be fetched separately when expanded
  const rootTopics = useMemo(() => {
    return allTopicsFromSearch.filter(t => !t.parent_id);
  }, [allTopicsFromSearch]);

  // Get all topics as flat array for code derivation (need all for hierarchy)
  const allTopicsFlat = useMemo(() => {
    return allTopicsFromSearch;
  }, [allTopicsFromSearch]);

  const toggleTopicExpansion = (topicId: string) => {
    setExpandedTopics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }
      return newSet;
    });
  };

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => {
    if (hideSubjectFilter) return [];
    
    return [
      {
        key: 'subject',
        label: 'Subject',
        options: subjectSearchResults.map(s => ({ label: s.long_name ?? '', value: s.id })),
      },
    ];
  }, [hideSubjectFilter, subjectSearchResults]);

  const sortOptions: DataTableSortOption[] = [
    { key: 'name', label: 'Name' },
    { key: 'index', label: 'Index' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'subject', label: 'Subject' },
    { key: 'name', label: 'Name' },
    { key: 'files', label: 'Files' },
  ];

  // Reset to page 1 when search term or filters change
  useEffect(() => {
    setPage(1);
  }, [state.search, state.filters, setPage]);

  const [selectedTopicInfo, setSelectedTopicInfo] = useState<{ topicName: string; fileCode: string } | null>(null);

  const handleFileClick = (fileId: string, topicName?: string, fileCode?: string) => {
    setSelectedFileId(fileId);
    setSelectedTopicInfo(topicName && fileCode ? { topicName, fileCode } : null);
    setIsFileModalOpen(true);
  };

  // Loading state
  if (isLoading && rootTopics.length === 0) {
    return (
      <div className="space-y-4">
        <DataTableToolbar
          state={state}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onSortChange={setSort}
          onGroupByChange={() => {}}
          onVisibleColumnsChange={setVisibleColumns}
          onQuickFilterApply={(qf) => applyQuickFilter(qf, currentStaff?.id)}
          onReset={resetFilters}
          filterDefinitions={filterDefinitions}
          sortOptions={sortOptions}
          columnDefinitions={columnDefinitions}
          quickFilters={quickFilters}
          searchPlaceholder="Search topics..."
          isLoading={true}
        />
        
        <SkeletonTable rows={8} columns={state.visibleColumns.length + 1} />
        
        <div className="text-sm text-muted-foreground">
          Loading topics...
        </div>
      </div>
    );
  }

  // Error state
  if (error && rootTopics.length === 0) {
    return (
      <div className="text-red-500 p-4">
        Failed to load topics. Please try again.
        <button 
          onClick={() => refetch()} 
          className="ml-2 text-blue-600 hover:text-blue-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DataTableToolbar
        state={state}
        onSearchChange={setSearch}
        onFiltersChange={setFilters}
        onSortChange={setSort}
        onGroupByChange={() => {}}
        onVisibleColumnsChange={setVisibleColumns}
        onQuickFilterApply={(qf) => applyQuickFilter(qf, currentStaff?.id)}
        onReset={resetFilters}
        filterDefinitions={filterDefinitions}
        sortOptions={sortOptions}
        columnDefinitions={columnDefinitions}
        quickFilters={quickFilters}
        searchPlaceholder="Search topics..."
        isLoading={isFetching}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              {state.visibleColumns.includes('subject') && <TableHead>Subject</TableHead>}
              {state.visibleColumns.includes('name') && <TableHead>Name</TableHead>}
              {state.visibleColumns.includes('files') && <TableHead>Files</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rootTopics.length === 0 ? (
              <TableRow>
                <TableCell colSpan={state.visibleColumns.length + 1} className="text-center h-24">
                  {isLoading ? (
                    "Loading topics..."
                  ) : state.search || Object.keys(state.filters).length > 0 ? (
                    "No topics match your filters"
                  ) : (
                    "No topics found"
                  )}
                </TableCell>
              </TableRow>
            ) : (
              <TopicRows
                allTopics={allTopicsFlat}
                topics={rootTopics}
                expandedTopics={expandedTopics}
                onToggleExpansion={toggleTopicExpansion}
                onFileClick={handleFileClick}
                onViewTopic={onViewTopic}
                visibleColumns={state.visibleColumns}
                level={0}
              />
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <TablePagination
        page={state.page}
        pageSize={state.pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={isFileModalOpen}
        fileId={selectedFileId}
        topicName={selectedTopicInfo?.topicName}
        fileCode={selectedTopicInfo?.fileCode}
        onClose={() => {
          setIsFileModalOpen(false);
          setSelectedFileId(null);
          setSelectedTopicInfo(null);
        }}
      />
    </div>
  );
}

interface TopicRowsProps {
  allTopics: TopicWithSubject[];
  topics: TopicWithSubject[];
  expandedTopics: Set<string>;
  onToggleExpansion: (topicId: string) => void;
  onFileClick: (fileId: string, topicName?: string, fileCode?: string) => void;
  onViewTopic?: (topicId: string) => void;
  visibleColumns: string[];
  level: number;
  parentId?: string | null;
}

function TopicRows({
  allTopics,
  topics,
  expandedTopics,
  onToggleExpansion,
  onFileClick,
  onViewTopic,
  visibleColumns,
  level,
  parentId = null,
}: TopicRowsProps) {
  // Filter topics by parent
  const filteredTopics = useMemo(() => {
    return topics.filter(t => {
      if (parentId === null) {
        return !t.parent_id;
      }
      return t.parent_id === parentId;
    }).sort((a, b) => {
      // Sort by subject name, then by index
      const subjectCompare = a.subject.name.localeCompare(b.subject.name);
      if (subjectCompare !== 0) return subjectCompare;
      return a.index - b.index;
    });
  }, [topics, parentId]);

  if (filteredTopics.length === 0) {
    return null;
  }

  return (
    <>
      {filteredTopics.map((topic) => {
        const topicCode = topic.code || '';
        const hasChildren = allTopics.some(t => t.parent_id === topic.id);
        const isExpanded = expandedTopics.has(topic.id);
        const subjectColorHex = getSubjectColorHex(topic.subject);

        return (
          <TopicRow
            key={topic.id}
            topic={topic}
            topicCode={topicCode}
            subjectColorHex={subjectColorHex}
            hasChildren={hasChildren}
            isExpanded={isExpanded}
            level={level}
            allTopics={allTopics}
            expandedTopics={expandedTopics}
            onToggleExpansion={onToggleExpansion}
            onFileClick={onFileClick}
            onViewTopic={onViewTopic}
            visibleColumns={visibleColumns}
          />
        );
      })}
    </>
  );
}

interface TopicRowProps {
  topic: TopicWithSubject;
  topicCode: string;
  subjectColorHex: string | null;
  hasChildren: boolean;
  isExpanded: boolean;
  level: number;
  allTopics: TopicWithSubject[];
  expandedTopics: Set<string>;
  onToggleExpansion: (topicId: string) => void;
  onFileClick: (fileId: string, topicName?: string, fileCode?: string) => void;
  onViewTopic?: (topicId: string) => void;
  visibleColumns: string[];
}

function TopicRow({
  topic,
  topicCode,
  subjectColorHex,
  hasChildren,
  isExpanded,
  level,
  allTopics,
  expandedTopics,
  onToggleExpansion,
  onFileClick,
  onViewTopic,
  visibleColumns,
}: TopicRowProps) {
  const { data: topicFiles = [] } = useTopicFilesByTopic(topic.id);
  const { data: childTopics = [] } = useChildTopics(isExpanded && hasChildren ? topic.id : null);
  
  // Get subject info for child topics
  const childTopicsWithSubjects = useMemo(() => {
    return childTopics.map(child => ({
      ...child,
      subject: topic.subject, // Children have same subject as parent
    })) as TopicWithSubject[];
  }, [childTopics, topic.subject]);

  const paddingLeft = level * 24;

  const handleRowClick = () => {
    if (onViewTopic) {
      onViewTopic(topic.id);
    }
  };

  return (
    <>
      <TableRow 
        className={onViewTopic ? "cursor-pointer hover:bg-muted/50" : undefined}
        onClick={onViewTopic ? handleRowClick : undefined}
      >
        <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
          {hasChildren ? (
            <button
              onClick={() => onToggleExpansion(topic.id)}
              className="p-1 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : null}
        </TableCell>
        {visibleColumns.includes('subject') && (
          <TableCell>
            <div
              className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: subjectColorHex ? `${subjectColorHex}20` : undefined,
                color: subjectColorHex || undefined,
              }}
            >
              {topic.subject?.short_name ?? topic.subject?.long_name ?? topic.subject?.name ?? ''}
            </div>
          </TableCell>
        )}
        {visibleColumns.includes('name') && (
          <TableCell style={{ paddingLeft: `${paddingLeft}px` }}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{topicCode}</span>
              <span className="text-sm">{topic.name}</span>
            </div>
          </TableCell>
        )}
        {visibleColumns.includes('files') && (
          <TableCell onClick={(e) => e.stopPropagation()}>
            <TooltipProvider>
              <div className="space-y-1">
                {topicFiles.map((tf) => {
                  const fileCode = tf.code || '';
                  const typeLabel = getFileTypeLabel(tf.type);
                  const filename = tf.file?.filename || 'Unknown file';
                  const fileId = tf.file?.id;

                  return (
                    <div
                      key={tf.id}
                      className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-muted/50"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => fileId && onFileClick(fileId, topic.name, fileCode)}
                            className="flex-1 text-left min-w-0 truncate text-sm"
                          >
                            <span className="font-mono">{fileCode}</span>{' '}
                            <span className="text-muted-foreground">{typeLabel}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{filename}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })}
                {topicFiles.length === 0 && (
                  <span className="text-sm text-muted-foreground">No files</span>
                )}
              </div>
            </TooltipProvider>
          </TableCell>
        )}
      </TableRow>
      {hasChildren && isExpanded && childTopicsWithSubjects.length > 0 && (
        <TopicRows
          allTopics={[...allTopics, ...childTopicsWithSubjects]}
          topics={childTopicsWithSubjects}
          expandedTopics={expandedTopics}
          onToggleExpansion={onToggleExpansion}
          onFileClick={onFileClick}
          onViewTopic={onViewTopic}
          visibleColumns={visibleColumns}
          level={level + 1}
          parentId={topic.id}
        />
      )}
    </>
  );
}
