'use client';

import { useState, useCallback, memo, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import type { Staff, StaffRole, StaffStatus } from '@/shared/lib/supabase/database/types';
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

  // Extract staff array from the data structure
  const staffMembers = data?.staff || [];

  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<StaffStatus | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<keyof Staff>('firstName');
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
        staff.firstName.toLowerCase().includes(searchLower) ||
        staff.lastName.toLowerCase().includes(searchLower) ||
        staff.email?.toLowerCase().includes(searchLower) ||
        staff.phoneNumber?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply role filter
    if (roleFilter !== 'ALL') {
      result = result.filter(staff => staff.role === roleFilter);
    }
    
    // Apply status filter
    if (statusFilter !== 'ALL') {
      result = result.filter(staff => staff.status === statusFilter);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      const aValue = String(a[sortField as keyof Staff] || '');
      const bValue = String(b[sortField as keyof Staff] || '');
      
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [staffMembers, searchTerm, roleFilter, statusFilter, sortField, sortDirection]);

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

  const handleSort = useCallback((field: keyof Staff) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setSortField('firstName');
    setSortDirection('asc');
  }, []);

  // Loading state
  if (isLoading && staffMembers.length === 0) {
    return (
      <div className="space-y-4">
        <StaffTableFilters
          searchTerm=""
          roleFilter="ALL"
          statusFilter="ALL"
          onSearchChange={() => {}}
          onRoleFilterChange={() => {}}
          onStatusFilterChange={() => {}}
          onRefresh={() => {}}
          onResetFilters={() => {}}
          isLoading={true}
        />
        
        <SkeletonTable rows={8} columns={6} />
        
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
        roleFilter={roleFilter}
        statusFilter={statusFilter}
        onSearchChange={setSearchTerm}
        onRoleFilterChange={setRoleFilter}
        onStatusFilterChange={setStatusFilter}
        onRefresh={handleRefresh}
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
                <TableCell colSpan={6} className="text-center h-24">
                  {isLoading ? (
                    "Loading staff..."
                  ) : searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL' ? (
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
                  onStaffClick={handleStaffClick}
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