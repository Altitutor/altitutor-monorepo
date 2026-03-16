'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Plus, Search, ChevronDown, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { 
  Button, 
  Input, 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Badge,
  Label,
} from '@altitutor/ui';
import { format } from 'date-fns';
import { useToast } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { dateStringToUtcStart, dateStringToUtcEnd } from '@/shared/utils/datetime';
import {
  getStudentsBySubject,
  getStudentsByClass,
  getStudentsByYearLevel,
  getStudentsClasses,
} from '../../api/bulk';
import { subjectsApi } from '@/features/subjects/api/subjects';
import { classesApi } from '@/features/classes/api/classes';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSubjectCurriculumColor, cn } from '@/shared/utils';
import { useQuery } from '@tanstack/react-query';

interface StudentSelectorProps {
  selectedStudents: Tables<'students'>[];
  onStudentsChange: (students: Tables<'students'>[]) => void;
  sendToParents: boolean;
  onSendToParentsChange: (value: boolean) => void;
  onNext?: () => void;
}

export function StudentSelector({ 
  selectedStudents, 
  onStudentsChange, 
  sendToParents,
  onSendToParentsChange,
  onNext: _onNext 
}: StudentSelectorProps) {
  const { toast } = useToast();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Tables<'students'>[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Filter popover states
  const [isSubjectPopoverOpen, setIsSubjectPopoverOpen] = useState(false);
  const [isClassPopoverOpen, setIsClassPopoverOpen] = useState(false);
  const [isYearPopoverOpen, setIsYearPopoverOpen] = useState(false);
  const [isSessionPopoverOpen, setIsSessionPopoverOpen] = useState(false);
  
  // Filter search queries
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [yearSearchQuery, setYearSearchQuery] = useState('');
  
  // Selected filter values
  const [selectedDate, setSelectedDate] = useState<Date>();
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  
  // Bulk selection state
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  

  // Server-side subject search state
  const [subjectSearchResults, setSubjectSearchResults] = useState<Tables<'subjects'>[]>([]);
  const [isSearchingSubjects, setIsSearchingSubjects] = useState(false);

  // Server-side class search state
  const [classSearchResults, setClassSearchResults] = useState<Array<{ class: Tables<'classes'>; subject: Tables<'subjects'> | null }>>([]);
  const [isSearchingClasses, setIsSearchingClasses] = useState(false);

  
  // Fetch classes for selected students
  const { data: studentClassesMap = {} } = useQuery({
    queryKey: ['students-classes', selectedStudents.map(s => s.id)],
    queryFn: () => getStudentsClasses(selectedStudents.map(s => s.id)),
    enabled: selectedStudents.length > 0,
  });
  
  // Search functionality using RPC
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setIsSearchPopoverOpen(false);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const supabase = getSupabaseClient() as SupabaseClient<Database>;
        const trimmed = searchQuery.trim();
        
        const { data: rpcResult, error: rpcError } = await supabase.rpc('search_students_admin', {
          p_search: trimmed,
          p_statuses: ['ACTIVE'],
          p_include_relationships: false,
          p_exclude_class_search: false,
          p_limit: 20,
          p_offset: 0,
          p_order_by: 'last_name',
          p_ascending: true,
        });

        if (rpcError) throw rpcError;
        if (!rpcResult) {
          setSearchResults([]);
          setIsSearchPopoverOpen(false);
          return;
        }

        const rpcData = rpcResult as { students: Array<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          status: string;
          curriculum: string | null;
          year_level: number | null;
          school: string | null;
          email: string | null;
          phone: string | null;
          created_at: string | null;
          updated_at: string | null;
        }>; total: number };
        const results = (rpcData.students || []).map((s) => ({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          status: s.status,
          curriculum: s.curriculum || null,
          year_level: s.year_level || null,
          school: s.school || null,
          email: s.email || null,
          phone: s.phone || null,
          created_at: s.created_at || null,
          updated_at: s.updated_at || null,
        })) as Tables<'students'>[];

        // Filter out already selected students
        const selectedIds = new Set(selectedStudents.map(s => s.id));
        const filteredResults = results.filter(s => !selectedIds.has(s.id));
        setSearchResults(filteredResults);
        setIsSearchPopoverOpen(filteredResults.length > 0 && trimmed.length > 0);
      } catch (error) {
        console.error('Error searching students:', error);
        toast({
          title: 'Error',
          description: 'Failed to search students',
          variant: 'destructive',
        });
      } finally {
        setIsSearching(false);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedStudents, toast]);
  
  // Server-side subject search with debouncing using RPC
  useEffect(() => {
    if (!isSubjectPopoverOpen) {
      setSubjectSearchQuery('');
      setSubjectSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearchingSubjects(true);
      try {
        const { subjects: searchResults } = await subjectsApi.list({ 
          search: subjectSearchQuery.trim().length > 0 ? subjectSearchQuery.trim() : undefined, 
          limit: 100, 
          offset: 0 
        });
        setSubjectSearchResults(searchResults);
      } catch (error) {
        console.error('Error searching subjects:', error);
        setSubjectSearchResults([]);
      } finally {
        setIsSearchingSubjects(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [subjectSearchQuery, isSubjectPopoverOpen]);

  // Use search results
  const filteredSubjects = useMemo(() => {
    return subjectSearchResults;
  }, [subjectSearchResults]);
  
  // Server-side class search with debouncing using RPC
  useEffect(() => {
    if (!isClassPopoverOpen) {
      setClassSearchQuery('');
      setClassSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearchingClasses(true);
      try {
        const { classes: searchResults } = await classesApi.listMinimal({ 
          search: classSearchQuery.trim().length > 0 ? classSearchQuery.trim() : undefined, 
          limit: 100, 
          offset: 0 
        });
        // Transform to match expected format
        const transformedResults = searchResults.map(cls => ({
          class: {
            id: cls.id,
            subject_id: cls.subject_id,
            day_of_week: cls.day_of_week,
            start_time: cls.start_time,
            end_time: cls.end_time,
            status: cls.status,
            room: cls.room,
            level: cls.level,
          } as Tables<'classes'>,
          subject: cls.subject || null,
        }));
        setClassSearchResults(transformedResults);
      } catch (error) {
        console.error('Error searching classes:', error);
        setClassSearchResults([]);
      } finally {
        setIsSearchingClasses(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [classSearchQuery, isClassPopoverOpen]);

  // Use search results
  const filteredClasses = useMemo(() => {
    return classSearchResults;
  }, [classSearchResults]);
  
  // Year levels
  const filteredYearLevels = useMemo(() => {
    const yearLevels = [7, 8, 9, 10, 11, 12, 13];
    if (!yearSearchQuery) return yearLevels;
    
    const query = yearSearchQuery.toLowerCase();
    return yearLevels.filter(year => 
      year.toString().includes(query) || `year ${year}`.includes(query)
    );
  }, [yearSearchQuery]);
  
  // Handle adding student from search
  const handleAddStudentFromSearch = (student: Tables<'students'>) => {
    const existingIds = new Set(selectedStudents.map(s => s.id));
    if (!existingIds.has(student.id)) {
      onStudentsChange([...selectedStudents, student]);
      setSearchQuery('');
      setSearchResults([]);
      setIsSearchPopoverOpen(false);
    }
  };
  
  // Handle adding students by filter
  const handleAddBySubject = async (subjectId: string) => {
    setIsLoading(true);
    try {
      const newStudents = await getStudentsBySubject(subjectId);
      const existingIds = new Set(selectedStudents.map(s => s.id));
      const uniqueNewStudents = newStudents.filter(s => !existingIds.has(s.id));
      onStudentsChange([...selectedStudents, ...uniqueNewStudents]);
      setIsSubjectPopoverOpen(false);
      setSubjectSearchQuery('');
      toast({
        title: 'Students added',
        description: `Added ${uniqueNewStudents.length} student${uniqueNewStudents.length !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Error adding students by subject:', error);
      toast({
        title: 'Error',
        description: 'Failed to add students',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddByClass = async (classId: string) => {
    setIsLoading(true);
    try {
      const newStudents = await getStudentsByClass(classId);
      const existingIds = new Set(selectedStudents.map(s => s.id));
      const uniqueNewStudents = newStudents.filter(s => !existingIds.has(s.id));
      onStudentsChange([...selectedStudents, ...uniqueNewStudents]);
      setIsClassPopoverOpen(false);
      setClassSearchQuery('');
      toast({
        title: 'Students added',
        description: `Added ${uniqueNewStudents.length} student${uniqueNewStudents.length !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Error adding students by class:', error);
      toast({
        title: 'Error',
        description: 'Failed to add students',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddByYearLevel = async (yearLevel: number) => {
    setIsLoading(true);
    try {
      const newStudents = await getStudentsByYearLevel(yearLevel);
      const existingIds = new Set(selectedStudents.map(s => s.id));
      const uniqueNewStudents = newStudents.filter(s => !existingIds.has(s.id));
      onStudentsChange([...selectedStudents, ...uniqueNewStudents]);
      setIsYearPopoverOpen(false);
      setYearSearchQuery('');
      toast({
        title: 'Students added',
        description: `Added ${uniqueNewStudents.length} student${uniqueNewStudents.length !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Error adding students by year level:', error);
      toast({
        title: 'Error',
        description: 'Failed to add students',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddBySessionDate = async () => {
    if (!selectedDate) return;
    
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      // Convert date string to UTC (interpret as local timezone)
      const startIso = dateStringToUtcStart(dateStr);
      const endIso = dateStringToUtcEnd(dateStr);
      
      // Use RPC function to search sessions
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_sessions_admin', {
        p_search: undefined,
        p_range_start: startIso,
        p_range_end: endIso,
        p_staff_id: undefined,
        p_class_id: undefined,
        p_student_id: undefined,
        p_statuses: ['ACTIVE'],
        p_types: undefined,
        p_include_relationships: true,
        p_limit: 1000,
        p_offset: 0,
        p_order_by: 'start_at',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) {
        setIsSessionPopoverOpen(false);
        setSelectedDate(undefined);
        return;
      }

      const rpcData = rpcResult as {
        sessions: Array<{
          id: string;
          class_id: string | null;
          start_at: string;
          end_at: string;
          status: string;
        }>;
        sessionStudents: Record<string, Array<{
          student: {
            id: string;
            status: string;
          };
          planned_absence: boolean;
        }>>;
        total: number;
      };

      // Extract unique student IDs from sessions
      const studentIds = new Set<string>();
      Object.values(rpcData.sessionStudents || {}).forEach((students) => {
        students.forEach((ss) => {
          const student = ss.student || ss;
          if (student && student.status === 'ACTIVE' && !ss.planned_absence) {
            studentIds.add(student.id);
          }
        });
      });

      if (studentIds.size === 0) {
        toast({
          title: 'No students found',
          description: 'No active students found for this session date',
        });
        setIsSessionPopoverOpen(false);
        setSelectedDate(undefined);
        return;
      }

      // Fetch full student records
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .in('id', Array.from(studentIds))
        .eq('status', 'ACTIVE');

      if (studentsError) throw studentsError;

      const newStudents = (studentsData || []) as Tables<'students'>[];
      const existingIds = new Set(selectedStudents.map(s => s.id));
      const uniqueNewStudents = newStudents.filter(s => !existingIds.has(s.id));
      
      onStudentsChange([...selectedStudents, ...uniqueNewStudents]);
      setIsSessionPopoverOpen(false);
      setSelectedDate(undefined);
      toast({
        title: 'Students added',
        description: `Added ${uniqueNewStudents.length} student${uniqueNewStudents.length !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Error adding students by session date:', error);
      toast({
        title: 'Error',
        description: 'Failed to add students',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAllActiveStudents = async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      // Use RPC function to get all active student IDs
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_students_admin', {
        p_search: undefined, // No search term - get all
        p_statuses: ['ACTIVE'],
        p_include_relationships: false,
        p_exclude_class_search: false,
        p_limit: 10000, // High limit to get all active students
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) {
        toast({
          title: 'No students found',
          description: 'No active students found',
        });
        return;
      }

      const rpcData = rpcResult as { students: Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        status: string;
        curriculum: string | null;
        year_level: number | null;
        school: string | null;
        email: string | null;
        phone: string | null;
        created_at: string | null;
        updated_at: string | null;
      }>; total: number };
      
      // Transform RPC response to match Tables<'students'> format
      const allActiveStudents = (rpcData.students || []).map((s) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        status: s.status,
        curriculum: s.curriculum || null,
        year_level: s.year_level || null,
        school: s.school || null,
        email: s.email || null,
        phone: s.phone || null,
        created_at: s.created_at || null,
        updated_at: s.updated_at || null,
      })) as Tables<'students'>[];

      if (allActiveStudents.length === 0) {
        toast({
          title: 'No students found',
          description: 'No active students found',
        });
        return;
      }

      // Filter out already selected students
      const existingIds = new Set(selectedStudents.map(s => s.id));
      const uniqueNewStudents = allActiveStudents.filter(s => !existingIds.has(s.id));
      
      onStudentsChange([...selectedStudents, ...uniqueNewStudents]);
      toast({
        title: 'Students added',
        description: `Added ${uniqueNewStudents.length} active student${uniqueNewStudents.length !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Error adding all active students:', error);
      toast({
        title: 'Error',
        description: 'Failed to add all active students',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Individual remove
  const handleRemoveStudent = (studentId: string) => {
    onStudentsChange(selectedStudents.filter(s => s.id !== studentId));
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });
  };
  
  // Bulk selection handlers
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.size === selectedStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(selectedStudents.map(s => s.id)));
    }
  };
  
  const handleToggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };
  
  const handleBulkRemove = () => {
    onStudentsChange(selectedStudents.filter(s => !selectedStudentIds.has(s.id)));
    setSelectedStudentIds(new Set());
  };
  
  const allSelected = selectedStudents.length > 0 && selectedStudentIds.size === selectedStudents.length;
  
  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
          <Popover open={isSearchPopoverOpen && searchResults.length > 0 && searchQuery.trim().length > 0} onOpenChange={setIsSearchPopoverOpen}>
            <PopoverTrigger asChild>
              <div className="relative w-full">
                <Input
                  ref={searchInputRef}
                  placeholder="Search by student name or class..."
                  className="pl-10 w-full"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                  onFocus={() => {
                    if (searchResults.length > 0 && searchQuery.trim().length > 0) {
                      setIsSearchPopoverOpen(true);
                    }
                  }}
                  onKeyDown={(e) => {
                    // Prevent popover from closing when typing
                    e.stopPropagation();
                  }}
                />
              </div>
            </PopoverTrigger>
            <PopoverContent 
              className="p-0" 
              align="start" 
              onOpenAutoFocus={(e) => e.preventDefault()}
              style={{ width: searchInputRef.current?.offsetWidth || '100%' }}
            >
              <ScrollArea className="max-h-[400px]">
                <div className="p-2">
                  {isSearching ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {searchQuery.trim().length === 0 
                        ? 'Start typing to search...'
                        : 'No students found'}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {searchResults.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => handleAddStudentFromSearch(student)}
                          className="w-full text-left p-3 hover:bg-accent rounded-md transition-colors"
                        >
                          <div className="font-medium">
                            {student.first_name} {student.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {student.phone && <span>Phone: {student.phone}</span>}
                            {student.phone && student.email && <span> • </span>}
                            {student.email && <span>Email: {student.email}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
        
        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Add All Active Students Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddAllActiveStudents}
            disabled={isLoading}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add All Active Students
          </Button>
          
          {/* Subject Filter */}
          <Popover open={isSubjectPopoverOpen} onOpenChange={setIsSubjectPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                By Subject
                <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <div className="p-3">
                <Input
                  placeholder="Search subjects..."
                  value={subjectSearchQuery}
                  onChange={(e) => setSubjectSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1 pr-4">
                    {isSearchingSubjects ? (
                      <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching...
                      </div>
                    ) : filteredSubjects.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        {subjectSearchQuery ? 'No subjects match your search' : 'No subjects found'}
                      </div>
                    ) : (
                      filteredSubjects.map((subject) => (
                        <Button
                          key={subject.id}
                          variant="ghost"
                          className="w-full justify-start h-auto p-2"
                          onClick={() => handleAddBySubject(subject.id)}
                          disabled={isLoading}
                        >
                          <div className="font-medium">{subject?.long_name ?? ''}</div>
                        </Button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Class Filter */}
          <Popover open={isClassPopoverOpen} onOpenChange={setIsClassPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                By Class
                <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <div className="p-3">
                <Input
                  placeholder="Search classes..."
                  value={classSearchQuery}
                  onChange={(e) => setClassSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1 pr-4">
                    {isSearchingClasses ? (
                      <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching...
                      </div>
                    ) : filteredClasses.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        {classSearchQuery ? 'No classes match your search' : 'No classes found'}
                      </div>
                    ) : (
                      filteredClasses.map(({ class: cls }) => (
                        <Button
                          key={cls.id}
                          variant="ghost"
                          className="w-full justify-start h-auto p-2"
                          onClick={() => handleAddByClass(cls.id)}
                          disabled={isLoading}
                        >
                          <div className="font-medium">{cls?.long_name?.trim() ?? ''}</div>
                        </Button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Year Level Filter */}
          <Popover open={isYearPopoverOpen} onOpenChange={setIsYearPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                By Year Level
                <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <div className="p-3">
                <Input
                  placeholder="Search year levels..."
                  value={yearSearchQuery}
                  onChange={(e) => setYearSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1 pr-4">
                    {filteredYearLevels.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        {yearSearchQuery ? 'No year levels match your search' : 'No year levels found'}
                      </div>
                    ) : (
                      filteredYearLevels.map((year) => (
                        <Button
                          key={year}
                          variant="ghost"
                          className="w-full justify-start h-auto p-2"
                          onClick={() => handleAddByYearLevel(year)}
                          disabled={isLoading}
                        >
                          <div className="font-medium">Year {year}</div>
                        </Button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Session Date Filter */}
          <Popover open={isSessionPopoverOpen} onOpenChange={setIsSessionPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                By Session Date
                <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-4" align="start">
              <div className="space-y-3">
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : undefined)}
                    className="pl-9"
                  />
                </div>
                <Button
                  onClick={handleAddBySessionDate}
                  disabled={!selectedDate || isLoading}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Students
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Send to Parents Option */}
      <div className="border rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="send-to-parents"
            checked={sendToParents}
            onCheckedChange={(checked) => onSendToParentsChange(checked === true)}
          />
          <div className="flex-1">
            <Label
              htmlFor="send-to-parents"
              className="text-sm font-medium cursor-pointer"
            >
              Send to parents as well
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              If enabled, each parent will receive a separate message with their student's information
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            Selected Students ({selectedStudents.length})
          </h3>
          <div className="flex items-center gap-2">
            {selectedStudentIds.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkRemove}
              >
                Remove Selected ({selectedStudentIds.size})
              </Button>
            )}
            {selectedStudents.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onStudentsChange([]);
                  setSelectedStudentIds(new Set());
                }}
              >
                Clear All
              </Button>
            )}
          </div>
        </div>

        {selectedStudents.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            No students selected. Use search or filters above to add students.
          </div>
        ) : (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleToggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Education</TableHead>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Classes</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedStudents.map((student) => {
                  const classes = studentClassesMap[student.id] || [];
                  const isSelected = selectedStudentIds.has(student.id);
                  
                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelectStudent(student.id)}
                          aria-label={`Select ${student.first_name} ${student.last_name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 items-center">
                          {student.curriculum ? (
                            <Badge className={cn("text-xs", getSubjectCurriculumColor(student.curriculum as 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY' | 'MEDICINE'))}>
                              {student.curriculum}
                            </Badge>
                          ) : null}
                          {student.year_level ? (
                            <Badge variant="outline" className="text-xs bg-transparent">
                              Year {student.year_level}
                            </Badge>
                          ) : null}
                          {!student.curriculum && !student.year_level && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {student.first_name || '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {student.last_name || '-'}
                      </TableCell>
                      <TableCell>
                        {classes.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {classes
                              .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
                              .map((cls) => {
                                const shortName = (cls as { short_name?: string | null }).short_name?.trim() ?? '';
                                return (
                                  <span key={cls.id} className="text-xs">
                                    {shortName}
                                  </span>
                                );
                              })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No classes</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {student.phone || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRemoveStudent(student.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
