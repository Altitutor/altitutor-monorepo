'use client';

import { useState, useCallback, memo, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@altitutor/ui";
import { SkeletonTable } from "@altitutor/ui";
import type { Tables } from '@altitutor/shared';
import { TablePagination } from '@/shared/components/TablePagination';
import { useStaffMinimalPaginated } from '../hooks/useStaffQuery';
import { AddStaffModal } from './AddStaffModal';
import { ViewStaffModal } from './modal';
import { ViewClassModal } from '@/features/classes';
import { StaffTableFilters } from './StaffTableFilters';
import { StaffTableHeader } from './StaffTableHeader';
import { StaffTableRow } from './StaffTableRow';
import { formatClassShortName, formatClassName } from '@/shared/utils';

interface StaffTableProps {
  onRefresh?: number;
}

export const StaffTable = memo(function StaffTable({ onRefresh: _onRefresh }: StaffTableProps = {}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>(['ACTIVE']);
  const [sortField, setSortField] = useState<keyof Tables<'staff'>>('role');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useStaffMinimalPaginated({
    search: searchTerm,
    roles: roleFilters,
    statuses: statusFilters,
    page,
    pageSize,
    orderBy: sortField,
    ascending: sortDirection === 'asc',
  });

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
  }, [searchTerm, roleFilters, statusFilters]);

  // Event handlers
  const handleStaffClick = useCallback((id: string) => {
    setSelectedStaffId(id);
    setIsViewModalOpen(true);
  }, []);

  const handleStaffUpdated = useCallback(() => {
    refetch();
  }, [refetch]);

  const _handleAddStaffClick = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const handleClassClick = useCallback((classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  }, []);

  const handleSort = useCallback((field: keyof Tables<'staff'>) => {
    setPage(1);
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setRoleFilters([]);
    setStatusFilters(['ACTIVE']);
    setSortField('role');
    setSortDirection('asc');
    setPage(1);
  }, []);

  const handleRoleFiltersChange = useCallback((roles: string[]) => {
    setRoleFilters(roles);
    setPage(1);
  }, []);

  const handleStatusFiltersChange = useCallback((statuses: string[]) => {
    setStatusFilters(statuses.length > 0 ? statuses : []);
    setPage(1);
  }, []);

  // Loading state
  if (isLoading && staffMembers.length === 0) {
    return (
      <div className="space-y-4">
        <StaffTableFilters
          searchTerm=""
          roleFilters={[]}
          statusFilters={[]}
          onSearchChange={() => {}}
          onRoleFiltersChange={() => {}}
          onStatusFiltersChange={() => {}}
          onResetFilters={() => {}}
          isLoading={true}
        />
        
        <SkeletonTable rows={8} columns={5} />
        
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
      <StaffTableFilters
        searchTerm={searchTerm}
        roleFilters={roleFilters}
        statusFilters={statusFilters}
        onSearchChange={(value) => {
          setSearchTerm(value);
          setPage(1);
        }}
        onRoleFiltersChange={handleRoleFiltersChange}
        onStatusFiltersChange={handleStatusFiltersChange}
        onResetFilters={resetFilters}
        isLoading={isFetching}
      />

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <StaffTableHeader
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          <TableBody>
            {staffMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  {isLoading ? (
                    "Loading staff..."
                  ) : searchTerm || roleFilters.length > 0 || statusFilters.length !== 1 || !statusFilters.includes('ACTIVE') ? (
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
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
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