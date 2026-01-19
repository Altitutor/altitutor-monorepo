'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@altitutor/ui";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@altitutor/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { SkeletonTable } from "@altitutor/ui";
import { ScrollArea } from "@altitutor/ui";
import { 
  Search, 
  ChevronRight,
  ChevronDown,
  Filter,
  X,
  Loader2,
} from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { getSubjectColorHex, formatSubjectDisplay, formatSubjectShortName } from '@/shared/utils/index';
import { TablePagination } from '@/shared/components/TablePagination';
import { useSearchTopics, useChildTopics } from '../hooks/useTopicsQuery';
import { useTopicFilesByTopic } from '../hooks/useTopicsFilesQuery';
import { getFileTypeLabel } from '../utils/file-type-icons';
import { FilePreviewModal } from './FilePreviewModal';
import { useSubjectSearch } from '@/features/subjects/hooks';

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
  basePath = '/topics',
  hideSubjectFilter = false,
}: TopicsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize from URL params
  const getSearchFromUrl = () => searchParams.get('search') || '';
  const getArrayFromUrl = (key: string): string[] => {
    const param = searchParams.get(key);
    return param ? param.split(',').filter(Boolean) : [];
  };
  
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`${basePath}?${params.toString()}`);
  };
  
  // Filter and search state initialized from URL
  const [searchTerm, setSearchTerm] = useState(getSearchFromUrl);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  // If subjectId prop is provided, use it; otherwise use URL params
  const [subjectFilters, setSubjectFilters] = useState<string[]>(
    subjectId ? [subjectId] : getArrayFromUrl('subject')
  );
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('pageSize')) || 50);
  
  // Sync from URL params
  useEffect(() => {
    setSearchTerm(getSearchFromUrl());
    setSubjectFilters(getArrayFromUrl('subject'));
    const pageParam = Number(searchParams.get('page'));
    if (pageParam) setPage(pageParam);
    const pageSizeParam = Number(searchParams.get('pageSize'));
    if (pageSizeParam) setPageSize(pageSizeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);

  // Subject filter popover state
  const [isSubjectPopoverOpen, setIsSubjectPopoverOpen] = useState(false);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');

  // Debounce search term
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1); // Reset to first page on search
      updateUrlParams({ 
        search: searchTerm || null,
        page: null 
      });
    }, 300);
    return () => clearTimeout(timeoutId);
    // updateUrlParams is stable (uses searchParams which is from useSearchParams)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Use React Query hook for debounced subject search
  const { subjects: subjectSearchResults, isLoading: isSubjectSearching } = useSubjectSearch({
    searchQuery: subjectSearchQuery,
    isOpen: isSubjectPopoverOpen,
    limit: 100,
  });

  // React Query hook for data fetching with server-side filtering
  // If subjectId prop is provided, always use it; otherwise use subjectFilters from URL
  const effectiveSubjectIds = subjectId ? [subjectId] : (subjectFilters.length > 0 ? subjectFilters : undefined);
  
  const { 
    data: topicsData, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useSearchTopics({
    search: debouncedSearchTerm || undefined,
    subjectIds: effectiveSubjectIds,
    limit: pageSize,
    offset: (page - 1) * pageSize,
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

  const handleSubjectFilterToggle = (subjectId: string) => {
    const newFilters = subjectFilters.includes(subjectId) 
      ? subjectFilters.filter(id => id !== subjectId)
      : [...subjectFilters, subjectId];
    setSubjectFilters(newFilters);
    setPage(1); // Reset to first page
    updateUrlParams({ 
      subject: newFilters.length > 0 ? newFilters.join(',') : null,
      page: null 
    });
  };

  const clearAllFilters = () => {
    setSubjectFilters([]);
    setSearchTerm('');
    setPage(1);
    updateUrlParams({ 
      subject: null,
      search: null,
      page: null 
    });
  };

  const [selectedTopicInfo, setSelectedTopicInfo] = useState<{ topicName: string; fileCode: string } | null>(null);

  const handleFileClick = (fileId: string, topicName?: string, fileCode?: string) => {
    setSelectedFileId(fileId);
    setSelectedTopicInfo(topicName && fileCode ? { topicName, fileCode } : null);
    setIsFileModalOpen(true);
  };


  // Count active filters
  const activeFiltersCount = subjectFilters.length;

  // Loading state
  if (isLoading && rootTopics.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search topics..."
              className="pl-8"
              disabled
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              <Filter className="h-4 w-4 mr-2" />
              Subject
            </Button>
          </div>
        </div>
        
        <SkeletonTable rows={8} columns={3} />
        
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search topics..."
            className="pl-8"
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value;
                setSearchTerm(value);
              }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllFilters}
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}

          {/* Subject Filter - hide if hideSubjectFilter is true */}
          {!hideSubjectFilter && (
            <Popover open={isSubjectPopoverOpen} onOpenChange={setIsSubjectPopoverOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant={subjectFilters.length > 0 ? "secondary" : "outline"} 
                  size="sm"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Subject {subjectFilters.length > 0 && `(${subjectFilters.length})`}
                </Button>
              </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="end">
              <div className="p-3">
                <Input
                  placeholder="Search subjects..."
                  value={subjectSearchQuery}
                  onChange={(e) => setSubjectSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-1">
                    {isSubjectSearching ? (
                      <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching...
                      </div>
                    ) : subjectSearchResults.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        {subjectSearchQuery ? 'No subjects match your search' : 'No subjects found'}
                      </div>
                    ) : (
                      subjectSearchResults.map((subject) => {
                        const isSelected = subjectFilters.includes(subject.id);
                        return (
                          <Button
                            key={subject.id}
                            variant={isSelected ? "secondary" : "ghost"}
                            className="w-full justify-start h-auto p-2"
                            onClick={() => handleSubjectFilterToggle(subject.id)}
                          >
                            <div className="font-medium">{formatSubjectDisplay(subject)}</div>
                          </Button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Files</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rootTopics.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24">
                  {isLoading ? (
                    "Loading topics..."
                  ) : searchTerm || activeFiltersCount > 0 ? (
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
                level={0}
              />
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={(newPage) => {
          setPage(newPage);
          updateUrlParams({ page: newPage === 1 ? null : String(newPage) });
        }}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
          updateUrlParams({ 
            pageSize: size === 50 ? null : String(size),
            page: null 
          });
        }}
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
        <TableCell>
          <div
            className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: subjectColorHex ? `${subjectColorHex}20` : undefined,
              color: subjectColorHex || undefined,
            }}
          >
            {formatSubjectShortName(topic.subject)}
          </div>
        </TableCell>
        <TableCell style={{ paddingLeft: `${paddingLeft}px` }}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{topicCode}</span>
            <span className="text-sm">{topic.name}</span>
          </div>
        </TableCell>
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
      </TableRow>
      {hasChildren && isExpanded && childTopicsWithSubjects.length > 0 && (
        <TopicRows
          allTopics={[...allTopics, ...childTopicsWithSubjects]}
          topics={childTopicsWithSubjects}
          expandedTopics={expandedTopics}
          onToggleExpansion={onToggleExpansion}
          onFileClick={onFileClick}
          onViewTopic={onViewTopic}
          level={level + 1}
          parentId={topic.id}
        />
      )}
    </>
  );
}
