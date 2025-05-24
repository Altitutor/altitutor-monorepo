'use client';

import { useState, useCallback, memo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Staff } from '@/lib/supabase/db/types';
import { useStaffData } from '@/hooks/useStaffData';
import { useStaffFilters } from '@/hooks/useStaffFilters';
import { AddStaffModal } from './AddStaffModal';
import { ViewStaffModal } from './modal';
import { ViewClassModal } from '@/components/features/classes/modal';
import { StaffTableFilters } from './StaffTableFilters';
import { StaffTableHeader } from './StaffTableHeader';
import { StaffTableRow } from './StaffTableRow';

interface StaffTableProps {
  onRefresh?: number;
}

export const StaffTable = memo(function StaffTable({ onRefresh }: StaffTableProps = {}) {
  // Data management
  const { staffMembers, staffClasses, loading, error, refreshData } = useStaffData(onRefresh);
  
  // Filtering and sorting
  const {
    filteredStaff,
    filters,
    setSearchTerm,
    setRoleFilter,
    setStatusFilter,
    handleSort,
    resetFilters,
  } = useStaffFilters(staffMembers);

  // Modal state
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  // Event handlers
  const handleStaffClick = useCallback((id: string) => {
    setSelectedStaffId(id);
    setIsViewModalOpen(true);
  }, []);

  const handleStaffUpdated = useCallback(() => {
    refreshData();
  }, [refreshData]);

  const handleAddStaffClick = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const handleClassClick = useCallback((classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  }, []);

  const handleRefresh = useCallback(() => {
    refreshData();
  }, [refreshData]);

  // Loading state
  if (loading && staffMembers.length === 0) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-muted-foreground">Loading staff...</div>
      </div>
    );
  }

  // Error state
  if (error && staffMembers.length === 0) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <StaffTableFilters
        searchTerm={filters.searchTerm}
        roleFilter={filters.roleFilter}
        statusFilter={filters.statusFilter}
        onSearchChange={setSearchTerm}
        onRoleFilterChange={setRoleFilter}
        onStatusFilterChange={setStatusFilter}
        onRefresh={handleRefresh}
        onResetFilters={resetFilters}
        isLoading={loading}
      />

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <StaffTableHeader
            sortField={filters.sortField}
            sortDirection={filters.sortDirection}
            onSort={handleSort}
          />
          <TableBody>
            {filteredStaff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  {filters.searchTerm || filters.roleFilter !== 'ALL' || filters.statusFilter !== 'ALL' 
                    ? "No staff match your filters" 
                    : "No staff found"}
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