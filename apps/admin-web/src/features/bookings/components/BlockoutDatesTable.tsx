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
import { Edit2, Trash2 } from 'lucide-react';
import type { BlockoutRow } from '../api/blockouts';
import { useBlockoutForm } from '../hooks/useBlockoutForm';
import { formatDateRange } from '../utils/dateTimeHelpers';
import { getStaffNameFromBlockout } from '../utils/blockoutHelpers';
import type { Tables } from '@altitutor/shared';
import { StaffSelectorPopover } from './StaffSelectorPopover';

interface BlockoutDatesTableProps {
  blockouts: BlockoutRow[];
  onUpdate: () => void;
  onCreateTrigger?: number;
}

export function BlockoutDatesTable({ blockouts, onUpdate, onCreateTrigger }: BlockoutDatesTableProps) {
  const [editingBlockout, setEditingBlockout] = useState<BlockoutRow | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Tables<'staff'> | null>(null);

  const {
    staffId,
    startDate,
    endDate,
    reason,
    saving,
    deleting,
    setStaffId,
    setStartDate,
    setEndDate,
    setReason,
    resetForm,
    loadBlockout,
    createBlockout,
    updateBlockout,
    deleteBlockout,
  } = useBlockoutForm({
    onSuccess: () => {
      setEditingBlockout(null);
      setIsAddDialogOpen(false);
      setSelectedStaff(null);
      resetForm();
      onUpdate();
    },
  });

  const handleEdit = (blockout: BlockoutRow) => {
    setEditingBlockout(blockout);
    loadBlockout(blockout);
    setSelectedStaff(null); // Will be populated from search if needed
  };

  const handleSave = async () => {
    if (!editingBlockout) return;
    await updateBlockout(editingBlockout.id);
  };

  const handleAdd = async () => {
    await createBlockout();
  };

  const handleDelete = async (id: string) => {
    await deleteBlockout(id);
  };

  const handleStaffSelect = (staff: Tables<'staff'>) => {
    setStaffId(staff.id);
    setSelectedStaff(staff);
  };

  const handleCloseEdit = () => {
    setEditingBlockout(null);
    setSelectedStaff(null);
    resetForm();
  };

  const handleCloseAdd = () => {
    setIsAddDialogOpen(false);
    setSelectedStaff(null);
    resetForm();
  };

  // Trigger add dialog when onCreateTrigger changes
  useEffect(() => {
    if (onCreateTrigger && onCreateTrigger > 0) {
      // Use setTimeout to avoid state update during render
      setTimeout(() => {
        setIsAddDialogOpen(true);
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCreateTrigger]);

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
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
                    {getStaffNameFromBlockout(blockout, blockout.staff_id)}
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
      {editingBlockout && (
        <Dialog open={!!editingBlockout} onOpenChange={(open) => !open && handleCloseEdit()}>
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
                  value={selectedStaff 
                    ? `${selectedStaff.first_name} ${selectedStaff.last_name}` 
                    : getStaffNameFromBlockout(editingBlockout, editingBlockout.staff_id)}
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
            <Button variant="outline" onClick={handleCloseEdit}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => !open && handleCloseAdd()}>
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
              <StaffSelectorPopover
                selectedStaff={selectedStaff}
                onSelectStaff={handleStaffSelect}
                disabled={saving}
              />
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
            <Button variant="outline" onClick={handleCloseAdd}>
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
