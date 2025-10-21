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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { SkeletonTable } from "@altitutor/ui";
import { 
  ChevronDown, 
  Search, 
  ArrowUpDown,
  Filter,
  RefreshCw
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
  const [curriculumFilter, setCurriculumFilter] = useState<Enums<'subject_curriculum'> | 'ALL'>('ALL');
  const [disciplineFilter, setDisciplineFilter] = useState<Enums<'subject_discipline'> | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<keyof Tables<'subjects'>>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
    if (curriculumFilter !== 'ALL') {
      result = result.filter(subject => subject.curriculum === curriculumFilter);
    }
    
    // Apply discipline filter
    if (disciplineFilter !== 'ALL') {
      result = result.filter(subject => subject.discipline === disciplineFilter);
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
  }, [subjects, searchTerm, curriculumFilter, disciplineFilter, sortField, sortDirection]);

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
            <Button variant="outline" size="sm" disabled className="flex items-center">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
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
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            className="flex items-center"
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
            Refresh
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant={curriculumFilter !== 'ALL' ? "secondary" : "outline"} 
                size="sm"
                className="flex items-center"
              >
                <Filter className="h-4 w-4 mr-2" />
                {curriculumFilter === 'ALL' ? 'Curriculum' : curriculumFilter}
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCurriculumFilter('ALL')}>
                All Curriculums
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurriculumFilter('SACE')}>
                SACE
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurriculumFilter('IB')}>
                IB
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurriculumFilter('PRESACE')}>
                Pre-SACE
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurriculumFilter('PRIMARY')}>
                Primary
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurriculumFilter('MEDICINE')}>
                Medicine
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant={disciplineFilter !== 'ALL' ? "secondary" : "outline"} 
                size="sm"
                className="flex items-center"
              >
                <Filter className="h-4 w-4 mr-2" />
                {disciplineFilter === 'ALL' ? 'Discipline' : disciplineFilter}
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDisciplineFilter('ALL')}>
                All Disciplines
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDisciplineFilter('MATHEMATICS')}>
                Mathematics
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDisciplineFilter('SCIENCE')}>
                Science
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDisciplineFilter('HUMANITIES')}>
                Humanities
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDisciplineFilter('ENGLISH')}>
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDisciplineFilter('ART')}>
                Art
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDisciplineFilter('LANGUAGE')}>
                Languages
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDisciplineFilter('MEDICINE')}>
                Medicine
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                  ) : searchTerm || curriculumFilter !== 'ALL' || disciplineFilter !== 'ALL' ? (
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