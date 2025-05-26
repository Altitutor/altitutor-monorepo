'use client';

import { useEffect, useState } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowUpDown, ChevronDown, ChevronRight, Plus, Search, X } from 'lucide-react';
import { topicsApi } from '../api';
import { subjectsApi } from '@/features/subjects/api';
import type { Topic, Subtopic } from '../types';
import type { Subject, SubjectCurriculum } from '@/shared/lib/supabase/db/types';
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
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'subject', desc: false },
    { id: 'number', desc: false }
  ]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [data, setData] = useState<TableRow[]>([]);
  const [textFilter, setTextFilter] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
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
        
        // For debugging
        console.log('Topic subject in cell:', topic.subject);
        
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

  // Load topics and subtopics
  useEffect(() => {
    loadTopics();
    loadSubjects();
  }, [onRefresh]);

  // Process data for the table
  useEffect(() => {
    createTableData();
  }, [topics, subtopics, textFilter, selectedSubject]);

  const loadSubjects = async () => {
    try {
      const subjectsData = await subjectsApi.getAllSubjects();
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  };

  const loadTopics = async () => {
    setLoading(true);
    try {
      // Get topics with related subject information
      const topicsWithSubjects = await topicsApi.getTopicsWithSubjects();
      console.log('Topics with subjects:', topicsWithSubjects);
      console.log('First topic subject:', topicsWithSubjects[0]?.subject);
      setTopics(topicsWithSubjects);

      // Get all subtopics
      const allSubtopics = await topicsApi.getAllSubtopicsWithTopics();
      setSubtopics(allSubtopics);
    } catch (error) {
      console.error('Error loading topics and subtopics:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTableData = () => {
    // Filter topics based on text input and selected subject
    const filteredTopics = topics.filter(topic => {
      // Text filter
      const matchesText = !textFilter || 
        topic.name.toLowerCase().includes(textFilter.toLowerCase()) ||
        (topic.subject?.name.toLowerCase().includes(textFilter.toLowerCase())) ||
        (topic.subject?.yearLevel && 
         topic.subject.yearLevel.toString().includes(textFilter.toLowerCase()));
      
      // Subject filter
      const matchesSubject = !selectedSubject || topic.subject?.id === selectedSubject;
      
      return matchesText && matchesSubject;
    });

    // Create table data with topics and their subtopics
    const tableData: TableRow[] = filteredTopics.map(topic => ({
      ...topic,
      isSubtopic: false,
      // Find all subtopics for this topic
      subtopics: subtopics.filter(subtopic => subtopic.topicId === topic.id)
    }));
    
    setData(tableData);
  };

  // Table instance with sorting and expanding
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      expanded,
    },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: row => {
      const topic = row.original as TopicRow;
      return !row.original.isSubtopic && Boolean(topic.subtopics && topic.subtopics.length > 0);
    },
  });

  // Handler for adding a new subtopic
  const handleAddSubtopic = (topicId: string) => {
    setAddSubtopicToTopicId(topicId);
    setIsAddSubtopicModalOpen(true);
  };

  // Handler for viewing a topic
  const handleViewTopic = (id: string) => {
    setViewTopicId(id);
    setIsViewModalOpen(true);
  };

  // Handler for editing a topic
  const handleEditTopic = (id: string) => {
    setEditTopicId(id);
    setIsEditModalOpen(true);
  };

  // Handler for editing a subtopic
  const handleEditSubtopic = (id: string) => {
    setViewSubtopicId(id);
    setIsViewSubtopicModalOpen(true);
  };

  // Handler for deleting a topic
  const handleDeleteTopic = async (id: string) => {
    if (confirm('Are you sure you want to delete this topic? This will also delete all subtopics.')) {
      try {
        await topicsApi.deleteTopic(id);
        loadTopics();
      } catch (error) {
        console.error('Error deleting topic:', error);
        alert('Failed to delete topic. Please try again.');
      }
    }
  };

  // Handler for deleting a subtopic
  const handleDeleteSubtopic = async (id: string) => {
    if (confirm('Are you sure you want to delete this subtopic?')) {
      try {
        await topicsApi.deleteSubtopic(id);
        loadTopics();
      } catch (error) {
        console.error('Error deleting subtopic:', error);
        alert('Failed to delete subtopic. Please try again.');
      }
    }
  };

  // Handler for topic update (reloads topics)
  const handleTopicUpdated = () => {
    loadTopics();
  };

  // Clear all filters
  const clearFilters = () => {
    setTextFilter('');
    setSelectedSubject(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
        {/* Text filter */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter topics..."
            value={textFilter}
            onChange={(e) => setTextFilter(e.target.value)}
            className="pl-8 max-w-sm"
          />
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Add Topic Button */}
          <Button 
            size="sm" 
            onClick={() => setIsAddTopicModalOpen(true)}
            className="flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Topic
          </Button>
          
          {/* Subject filter */}
          <Popover open={subjectFilterOpen} onOpenChange={setSubjectFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start">
                {selectedSubject ? (
                  formatSubjectDisplay(subjects.find(s => s.id === selectedSubject)!)
                ) : (
                  "Filter by Subject"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="start">
              <Command>
                <CommandInput placeholder="Search subjects..." />
                <CommandEmpty>No subject found.</CommandEmpty>
                <CommandGroup>
                  <ScrollArea className="h-72">
                    {subjects.map((subject) => (
                      <CommandItem
                        key={subject.id}
                        onSelect={() => {
                          setSelectedSubject(
                            selectedSubject === subject.id ? null : subject.id
                          );
                          setSubjectFilterOpen(false);
                        }}
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            selectedSubject === subject.id
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-3 w-3"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        </div>
                        <span>
                          {formatSubjectDisplay(subject)}
                        </span>
                      </CommandItem>
                    ))}
                  </ScrollArea>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          
          {/* Clear filters button - only show when filters are active */}
          {(textFilter || selectedSubject) && (
            <Button 
              variant="ghost" 
              onClick={clearFilters}
              size="sm"
              className="h-8"
            >
              <X className="h-4 w-4 mr-1" />
              Clear filters
            </Button>
          )}
        </div>
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
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading topics and subtopics...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              <>
                {table.getRowModel().rows.map((row) => {
                  const isExpanded = row.getIsExpanded();
                  const isSubtopic = row.original.isSubtopic;
                  const topic = row.original as TopicRow;
                  const hasSubtopics = !isSubtopic && topic.subtopics && topic.subtopics.length > 0;
                  
                  return (
                    <React.Fragment key={row.id}>
                      <TableRow
                        data-state={row.getIsSelected() && "selected"}
                        className={!isSubtopic ? "cursor-pointer" : ""}
                        onClick={() => {
                          if (!isSubtopic) {
                            handleViewTopic(topic.id);
                          }
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                      
                      {/* Render subtopics immediately after their parent if expanded */}
                      {isExpanded && hasSubtopics && topic.subtopics!.map((subtopic) => (
                        <TableRow 
                          key={`subtopic-${subtopic.id}`} 
                          className="bg-muted/30 cursor-pointer hover:bg-muted/50"
                          onClick={() => handleEditSubtopic(subtopic.id)}
                        >
                          <TableCell><div className="w-6 pl-6"></div></TableCell>
                          <TableCell></TableCell>
                          <TableCell>{subtopic.number}</TableCell>
                          <TableCell className="pl-10">{subtopic.name}</TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No topics found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modals */}
      <ViewTopicModal 
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        topicId={viewTopicId}
        onTopicUpdated={handleTopicUpdated}
      />
      
      {isAddTopicModalOpen && (
        <AddTopicModal
          isOpen={isAddTopicModalOpen}
          onClose={() => setIsAddTopicModalOpen(false)}
          onTopicAdded={handleTopicUpdated}
        />
      )}

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