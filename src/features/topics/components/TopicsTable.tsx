'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  ExpandedState,
  getExpandedRowModel,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SkeletonTable } from "@/components/ui/skeleton-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowUpDown, ChevronDown, ChevronRight, Plus, Search, X, RefreshCw } from 'lucide-react';
import { useTopicsWithSubjects, useSubtopicsWithTopics, useDeleteTopic, useDeleteSubtopic } from '../hooks/useTopicsQuery';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import type { Topic, Subtopic } from '../types';
import type { Subject, SubjectCurriculum } from '@/shared/lib/supabase/database/types';
import { ViewTopicModal } from './ViewTopicModal';
import { AddSubtopicModal } from './AddSubtopicModal';
import { ViewSubtopicModal } from './ViewSubtopicModal';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { cn } from "@/shared/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatSubjectDisplay } from "@/shared/utils";
import React from 'react';
import { AddTopicModal } from './AddTopicModal';

interface TopicsTableProps {
  onRefresh?: number;
}

// Define a type that includes both Topic and Subtopics in a unified structure
type TopicRow = Topic & {
  isSubtopic?: false;
  subtopics?: Subtopic[];
  subject?: Subject;
};

type SubtopicRow = Subtopic & {
  isSubtopic: true;
  topicId: string;
  topicName?: string;
};

type TableRow = TopicRow | SubtopicRow;

