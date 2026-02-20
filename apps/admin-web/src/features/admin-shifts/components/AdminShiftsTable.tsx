'use client';

import React, { useState, Dispatch, SetStateAction, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
  Label,
  Badge,
  SkeletonTable,
  useToast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DataTableToolbar,
  TablePagination,
} from "@altitutor/ui";
import { Search, Loader2 } from 'lucide-react';
import { useAdminShiftsMinimalPaginated, useDeleteAdminShift } from '../hooks/useAdminShiftsQuery';
import type { Tables, DataTableFilterDefinition, DataTableSortOption, DataTableColumnDefinition } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';
import { AddAdminShiftModal } from './AddAdminShiftModal';
import { ViewAdminShiftModal } from './modal';
import { ViewStaffModal } from '@/features/staff';
import { formatTime, getDayOfWeek } from '@/shared/utils/datetime';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
import { useCurrentStaff } from '@/shared/hooks';

interface AdminShiftsTableProps {
  addModalState?: [boolean, Dispatch<SetStateAction<boolean>>];
  viewMode?: 'table';
}

export function AdminShiftsTable({ addModalState }: AdminShiftsTableProps) {
  const router = useRouter();
  const { data: currentStaff } = useCurrentStaff();
  const { data: quickFilters = [] } = useQuickFilters('admin-shifts');
  
  const defaultFilters = useMemo(() => ({ status: ['ACTIVE'] }), []);
  const defaultSort = useMemo(() => ({ field: 'day_of_week', direction: 'asc' as const }), []);
  const defaultVisibleColumns = useMemo(() => ['day', 'time', 'status', 'staff'], []);

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
    filterKeys: ['day', 'status'],
  });

  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useAdminShiftsMinimalPaginated({
    search: state.search,
    daysOfWeek: state.filters.day as number[],
    statuses: state.filters.status as string[],
    page: state.page,
    pageSize: state.pageSize,
    orderBy: state.sortBy as any || 'day_of_week',
    ascending: state.sortDirection === 'asc',
  });

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => [
    {
      key: 'day',
      label: 'Day',
      options: [
        { label: 'Monday', value: 1 },
        { label: 'Tuesday', value: 2 },
        { label: 'Wednesday', value: 3 },
        { label: 'Thursday', value: 4 },
        { label: 'Friday', value: 5 },
        { label: 'Saturday', value: 6 },
        { label: 'Sunday', value: 0 },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      options: [
        { label: 'ACTIVE', value: 'ACTIVE' },
        { label: 'INACTIVE', value: 'INACTIVE' },
      ],
    },
  ], []);

  const sortOptions: DataTableSortOption[] = [
    { key: 'day_of_week', label: 'Day of Week' },
    { key: 'start_time', label: 'Start Time' },
    { key: 'created_at', label: 'Created At' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'day', label: 'Day' },
    { key: 'time', label: 'Time' },
    { key: 'status', label: 'Status' },
    { key: 'staff', label: 'Staff' },
  ];

  const adminShifts: (Tables<'admin_shifts'> & {
    staff?: Tables<'staff'>[];
  })[] = (data?.adminShifts as any) || [];
  const total = data?.total ?? 0;
  
  // Modal states - manage internally and use external state only when provided
  const [internalAddModalOpen, setInternalAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAdminShift, setSelectedAdminShift] = useState<Tables<'admin_shifts'> | null>(null);

  // Use external modal state if provided, otherwise use internal state
  const isAddModalOpen = addModalState ? addModalState[0] : internalAddModalOpen;
  const setIsAddModalOpen = addModalState ? addModalState[1] : setInternalAddModalOpen;

  // Cross-feature modal states
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  // Delete dialog state
  const [adminShiftToDelete, setAdminShiftToDelete] = useState<Tables<'admin_shifts'> | null>(null);
  const [isAdminShiftDeleteDialogOpen, setIsAdminShiftDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const deleteAdminShiftMutation = useDeleteAdminShift();
  const { toast } = useToast();

  // Ensure hooks are declared before any early returns
  const parentRef = useRef<HTMLDivElement | null>(null);

  const getAdminShiftStaff = (shift: Tables<'admin_shifts'>): Tables<'staff'>[] => {
    return ((shift as any).staff || []) as Tables<'staff'>[];
  };
  
  const handleAdminShiftClick = (shift: Tables<'admin_shifts'>) => {
    setSelectedAdminShift(shift);
    setIsDetailModalOpen(true);
  };

  const handleStaffClick = (staffId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent admin shift modal from opening
    setSelectedStaffId(staffId);
    setIsStaffModalOpen(true);
  };

  const handleAdminShiftUpdated = () => {
    refetch();
  };

  const _getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Reset to page 1 when search term or filters change
  useEffect(() => {
    setPage(1);
  }, [state.search, state.filters, setPage]);

  // Loading state
  if (isLoading && adminShifts.length === 0) {
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
          searchPlaceholder="Search admin shifts..."
          isLoading={true}
        />
        
        <SkeletonTable rows={8} columns={state.visibleColumns.length} />
        
        <div className="text-sm text-muted-foreground">
          Loading admin shifts...
        </div>
      </div>
    );
  }

  // Error state
  if (error && adminShifts.length === 0) {
    return (
      <div className="text-red-500 p-4">
        Failed to load admin shifts. Please try again.
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          className="ml-2"
        >
          Retry
        </Button>
      </div>
    );
  }

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
        searchPlaceholder="Search admin shifts..."
        isLoading={isFetching}
      />

      <div className="rounded-md border" ref={parentRef}>
          <Table>
            <TableHeader>
              <TableRow>
                {state.visibleColumns.includes('day') && <TableHead>Day</TableHead>}
                {state.visibleColumns.includes('time') && <TableHead>Time</TableHead>}
                {state.visibleColumns.includes('status') && <TableHead>Status</TableHead>}
                {state.visibleColumns.includes('staff') && <TableHead>Staff</TableHead>}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminShifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={state.visibleColumns.length + 1} className="text-center h-24">
                    {isLoading ? (
                      "Loading admin shifts..."
                    ) : state.search || Object.keys(state.filters).length > 0 ? (
                      "No admin shifts match your filters"
                    ) : (
                      "No admin shifts found"
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                adminShifts.map((shift, index) => {
                  return (
                    <TableRow
                      key={shift.id}
                      data-index={index}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleAdminShiftClick(shift)}
                    >
                      {state.visibleColumns.includes('day') && (
                        <TableCell>{getDayOfWeek(shift.day_of_week)}</TableCell>
                      )}
                      {state.visibleColumns.includes('time') && (
                        <TableCell>
                          {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                        </TableCell>
                      )}
                      {state.visibleColumns.includes('status') && (
                        <TableCell>
                          <Badge className={cn("text-xs", _getStatusBadgeColor(shift.status))}>
                            {shift.status}
                          </Badge>
                        </TableCell>
                      )}
                      {state.visibleColumns.includes('staff') && (
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getAdminShiftStaff(shift).length === 0 ? (
                              <span className="text-muted-foreground text-sm">No staff</span>
                            ) : (
                              getAdminShiftStaff(shift).map((staff, staffIndex) => (
                                <Button
                                  key={`${shift.id}-${staff.id}-${staffIndex}`}
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs justify-start"
                                  onClick={(e) => handleStaffClick(staff.id, e)}
                                >
                                  {staff.first_name} {staff.last_name}
                                </Button>
                              ))
                            )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <ActionsMenu
                          type="adminShift"
                          entityId={shift.id}
                          onOpenInPage={() => {
                            router.push(`/admin-shifts/${shift.id}`);
                          }}
                          onDelete={() => {
                            setAdminShiftToDelete(shift);
                            setDeleteConfirmText('');
                            setIsAdminShiftDeleteDialogOpen(true);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
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

      {/* Add Admin Shift Modal */}
      <AddAdminShiftModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAdminShiftAdded={() => {
          refetch();
        }}
      />

      {/* Admin Shift Detail Modal */}
      {selectedAdminShift && (
        <ViewAdminShiftModal 
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          adminShiftId={selectedAdminShift.id}
          onAdminShiftUpdated={handleAdminShiftUpdated}
        />
      )}
      
      {/* Staff Modal */}
      {selectedStaffId && (
        <ViewStaffModal
          staffId={selectedStaffId}
          isOpen={isStaffModalOpen}
          onClose={() => {
            setIsStaffModalOpen(false);
            setSelectedStaffId(null);
          }}
          onStaffUpdated={() => {
            // Refresh admin shift data to show updated staff information
            refetch();
          }}
        />
      )}

      {/* Delete admin shift confirmation dialog */}
      <AlertDialog open={isAdminShiftDeleteDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setAdminShiftToDelete(null);
          setDeleteConfirmText('');
        }
        setIsAdminShiftDeleteDialogOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the admin shift
              and all associated data from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label>
                Type <strong>DELETE</strong> to confirm deletion
              </Label>
              <Input
                type="text"
                placeholder="Type DELETE to confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!adminShiftToDelete) return;
                try {
                  await deleteAdminShiftMutation.mutateAsync(adminShiftToDelete.id);
                  refetch();
                  setAdminShiftToDelete(null);
                  setIsAdminShiftDeleteDialogOpen(false);
                  setDeleteConfirmText('');
                  toast({
                    title: 'Admin shift deleted',
                    description: 'Admin shift has been deleted successfully.',
                  });
                } catch {
                  toast({
                    title: 'Delete failed',
                    description: 'There was an error deleting the admin shift. Please try again.',
                    variant: 'destructive',
                  });
                }
              }}
              disabled={deleteAdminShiftMutation.isPending || deleteConfirmText !== 'DELETE'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteAdminShiftMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
