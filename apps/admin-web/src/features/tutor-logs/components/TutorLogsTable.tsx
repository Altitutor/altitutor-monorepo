'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { SkeletonTable } from "@altitutor/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@altitutor/ui";
import { Checkbox } from "@altitutor/ui";
import { ScrollArea } from "@altitutor/ui";
import { 
  Search, 
  ArrowUpDown,
  CalendarIcon,
  X,
  Filter
} from 'lucide-react';
import { useSearchTutorLogs } from '../hooks/useTutorLogsQuery';
import type { Tables } from '@altitutor/shared';
import { cn, formatSessionType } from '@/shared/utils/index';
import { ViewClassModal } from '@/features/classes';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewTopicModal, FilePreviewModal } from '@/features/topics';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DateRangePicker } from '@/shared/components/DateRangePicker';
import { TablePagination } from '@/shared/components/TablePagination';
import Link from 'next/link';

type TutorLogsTableProps = {
  rangeStart?: string;
  rangeEnd?: string;
  onOpenSession: (id: string) => void;
  onOpenStaff: (id: string) => void;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
  onResetDates: () => void;
};

export function TutorLogsTable({ 
  rangeStart, 
  rangeEnd, 
  onOpenSession, 
  onOpenStaff,
  onFromChange, 
  onToChange, 
  onResetDates 
}: TutorLogsTableProps) {
  
  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [staffFilters, setStaffFilters] = useState<string[]>([]);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  type SortField = 'session_start_at';
  const [sortField, setSortField] = useState<SortField>('session_start_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Search staff using RPC
  const { data: staffSearchResults } = useQuery({
    queryKey: ['staff', 'search', staffSearchQuery.trim()],
    queryFn: async () => {
      const trimmed = staffSearchQuery.trim();
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_staff_admin', {
        p_search: trimmed.length > 0 ? trimmed : undefined,
        p_statuses: ['ACTIVE'],
        p_include_relationships: false,
        p_limit: 100,
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return { staff: [], total: 0 };

      const rpcData = rpcResult as { staff: any[]; total: number };
      const staff = (rpcData.staff || []).map((s: any) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        role: s.role,
        status: s.status,
        email: s.email,
        phone_number: s.phone_number,
        created_at: s.created_at || null,
        updated_at: s.updated_at || null,
      })) as Tables<'staff'>[];
      
      return {
        staff,
        total: rpcData.total || 0,
      };
    },
    enabled: staffSearchQuery.trim().length > 0,
    staleTime: 1000 * 30,
  });

  const filteredStaff = staffSearchResults?.staff || [];

  const toggleStaffFilter = useCallback((staffId: string) => {
    setStaffFilters(prev => 
      prev.includes(staffId) 
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  }, []);

  // Determine which staff filter to use for API call
  const apiStaffId = staffFilters.length === 1 ? staffFilters[0] : undefined;

  // React Query hook for data fetching
  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isFetching: _isFetching 
  } = useSearchTutorLogs({ 
    rangeStart: rangeStart || undefined,
    rangeEnd: rangeEnd || undefined,
    search: debouncedSearchTerm,
    staffId: apiStaffId,
    limit: 10000, // High limit to get all
    offset: 0,
    orderBy: sortField === 'session_start_at' ? 'session_start_at' : 'session_start_at',
    ascending: sortDirection === 'asc',
  });
  
  const isFetching = _isFetching;
  
  // Extract data from the response
  const tutorLogs = (data?.tutorLogs || []) as any[];
  const sessions = (data?.sessions || {}) as Record<string, Tables<'sessions'>>;
  const classesById = (data?.classesById || {}) as Record<string, Tables<'classes'>>;
  const subjectsById = (data?.subjectsById || {}) as Record<string, Tables<'subjects'>>;
  const sessionStudents = (data?.sessionStudents || {}) as Record<string, any[]>;
  const sessionStaff = (data?.sessionStaff || {}) as Record<string, any[]>;
  const staffAttendance = (data?.staffAttendance || {}) as Record<string, any[]>;
  const studentAttendance = (data?.studentAttendance || {}) as Record<string, any[]>;
  const topics = (data?.topics || {}) as Record<string, any[]>;
  const topicFiles = (data?.topicFiles || {}) as Record<string, any[]>;

  // Get unique created_by staff IDs
  const createdByStaffIds = useMemo(() => {
    const ids = new Set<string>();
    tutorLogs.forEach(log => {
      if (log.created_by) ids.add(log.created_by);
    });
    return Array.from(ids);
  }, [tutorLogs]);

  // Fetch created_by staff names
  const { data: createdByStaffData } = useQuery({
    queryKey: ['staff', 'created-by', createdByStaffIds],
    queryFn: async () => {
      if (createdByStaffIds.length === 0) return {};
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data, error } = await supabase
        .from('staff')
        .select('id, first_name, last_name')
        .in('id', createdByStaffIds);
      
      if (error) throw error;
      
      const staffMap: Record<string, { first_name: string; last_name: string }> = {};
      (data || []).forEach((s: any) => {
        staffMap[s.id] = { first_name: s.first_name, last_name: s.last_name };
      });
      return staffMap;
    },
    enabled: createdByStaffIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const createdByStaffMap = createdByStaffData || {};

  // Class modal state
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);

  const getClassDisplay = useCallback((classId: string | null) => {
    if (!classId) return null;
    const cls = classesById[classId];
    if (!cls) return null;
    const subj = cls.subject_id ? subjectsById[cls.subject_id] : undefined;
    const parts: string[] = [];
    if (subj?.curriculum) parts.push(String(subj.curriculum));
    if (subj?.year_level != null) parts.push(String(subj.year_level));
    if (subj?.name) parts.push(subj.name);
    if (cls?.level) parts.push(String(cls.level));
    return parts.join(' ');
  }, [classesById, subjectsById]);

  // Memoized tutor logs (filtering is done server-side)
  const filteredTutorLogs = useMemo(() => {
    if (!tutorLogs.length) return [];
    
    let result = [...tutorLogs];
    
    // Client-side filter for multiple staff IDs (if more than one selected)
    if (staffFilters.length > 1) {
      result = result.filter(log => {
        // Check if created by any selected staff
        if (staffFilters.includes(log.created_by)) return true;
        // Check if any selected staff attended
        const attendance = staffAttendance[log.id] || [];
        return attendance.some((att: any) => staffFilters.includes(att.staff_id));
      });
    }
    
    return result;
  }, [tutorLogs, staffFilters, staffAttendance]);

  // Paginated tutor logs
  const paginatedTutorLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredTutorLogs.slice(start, end);
  }, [filteredTutorLogs, page, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [staffFilters, debouncedSearchTerm, rangeStart, rangeEnd]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  const getSessionTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'CLASS':
        return 'bg-blue-100 text-blue-800';
      case 'DRAFTING':
        return 'bg-purple-100 text-purple-800';
      case 'SUBSIDY_INTERVIEW':
        return 'bg-yellow-100 text-yellow-800';
      case 'TRIAL_SESSION':
        return 'bg-green-100 text-green-800';
      case 'TRIAL_SHIFT':
        return 'bg-orange-100 text-orange-800';
      case 'EXAM_COURSE':
        return 'bg-indigo-100 text-indigo-800';
      case 'STAFF_INTERVIEW':
        return 'bg-pink-100 text-pink-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  const getTimeRange = (startAt: string, endAt: string) => {
    const s = startAt ? new Date(startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const e = endAt ? new Date(endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return s && e ? `${s}–${e}` : s || e || '-';
  };
  
  const handleTutorLogClick = (sessionId: string) => {
    if (onOpenSession) onOpenSession(sessionId);
  };

  const handleClassClick = (classId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  const handleStaffClick = (staffId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStaffId(staffId);
    setIsStaffModalOpen(true);
  };

  const handleTopicClick = (topicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTopicId(topicId);
    setIsTopicModalOpen(true);
  };

  const handleFileClick = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFileId(fileId);
    setIsFileModalOpen(true);
  };

  const isDefaultState = () => {
    const today = new Date().toISOString().split('T')[0];
    return (
      staffFilters.length === 0 &&
      !searchTerm &&
      (!rangeStart || rangeStart === today) &&
      (!rangeEnd || rangeEnd === today)
    );
  };

  const clearAllFilters = useCallback(() => {
    setStaffFilters([]);
    setSearchTerm('');
    setStaffSearchQuery('');
    setPage(1);
    if (onResetDates) {
      onResetDates();
    }
  }, [onResetDates]);
  
  // Debounce search term
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Loading state
  if (isLoading && tutorLogs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tutor logs..."
              className="pl-8"
              disabled
            />
          </div>
        </div>
        
        <SkeletonTable rows={8} columns={9} />
        
        <div className="text-sm text-muted-foreground">
          Loading tutor logs...
        </div>
      </div>
    );
  }

  // Error state
  if (error && tutorLogs.length === 0) {
    return (
      <div className="text-red-500 p-4">
        Failed to load tutor logs. Please try again.
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
            placeholder="Search tutor logs..."
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
          {!isDefaultState() && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllFilters}
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
          
          {/* Staff Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={staffFilters.length > 0 ? "secondary" : "outline"} 
                size="sm"
              >
                <Filter className="h-4 w-4 mr-2" />
                Staff {staffFilters.length > 0 && `(${staffFilters.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[400px]" align="end">
              <div className="p-3">
                <Input
                  placeholder="Search staff..."
                  value={staffSearchQuery}
                  onChange={(e) => setStaffSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1 pr-4">
                    {filteredStaff.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        {staffSearchQuery
                          ? 'No staff match your search'
                          : 'No staff found'}
                      </div>
                    ) : (
                      filteredStaff.map((staff) => (
                        <label
                          key={staff.id}
                          className="flex items-center gap-2 cursor-pointer p-2 hover:bg-muted rounded"
                        >
                          <Checkbox
                            checked={staffFilters.includes(staff.id)}
                            onCheckedChange={() => toggleStaffFilter(staff.id)}
                          />
                          <div className="flex flex-col items-start flex-1">
                            <div className="font-medium text-sm">
                              {staff.first_name} {staff.last_name}
                            </div>
                            {staff.role && (
                              <div className="text-xs text-muted-foreground">
                                {staff.role}
                              </div>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>

          {/* Date Range Filter */}
          <DateRangePicker
            from={rangeStart || ''}
            to={rangeEnd || ''}
            onFromChange={onFromChange}
            onToChange={onToChange}
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => handleSort('session_start_at')}>
                Session Date
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'session_start_at' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('session_start_at')}>
                Session Time
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'session_start_at' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Staff Attendance</TableHead>
              <TableHead>Student Attendance</TableHead>
              <TableHead>Topics Covered</TableHead>
              <TableHead>Files</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTutorLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24">
                  {searchTerm || staffFilters.length > 0
                    ? "No tutor logs match your filters" 
                    : "No tutor logs found"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedTutorLogs.map((log) => {
                const session = sessions[log.session_id];
                const classDisplay = getClassDisplay(log.class_id);
                const staffAtt = staffAttendance[log.id] || [];
                const studentAtt = studentAttendance[log.id] || [];
                const logTopics = topics[log.id] || [];
                const logFiles = topicFiles[log.id] || [];
                
                // Get created by staff name
                const createdByStaffInfo = createdByStaffMap[log.created_by];
                const createdByName = createdByStaffInfo 
                  ? `${createdByStaffInfo.first_name} ${createdByStaffInfo.last_name}`
                  : 'Unknown';

                return (
                  <TableRow 
                    key={log.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleTutorLogClick(log.session_id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span>{log.session_start_at ? formatDate(log.session_start_at) : '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {getTimeRange(log.session_start_at, log.session_end_at)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getSessionTypeBadgeColor(log.session_type)}>
                        {formatSessionType(log.session_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.class_id && classDisplay ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs justify-start whitespace-nowrap font-medium"
                          onClick={(e) => handleClassClick(log.class_id!, e)}
                          title={classDisplay}
                        >
                          {classDisplay}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.created_by ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs justify-start"
                          onClick={(e) => handleStaffClick(log.created_by, e)}
                        >
                          {createdByName}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {staffAtt.length === 0 ? (
                        <span className="text-muted-foreground text-sm">-</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {staffAtt.map((att: any) => {
                            const attended = att.attended === true;
                            const nameClass = attended 
                              ? "" 
                              : "text-red-600 line-through";
                            
                            return (
                              <div key={att.staff_id} className="flex items-center">
                                <Button
                                  variant="link"
                                  size="sm"
                                  className={cn("h-auto p-0 text-xs justify-start", nameClass)}
                                  onClick={(e) => handleStaffClick(att.staff_id, e)}
                                >
                                  {att.first_name} {att.last_name}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {studentAtt.length === 0 ? (
                        <span className="text-muted-foreground text-sm">-</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {studentAtt.map((att: any) => {
                            const attended = att.attended === true;
                            const nameClass = attended 
                              ? "" 
                              : "text-red-600 line-through";
                            
                            return (
                              <div key={att.student_id} className="flex items-center">
                                <Button
                                  variant="link"
                                  size="sm"
                                  className={cn("h-auto p-0 text-xs justify-start", nameClass)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Note: We don't have onOpenStudent prop, but we can dispatch event
                                    window.dispatchEvent(new CustomEvent('open-student-modal', { detail: { id: att.student_id } }));
                                  }}
                                >
                                  {att.first_name} {att.last_name}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {logTopics.length === 0 ? (
                        <span className="text-muted-foreground text-sm">-</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {logTopics.map((topic: any) => (
                            <Button
                              key={topic.topic_id}
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs justify-start"
                              onClick={(e) => handleTopicClick(topic.topic_id, e)}
                            >
                              {topic.code} {topic.name}
                            </Button>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {logFiles.length === 0 ? (
                        <span className="text-muted-foreground text-sm">-</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {logFiles.map((file: any) => (
                            <Button
                              key={file.file_id}
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs justify-start"
                              onClick={(e) => handleFileClick(file.file_id, e)}
                            >
                              {file.code} {file.file_type}
                            </Button>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={filteredTutorLogs.length}
        isFetching={isFetching}
        onPageChange={(newPage) => {
          setPage(newPage);
        }}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
      />

      {/* Class Modal */}
      {selectedClassId && (
        <ViewClassModal
          classId={selectedClassId}
          isOpen={isClassModalOpen}
          onClose={() => {
            setIsClassModalOpen(false);
            setSelectedClassId(null);
          }}
          onClassUpdated={() => {
            refetch();
          }}
        />
      )}

      {/* Staff Modal */}
      {selectedStaffId && (
        <ViewStaffModal
          staffId={selectedStaffId}
          isOpen={isStaffModalOpen}
          onClose={() => {
            setIsStaffModalOpen(false);
            setSelectedStaffId(null);
          }}
          onStaffUpdated={() => {}}
        />
      )}

      {/* Topic Modal */}
      {selectedTopicId && (
        <ViewTopicModal
          topicId={selectedTopicId}
          isOpen={isTopicModalOpen}
          onClose={() => {
            setIsTopicModalOpen(false);
            setSelectedTopicId(null);
          }}
          onTopicUpdated={() => {}}
        />
      )}

      {/* File Modal */}
      {selectedFileId && (
        <FilePreviewModal
          fileId={selectedFileId}
          isOpen={isFileModalOpen}
          onClose={() => {
            setIsFileModalOpen(false);
            setSelectedFileId(null);
          }}
        />
      )}
    </div>
  );
}

