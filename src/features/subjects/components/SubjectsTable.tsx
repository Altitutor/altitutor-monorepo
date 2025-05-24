'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  Search, 
  ArrowUpDown,
  Filter,
  RefreshCw
} from 'lucide-react';
import { useSubjects } from '../hooks';
import type { Subject } from '../types';
import { SubjectCurriculum, SubjectDiscipline } from '@/lib/supabase/db/types';
import { cn } from '@/lib/utils/index';
import { SubjectCurriculumBadge } from '@/components/ui/enum-badge';
import { subjectsApi } from '../api';
import { ViewSubjectModal } from './ViewSubjectModal';

interface SubjectsTableProps {
  onRefresh?: number;
  onViewSubject?: (subjectId: string) => void;
}

export function SubjectsTable({ onRefresh, onViewSubject }: SubjectsTableProps) {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filteredSubjects, setFilteredSubjects] = useState<Subject[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [curriculumFilter, setCurriculumFilter] = useState<SubjectCurriculum | 'ALL'>('ALL');
  const [disciplineFilter, setDisciplineFilter] = useState<SubjectDiscipline | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<keyof Subject>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      const data = await subjectsApi.getAllSubjects();
      setSubjects(data);
    } catch (err) {
      console.error('Failed to load subjects:', err);
      setError('Failed to load subjects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, [onRefresh]);

  useEffect(() => {
    if (!subjects) return;
    
    let result = [...subjects];
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(subject => 
        subject.name.toLowerCase().includes(searchLower) ||
        String(subject.yearLevel).includes(searchLower) ||
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
    
    setFilteredSubjects(result);
  }, [subjects, searchTerm, curriculumFilter, disciplineFilter, sortField, sortDirection]);

  const handleSort = (field: keyof Subject) => {
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
    loadSubjects();
  };

  if (loading) {
    return <div className="flex justify-center p-4">Loading subjects...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
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
          <Button variant="outline" size="sm" onClick={loadSubjects} className="flex items-center">
            <RefreshCw className="h-4 w-4 mr-2" />
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
              <DropdownMenuItem onClick={() => setCurriculumFilter(SubjectCurriculum.SACE)}>
                SACE
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurriculumFilter(SubjectCurriculum.IB)}>
                IB
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurriculumFilter(SubjectCurriculum.PRESACE)}>
                Pre-SACE
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurriculumFilter(SubjectCurriculum.PRIMARY)}>
                Primary
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurriculumFilter(SubjectCurriculum.MEDICINE)}>
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
              <DropdownMenuItem onClick={() => setDisciplineFilter(SubjectDiscipline.MATHEMATICS)}>
                Mathematics
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDisciplineFilter(SubjectDiscipline.SCIENCE)}>
                Science
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDisciplineFilter(SubjectDiscipline.HUMANITIES)}>
                Humanities
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDisciplineFilter(SubjectDiscipline.ENGLISH)}>
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDisciplineFilter(SubjectDiscipline.ART)}>
                Art
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDisciplineFilter(SubjectDiscipline.LANGUAGE)}>
                Languages
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDisciplineFilter(SubjectDiscipline.MEDICINE)}>
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
              <TableHead className="cursor-pointer" onClick={() => handleSort('yearLevel')}>
                Year Level
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'yearLevel' ? "opacity-100" : "opacity-40"
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
                  {searchTerm || curriculumFilter !== 'ALL' || disciplineFilter !== 'ALL'
                    ? "No subjects match your filters" 
                    : "No subjects found"}
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
                  <TableCell>{subject.yearLevel || '-'}</TableCell>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>{subject.level || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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