'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
  Checkbox,
  Badge,
  SkeletonTable,
  useToast,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  DataTableToolbar,
  TablePagination,
} from "@altitutor/ui";
import { 
  ArrowUpDown,
  X,
  Palette,
  Loader2
} from 'lucide-react';
import type { Enums, DataTableFilterDefinition, DataTableSortOption, DataTableColumnDefinition } from '@altitutor/shared';
import { cn, getSubjectColorHex, getSubjectColorStyle } from '@/shared/utils/index';
import { ViewSubjectModal } from './ViewSubjectModal';
import { subjectsApi } from '../api';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
import { useCurrentStaff } from '@/shared/hooks';

interface SubjectsTableProps {
  onRefresh?: number;
  onViewSubject?: (subjectId: string) => void;
}

export function SubjectsTable({ onRefresh: _onRefresh, onViewSubject: _onViewSubject }: SubjectsTableProps) {
  useRouter(); // Required for URL sync in useDataTable
  const { data: currentStaff } = useCurrentStaff();
  const { data: quickFilters = [] } = useQuickFilters('subjects');
  
  const defaultFilters = useMemo(() => ({}), []);
  const defaultSort = useMemo(() => ({ field: 'name', direction: 'asc' as const }), []);
  const defaultVisibleColumns = useMemo(() => ['curriculum', 'year_level', 'name', 'code', 'color'], []);

  const {
    state,
    setSearch,
    setSort,
    setFilters,
    setPage,
    setPageSize,
    setVisibleColumns,
    applyQuickFilter,
    resetFilters,
  } = useDataTable({
    defaultFilters,
    defaultSort,
    defaultVisibleColumns,
    filterKeys: ['curriculum', 'discipline', 'yearLevel'],
  });

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  // Select mode state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [isBulkColorDialogOpen, setIsBulkColorDialogOpen] = useState(false);
  const [bulkColor, setBulkColor] = useState<string>('#000000');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const { toast } = useToast();

  // React Query hook for data fetching with server-side filtering and pagination
  const { 
    data: subjectsData, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useQuery({
    queryKey: ['subjects-list', state.search, state.filters, state.sortBy, state.sortDirection, state.page, state.pageSize],
    queryFn: () => subjectsApi.list({
      search: state.search || undefined,
      curriculums: (state.filters.curriculum as Enums<'subject_curriculum'>[])?.length > 0 ? (state.filters.curriculum as Enums<'subject_curriculum'>[]) : undefined,
      disciplines: (state.filters.discipline as Enums<'subject_discipline'>[])?.length > 0 ? (state.filters.discipline as Enums<'subject_discipline'>[]) : undefined,
      yearLevels: (state.filters.yearLevel as number[])?.length > 0 ? (state.filters.yearLevel as number[]) : undefined,
      limit: state.pageSize,
      offset: (state.page - 1) * state.pageSize,
      orderBy: (state.sortBy || 'name') as 'name' | 'curriculum' | 'year_level' | 'discipline' | 'level',
      ascending: state.sortDirection === 'asc',
    }),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });

  const subjects = subjectsData?.subjects || [];
  const total = subjectsData?.total || 0;
  
  // Get unique year levels from all subjects for filter dropdown
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

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => [
    {
      key: 'curriculum',
      label: 'Curriculum',
      options: ['SACE', 'IB', 'PRESACE', 'PRIMARY', 'MEDICINE'].map(c => ({ label: c, value: c })),
    },
    {
      key: 'discipline',
      label: 'Discipline',
      options: ['MATHEMATICS', 'SCIENCE', 'HUMANITIES', 'ENGLISH', 'ART', 'LANGUAGE', 'MEDICINE'].map(d => ({ label: d, value: d })),
    },
    {
      key: 'yearLevel',
      label: 'Year Level',
      options: uniqueYearLevels.map(y => ({ label: `Year ${y}`, value: y })),
    },
  ], [uniqueYearLevels]);

  const sortOptions: DataTableSortOption[] = [
    { key: 'name', label: 'Name' },
    { key: 'curriculum', label: 'Curriculum' },
    { key: 'year_level', label: 'Year Level' },
    { key: 'discipline', label: 'Discipline' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'curriculum', label: 'Curriculum' },
    { key: 'year_level', label: 'Year Level' },
    { key: 'name', label: 'Name' },
    { key: 'code', label: 'Code' },
    { key: 'color', label: 'Color' },
  ];

  // Reset to page 1 when search term or filters change
  useEffect(() => {
    setPage(1);
  }, [state.search, state.filters, setPage]);
  
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
      setSelectedSubjectIds(new Set(subjects.map(s => s.id)));
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

  // Loading state
  if (isLoading && subjects.length === 0) {
    return (
      <div className="space-y-4">
        <DataTableToolbar
          state={state}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onSortChange={setSort}
          onGroupByChange={() => {}}
          onVisibleColumnsChange={setVisibleColumns}
          onQuickFilterApply={(qf) => applyQuickFilter(qf, currentStaff?.id)}
          onReset={resetFilters}
          filterDefinitions={filterDefinitions}
          sortOptions={sortOptions}
          columnDefinitions={columnDefinitions}
          quickFilters={quickFilters}
          searchPlaceholder="Search subjects..."
          isLoading={true}
        />
        
        <SkeletonTable rows={8} columns={state.visibleColumns.length + (isSelectMode ? 1 : 0)} />
        
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
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={isSelectMode ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) {
                setSelectedSubjectIds(new Set());
              }
            }}
            className="h-9"
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

          {isSelectMode && selectedSubjectIds.size > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsBulkColorDialogOpen(true)}
              className="h-9"
            >
              <Palette className="h-4 w-4 mr-2" />
              Change Color ({selectedSubjectIds.size})
            </Button>
          )}
        </div>

        <DataTableToolbar
          state={state}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onSortChange={setSort}
          onGroupByChange={() => {}}
          onVisibleColumnsChange={setVisibleColumns}
          onQuickFilterApply={(qf) => applyQuickFilter(qf, currentStaff?.id)}
          onReset={resetFilters}
          filterDefinitions={filterDefinitions}
          sortOptions={sortOptions}
          columnDefinitions={columnDefinitions}
          quickFilters={quickFilters}
          searchPlaceholder="Search subjects..."
          isLoading={isFetching}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {isSelectMode && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={subjects.length > 0 && subjects.every(s => selectedSubjectIds.has(s.id))}
                    onCheckedChange={(checked) => handleSelectAll(checked === true)}
                  />
                </TableHead>
              )}
              {state.visibleColumns.includes('curriculum') && (
                <TableHead className="cursor-pointer" onClick={() => setSort('curriculum', state.sortBy === 'curriculum' && state.sortDirection === 'asc' ? 'desc' : 'asc')}>
                  Curriculum
                  <ArrowUpDown className={cn(
                    "ml-2 h-4 w-4 inline",
                    state.sortBy === 'curriculum' ? "opacity-100" : "opacity-40"
                  )} />
                </TableHead>
              )}
              {state.visibleColumns.includes('year_level') && (
                <TableHead className="cursor-pointer" onClick={() => setSort('year_level', state.sortBy === 'year_level' && state.sortDirection === 'asc' ? 'desc' : 'asc')}>
                  Year Level
                  <ArrowUpDown className={cn(
                    "ml-2 h-4 w-4 inline",
                    state.sortBy === 'year_level' ? "opacity-100" : "opacity-40"
                  )} />
                </TableHead>
              )}
              {state.visibleColumns.includes('name') && (
                <TableHead className="cursor-pointer" onClick={() => setSort('name', state.sortBy === 'name' && state.sortDirection === 'asc' ? 'desc' : 'asc')}>
                  Name
                  <ArrowUpDown className={cn(
                    "ml-2 h-4 w-4 inline",
                    state.sortBy === 'name' ? "opacity-100" : "opacity-40"
                  )} />
                </TableHead>
              )}
              {state.visibleColumns.includes('code') && <TableHead>Code</TableHead>}
              {state.visibleColumns.includes('color') && <TableHead className="text-right">Color</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(isSelectMode ? 1 : 0) + state.visibleColumns.length} className="text-center h-24">
                  {isLoading ? (
                    "Loading subjects..."
                  ) : state.search || Object.keys(state.filters).length > 0 ? (
                    "No subjects match your filters"
                  ) : (
                    "No subjects found"
                  )}
                </TableCell>
              </TableRow>
            ) : (
              subjects.map((subject) => {
                const isSelected = selectedSubjectIds.has(subject.id);
                const subjectColorHex = getSubjectColorHex(subject);
                const { style, textColorClass } = getSubjectColorStyle(subject);
                const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                const shortName = subject?.short_name ?? subject?.long_name ?? subject?.name ?? '';
                
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
                    {state.visibleColumns.includes('curriculum') && (
                      <TableCell>
                        {subject.curriculum ? (
                          <Badge variant="outline">{subject.curriculum}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('year_level') && (
                      <TableCell>
                        {subject.year_level != null ? (
                          <Badge variant="outline">Year {subject.year_level}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('name') && (
                      <TableCell className="font-medium">
                        {subject.name || '-'}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('code') && (
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={defaultClass || `text-xs px-2 py-0.5 ${textColorClass}`}
                          style={style.backgroundColor ? style : undefined}
                        >
                          {shortName}
                        </Badge>
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('color') && (
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
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <TablePagination
        page={state.page}
        pageSize={state.pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
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
