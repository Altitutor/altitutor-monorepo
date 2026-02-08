'use client';

import { useState, useCallback, memo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

interface StaffTableProps {
  onRefresh?: number;
}

export const StaffTable = memo(function StaffTable({ onRefresh: _onRefresh }: StaffTableProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize from URL params
  const getSearchFromUrl = () => searchParams.get('search') || '';
  const getArrayFromUrl = (key: string): string[] => {
    const param = searchParams.get(key);
    return param ? param.split(',').filter(Boolean) : [];
  };
  const getSortFromUrl = (): { field: keyof Tables<'staff'>; direction: 'asc' | 'desc' } => {
    const field = (searchParams.get('sort') || 'role') as keyof Tables<'staff'>;
    const direction = (searchParams.get('order') || 'asc') as 'asc' | 'desc';
    return { field, direction };
  };
  
  const updateUrlParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`/staff?${params.toString()}`);
  }, [searchParams, router]);
  
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('pageSize')) || 50);

  // Filter and sort state initialized from URL
  const [searchTerm, setSearchTerm] = useState(getSearchFromUrl);
  const [roleFilters, setRoleFilters] = useState<string[]>(getArrayFromUrl('role'));
  const [statusFilters, setStatusFilters] = useState<string[]>(getArrayFromUrl('status').length > 0 ? getArrayFromUrl('status') : ['ACTIVE']);
  const sortFromUrl = getSortFromUrl();
  const [sortField, setSortField] = useState<keyof Tables<'staff'>>(sortFromUrl.field);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(sortFromUrl.direction);
  
  // Sync from URL params
  useEffect(() => {
    setSearchTerm(getSearchFromUrl());
    setRoleFilters(getArrayFromUrl('role'));
    const statusFromUrl = getArrayFromUrl('status');
    setStatusFilters(statusFromUrl.length > 0 ? statusFromUrl : ['ACTIVE']);
    const sort = getSortFromUrl();
    setSortField(sort.field);
    setSortDirection(sort.direction);
    const pageParam = Number(searchParams.get('page'));
    if (pageParam) setPage(pageParam);
    const pageSizeParam = Number(searchParams.get('pageSize'));
    if (pageSizeParam) setPageSize(pageSizeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  const handleClassClick = useCallback((classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  }, []);

  const handleSort = useCallback((field: keyof Tables<'staff'>) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    const newField = sortField === field ? field : field;
    setSortField(newField);
    setSortDirection(newDirection);
    setPage(1);
    updateUrlParams({ 
      sort: newField,
      order: newDirection,
      page: null 
    });
  }, [sortField, sortDirection, updateUrlParams]);

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setRoleFilters([]);
    setStatusFilters(['ACTIVE']);
    setSortField('role');
    setSortDirection('asc');
    setPage(1);
    updateUrlParams({ 
      search: null,
      role: null,
      status: null,
      sort: null,
      order: null,
      page: null 
    });
  }, [updateUrlParams]);

  const handleRoleFiltersChange = useCallback((roles: string[]) => {
    setRoleFilters(roles);
    setPage(1);
    updateUrlParams({ 
      role: roles.length > 0 ? roles.join(',') : null,
      page: null 
    });
  }, [updateUrlParams]);

  const handleStatusFiltersChange = useCallback((statuses: string[]) => {
    setStatusFilters(statuses.length > 0 ? statuses : []);
    setPage(1);
    updateUrlParams({ 
      status: statuses.length > 0 ? statuses.join(',') : null,
      page: null 
    });
  }, [updateUrlParams]);

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
          updateUrlParams({ 
            search: value || null,
            page: null 
          });
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
                  onStaffUpdated={handleStaffUpdated}
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
        onPageChange={(newPage) => {
          setPage(newPage);
          updateUrlParams({ page: newPage === 1 ? null : String(newPage) });
        }}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
          updateUrlParams({ 
            pageSize: size === 50 ? null : String(size),
            page: null 
          });
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