'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { SkeletonTable } from "@altitutor/ui";
import { 
  Search, 
  ArrowUpDown,
  Filter,
  X,
  Palette,
  Loader2
} from 'lucide-react';
import type { Tables, Enums } from '@altitutor/shared';
import { cn, getSubjectColorHex, formatSubjectDisplay, formatSubjectShortName } from '@/shared/utils/index';
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
  const _router = useRouter();
  
  // Track table width for responsive display
  const [tableRef, tableSize] = useElementSize<HTMLDivElement>();

  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [curriculumFilters, setCurriculumFilters] = useState<Enums<'subject_curriculum'>[]>([]);
  const [disciplineFilters, setDisciplineFilters] = useState<Enums<'subject_discipline'>[]>([]);
  const [sortField, setSortField] = useState<keyof Tables<'subjects'>>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [_isEditModalOpen, setIsEditModalOpen] = useState(false);
  
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
    }, 300);
    return () => clearTimeout(timeoutId);
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

  // React Query hook for data fetching with server-side filtering
  const { 
    data: subjectsData, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useQuery({
    queryKey: ['subjects-list', debouncedSearchTerm, curriculumFilters, disciplineFilters, rpcOrderBy, sortDirection],
    queryFn: () => subjectsApi.list({
      search: debouncedSearchTerm || undefined,
      curriculums: curriculumFilters.length > 0 ? curriculumFilters : undefined,
      disciplines: disciplineFilters.length > 0 ? disciplineFilters : undefined,
      limit: 10000, // High limit to get all subjects
      offset: 0,
      orderBy: rpcOrderBy as 'name' | 'curriculum' | 'year_level' | 'discipline' | 'level',
      ascending: sortDirection === 'asc',
    }),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });

  const subjects = subjectsData?.subjects || [];

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

  // Subjects are already filtered and sorted server-side via RPC
  const filteredSubjects = subjects;

  const handleSort = (field: keyof Tables<'subjects'>) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
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
  
  const _handleViewSubject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSubjectId(id);
    setIsViewModalOpen(true);
  };

  const _handleEditSubject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSubjectId(id);
    setIsEditModalOpen(true);
  };

  const handleSubjectUpdated = () => {
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search subjects..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
              <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                Subject Name
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'name' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="text-right">Color</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isSelectMode ? 3 : 2} className="text-center h-24">
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
                // Show full name if table width >= 600px, otherwise show short name
                const showFullName = tableSize.width >= 600;
                const displayName = showFullName 
                  ? formatSubjectDisplay(subject) 
                  : formatSubjectShortName(subject);
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
                    <TableCell className="font-medium" title={formatSubjectDisplay(subject)}>
                      {displayName}
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