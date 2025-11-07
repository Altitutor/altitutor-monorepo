'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { Badge } from "@altitutor/ui";
import { Checkbox } from "@altitutor/ui";
import { SkeletonTable } from "@altitutor/ui";
import { 
  Search, 
  ArrowUpDown,
  Filter,
  X
} from 'lucide-react';
import { useSubjects } from '../hooks/useSubjectsQuery';
import type { Tables, Enums } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';
import { SubjectCurriculumBadge } from '@altitutor/ui';
import { ViewSubjectModal } from './ViewSubjectModal';

interface SubjectsTableProps {
  onRefresh?: number;
  onViewSubject?: (subjectId: string) => void;
}

export function SubjectsTable({ onRefresh, onViewSubject }: SubjectsTableProps) {
  const router = useRouter();
  
  // React Query hook for data fetching
  const { 
    data: subjects = [], 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useSubjects();

  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [curriculumFilters, setCurriculumFilters] = useState<Enums<'subject_curriculum'>[]>([]);
  const [disciplineFilters, setDisciplineFilters] = useState<Enums<'subject_discipline'>[]>([]);
  const [sortField, setSortField] = useState<keyof Tables<'subjects'>>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Filter toggle handlers
  const toggleCurriculumFilter = (curriculum: Enums<'subject_curriculum'>) => {
    setCurriculumFilters(prev => 
      prev.includes(curriculum) 
        ? prev.filter(c => c !== curriculum)
        : [...prev, curriculum]
    );
  };

  const toggleDisciplineFilter = (discipline: Enums<'subject_discipline'>) => {
    setDisciplineFilters(prev => 
      prev.includes(discipline) 
        ? prev.filter(d => d !== discipline)
        : [...prev, discipline]
    );
  };

  const clearAllFilters = () => {
    setCurriculumFilters([]);
    setDisciplineFilters([]);
    setSearchTerm('');
  };

  // Memoized filtered and sorted subjects
  const filteredSubjects = useMemo(() => {
    if (!subjects.length) return [];
    
    let result = [...subjects];
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(subject => 
        subject.name.toLowerCase().includes(searchLower) ||
        String(subject.year_level).includes(searchLower) ||
        (subject.level && subject.level.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply curriculum filter
    if (curriculumFilters.length > 0) {
      result = result.filter(subject => subject.curriculum && curriculumFilters.includes(subject.curriculum));
    }
    
    // Apply discipline filter
    if (disciplineFilters.length > 0) {
      result = result.filter(subject => subject.discipline && disciplineFilters.includes(subject.discipline));
    }
    
    // Apply sorting
    result.sort((a, b) => {
      const valueA = a[sortField];
      const valueB = b[sortField];
      
      if (valueA === null || valueA === undefined) return sortDirection === 'asc' ? -1 : 1;
      if (valueB === null || valueB === undefined) return sortDirection === 'asc' ? 1 : -1;
      
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDirection === 'asc' 
          ? valueA.localeCompare(valueB) 
          : valueB.localeCompare(valueA);
      }
      
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortDirection === 'asc' 
          ? valueA - valueB 
          : valueB - valueA;
      }
      
      return 0;
    });
    
    return result;
  }, [subjects, searchTerm, curriculumFilters, disciplineFilters, sortField, sortDirection]);

  const handleSort = (field: keyof Tables<'subjects'>) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const handleSubjectClick = (id: string) => {
    if (onViewSubject) {
      onViewSubject(id);
    } else {
      setSelectedSubjectId(id);
      setIsViewModalOpen(true);
    }
  };
  
  const handleViewSubject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSubjectId(id);
    setIsViewModalOpen(true);
  };

  const handleEditSubject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSubjectId(id);
    setIsEditModalOpen(true);
  };

  const handleSubjectUpdated = () => {
    refetch();
  };

  const handleRefresh = () => {
    refetch();
  };

  // Count active filters
  const activeFiltersCount = 
    (curriculumFilters.length > 0 ? 1 : 0) +
    (disciplineFilters.length > 0 ? 1 : 0);

  // Loading state
  if (isLoading && subjects.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search subjects..."
              className="pl-8"
              disabled
            />
          </div>
          <div className="flex space-x-2 items-center">
          </div>
        </div>
        
        <SkeletonTable rows={8} columns={6} />
        
        <div className="text-sm text-muted-foreground">
          Loading subjects...
        </div>
      </div>
    );
  }

  // Error state
  if (error && subjects.length === 0) {
    return (
      <div className="text-red-500 p-4">
        Failed to load subjects. Please try again.
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
      <div className="flex flex-wrap justify-between gap-2 items-center">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search subjects..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex space-x-2 items-center">
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

          {/* Curriculum Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={curriculumFilters.length > 0 ? "secondary" : "outline"} 
                size="sm"
              >
                <Filter className="h-4 w-4 mr-2" />
                Curriculum {curriculumFilters.length > 0 && `(${curriculumFilters.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-2">
                <div className="font-medium text-sm mb-2">Curriculum</div>
                {(['SACE', 'IB', 'PRESACE', 'PRIMARY', 'MEDICINE'] as const).map((curriculum) => (
                  <label key={curriculum} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={curriculumFilters.includes(curriculum)}
                      onCheckedChange={() => toggleCurriculumFilter(curriculum)}
                    />
                    <span className="text-sm">{curriculum}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Discipline Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={disciplineFilters.length > 0 ? "secondary" : "outline"} 
                size="sm"
              >
                <Filter className="h-4 w-4 mr-2" />
                Discipline {disciplineFilters.length > 0 && `(${disciplineFilters.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-2">
                <div className="font-medium text-sm mb-2">Discipline</div>
                {(['MATHEMATICS', 'SCIENCE', 'HUMANITIES', 'ENGLISH', 'ART', 'LANGUAGE', 'MEDICINE'] as const).map((discipline) => (
                  <label key={discipline} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={disciplineFilters.includes(discipline)}
                      onCheckedChange={() => toggleDisciplineFilter(discipline)}
                    />
                    <span className="text-sm">{discipline}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => handleSort('curriculum')}>
                Curriculum
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'curriculum' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('year_level')}>
                Year Level
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'year_level' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                Subject Name
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'name' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('level')}>
                Level
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'level' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24">
                  {isLoading ? (
                    "Loading subjects..."
                  ) : searchTerm || activeFiltersCount > 0 ? (
                    "No subjects match your filters"
                  ) : (
                    "No subjects found"
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredSubjects.map((subject) => (
                <TableRow 
                  key={subject.id} 
                  className="cursor-pointer"
                  onClick={() => handleSubjectClick(subject.id)}
                >
                  <TableCell>
                    <SubjectCurriculumBadge value={subject.curriculum} />
                  </TableCell>
                  <TableCell>{subject.year_level || '-'}</TableCell>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>{subject.level || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredSubjects.length} subjects displayed
        {filteredSubjects.length !== subjects.length && ` of ${subjects.length} total`}
        {isFetching && <span className="ml-2">(Refreshing...)</span>}
      </div>

      <ViewSubjectModal 
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        subjectId={selectedSubjectId}
        onSubjectUpdated={handleSubjectUpdated}
      />

    </div>
  );
} 