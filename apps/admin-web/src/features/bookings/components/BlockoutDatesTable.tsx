'use client';

import { useState, useEffect } from 'react';
import {
  Input,
  Button,
  Label,
} from '@altitutor/ui';
import type { BlockoutRow } from '../api/blockouts';
import { useBlockoutForm } from '../hooks/useBlockoutForm';
import { formatDateRange } from '../utils/dateTimeHelpers';
import { getStaffNameFromBlockout } from '../utils/blockoutHelpers';
import type { Tables } from '@altitutor/shared';
import { StaffSelectorPopover } from './StaffSelectorPopover';
import {
  AdminDialogShell,
  SettingsDataTable,
  type SettingsDataTableColumn,
} from '@/shared/components';

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

  const columns: SettingsDataTableColumn<BlockoutRow>[] = [
    {
      key: 'staff',
      label: 'Staff',
      render: (blockout) => (
        <span className="font-medium">{getStaffNameFromBlockout(blockout, blockout.staff_id)}</span>
      ),
      sortValue: (blockout) => getStaffNameFromBlockout(blockout, blockout.staff_id),
      searchValue: (blockout) => getStaffNameFromBlockout(blockout, blockout.staff_id),
    },
    {
      key: 'date_range',
      label: 'Date Range',
      render: (blockout) => formatDateRange(blockout.start_at, blockout.end_at),
      sortValue: (blockout) => blockout.start_at,
      searchValue: (blockout) => formatDateRange(blockout.start_at, blockout.end_at),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (blockout) => blockout.reason || '-',
      sortValue: (blockout) => blockout.reason || '',
      searchValue: (blockout) => blockout.reason || '',
    },
  ];

  return (
    <>
      <SettingsDataTable
        data={blockouts}
        columns={columns}
        getRowId={(blockout) => blockout.id}
        emptyMessage="No blockouts found"
        searchPlaceholder="Search blockouts..."
        filterKeys={[]}
        defaultSort={{ field: 'date_range', direction: 'asc' }}
        getActions={(blockout) => [
          {
            id: 'edit',
            label: 'Edit',
            onSelect: () => handleEdit(blockout),
          },
          {
            id: 'delete',
            label: 'Delete',
            disabled: deleting === blockout.id,
            onSelect: () => handleDelete(blockout.id),
          },
        ]}
      />

      {editingBlockout && (
        <AdminDialogShell
          open={!!editingBlockout}
          onClose={handleCloseEdit}
          title="Edit Blockout"
          subtitle="Update blockout date range"
          footer={(
            <>
              <Button variant="outline" onClick={handleCloseEdit}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        >
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
        </AdminDialogShell>
      )}

      <AdminDialogShell
        open={isAddDialogOpen}
        onClose={handleCloseAdd}
        title="Add Blockout"
        subtitle="Create a new blockout date range for a staff member"
        footer={(
          <>
            <Button variant="outline" onClick={handleCloseAdd}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving || !staffId}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </>
        )}
      >
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
      </AdminDialogShell>
    </>
  );
}
