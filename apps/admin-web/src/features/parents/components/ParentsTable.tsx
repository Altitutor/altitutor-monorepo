'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import { SkeletonTable } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { Search, ArrowUpDown, Loader2 } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { TablePagination } from '@/shared/components/TablePagination';
import { useParentsList, useDeleteParent } from '../hooks/useParentsQuery';
import { ActionsMenu } from '@/shared/components/ActionsMenu';

interface ParentsTableProps {
  onRefresh?: number;
}

export function ParentsTable({ onRefresh: _onRefresh }: ParentsTableProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize state from URL params
  const getSearchFromUrl = () => searchParams.get('search') || '';
  const getSortFromUrl = (): { field: keyof Tables<'parents'>; direction: 'asc' | 'desc' } => {
    const field = (searchParams.get('sort') || 'last_name') as keyof Tables<'parents'>;
    const direction = (searchParams.get('order') || 'asc') as 'asc' | 'desc';
    return { field, direction };
  };
  
  // Local UI state initialized from URL
  const [searchTerm, setSearchTerm] = useState(getSearchFromUrl);
  const sortFromUrl = getSortFromUrl();
  const [sortField, setSortField] = useState<keyof Tables<'parents'>>(sortFromUrl.field);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(sortFromUrl.direction);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('pageSize')) || 50);
  
  // Sync URL params when state changes
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`/parents?${params.toString()}`);
  };

  const { 
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useParentsList({
    search: searchTerm,
    page,
    pageSize,
    orderBy: sortField,
    ascending: sortDirection === 'asc',
  });

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
    setSearchTerm(getSearchFromUrl());
    const sort = getSortFromUrl();
    setSortField(sort.field);
    setSortDirection(sort.direction);
    const pageParam = Number(searchParams.get('page'));
    if (pageParam) setPage(pageParam);
    const pageSizeParam = Number(searchParams.get('pageSize'));
    if (pageSizeParam) setPageSize(pageSizeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSort = (field: keyof Tables<'parents'>) => {
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
  };
  
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
    router.push('/parents');
  };

  // Loading state
  if (isLoading && parents.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search parents..."
              className="pl-8"
              value=""
              disabled
            />
          </div>
        </div>
        
        <SkeletonTable rows={8} columns={4} />
        
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
      {/* Search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search parents..."
            className="pl-8"
            value={searchTerm || ''}
            onChange={(e) => {
              const value = e.target.value;
              setSearchTerm(value);
              updateUrlParams({ search: value || null, page: null });
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => handleSort('first_name')}>
                First Name
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'first_name' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('last_name')}>
                Last Name
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'last_name' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead>Students</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  {isLoading ? (
                    "Loading parents..."
                  ) : searchTerm ? (
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
                    <TableCell className="font-medium">
                      {parent.first_name || '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {parent.last_name || '-'}
                    </TableCell>
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ActionsMenu
                        type="parent"
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
        page={page}
        pageSize={pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={(newPage) => {
          setPage(newPage);
          updateUrlParams({ page: newPage === 1 ? null : String(newPage) });
        }}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
          updateUrlParams({ 
            pageSize: newSize === 50 ? null : String(newSize),
            page: null 
          });
        }}
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