export function TopicsTable({ onRefresh }: TopicsTableProps) {
  const router = useRouter();
  
  // React Query hooks for data fetching
  const { 
    data: topicsData = [], 
    isLoading: topicsLoading, 
    error: topicsError,
    refetch: refetchTopics 
  } = useTopicsWithSubjects();
  
  const { 
    data: subtopicsData = [], 
    isLoading: subtopicsLoading, 
    error: subtopicsError,
    refetch: refetchSubtopics 
  } = useSubtopicsWithTopics();
  
  const { 
    data: subjects = [], 
    isLoading: subjectsLoading, 
    error: subjectsError,
    refetch: refetchSubjects 
  } = useSubjects();

  // Mutation hooks
  const deleteTopicMutation = useDeleteTopic();
  const deleteSubtopicMutation = useDeleteSubtopic();

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'subject', desc: false },
    { id: 'number', desc: false }
  ]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [textFilter, setTextFilter] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [subjectFilterOpen, setSubjectFilterOpen] = useState(false);
  
  // Modals state
  const [viewTopicId, setViewTopicId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editTopicId, setEditTopicId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddTopicModalOpen, setIsAddTopicModalOpen] = useState(false);
  const [isAddSubtopicModalOpen, setIsAddSubtopicModalOpen] = useState(false);
  const [addSubtopicToTopicId, setAddSubtopicToTopicId] = useState<string | null>(null);
  const [viewSubtopicId, setViewSubtopicId] = useState<string | null>(null);
  const [isViewSubtopicModalOpen, setIsViewSubtopicModalOpen] = useState(false);

  // Memoized table data creation
  const data = useMemo(() => {
    const tableData: TableRow[] = [];
    
    // Create a map of subtopics by topic ID for efficient lookup
    const subtopicsByTopic: Record<string, Subtopic[]> = {};
    subtopicsData.forEach(subtopic => {
      if (!subtopicsByTopic[subtopic.topicId]) {
        subtopicsByTopic[subtopic.topicId] = [];
      }
      subtopicsByTopic[subtopic.topicId].push(subtopic);
    });

    // Process topics and add their subtopics
    topicsData.forEach(topic => {
      const topicSubtopics = subtopicsByTopic[topic.id] || [];
      
      // Add the topic row
      const topicRow: TopicRow = {
        ...topic,
        isSubtopic: false,
        subtopics: topicSubtopics,
      };
      tableData.push(topicRow);

      // Add subtopic rows if expanded
      if (Object.prototype.hasOwnProperty.call(expanded, topic.id) && expanded[topic.id as keyof typeof expanded]) {
        topicSubtopics.forEach(subtopic => {
          const subtopicRow: SubtopicRow = {
            ...subtopic,
            isSubtopic: true,
            topicId: topic.id,
            topicName: topic.name,
          };
          tableData.push(subtopicRow);
        });
      }
    });

    return tableData;
  }, [topicsData, subtopicsData, expanded]);

  // Filtered data based on text and subject filters
  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply text filter
    if (textFilter) {
      const searchLower = textFilter.toLowerCase();
      result = result.filter(row => {
        if (row.isSubtopic) {
          return row.name.toLowerCase().includes(searchLower) ||
                 String(row.number).includes(searchLower);
        } else {
          const topic = row as TopicRow;
          return topic.name.toLowerCase().includes(searchLower) ||
                 String(topic.number).includes(searchLower) ||
                 topic.subject?.name.toLowerCase().includes(searchLower);
        }
      });
    }

    // Apply subject filter
    if (selectedSubject) {
      result = result.filter(row => {
        if (row.isSubtopic) {
          // For subtopics, find the parent topic and check its subject
          const parentTopic = topicsData.find(t => t.id === row.topicId);
          return parentTopic?.subjectId === selectedSubject;
        } else {
          return row.subjectId === selectedSubject;
        }
      });
    }

    return result;
  }, [data, textFilter, selectedSubject, topicsData]);

  // Define columns for the table
  const columns: ColumnDef<TableRow>[] = [
    {
      id: 'expander',
      header: () => null,
      cell: ({ row }) => {
        // Only show expander for top-level topics, not subtopics
        if (row.original.isSubtopic) {
          return <div className="w-6"></div>; // Empty space for subtopics
        }

        const topicRow = row.original as TopicRow;
        const hasSubtopics = topicRow.subtopics && topicRow.subtopics.length > 0;
        
        if (hasSubtopics) {
          return (
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-6 w-6"
              onClick={(e) => {
                e.stopPropagation(); // Prevent row click when clicking expander
                row.toggleExpanded();
              }}
            >
              {row.getIsExpanded() ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          );
        } else {
          return <div className="w-6"></div>; // Empty space for topics without subtopics
        }
      },
    },
    {
      accessorKey: 'subject',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Subject
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        if (row.original.isSubtopic) return null;
        
        const topic = row.original as TopicRow;
        if (!topic.subject) return null;
        
        const subjectText = formatSubjectDisplay(topic.subject);
        
        return (
          <Badge variant="outline" className="px-2 py-1">
            {subjectText}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'number',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Number
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div>{row.getValue('number')}</div>,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const isSubtopic = row.original.isSubtopic;
        return (
          <div className={isSubtopic ? "pl-6 font-normal" : "font-medium"}>
            {row.getValue('name')}
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    state: {
      sorting,
      expanded,
    },
  });

  const handleAddSubtopic = (topicId: string) => {
    setAddSubtopicToTopicId(topicId);
    setIsAddSubtopicModalOpen(true);
  };

  const handleViewTopic = (id: string) => {
    setViewTopicId(id);
    setIsViewModalOpen(true);
  };

  const handleEditTopic = (id: string) => {
    setEditTopicId(id);
    setIsEditModalOpen(true);
  };

  const handleEditSubtopic = (id: string) => {
    setViewSubtopicId(id);
    setIsViewSubtopicModalOpen(true);
  };

  const handleDeleteTopic = async (id: string) => {
    if (confirm('Are you sure you want to delete this topic? This will also delete all its subtopics.')) {
      try {
        await deleteTopicMutation.mutateAsync(id);
      } catch (error) {
        console.error('Error deleting topic:', error);
        alert('Failed to delete topic. Please try again.');
      }
    }
  };

  const handleDeleteSubtopic = async (id: string) => {
    if (confirm('Are you sure you want to delete this subtopic?')) {
      try {
        await deleteSubtopicMutation.mutateAsync(id);
      } catch (error) {
        console.error('Error deleting subtopic:', error);
        alert('Failed to delete subtopic. Please try again.');
      }
    }
  };

  const handleTopicUpdated = () => {
    refetchTopics();
    refetchSubtopics();
  };

  const handleRefresh = () => {
    refetchTopics();
    refetchSubtopics();
    refetchSubjects();
  };

  const clearFilters = () => {
    setTextFilter('');
    setSelectedSubject(null);
  };

  const isLoading = topicsLoading || subtopicsLoading || subjectsLoading;
  const hasError = topicsError || subtopicsError || subjectsError;

  // Loading state
  if (isLoading && topicsData.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search topics..."
                className="pl-8"
                disabled
              />
            </div>
            <Button variant="outline" size="sm" disabled>
              Subject Filter
            </Button>
            <Button variant="outline" size="sm" disabled>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Add Topic
          </Button>
        </div>
        
        <SkeletonTable rows={8} columns={4} />
        
        <div className="text-sm text-muted-foreground">
          Loading topics...
        </div>
      </div>
    );
  }

  // Error state
  if (hasError && topicsData.length === 0) {
    return (
      <div className="text-red-500 p-4">
        Failed to load topics. Please try again.
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          className="ml-2"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search topics..."
              className="pl-8"
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
            />
          </div>
          
          <Popover open={subjectFilterOpen} onOpenChange={setSubjectFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={selectedSubject ? "secondary" : "outline"}
                size="sm"
                className="justify-between min-w-[150px]"
              >
                {selectedSubject 
                  ? subjects.find(s => s.id === selectedSubject)?.name || 'Unknown Subject'
                  : 'Subject Filter'
                }
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput placeholder="Search subjects..." />
                <CommandEmpty>No subjects found.</CommandEmpty>
                <CommandGroup>
                  <ScrollArea className="h-[200px]">
                    <CommandItem
                      onSelect={() => {
                        setSelectedSubject(null);
                        setSubjectFilterOpen(false);
                      }}
                    >
                      All Subjects
                    </CommandItem>
                    {subjects.map((subject) => (
                      <CommandItem
                        key={subject.id}
                        onSelect={() => {
                          setSelectedSubject(subject.id);
                          setSubjectFilterOpen(false);
                        }}
                      >
                        {formatSubjectDisplay(subject)}
                      </CommandItem>
                    ))}
                  </ScrollArea>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>

          {(textFilter || selectedSubject) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
        
        <Button onClick={() => setIsAddTopicModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Topic
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    if (row.original.isSubtopic) {
                      handleEditSubtopic(row.original.id);
                    } else {
                      handleViewTopic(row.original.id);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {row.original.isSubtopic ? (
                          <>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleEditSubtopic(row.original.id);
                            }}>
                              Edit Subtopic
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSubtopic(row.original.id);
                              }}
                              className="text-red-600"
                            >
                              Delete Subtopic
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleViewTopic(row.original.id);
                            }}>
                              View Topic
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleAddSubtopic(row.original.id);
                            }}>
                              Add Subtopic
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTopic(row.original.id);
                              }}
                              className="text-red-600"
                            >
                              Delete Topic
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                  {textFilter || selectedSubject ? "No topics match your filters" : "No topics found"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        {table.getRowModel().rows.length} items displayed
        {isLoading && <span className="ml-2">(Refreshing...)</span>}
      </div>

      {/* Modals */}
      <AddTopicModal
        isOpen={isAddTopicModalOpen}
        onClose={() => setIsAddTopicModalOpen(false)}
        onTopicAdded={handleTopicUpdated}
      />

      <ViewTopicModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        topicId={viewTopicId}
        onTopicUpdated={handleTopicUpdated}
      />

      <AddSubtopicModal
        isOpen={isAddSubtopicModalOpen}
        onClose={() => setIsAddSubtopicModalOpen(false)}
        topicId={addSubtopicToTopicId}
        onSubtopicAdded={handleTopicUpdated}
      />

      <ViewSubtopicModal
        isOpen={isViewSubtopicModalOpen}
        onClose={() => setIsViewSubtopicModalOpen(false)}
        subtopicId={viewSubtopicId}
        onSubtopicUpdated={handleTopicUpdated}
      />
    </div>
  );
} 