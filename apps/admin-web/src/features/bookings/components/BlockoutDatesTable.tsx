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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { blockoutsApi, type BlockoutRow, type CreateBlockoutInput, type UpdateBlockoutInput } from '../api/blockouts';
import { staffApi } from '@/features/staff/api/staff';
import type { Tables } from '@altitutor/shared';
import { formatDateTime } from '@/shared/utils';

interface BlockoutDatesTableProps {
  blockouts: BlockoutRow[];
  onUpdate: () => void;
}

export function BlockoutDatesTable({ blockouts, onUpdate }: BlockoutDatesTableProps) {
  const [editingBlockout, setEditingBlockout] = useState<BlockoutRow | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [staffList, setStaffList] = useState<Tables<'staff'>[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  
  // Form state
  const [staffId, setStaffId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Load staff list
  useEffect(() => {
    const loadStaff = async () => {
      setLoadingStaff(true);
      try {
        const staff = await staffApi.getAll();
        setStaffList(staff);
      } catch (error) {
        console.error('Failed to load staff:', error);
      } finally {
        setLoadingStaff(false);
      }
    };
    loadStaff();
  }, []);

  const handleEdit = (blockout: BlockoutRow) => {
    setEditingBlockout(blockout);
    setStaffId(blockout.staff_id);
    const startDate = new Date(blockout.start_at);
    const endDate = new Date(blockout.end_at);
    setDate(startDate.toISOString().split('T')[0]);
    setStartTime(startDate.toTimeString().slice(0, 5));
    setEndTime(endDate.toTimeString().slice(0, 5));
    setReason(blockout.reason || '');
  };

  const buildDateTime = (dateStr: string, timeStr: string): string => {
    // Combine date and time, interpret as Adelaide local time, convert to UTC
    // Format: "2024-01-15T09:00:00"
    const isoString = `${dateStr}T${timeStr}:00`;
    
    // Create date assuming Adelaide timezone (UTC+10:30 standard, UTC+9:30 DST)
    // Use fixed offset for now - TODO: Use proper timezone library (date-fns-tz) for DST handling
    // Adelaide standard time: UTC+10:30
    const adelaideOffsetMinutes = 10 * 60 + 30; // 10 hours 30 minutes
    const localDate = new Date(isoString);
    // Subtract offset to get UTC
    const utcDate = new Date(localDate.getTime() - (adelaideOffsetMinutes * 60 * 1000));
    
    return utcDate.toISOString();
  };

  const handleSave = async () => {
    if (!editingBlockout) return;
    setSaving(true);
    try {
      const updates: UpdateBlockoutInput = {
        start_at: buildDateTime(date, startTime),
        end_at: buildDateTime(date, endTime),
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
    setSaving(true);
    try {
      const input: CreateBlockoutInput = {
        staff_id: staffId,
        start_at: buildDateTime(date, startTime),
        end_at: buildDateTime(date, endTime),
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
    setDate(new Date().toISOString().split('T')[0]);
    setStartTime('09:00');
    setEndTime('17:00');
    setReason('');
  };

  const getStaffName = (staffId: string) => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return 'Unknown';
    return `${staff.first_name} ${staff.last_name}`;
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
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blockouts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No blockouts found
                </TableCell>
              </TableRow>
            ) : (
              blockouts.map((blockout) => (
                <TableRow key={blockout.id}>
                  <TableCell className="font-medium">
                    {getStaffName(blockout.staff_id)}
                  </TableCell>
                  <TableCell>{formatDateTime(blockout.start_at)}</TableCell>
                  <TableCell>{formatDateTime(blockout.end_at)}</TableCell>
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
              Update blockout date and time
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-staff">Staff</Label>
              <Select value={staffId} onValueChange={setStaffId} disabled>
                <SelectTrigger id="edit-staff">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.first_name} {staff.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start-time">Start Time</Label>
                <Input
                  id="edit-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-end-time">End Time</Label>
                <Input
                  id="edit-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Blockout</DialogTitle>
            <DialogDescription>
              Create a new blockout date for a staff member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-staff">Staff *</Label>
              <Select value={staffId} onValueChange={setStaffId} disabled={loadingStaff}>
                <SelectTrigger id="add-staff">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.first_name} {staff.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-date">Date</Label>
              <Input
                id="add-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-start-time">Start Time</Label>
                <Input
                  id="add-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-end-time">End Time</Label>
                <Input
                  id="add-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
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

