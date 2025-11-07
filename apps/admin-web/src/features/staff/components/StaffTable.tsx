'use client';

import { useState, useCallback, memo, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@altitutor/ui";
import { SkeletonTable } from "@altitutor/ui";
import type { Tables } from '@altitutor/shared';
import { useStaffWithSubjects } from '../hooks/useStaffQuery';
import { AddStaffModal } from './AddStaffModal';
import { ViewStaffModal } from './modal';
import { ViewClassModal } from '@/features/classes';
import { StaffTableFilters } from './StaffTableFilters';
import { StaffTableHeader } from './StaffTableHeader';
import { StaffTableRow } from './StaffTableRow';

interface StaffTableProps {
  onRefresh?: number;
}

export const StaffTable = memo(function StaffTable({ onRefresh }: StaffTableProps = {}) {
  // React Query hook for data fetching
  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useStaffWithSubjects();

  // Extract staff array and classes from the data structure
  const staffMembers = (data?.staff as Tables<'staff'>[] | undefined) || [];
  const staffClasses: Record<string, (Tables<'classes'> & { subject?: Tables<'subjects'> })[]> = (data as any)?.staffClasses || {};
  const classSubjects: Record<string, Tables<'subjects'>> = (data as any)?.classSubjects || {};

  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>(['ACTIVE']);
  const [sortField, setSortField] = useState<keyof Tables<'staff'>>('role');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modal state
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  // Memoized filtered and sorted staff
  const filteredStaff = useMemo(() => {
    if (!staffMembers.length) return [];
    
    let result = [...staffMembers];
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(staff => 
        (staff.first_name || '').toLowerCase().includes(searchLower) ||
        (staff.last_name || '').toLowerCase().includes(searchLower) ||
        staff.email?.toLowerCase().includes(searchLower) ||
        staff.phone_number?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply role filter
    if (roleFilters.length > 0) {
      result = result.filter(staff => staff.role && roleFilters.includes(staff.role));
    }
    
    // Apply status filter
    if (statusFilters.length > 0) {
      result = result.filter(staff => staff.status && statusFilters.includes(staff.status));
    }
    
    // Apply sorting with compound sort for role field
    result.sort((a, b) => {
      const aValue = String(a[sortField] || '');
      const bValue = String(b[sortField] || '');
      
      const comparison = aValue.localeCompare(bValue);
      const primarySort = sortDirection === 'asc' ? comparison : -comparison;
      
      // If sorting by role and values are equal, use first_name as secondary sort
      if (sortField === 'role' && comparison === 0) {
        const aFirstName = String(a.first_name || '');
        const bFirstName = String(b.first_name || '');
        return aFirstName.localeCompare(bFirstName);
      }
      
      return primarySort;
    });
    
    return result;
  }, [staffMembers, searchTerm, roleFilters, statusFilters, sortField, sortDirection]);

  // Event handlers
  const handleStaffClick = useCallback((id: string) => {
    setSelectedStaffId(id);
    setIsViewModalOpen(true);
  }, []);

  const handleStaffUpdated = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleAddStaffClick = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const handleClassClick = useCallback((classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleSort = useCallback((field: keyof Tables<'staff'>) => {
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
        onSearchChange={setSearchTerm}
        onRoleFiltersChange={setRoleFilters}
        onStatusFiltersChange={setStatusFilters}
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
            {filteredStaff.length === 0 ? (
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
              filteredStaff.map((staff) => (
                <StaffTableRow
                  key={staff.id}
                  staff={staff}
                  classes={staffClasses[staff.id] || []}
                  onStaffClick={handleStaffClick}
                  onClassClick={handleClassClick}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredStaff.length} staff displayed
        {filteredStaff.length !== staffMembers.length && ` of ${staffMembers.length} total`}
        {isFetching && <span className="ml-2">(Refreshing...)</span>}
      </div>

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