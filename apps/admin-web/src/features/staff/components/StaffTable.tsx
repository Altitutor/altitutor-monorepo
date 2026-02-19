'use client';

import { useState, useCallback, memo, useEffect, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
  TableHeader,
  DataTableToolbar,
  TablePagination,
  SkeletonTable,
} from "@altitutor/ui";
import { ArrowUpDown } from 'lucide-react';
import type { Tables, DataTableFilterDefinition, DataTableSortOption, DataTableColumnDefinition } from '@altitutor/shared';
import { useStaffMinimalPaginated, useCurrentStaff } from '../hooks/useStaffQuery';
import { AddStaffModal } from './AddStaffModal';
import { ViewStaffModal } from './modal';
import { ViewClassModal } from '@/features/classes';
import { StaffTableRow } from './StaffTableRow';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
import { cn } from '@/shared/utils';

interface StaffTableProps {
  onRefresh?: number;
}

export const StaffTable = memo(function StaffTable({ onRefresh: _onRefresh }: StaffTableProps = {}) {
  const { data: currentStaff } = useCurrentStaff();
  const { data: quickFilters = [] } = useQuickFilters('staff');
  
  const defaultFilters = useMemo(() => ({ status: ['ACTIVE'] }), []);
  const defaultSort = useMemo(() => ({ field: 'role', direction: 'asc' as const }), []);
  const defaultVisibleColumns = useMemo(() => ['status', 'role', 'first_name', 'last_name', 'classes'], []);

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
    filterKeys: ['role', 'status'],
  });
  
  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useStaffMinimalPaginated({
    search: state.search,
    roles: state.filters.role as string[],
    statuses: state.filters.status as string[],
    page: state.page,
    pageSize: state.pageSize,
    orderBy: state.sortBy as keyof Tables<'staff'> || 'role',
    ascending: state.sortDirection === 'asc',
  });

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => [
    {
      key: 'role',
      label: 'Role',
      options: [
        { label: 'Admin Staff', value: 'ADMINSTAFF' },
        { label: 'Tutor', value: 'TUTOR' },
        { label: 'Admin', value: 'ADMIN' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      options: [
        { label: 'ACTIVE', value: 'ACTIVE' },
        { label: 'INACTIVE', value: 'INACTIVE' },
        { label: 'TRIAL', value: 'TRIAL' },
      ],
    },
  ], []);

  const sortOptions: DataTableSortOption[] = [
    { key: 'status', label: 'Status' },
    { key: 'role', label: 'Role' },
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'status', label: 'Status' },
    { key: 'role', label: 'Role' },
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'classes', label: 'Classes' },
  ];

  const staffMembers = (data?.staff as (Tables<'staff'> & { classes?: (Tables<'classes'> & { subject?: Tables<'subjects'> })[] })[] | undefined) || [];
  const total = data?.total ?? 0;

  // Modal state
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  // Reset to page 1 when search term or filters change
  useEffect(() => {
    setPage(1);
  }, [state.search, state.filters, setPage]);

  // Event handlers
  const handleStaffClick = useCallback((id: string) => {
    setSelectedStaffId(id);
    setIsViewModalOpen(true);
  }, []);

  const handleStaffUpdated = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleClassClick = useCallback((classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  }, []);

  // Loading state
  if (isLoading && staffMembers.length === 0) {
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
          searchPlaceholder="Search staff..."
          isLoading={true}
        />
        
        <SkeletonTable rows={8} columns={state.visibleColumns.length} />
        
        <div className="text-sm text-muted-foreground">
          Loading staff...
        </div>
      </div>
    );
  }

  // Error state
  if (error && staffMembers.length === 0) {
    return (
      <div className="text-red-500 p-4">
        Failed to load staff. Please try again.
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
      {/* Filters */}
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
        searchPlaceholder="Search staff..."
        isLoading={isFetching}
      />

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {state.visibleColumns.includes('status') && (
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors" 
                  onClick={() => setSort('status', state.sortBy === 'status' && state.sortDirection === 'asc' ? 'desc' : 'asc')}
                >
                  <div className="flex items-center">
                    Status
                    <ArrowUpDown className={cn(
                      "ml-2 h-4 w-4",
                      state.sortBy === 'status' ? "opacity-100" : "opacity-40"
                    )} />
                  </div>
                </TableHead>
              )}
              {state.visibleColumns.includes('role') && (
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors" 
                  onClick={() => setSort('role', state.sortBy === 'role' && state.sortDirection === 'asc' ? 'desc' : 'asc')}
                >
                  <div className="flex items-center">
                    Role
                    <ArrowUpDown className={cn(
                      "ml-2 h-4 w-4",
                      state.sortBy === 'role' ? "opacity-100" : "opacity-40"
                    )} />
                  </div>
                </TableHead>
              )}
              {state.visibleColumns.includes('first_name') && (
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors" 
                  onClick={() => setSort('first_name', state.sortBy === 'first_name' && state.sortDirection === 'asc' ? 'desc' : 'asc')}
                >
                  <div className="flex items-center">
                    First Name
                    <ArrowUpDown className={cn(
                      "ml-2 h-4 w-4",
                      state.sortBy === 'first_name' ? "opacity-100" : "opacity-40"
                    )} />
                  </div>
                </TableHead>
              )}
              {state.visibleColumns.includes('last_name') && (
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors" 
                  onClick={() => setSort('last_name', state.sortBy === 'last_name' && state.sortDirection === 'asc' ? 'desc' : 'asc')}
                >
                  <div className="flex items-center">
                    Last Name
                    <ArrowUpDown className={cn(
                      "ml-2 h-4 w-4",
                      state.sortBy === 'last_name' ? "opacity-100" : "opacity-40"
                    )} />
                  </div>
                </TableHead>
              )}
              {state.visibleColumns.includes('classes') && <TableHead>Classes</TableHead>}
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={state.visibleColumns.length + 1} className="text-center h-24">
                  {isLoading ? (
                    "Loading staff..."
                  ) : state.search || Object.keys(state.filters).length > 0 ? (
                    "No staff match your filters"
                  ) : (
                    "No staff found"
                  )}
                </TableCell>
              </TableRow>
            ) : (
              staffMembers.map((staff) => (
                <StaffTableRow
                  key={staff.id}
                  staff={staff}
                  classes={((staff as any).classes || []) as (Tables<'classes'> & { subject?: Tables<'subjects'> })[]}
                  onStaffClick={handleStaffClick}
                  onClassClick={handleClassClick}
                  onStaffUpdated={handleStaffUpdated}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <TablePagination
        page={state.page}
        pageSize={state.pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* Modals */}
      <AddStaffModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onStaffAdded={handleStaffUpdated}
      />

      <ViewStaffModal 
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        staffId={selectedStaffId}
        onStaffUpdated={handleStaffUpdated}
      />

      <ViewClassModal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        classId={selectedClassId}
        onClassUpdated={handleStaffUpdated}
      />
    </div>
  );
}); 
