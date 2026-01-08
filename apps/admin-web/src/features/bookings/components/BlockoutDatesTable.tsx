'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
} from '@altitutor/ui';
import { Edit2, Plus, Trash2, Check, Loader2, Search } from 'lucide-react';
import { blockoutsApi, type BlockoutRow, type CreateBlockoutInput, type UpdateBlockoutInput } from '../api/blockouts';
import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

interface BlockoutDatesTableProps {
  blockouts: BlockoutRow[];
  onUpdate: () => void;
}

const ADELAIDE_TIMEZONE = 'Australia/Adelaide';

/**
 * Convert a date string (YYYY-MM-DD) to midnight Adelaide time in UTC ISO string
 * Properly handles DST using Intl API
 */
function dateToAdelaideMidnightUTC(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  
  const adelaideFormatter = new Intl.DateTimeFormat('en', {
    timeZone: ADELAIDE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  // Search for UTC time that gives us midnight in Adelaide
  // Try UTC times from 13 hours before to 11 hours after midnight UTC
  // (Adelaide is typically UTC+9:30 to UTC+10:30)
  for (let hourOffset = -13; hourOffset <= 11; hourOffset++) {
    let testYear = year;
    let testMonth = month;
    let testDay = day;
    let testHour = hourOffset;
    
    // Handle negative hours (previous day)
    if (testHour < 0) {
      testHour += 24;
      testDay -= 1;
      if (testDay < 1) {
        testMonth -= 1;
        if (testMonth < 1) {
          testMonth = 12;
          testYear -= 1;
        }
        testDay = 31;
      }
    }
    
    const testUtc = new Date(Date.UTC(testYear, testMonth - 1, testDay, testHour, 0, 0, 0));
    const testAdelaide = adelaideFormatter.formatToParts(testUtc);
    const testAdelaideHour = parseInt(testAdelaide.find(p => p.type === 'hour')?.value || '0', 10);
    const testAdelaideMinute = parseInt(testAdelaide.find(p => p.type === 'minute')?.value || '0', 10);
    const testAdelaideDay = parseInt(testAdelaide.find(p => p.type === 'day')?.value || '0', 10);
    const testAdelaideMonth = parseInt(testAdelaide.find(p => p.type === 'month')?.value || '0', 10);
    const testAdelaideYear = parseInt(testAdelaide.find(p => p.type === 'year')?.value || '0', 10);
    
    if (
      testAdelaideHour === 0 &&
      testAdelaideMinute === 0 &&
      testAdelaideDay === day &&
      testAdelaideMonth === month &&
      testAdelaideYear === year
    ) {
      return testUtc.toISOString();
    }
  }
  
  // Fallback: approximate (shouldn't happen)
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toISOString();
}

/**
 * Convert a date string (YYYY-MM-DD) to end of day (23:59:59.999) Adelaide time in UTC ISO string
 */
function dateToAdelaideEndOfDayUTC(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  
  const adelaideFormatter = new Intl.DateTimeFormat('en', {
    timeZone: ADELAIDE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  // Search for UTC time that gives us 23:59:59 in Adelaide
  for (let hourOffset = -13; hourOffset <= 11; hourOffset++) {
    let testYear = year;
    let testMonth = month;
    let testDay = day;
    let testHour = hourOffset;
    
    // Handle negative hours (previous day)
    if (testHour < 0) {
      testHour += 24;
      testDay -= 1;
      if (testDay < 1) {
        testMonth -= 1;
        if (testMonth < 1) {
          testMonth = 12;
          testYear -= 1;
        }
        testDay = 31;
      }
    }
    
    const testUtc = new Date(Date.UTC(testYear, testMonth - 1, testDay, testHour, 59, 59, 999));
    const testAdelaide = adelaideFormatter.formatToParts(testUtc);
    const testAdelaideHour = parseInt(testAdelaide.find(p => p.type === 'hour')?.value || '0', 10);
    const testAdelaideMinute = parseInt(testAdelaide.find(p => p.type === 'minute')?.value || '0', 10);
    const testAdelaideSecond = parseInt(testAdelaide.find(p => p.type === 'second')?.value || '0', 10);
    const testAdelaideDay = parseInt(testAdelaide.find(p => p.type === 'day')?.value || '0', 10);
    const testAdelaideMonth = parseInt(testAdelaide.find(p => p.type === 'month')?.value || '0', 10);
    const testAdelaideYear = parseInt(testAdelaide.find(p => p.type === 'year')?.value || '0', 10);
    
    if (
      testAdelaideHour === 23 &&
      testAdelaideMinute === 59 &&
      testAdelaideSecond === 59 &&
      testAdelaideDay === day &&
      testAdelaideMonth === month &&
      testAdelaideYear === year
    ) {
      return testUtc.toISOString();
    }
  }
  
  // Fallback: approximate
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)).toISOString();
}

/**
 * Convert UTC ISO string to Adelaide date string (YYYY-MM-DD)
 */
function utcToAdelaideDate(utcString: string): string {
  const date = new Date(utcString);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ADELAIDE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

export function BlockoutDatesTable({ blockouts, onUpdate }: BlockoutDatesTableProps) {
  const [editingBlockout, setEditingBlockout] = useState<BlockoutRow | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // Form state - using date ranges instead of date + times
  const [staffId, setStaffId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    return utcToAdelaideDate(today.toISOString());
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date();
    return utcToAdelaideDate(today.toISOString());
  });
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Staff search state
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [isStaffPopoverOpen, setIsStaffPopoverOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Tables<'staff'> | null>(null);

  // Search staff using RPC
  const { data: staffSearchResults, isLoading: loadingStaff } = useQuery({
    queryKey: ['staff', 'search', 'blockouts', staffSearchQuery.trim()],
    queryFn: async () => {
      const trimmed = staffSearchQuery.trim();
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_staff_admin', {
        p_search: trimmed.length > 0 ? trimmed : undefined,
        p_statuses: ['ACTIVE'],
        p_include_relationships: false,
        p_limit: 100,
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return { staff: [], total: 0 };

      const rpcData = rpcResult as { staff: any[]; total: number };
      const staff = (rpcData.staff || []).map((s: any) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        role: s.role,
        status: s.status,
        email: s.email,
        phone_number: s.phone_number,
        created_at: s.created_at || null,
        updated_at: s.updated_at || null,
      })) as Tables<'staff'>[];
      
      return {
        staff,
        total: rpcData.total || 0,
      };
    },
    enabled: isStaffPopoverOpen || staffSearchQuery.trim().length > 0,
    staleTime: 1000 * 30,
  });

  const staffList = staffSearchResults?.staff || [];

  // Sync selectedStaff when staffId changes - only clear when staffId becomes null
  useEffect(() => {
    if (!staffId) {
      setSelectedStaff(null);
      return;
    }
    // Don't try to set it here - handleEdit already sets it, and handleStaffSelect sets it
    // This effect is just for clearing when staffId becomes null
  }, [staffId]);

  const handleEdit = (blockout: BlockoutRow) => {
    setEditingBlockout(blockout);
    setStaffId(blockout.staff_id);
    // Convert UTC timestamps to Adelaide date strings
    setStartDate(utcToAdelaideDate(blockout.start_at));
    setEndDate(utcToAdelaideDate(blockout.end_at));
    setReason(blockout.reason || '');
    
    // Don't set selectedStaff here - we only have partial staff data from the blockout
    // The staff_id is already set, which is sufficient for the form
    setSelectedStaff(null);
  };

  const handleSave = async () => {
    if (!editingBlockout) return;
    
    if (endDate < startDate) {
      alert('End date must be on or after start date');
      return;
    }
    
    setSaving(true);
    try {
      const updates: UpdateBlockoutInput = {
        start_at: dateToAdelaideMidnightUTC(startDate),
        end_at: dateToAdelaideEndOfDayUTC(endDate),
        reason: reason || undefined,
      };
      await blockoutsApi.updateBlockout(editingBlockout.id, updates);
      setEditingBlockout(null);
      resetForm();
      onUpdate();
    } catch (e) {
      alert('Failed to update: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!staffId) {
      alert('Please select a staff member');
      return;
    }
    
    if (endDate < startDate) {
      alert('End date must be on or after start date');
      return;
    }
    
    setSaving(true);
    try {
      const input: CreateBlockoutInput = {
        staff_id: staffId,
        start_at: dateToAdelaideMidnightUTC(startDate),
        end_at: dateToAdelaideEndOfDayUTC(endDate),
        reason: reason || undefined,
      };
      await blockoutsApi.createBlockout(input);
      setIsAddDialogOpen(false);
      resetForm();
      onUpdate();
    } catch (e) {
      alert('Failed to create: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this blockout?')) return;
    setDeleting(id);
    try {
      await blockoutsApi.deleteBlockout(id);
      onUpdate();
    } catch (e) {
      alert('Failed to delete: ' + (e as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  const resetForm = () => {
    setStaffId('');
    setSelectedStaff(null);
    const today = new Date();
    const todayStr = utcToAdelaideDate(today.toISOString());
    setStartDate(todayStr);
    setEndDate(todayStr);
    setReason('');
    setStaffSearchQuery('');
  };

  const getStaffName = (staffId: string) => {
    // Try to find in current search results
    const staff = staffList.find(s => s.id === staffId);
    if (staff) return `${staff.first_name} ${staff.last_name}`;
    
    // Try to find in blockouts (they have staff relation)
    const blockout = blockouts.find(b => b.staff_id === staffId);
    if (blockout && 'staff' in blockout && blockout.staff) {
      const staffData = blockout.staff as { first_name: string; last_name: string };
      return `${staffData.first_name} ${staffData.last_name}`;
    }
    
    return 'Unknown';
  };

  // Format date range for display (convert UTC to Adelaide, show dates only)
  const formatDateRange = (startUtc: string, endUtc: string): string => {
    const startDate = new Date(startUtc);
    const endDate = new Date(endUtc);
    
    const startFormatted = startDate.toLocaleDateString('en-AU', {
      timeZone: ADELAIDE_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    
    const endFormatted = endDate.toLocaleDateString('en-AU', {
      timeZone: ADELAIDE_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    
    // Check if it's a single day
    const startDateOnly = startDate.toLocaleDateString('en-CA', { timeZone: ADELAIDE_TIMEZONE });
    const endDateOnly = endDate.toLocaleDateString('en-CA', { timeZone: ADELAIDE_TIMEZONE });
    
    if (startDateOnly === endDateOnly) {
      return startFormatted;
    }
    
    return `${startFormatted} - ${endFormatted}`;
  };

  const handleStaffSelect = (staff: Tables<'staff'>) => {
    setStaffId(staff.id);
    setSelectedStaff(staff);
    setIsStaffPopoverOpen(false);
    setStaffSearchQuery('');
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Blockout Dates</h2>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Blockout
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Date Range</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blockouts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No blockouts found
                </TableCell>
              </TableRow>
            ) : (
              blockouts.map((blockout) => (
                <TableRow key={blockout.id}>
                  <TableCell className="font-medium">
                    {getStaffName(blockout.staff_id)}
                  </TableCell>
                  <TableCell>{formatDateRange(blockout.start_at, blockout.end_at)}</TableCell>
                  <TableCell>{blockout.reason || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(blockout)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(blockout.id)}
                        disabled={deleting === blockout.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingBlockout} onOpenChange={() => setEditingBlockout(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Blockout</DialogTitle>
            <DialogDescription>
              Update blockout date range
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-staff">Staff</Label>
              <Input
                id="edit-staff"
                value={selectedStaff ? `${selectedStaff.first_name} ${selectedStaff.last_name}` : 'Unknown'}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start-date">Start Date</Label>
                <Input
                  id="edit-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-end-date">End Date</Label>
                <Input
                  id="edit-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-reason">Reason (Optional)</Label>
              <Input
                id="edit-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Holiday, Sick leave"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBlockout(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open);
        if (!open) {
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Blockout</DialogTitle>
            <DialogDescription>
              Create a new blockout date range for a staff member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-staff">Staff *</Label>
              <Popover open={isStaffPopoverOpen} onOpenChange={setIsStaffPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="add-staff"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setIsStaffPopoverOpen(true)}
                  >
                    {selectedStaff ? `${selectedStaff.first_name} ${selectedStaff.last_name}` : 'Select staff member'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[400px]" align="start">
                  <div className="p-3">
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search staff by name..."
                        value={staffSearchQuery}
                        onChange={(e) => setStaffSearchQuery(e.target.value)}
                        className="pl-10"
                        autoFocus
                      />
                    </div>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-1 pr-4">
                        {loadingStaff ? (
                          <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Searching...
                          </div>
                        ) : staffList.length === 0 ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            {staffSearchQuery.trim()
                              ? 'No staff found'
                              : 'Start typing to search for staff'}
                          </div>
                        ) : (
                          staffList.map((staff) => (
                            <Button
                              key={staff.id}
                              variant="ghost"
                              className="w-full justify-start h-auto p-3"
                              onClick={() => handleStaffSelect(staff)}
                            >
                              <div className="flex items-center gap-2 w-full">
                                {selectedStaff?.id === staff.id && <Check className="h-4 w-4" />}
                                <div className="flex flex-col items-start flex-1">
                                  <div className={selectedStaff?.id === staff.id ? 'font-medium' : ''}>
                                    {staff.first_name} {staff.last_name}
                                  </div>
                                  {staff.email && (
                                    <div className="text-xs text-muted-foreground">
                                      {staff.email}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Button>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-start-date">Start Date</Label>
                <Input
                  id="add-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-end-date">End Date</Label>
                <Input
                  id="add-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-reason">Reason (Optional)</Label>
              <Input
                id="add-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Holiday, Sick leave"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddDialogOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving || !staffId}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

