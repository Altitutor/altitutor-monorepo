'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
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
import { Checkbox } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { SkeletonTable } from "@altitutor/ui";
import { TablePagination } from '@/shared/components/TablePagination';
import { 
  Search, 
  ArrowUpDown,
  Filter,
  X,
  Palette,
  Loader2
} from 'lucide-react';
import type { Tables, Enums } from '@altitutor/shared';
import { cn, getSubjectColorHex, getSubjectColorStyle, formatSubjectShortName } from '@/shared/utils/index';
import { useElementSize } from '@/shared/hooks/useElementSize';
import { ViewSubjectModal } from './ViewSubjectModal';
import { subjectsApi } from '../api';
import { useToast } from '@altitutor/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
import { Label } from "@altitutor/ui";

interface SubjectsTableProps {
  onRefresh?: number;
  onViewSubject?: (subjectId: string) => void;
}

export function SubjectsTable({ onRefresh: _onRefresh, onViewSubject: _onViewSubject }: SubjectsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize from URL params
  const getSearchFromUrl = () => searchParams.get('search') || '';
  const getArrayFromUrl = (key: string): string[] => {
    const param = searchParams.get(key);
    return param ? param.split(',').filter(Boolean) : [];
  };
  const getNumberArrayFromUrl = (key: string): number[] => {
    const param = searchParams.get(key);
    return param ? param.split(',').map(Number).filter(n => !isNaN(n)) : [];
  };
  const getSortFromUrl = (): { field: keyof Tables<'subjects'>; direction: 'asc' | 'desc' } => {
    const field = (searchParams.get('sort') || 'name') as keyof Tables<'subjects'>;
    const direction = (searchParams.get('order') || 'asc') as 'asc' | 'desc';
    return { field, direction };
  };
  
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`/subjects?${params.toString()}`);
  };
  
  // Track table width for responsive display
  const [tableRef] = useElementSize<HTMLDivElement>();

  // Filter and sort state initialized from URL
  const [searchTerm, setSearchTerm] = useState(getSearchFromUrl);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [curriculumFilters, setCurriculumFilters] = useState<Enums<'subject_curriculum'>[]>(getArrayFromUrl('curriculum') as Enums<'subject_curriculum'>[]);
  const [disciplineFilters, setDisciplineFilters] = useState<Enums<'subject_discipline'>[]>(getArrayFromUrl('discipline') as Enums<'subject_discipline'>[]);
  const [yearLevelFilters, setYearLevelFilters] = useState<number[]>(getNumberArrayFromUrl('yearLevel'));
  const sortFromUrl = getSortFromUrl();
  const [sortField, setSortField] = useState<keyof Tables<'subjects'>>(sortFromUrl.field);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(sortFromUrl.direction);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('pageSize')) || 50);
  
  // Sync from URL params
  useEffect(() => {
    setSearchTerm(getSearchFromUrl());
    setCurriculumFilters(getArrayFromUrl('curriculum') as Enums<'subject_curriculum'>[]);
    setDisciplineFilters(getArrayFromUrl('discipline') as Enums<'subject_discipline'>[]);
    setYearLevelFilters(getNumberArrayFromUrl('yearLevel'));
    const sort = getSortFromUrl();
    setSortField(sort.field);
    setSortDirection(sort.direction);
    const pageParam = Number(searchParams.get('page'));
    if (pageParam) setPage(pageParam);
    const pageSizeParam = Number(searchParams.get('pageSize'));
    if (pageSizeParam) setPageSize(pageSizeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  // Select mode state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [isBulkColorDialogOpen, setIsBulkColorDialogOpen] = useState(false);
  const [bulkColor, setBulkColor] = useState<string>('#000000');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const { toast } = useToast();

  // Debounce search term
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1); // Reset to first page on search
      updateUrlParams({ 
        search: searchTerm || null,
        page: null 
      });
    }, 300);
    return () => clearTimeout(timeoutId);
    // updateUrlParams is stable (uses searchParams which is from useSearchParams)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Map sortField to RPC orderBy parameter
  const rpcOrderBy = useMemo(() => {
    if (sortField === 'name') return 'name';
    if (sortField === 'curriculum') return 'curriculum';
    if (sortField === 'year_level') return 'year_level';
    if (sortField === 'discipline') return 'discipline';
    if (sortField === 'level') return 'level';
    return 'name';
  }, [sortField]);

  // React Query hook for data fetching with server-side filtering and pagination
  const { 
    data: subjectsData, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useQuery({
    queryKey: ['subjects-list', debouncedSearchTerm, curriculumFilters, disciplineFilters, yearLevelFilters, rpcOrderBy, sortDirection, page, pageSize],
    queryFn: () => subjectsApi.list({
      search: debouncedSearchTerm || undefined,
      curriculums: curriculumFilters.length > 0 ? curriculumFilters : undefined,
      disciplines: disciplineFilters.length > 0 ? disciplineFilters : undefined,
      yearLevels: yearLevelFilters.length > 0 ? yearLevelFilters : undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: rpcOrderBy as 'name' | 'curriculum' | 'year_level' | 'discipline' | 'level',
      ascending: sortDirection === 'asc',
    }),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });

  const subjects = subjectsData?.subjects || [];
  const total = subjectsData?.total || 0;
  
  // Get unique year levels from all subjects for filter dropdown
  // Fetch all subjects without pagination to get unique year levels
  const { data: allSubjectsData } = useQuery({
    queryKey: ['subjects-all-year-levels'],
    queryFn: () => subjectsApi.list({
      limit: 10000,
      offset: 0,
    }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  const uniqueYearLevels = useMemo(() => {
    const allSubjects = allSubjectsData?.subjects || [];
    const yearLevels = new Set<number>();
    allSubjects.forEach(subject => {
      if (subject.year_level != null) {
        yearLevels.add(subject.year_level);
      }
    });
    return Array.from(yearLevels).sort((a, b) => a - b);
  }, [allSubjectsData]);

  // Filter toggle handlers
  const toggleCurriculumFilter = (curriculum: Enums<'subject_curriculum'>) => {
    const newFilters = curriculumFilters.includes(curriculum) 
      ? curriculumFilters.filter(c => c !== curriculum)
      : [...curriculumFilters, curriculum];
    setCurriculumFilters(newFilters);
    setPage(1); // Reset to first page when filter changes
    updateUrlParams({ 
      curriculum: newFilters.length > 0 ? newFilters.join(',') : null,
      page: null 
    });
  };

  const toggleDisciplineFilter = (discipline: Enums<'subject_discipline'>) => {
    const newFilters = disciplineFilters.includes(discipline) 
      ? disciplineFilters.filter(d => d !== discipline)
      : [...disciplineFilters, discipline];
    setDisciplineFilters(newFilters);
    setPage(1); // Reset to first page when filter changes
    updateUrlParams({ 
      discipline: newFilters.length > 0 ? newFilters.join(',') : null,
      page: null 
    });
  };

  const toggleYearLevelFilter = (yearLevel: number) => {
    const newFilters = yearLevelFilters.includes(yearLevel) 
      ? yearLevelFilters.filter(y => y !== yearLevel)
      : [...yearLevelFilters, yearLevel];
    setYearLevelFilters(newFilters);
    setPage(1); // Reset to first page when filter changes
    updateUrlParams({ 
      yearLevel: newFilters.length > 0 ? newFilters.join(',') : null,
      page: null 
    });
  };

  const clearAllFilters = () => {
    setCurriculumFilters([]);
    setDisciplineFilters([]);
    setYearLevelFilters([]);
    setSearchTerm('');
    setPage(1);
    updateUrlParams({ 
      search: null,
      curriculum: null,
      discipline: null,
      yearLevel: null,
      page: null 
    });
  };

  // Subjects are already filtered and sorted server-side via RPC
  const filteredSubjects = subjects;

  const handleSort = (field: keyof Tables<'subjects'>) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    const newField = sortField === field ? field : field;
    setSortField(newField);
    setSortDirection(newDirection);
    setPage(1); // Reset to first page when sort changes
    updateUrlParams({ 
      sort: newField,
      order: newDirection,
      page: null 
    });
  };
  
  const handleSubjectClick = (id: string, e?: React.MouseEvent) => {
    // Don't open modal if clicking checkbox or in select mode
    if (isSelectMode || (e?.target as HTMLElement)?.closest('input[type="checkbox"]')) {
      return;
    }
    if (_onViewSubject) {
      _onViewSubject(id);
    } else {
      setSelectedSubjectId(id);
      setIsViewModalOpen(true);
    }
  };

  const handleSelectSubject = (id: string, checked: boolean) => {
    setSelectedSubjectIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSubjectIds(new Set(filteredSubjects.map(s => s.id)));
    } else {
      setSelectedSubjectIds(new Set());
    }
  };

  const handleBulkColorChange = async () => {
    if (selectedSubjectIds.size === 0) return;
    
    try {
      setIsBulkUpdating(true);
      const colorToSet = bulkColor === '#000000' ? null : bulkColor;
      await subjectsApi.bulkUpdateColors(Array.from(selectedSubjectIds), colorToSet);
      
      toast({
        title: "Colors updated",
        description: `Updated color for ${selectedSubjectIds.size} subject${selectedSubjectIds.size > 1 ? 's' : ''}.`,
      });
      
      setIsBulkColorDialogOpen(false);
      setSelectedSubjectIds(new Set());
      setIsSelectMode(false);
      refetch();
    } catch (error) {
      console.error('Failed to update colors:', error);
      toast({
        title: "Update failed",
        description: "There was an error updating subject colors. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };
  

  const handleSubjectUpdated = () => {
    refetch();
  };

  // Count active filters
  const activeFiltersCount = 
    (curriculumFilters.length > 0 ? 1 : 0) +
    (disciplineFilters.length > 0 ? 1 : 0) +
    (yearLevelFilters.length > 0 ? 1 : 0);

  // Loading state
  if (isLoading && subjects.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search subjects..."
              className="pl-8"
              disabled
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              <Filter className="h-4 w-4 mr-2" />
              Curriculum
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Filter className="h-4 w-4 mr-2" />
              Discipline
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Filter className="h-4 w-4 mr-2" />
              Year Level
            </Button>
          </div>
        </div>
        
        <SkeletonTable rows={8} columns={isSelectMode ? 6 : 5} />
        
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search subjects..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => {
              const value = e.target.value;
              setSearchTerm(value);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Select Mode Toggle */}
          <Button
            variant={isSelectMode ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) {
                setSelectedSubjectIds(new Set());
              }
            }}
          >
            {isSelectMode ? (
              <>
                <X className="h-4 w-4 mr-2" />
                Cancel Selection
              </>
            ) : (
              <>
                <Palette className="h-4 w-4 mr-2" />
                Select Subjects
              </>
            )}
          </Button>

          {/* Bulk Color Change Button */}
          {isSelectMode && selectedSubjectIds.size > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsBulkColorDialogOpen(true)}
            >
              <Palette className="h-4 w-4 mr-2" />
              Change Color ({selectedSubjectIds.size})
            </Button>
          )}

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

          {/* Year Level Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={yearLevelFilters.length > 0 ? "secondary" : "outline"} 
                size="sm"
              >
                <Filter className="h-4 w-4 mr-2" />
                Year Level {yearLevelFilters.length > 0 && `(${yearLevelFilters.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-2">
                <div className="font-medium text-sm mb-2">Year Level</div>
                {uniqueYearLevels.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2">Loading year levels...</div>
                ) : (
                  uniqueYearLevels.map((yearLevel) => (
                    <label key={yearLevel} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={yearLevelFilters.includes(yearLevel)}
                        onCheckedChange={() => toggleYearLevelFilter(yearLevel)}
                      />
                      <span className="text-sm">Year {yearLevel}</span>
                    </label>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="rounded-md border" ref={tableRef}>
        <Table>
          <TableHeader>
            <TableRow>
              {isSelectMode && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={filteredSubjects.length > 0 && filteredSubjects.every(s => selectedSubjectIds.has(s.id))}
                    onCheckedChange={(checked) => handleSelectAll(checked === true)}
                  />
                </TableHead>
              )}
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
                Name
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'name' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Color</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isSelectMode ? 6 : 5} className="text-center h-24">
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
              filteredSubjects.map((subject) => {
                const isSelected = selectedSubjectIds.has(subject.id);
                const subjectColorHex = getSubjectColorHex(subject);
                const { style, textColorClass } = getSubjectColorStyle(subject);
                const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                const shortName = formatSubjectShortName(subject);
                
                return (
                  <TableRow 
                    key={subject.id} 
                    className={cn(
                      !isSelectMode && "cursor-pointer",
                      isSelected && "bg-muted/50"
                    )}
                    onClick={(e) => handleSubjectClick(subject.id, e)}
                  >
                    {isSelectMode && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectSubject(subject.id, checked === true)}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      {subject.curriculum ? (
                        <Badge variant="outline">{subject.curriculum}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {subject.year_level != null ? (
                        <Badge variant="outline">Year {subject.year_level}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {subject.name || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={defaultClass || `text-xs px-2 py-0.5 ${textColorClass}`}
                        style={style.backgroundColor ? style : undefined}
                      >
                        {shortName}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {subjectColorHex ? (
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className="w-6 h-6 rounded border border-gray-300"
                            style={{ backgroundColor: subjectColorHex }}
                            title={subjectColorHex}
                          />
                          <span className="text-xs text-muted-foreground">{subjectColorHex}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={(newPage) => {
          setPage(newPage);
          updateUrlParams({ page: newPage === 1 ? null : String(newPage) });
        }}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
          updateUrlParams({ 
            pageSize: newSize === 50 ? null : String(newSize),
            page: null 
          });
        }}
      />

      <ViewSubjectModal 
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        subjectId={selectedSubjectId}
        onSubjectUpdated={handleSubjectUpdated}
      />

      {/* Bulk Color Change Dialog */}
      <Dialog open={isBulkColorDialogOpen} onOpenChange={setIsBulkColorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Color for {selectedSubjectIds.size} Subject{selectedSubjectIds.size > 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Select a color to apply to all selected subjects. Leave as black (#000000) to clear the color.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={bulkColor}
                  onChange={(e) => setBulkColor(e.target.value)}
                  className="h-10 w-20 cursor-pointer"
                />
                <Input
                  type="text"
                  placeholder="#000000"
                  value={bulkColor}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    if (value === '') {
                      setBulkColor('#000000');
                    } else if (/^#[0-9A-Fa-f]{6}$/i.test(value)) {
                      setBulkColor(value.toUpperCase());
                    } else {
                      setBulkColor(value);
                    }
                  }}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Hex color code (e.g., #FF5733). Set to #000000 to clear color.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBulkColorDialogOpen(false)}
              disabled={isBulkUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkColorChange}
              disabled={isBulkUpdating}
            >
              {isBulkUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Colors'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
} 