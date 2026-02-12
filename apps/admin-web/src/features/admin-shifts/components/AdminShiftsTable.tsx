'use client';

import React, { useState, Dispatch, SetStateAction, useEffect, useRef } from 'react';
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
import { Badge } from "@altitutor/ui";
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
import { Search, Loader2 } from 'lucide-react';
import { TablePagination } from '@/shared/components/TablePagination';
import { useAdminShiftsMinimalPaginated, useDeleteAdminShift } from '../hooks/useAdminShiftsQuery';
import type { Tables } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';
import { AddAdminShiftModal } from './AddAdminShiftModal';
import { ViewAdminShiftModal } from './modal';
import { ViewStaffModal } from '@/features/staff';
import { formatTime, getDayOfWeek } from '@/shared/utils/datetime';
import { ActionsMenu } from '@/shared/components/ActionsMenu';

interface AdminShiftsTableProps {
  addModalState?: [boolean, Dispatch<SetStateAction<boolean>>];
  viewMode?: 'table';
}

export function AdminShiftsTable({ addModalState }: AdminShiftsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize from URL params
  const getSearchFromUrl = () => searchParams.get('search') || '';
  const getNumberArrayFromUrl = (key: string): number[] => {
    const param = searchParams.get(key);
    return param ? param.split(',').map(Number).filter(n => !isNaN(n)) : [];
  };
  
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`/admin-shifts?${params.toString()}`);
  };
  
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('pageSize')) || 50);
  
  const [searchTerm, setSearchTerm] = useState(getSearchFromUrl);
  const [dayFilter, setDayFilter] = useState<number[]>(getNumberArrayFromUrl('day'));
  
  // Sync from URL params
  useEffect(() => {
    setSearchTerm(getSearchFromUrl());
    setDayFilter(getNumberArrayFromUrl('day'));
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
  } = useAdminShiftsMinimalPaginated({
    search: searchTerm,
    daysOfWeek: dayFilter,
    page,
    pageSize,
    orderBy: 'day_of_week',
    ascending: true,
  });

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

  // Day filter toggle function
  const toggleDay = (day: number) => {
    setDayFilter(prev => {
      if (prev.includes(day)) {
        const next = prev.filter(d => d !== day);
        setPage(1);
        updateUrlParams({ 
          day: next.length > 0 ? next.join(',') : null,
          page: null 
        });
        return next;
      } else {
        const next = [...prev, day];
        setPage(1);
        updateUrlParams({ 
          day: next.join(','),
          page: null 
        });
        return next;
      }
    });
  };

  const clearDayFilter = () => {
    setDayFilter([]);
    setPage(1);
    updateUrlParams({ 
      day: null,
      page: null 
    });
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
  }, [searchTerm, dayFilter]);

  // Loading state
  if (isLoading && adminShifts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search admin shifts"
              className="pl-8"
              value={""}
              disabled
            />
          </div>
          
          <div className="flex items-center gap-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <Button key={day} variant="outline" size="sm" disabled>
                {day}
              </Button>
            ))}
          </div>
        </div>
        
        <SkeletonTable rows={8} columns={4} />
        
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
      {/* Search and filters with dynamic wrapping */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search admin shifts"
            className="pl-8"
            value={searchTerm || ''}
            onChange={(e) => {
              const value = e.target.value;
              setSearchTerm(value);
              setPage(1);
              updateUrlParams({ 
                search: value || null,
                page: null 
              });
            }}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-1">
          <Button 
            variant={dayFilter.includes(1) ? 'default' : 'outline'} 
            size="sm"
            onClick={() => toggleDay(1)}
          >
            Mon
          </Button>
          <Button 
            variant={dayFilter.includes(2) ? 'default' : 'outline'} 
            size="sm"
            onClick={() => toggleDay(2)}
          >
            Tue
          </Button>
          <Button 
            variant={dayFilter.includes(3) ? 'default' : 'outline'} 
            size="sm"
            onClick={() => toggleDay(3)}
          >
            Wed
          </Button>
          <Button 
            variant={dayFilter.includes(4) ? 'default' : 'outline'} 
            size="sm"
            onClick={() => toggleDay(4)}
          >
            Thu
          </Button>
          <Button 
            variant={dayFilter.includes(5) ? 'default' : 'outline'} 
            size="sm"
            onClick={() => toggleDay(5)}
          >
            Fri
          </Button>
          <Button 
            variant={dayFilter.includes(6) ? 'default' : 'outline'} 
            size="sm"
            onClick={() => toggleDay(6)}
          >
            Sat
          </Button>
          <Button 
            variant={dayFilter.includes(0) ? 'default' : 'outline'} 
            size="sm"
            onClick={() => toggleDay(0)}
          >
            Sun
          </Button>
          {dayFilter.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={clearDayFilter}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border" ref={parentRef}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminShifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    {isLoading ? (
                      "Loading admin shifts..."
                    ) : searchTerm || dayFilter.length > 0 ? (
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
                      <TableCell>{getDayOfWeek(shift.day_of_week)}</TableCell>
                      <TableCell>
                        {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs", _getStatusBadgeColor(shift.status))}>
                          {shift.status}
                        </Badge>
                      </TableCell>
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <ActionsMenu
                          type="adminShift"
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
