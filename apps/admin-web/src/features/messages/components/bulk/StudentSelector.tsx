'use client';

import { useState, useMemo, useEffect } from 'react';
import { X, Plus, Search, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';
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
} from '@altitutor/ui';
import { format } from 'date-fns';
import { useToast } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import {
  searchStudents,
  getAllSubjects,
  getAllClasses,
  getStudentsBySubject,
  getStudentsByClass,
  getStudentsByYearLevel,
  getStudentsBySessionDate,
  getStudentsClasses,
} from '../../api/bulk';
import { 
  formatSubjectDisplay, 
  formatClassName, 
  formatClassShortName,
  getSubjectCurriculumColor,
  cn,
} from '@/shared/utils';
import { useQuery } from '@tanstack/react-query';

interface StudentSelectorProps {
  selectedStudents: Tables<'students'>[];
  onStudentsChange: (students: Tables<'students'>[]) => void;
  onNext: () => void;
}

export function StudentSelector({ selectedStudents, onStudentsChange, onNext }: StudentSelectorProps) {
  const { toast } = useToast();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Tables<'students'>[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);
  
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
  
  // Fetch subjects and classes for filters
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-all'],
    queryFn: getAllSubjects,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-all'],
    queryFn: getAllClasses,
  });
  
  // Fetch classes for selected students
  const { data: studentClassesMap = {} } = useQuery({
    queryKey: ['students-classes', selectedStudents.map(s => s.id)],
    queryFn: () => getStudentsClasses(selectedStudents.map(s => s.id)),
    enabled: selectedStudents.length > 0,
  });
  
  // Search functionality
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setIsSearchPopoverOpen(false);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchStudents(searchQuery, 20);
        // Filter out already selected students
        const selectedIds = new Set(selectedStudents.map(s => s.id));
        const filteredResults = results.filter(s => !selectedIds.has(s.id));
        setSearchResults(filteredResults);
        setIsSearchPopoverOpen(filteredResults.length > 0);
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
  
  // Filter subjects based on search query
  const filteredSubjects = useMemo(() => {
    if (!subjectSearchQuery) return subjects;
    
    const query = subjectSearchQuery.toLowerCase();
    return subjects.filter((subject) => {
      const displayText = formatSubjectDisplay(subject).toLowerCase();
      return displayText.includes(query) || subject.name.toLowerCase().includes(query);
    });
  }, [subjects, subjectSearchQuery]);
  
  // Filter classes based on search query
  const filteredClasses = useMemo(() => {
    if (!classSearchQuery) return classes;
    
    const query = classSearchQuery.toLowerCase();
    return classes.filter(({ class: cls, subject }) => {
      const className = formatClassName(cls, subject).toLowerCase();
      const shortName = formatClassShortName(cls, subject).toLowerCase();
      return className.includes(query) || shortName.includes(query);
    });
  }, [classes, classSearchQuery]);
  
  // Year levels
  const yearLevels = [7, 8, 9, 10, 11, 12, 13];
  const filteredYearLevels = useMemo(() => {
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
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const newStudents = await getStudentsBySessionDate(dateStr);
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
  const someSelected = selectedStudentIds.size > 0 && selectedStudentIds.size < selectedStudents.length;
  
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold">Select Students</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Search or use filters to add students to your bulk message list
        </p>
      </div>

      {/* Search and Filters */}
      <div className="p-6 border-b space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
            <PopoverTrigger asChild>
              <Input
                placeholder="Search by student name or class..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) {
                    setIsSearchPopoverOpen(true);
                  }
                }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-[600px] p-0" align="start">
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
        <div className="flex flex-wrap gap-2">
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
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-1">
                    {filteredSubjects.length === 0 ? (
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
                          <div className="font-medium">{formatSubjectDisplay(subject)}</div>
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
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-1">
                    {filteredClasses.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        {classSearchQuery ? 'No classes match your search' : 'No classes found'}
                      </div>
                    ) : (
                      filteredClasses.map(({ class: cls, subject }) => (
                        <Button
                          key={cls.id}
                          variant="ghost"
                          className="w-full justify-start h-auto p-2"
                          onClick={() => handleAddByClass(cls.id)}
                          disabled={isLoading}
                        >
                          <div className="font-medium">{formatClassName(cls, subject)}</div>
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
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-1">
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

      {/* Table */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
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
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No students selected. Use search or filters above to add students.
          </div>
        ) : (
          <div className="rounded-md border overflow-auto flex-1">
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
                  <TableHead>Email</TableHead>
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
                                const shortName = formatClassShortName(cls as any, cls.subject || null);
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
                      <TableCell className="text-sm">
                        {student.email || '-'}
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

      <div className="p-6 border-t flex justify-end">
        <Button
          onClick={onNext}
          disabled={selectedStudents.length === 0}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
