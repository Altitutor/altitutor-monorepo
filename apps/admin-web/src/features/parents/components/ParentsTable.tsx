'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { Search, ArrowUpDown, Loader2 } from 'lucide-react';
import type { Tables, DataTableFilterDefinition, DataTableSortOption, DataTableColumnDefinition } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { useParentsList, useDeleteParent } from '../hooks/useParentsQuery';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';

interface ParentsTableProps {
  onRefresh?: number;
}

export function ParentsTable({ onRefresh: _onRefresh }: ParentsTableProps = {}) {
  const router = useRouter();
  const { data: currentStaff } = useCurrentStaff();
  const { data: quickFilters = [] } = useQuickFilters('parents');
  
  const defaultFilters = useMemo(() => ({}), []);
  const defaultSort = useMemo(() => ({ field: 'last_name', direction: 'asc' as const }), []);
  const defaultVisibleColumns = useMemo(() => ['first_name', 'last_name', 'students'], []);

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
    filterKeys: [],
  });

  const { 
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useParentsList({
    search: state.search,
    page: state.page,
    pageSize: state.pageSize,
    orderBy: state.sortBy as keyof Tables<'parents'> || 'last_name',
    ascending: state.sortDirection === 'asc',
  });

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => [], []);

  const sortOptions: DataTableSortOption[] = [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'created_at', label: 'Created At' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'students', label: 'Students' },
  ];

  const parents = data?.parents || [];
  const total = data?.total || 0;

  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Delete dialog state
  const [parentToDelete, setParentToDelete] = useState<(typeof parents)[0] | null>(null);
  const [isParentDeleteDialogOpen, setIsParentDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const deleteParentMutation = useDeleteParent();
  const { toast } = useToast();

  // Refetch when onRefresh prop changes
  useEffect(() => {
    if (_onRefresh) {
      refetch();
    }
  }, [_onRefresh, refetch]);

  // Sync state from URL params on mount and when URL changes
  useEffect(() => {
    setPage(1);
  }, [state.search, state.filters, setPage]);

  const handleParentClick = (id: string) => {
    setSelectedParentId(id);
    setIsViewModalOpen(true);
  };

  const handleParentUpdated = () => {
    refetch();
  };

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedParentId(null);
  };

  // Loading state
  if (isLoading && parents.length === 0) {
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
          searchPlaceholder="Search parents..."
          isLoading={true}
        />
        
        <SkeletonTable rows={8} columns={state.visibleColumns.length} />
        
        <div className="text-sm text-muted-foreground">
          Loading parents...
        </div>
      </div>
    );
  }

  // Error state
  if (error && parents.length === 0) {
    return (
      <div className="text-red-500 p-4">
        Failed to load parents. Please try again.
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
        searchPlaceholder="Search parents..."
        isLoading={isFetching}
      />

      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              {state.visibleColumns.includes('first_name') && (
                <TableHead className="cursor-pointer" onClick={() => setSort('first_name', state.sortBy === 'first_name' && state.sortDirection === 'asc' ? 'desc' : 'asc')}>
                  First Name
                  <ArrowUpDown className={cn(
                    "ml-2 h-4 w-4 inline",
                    state.sortBy === 'first_name' ? "opacity-100" : "opacity-40"
                  )} />
                </TableHead>
              )}
              {state.visibleColumns.includes('last_name') && (
                <TableHead className="cursor-pointer" onClick={() => setSort('last_name', state.sortBy === 'last_name' && state.sortDirection === 'asc' ? 'desc' : 'asc')}>
                  Last Name
                  <ArrowUpDown className={cn(
                    "ml-2 h-4 w-4 inline",
                    state.sortBy === 'last_name' ? "opacity-100" : "opacity-40"
                  )} />
                </TableHead>
              )}
              {state.visibleColumns.includes('students') && <TableHead>Students</TableHead>}
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={state.visibleColumns.length + 1} className="text-center h-24">
                  {isLoading ? (
                    "Loading parents..."
                  ) : state.search ? (
                    "No parents match your search"
                  ) : (
                    "No parents found"
                  )}
                </TableCell>
              </TableRow>
            ) : (
              parents.map((parent) => {
                const students = (parent as any).students || [];
                return (
                  <TableRow
                    key={parent.id}
                    className="cursor-pointer"
                    onClick={() => handleParentClick(parent.id)}
                  >
                    {state.visibleColumns.includes('first_name') && (
                      <TableCell className="font-medium">
                        {parent.first_name || '-'}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('last_name') && (
                      <TableCell className="font-medium">
                        {parent.last_name || '-'}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('students') && (
                      <TableCell>
                        {students.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {students.map((student: Tables<'students'>) => (
                              <Button
                                key={student.id}
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs justify-start"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/students?view=${student.id}`);
                                }}
                              >
                                {student.first_name} {student.last_name}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No students</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ActionsMenu
                        type="parent"
                        entityId={parent.id}
                        copyTagDisplayText={`${parent.first_name || ''} ${parent.last_name || ''}`.trim()}
                        onOpenInPage={() => {
                          router.push(`/parents/${parent.id}`);
                        }}
                        onDelete={() => {
                          setParentToDelete(parent);
                          setDeleteConfirmText('');
                          setIsParentDeleteDialogOpen(true);
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

      {/* View/Edit Parent Modal */}
      <ViewParentModal 
        isOpen={isViewModalOpen}
        onClose={handleCloseViewModal}
        parentId={selectedParentId}
        onParentUpdated={handleParentUpdated}
      />

      {/* Delete parent confirmation dialog */}
      <AlertDialog open={isParentDeleteDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setParentToDelete(null);
          setDeleteConfirmText('');
        }
        setIsParentDeleteDialogOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the parent
              {parentToDelete ? ` ${parentToDelete.first_name} ${parentToDelete.last_name}` : ''} and all associated data from the database.
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
                if (!parentToDelete) return;
                try {
                  await deleteParentMutation.mutateAsync(parentToDelete.id);
                  refetch();
                  setParentToDelete(null);
                  setIsParentDeleteDialogOpen(false);
                  setDeleteConfirmText('');
                  toast({
                    title: 'Parent deleted',
                    description: 'Parent has been deleted successfully.',
                  });
                } catch {
                  toast({
                    title: 'Delete failed',
                    description: 'There was an error deleting the parent. Please try again.',
                    variant: 'destructive',
                  });
                }
              }}
              disabled={deleteParentMutation.isPending || deleteConfirmText !== 'DELETE'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteParentMutation.isPending ? (
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
