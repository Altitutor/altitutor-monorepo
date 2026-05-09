'use client';

import { useState, useEffect } from 'react';
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
} from '@altitutor/ui';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import { tutorTableBodyRow, tutorTableHeaderRow, tutorTableShell } from '@/shared/lib/tutor-visual';
import { blockoutsApi, type BlockoutRow, type CreateBlockoutInput, type UpdateBlockoutInput } from '../api/blockouts';

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
  // Handle day wraparound properly
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
        // Get days in previous month (simplified - assumes 31 days max)
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
        testDay = 31; // Simplified
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
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!editingBlockout && !isAddDialogOpen) setExpanded(false)
  }, [editingBlockout, isAddDialogOpen])
  
  // Form state - using date ranges instead of date + times
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

  const handleEdit = (blockout: BlockoutRow) => {
    setEditingBlockout(blockout);
    // Convert UTC timestamps to Adelaide date strings
    setStartDate(utcToAdelaideDate(blockout.start_at));
    setEndDate(utcToAdelaideDate(blockout.end_at));
    setReason(blockout.reason || '');
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
    if (endDate < startDate) {
      alert('End date must be on or after start date');
      return;
    }
    
    setSaving(true);
    try {
      const input: CreateBlockoutInput = {
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
    const today = new Date();
    const todayStr = utcToAdelaideDate(today.toISOString());
    setStartDate(todayStr);
    setEndDate(todayStr);
    setReason('');
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

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">My Blockout Dates</h2>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Blockout
        </Button>
      </div>

      <div className={tutorTableShell}>
        <Table>
          <TableHeader className="[&_tr]:border-b-0">
            <TableRow className={tutorTableHeaderRow}>
              <TableHead>Date Range</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blockouts.length === 0 ? (
              <TableRow className={tutorTableBodyRow}>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No blockouts found
                </TableCell>
              </TableRow>
            ) : (
              blockouts.map((blockout) => (
                <TableRow key={blockout.id} className={tutorTableBodyRow}>
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
        <DialogContent
          className={cn(
            EXPANDABLE_DIALOG_TRANSITION,
            expanded && EXPANDED_DIALOG_CONTENT_CLASS
          )}
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle>Edit Blockout</DialogTitle>
                <DialogDescription>
                  Update your blockout date range
                </DialogDescription>
              </div>
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent
          className={cn(
            EXPANDABLE_DIALOG_TRANSITION,
            expanded && EXPANDED_DIALOG_CONTENT_CLASS
          )}
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle>Add Blockout</DialogTitle>
                <DialogDescription>
                  Create a new blockout date range when you are unavailable
                </DialogDescription>
              </div>
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

