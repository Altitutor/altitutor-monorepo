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
  MoreHorizontal,
  ArrowUpDown,
  Filter,
  RefreshCw
} from 'lucide-react';
import { useSubjects } from '@/lib/hooks';
import { Subject, SubjectCurriculum, SubjectDiscipline } from '@/lib/supabase/db/types';
import { cn } from '@/lib/utils/index';
import { subjectsApi } from '@/lib/supabase/api';

export function SubjectsTable({ onRefresh }: { onRefresh?: number }) {
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
    router.push(`/dashboard/subjects/${id}`);
  };
  
  const getCurriculumBadge = (curriculum: SubjectCurriculum | null | undefined) => {
    if (!curriculum) return null;
    
    const colorMap: Record<SubjectCurriculum, string> = {
      [SubjectCurriculum.SACE]: 'bg-blue-100 text-blue-800',
      [SubjectCurriculum.IB]: 'bg-purple-100 text-purple-800',
      [SubjectCurriculum.PRESACE]: 'bg-green-100 text-green-800',
      [SubjectCurriculum.PRIMARY]: 'bg-yellow-100 text-yellow-800',
    };
    
    return (
      <Badge className={colorMap[curriculum]}>
        {curriculum}
      </Badge>
    );
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
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  {searchTerm || curriculumFilter !== 'ALL' || disciplineFilter !== 'ALL'
                    ? "No subjects match your filters" 
                    : "No subjects found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredSubjects.map((subject) => (
                <TableRow 
                  key={subject.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSubjectClick(subject.id)}
                >
                  <TableCell>
                    {getCurriculumBadge(subject.curriculum)}
                  </TableCell>
                  <TableCell>{subject.year_level || '-'}</TableCell>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>{subject.level || '-'}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/subjects/${subject.id}`);
                        }}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/subjects/${subject.id}/edit`);
                        }}>
                          Edit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 