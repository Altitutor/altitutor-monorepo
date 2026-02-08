'use client';

import { useState } from 'react';
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
  X,
  Filter
} from 'lucide-react';
import { useTutorLogsTable } from '../hooks/useTutorLogsTable';
import { formatClassDisplayName, formatTimeRange, formatSessionDate } from '../utils/tutorLogsTableHelpers';
import { cn, formatSessionType, getSessionTypeBadgeColor } from '@/shared/utils/index';
import { ViewClassModal } from '@/features/classes';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewTopicModal, FilePreviewModal } from '@/features/topics';
import { DateRangePicker } from '@altitutor/ui';
import { TablePagination } from '@/shared/components/TablePagination';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useRouter } from 'next/navigation';
import { EditTutorLogDialog } from './EditTutorLogDialog';


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
  onOpenStaff: _onOpenStaff,
  onFromChange, 
  onToChange, 
  onResetDates 
}: TutorLogsTableProps) {
  const router = useRouter();
  
  // Use custom hook for all state management and data fetching
  const {
    tutorLogs,
    sessions,
    classesById,
    subjectsById,
    staffAttendance,
    studentAttendance,
    topics,
    topicFiles,
    createdByStaffMap,
    searchTerm,
    setSearchTerm,
    staffFilters,
    toggleStaffFilter,
    staffSearchQuery,
    setStaffSearchQuery,
    filteredStaff,
    page,
    setPage,
    pageSize,
    setPageSize,
    paginatedTutorLogs,
    sortField,
    handleSort,
    isLoading,
    isFetching,
    error,
    refetch,
    clearAllFilters,
    isDefaultState,
  } = useTutorLogsTable({
    rangeStart,
    rangeEnd,
    onResetDates,
  });

  // Modal state
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [selectedTutorLogId, setSelectedTutorLogId] = useState<string | null>(null);
  const [isEditTutorLogModalOpen, setIsEditTutorLogModalOpen] = useState(false);

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
              <TableHead>Class</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Staff Attendance</TableHead>
              <TableHead>Student Attendance</TableHead>
              <TableHead>Topics Covered</TableHead>
              <TableHead>Files</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
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
                const classDisplay = formatClassDisplayName(
                  session?.class_id || null,
                  classesById,
                  subjectsById
                );
                const staffAtt = staffAttendance[log.id] || [];
                const studentAtt = studentAttendance[log.id] || [];
                const logTopics = topics[log.id] || [];
                const logFiles = topicFiles[log.id] || [];
                
                // Get created by staff name
                const createdByStaffInfo = createdByStaffMap[log.created_by || ''];
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
                      {formatSessionDate(session?.start_at)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatTimeRange(session?.start_at || null, session?.end_at || null)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={getSessionTypeBadgeColor(session?.type || '')}>
                          {formatSessionType(session?.type)}
                        </Badge>
                        {session?.class_id && classDisplay ? (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs justify-start whitespace-nowrap font-medium"
                            onClick={(e) => handleClassClick(session.class_id!, e)}
                            title={classDisplay}
                          >
                            {classDisplay}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.created_by ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs justify-start"
                          onClick={(e) => handleStaffClick(log.created_by!, e)}
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
                          {staffAtt.map((att) => {
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
                          {studentAtt.map((att) => {
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
                          {logTopics.map((topic) => (
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
                          {logFiles.map((file) => (
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ActionsMenu
                        type="tutorLog"
                        onOpenInPage={() => {
                          router.push(`/sessions/${log.session_id}`);
                        }}
                        onEdit={() => {
                          setSelectedTutorLogId(log.id);
                          setIsEditTutorLogModalOpen(true);
                        }}
                      />
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
        total={tutorLogs.length}
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

      {/* Edit Tutor Log Modal */}
      {selectedTutorLogId && (
        <EditTutorLogDialog
          tutorLogId={selectedTutorLogId}
          isOpen={isEditTutorLogModalOpen}
          onClose={() => {
            setIsEditTutorLogModalOpen(false);
            setSelectedTutorLogId(null);
          }}
          onTutorLogUpdated={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}

