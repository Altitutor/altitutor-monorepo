'use client';

import { useState, useMemo, useEffect } from 'react';
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
  Download,
  Loader2,
} from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { getSubjectColorHex, formatSubjectDisplay } from '@/shared/utils/index';
import { useSearchTopics, useChildTopics } from '../hooks/useTopicsQuery';
import { useTopicFilesByTopic } from '../hooks/useTopicsFilesQuery';
import { deriveTopicCode } from '../utils/codes';
import { deriveTopicFileCode } from '../utils/codes';
import { getFileTypeLabel } from '../utils/file-type-icons';
import { FilePreviewModal } from './FilePreviewModal';
import { getSignedUrl } from '@/shared/lib/supabase/storage';
import { subjectsApi } from '@/features/subjects/api/subjects';

interface TopicsTableProps {
  onRefresh?: number;
  onViewTopic?: (topicId: string) => void;
}

type TopicWithSubject = Tables<'topics'> & { subject: Tables<'subjects'> };

export function TopicsTable({ onRefresh: _onRefresh, onViewTopic: _onViewTopic }: TopicsTableProps) {
  // Filter and search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [subjectFilters, setSubjectFilters] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);

  // Subject filter popover state
  const [isSubjectPopoverOpen, setIsSubjectPopoverOpen] = useState(false);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [subjectSearchResults, setSubjectSearchResults] = useState<Tables<'subjects'>[]>([]);
  const [isSubjectSearching, setIsSubjectSearching] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Debounced subject search
  useEffect(() => {
    if (!isSubjectPopoverOpen) {
      setSubjectSearchQuery('');
      setSubjectSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      if (subjectSearchQuery.trim().length === 0) {
        setIsSubjectSearching(true);
        try {
          const { subjects } = await subjectsApi.list({ limit: 100, offset: 0 });
          setSubjectSearchResults(subjects);
        } catch (error) {
          console.error('Error fetching subjects:', error);
          setSubjectSearchResults([]);
        } finally {
          setIsSubjectSearching(false);
        }
      } else {
        setIsSubjectSearching(true);
        try {
          const { subjects } = await subjectsApi.list({ 
            search: subjectSearchQuery.trim(), 
            limit: 100, 
            offset: 0 
          });
          setSubjectSearchResults(subjects);
        } catch (error) {
          console.error('Error searching subjects:', error);
          setSubjectSearchResults([]);
        } finally {
          setIsSubjectSearching(false);
        }
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [subjectSearchQuery, isSubjectPopoverOpen]);

  // React Query hook for data fetching with server-side filtering
  const { 
    data: topicsData, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useSearchTopics({
    search: debouncedSearchTerm || undefined,
    subjectIds: subjectFilters.length > 0 ? subjectFilters : undefined,
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
    setSubjectFilters(prev => 
      prev.includes(subjectId) 
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
    setPage(1); // Reset to first page
  };

  const clearAllFilters = () => {
    setSubjectFilters([]);
    setSearchTerm('');
    setPage(1);
  };

  const handleFileClick = (fileId: string) => {
    setSelectedFileId(fileId);
    setIsFileModalOpen(true);
  };

  const handleFileDownload = async (storagePath: string, filename: string) => {
    try {
      const signedUrl = await getSignedUrl(storagePath);
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download file:', error);
    }
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
      <div className="flex justify-between items-center gap-4">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search topics..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
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

          {/* Subject Filter */}
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
                onFileDownload={handleFileDownload}
                level={0}
              />
            )}
          </TableBody>
        </Table>
      </div>

      {/* Results count and pagination */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Showing {rootTopics.length} of {total} root topics
          {isFetching && <span className="ml-2">(Refreshing...)</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / pageSize) || isLoading}
          >
            Next
          </Button>
        </div>
      </div>

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={isFileModalOpen}
        fileId={selectedFileId}
        onClose={() => {
          setIsFileModalOpen(false);
          setSelectedFileId(null);
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
  onFileClick: (fileId: string) => void;
  onFileDownload: (storagePath: string, filename: string) => void;
  level: number;
  parentId?: string | null;
}

function TopicRows({
  allTopics,
  topics,
  expandedTopics,
  onToggleExpansion,
  onFileClick,
  onFileDownload,
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
        const topicCode = deriveTopicCode(topic, allTopics);
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
            onFileDownload={onFileDownload}
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
  onFileClick: (fileId: string) => void;
  onFileDownload: (storagePath: string, filename: string) => void;
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
  onFileDownload,
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

  return (
    <>
      <TableRow>
        <TableCell className="w-12">
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
            {formatSubjectDisplay(topic.subject)}
          </div>
        </TableCell>
        <TableCell style={{ paddingLeft: `${paddingLeft}px` }}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{topicCode}</span>
            <span className="text-sm">{topic.name}</span>
          </div>
        </TableCell>
        <TableCell>
          <div className="space-y-1">
            {topicFiles.map((tf) => {
              const fileCode = deriveTopicFileCode(tf, topicCode, tf.type);
              const typeLabel = getFileTypeLabel(tf.type);
              const filename = tf.file?.filename || 'Unknown file';
              const storagePath = tf.file?.storage_path || '';
              const fileId = tf.file?.id;

              return (
                <div
                  key={tf.id}
                  className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-muted/50 group"
                >
                  <button
                    onClick={() => fileId && onFileClick(fileId)}
                    className="flex-1 text-left min-w-0 truncate text-sm"
                    title={`${fileCode} ${typeLabel} ${filename}`}
                  >
                    <span className="font-mono">{fileCode}</span>{' '}
                    <span className="text-muted-foreground">{typeLabel}</span>{' '}
                    <span className="truncate">{filename}</span>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (storagePath) {
                        onFileDownload(storagePath, filename);
                      }
                    }}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
            {topicFiles.length === 0 && (
              <span className="text-sm text-muted-foreground">No files</span>
            )}
          </div>
        </TableCell>
      </TableRow>
      {hasChildren && isExpanded && childTopicsWithSubjects.length > 0 && (
        <TopicRows
          allTopics={[...allTopics, ...childTopicsWithSubjects]}
          topics={childTopicsWithSubjects}
          expandedTopics={expandedTopics}
          onToggleExpansion={onToggleExpansion}
          onFileClick={onFileClick}
          onFileDownload={onFileDownload}
          level={level + 1}
          parentId={topic.id}
        />
      )}
    </>
  );
}
