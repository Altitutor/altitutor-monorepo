'use client';

import { useState, useEffect } from 'react';
import {
  Input,
  Button,
  Label,
  Switch,
  SearchableSelect,
} from '@altitutor/ui';
import { Plus } from 'lucide-react';
import {
  callRoutingApi,
  type OnCallSchedule,
} from '../api/call-routing';
import { staffApi } from '@/features/staff/api/staff';
import type { Tables } from '@altitutor/shared';
import { AdminDialogShell, SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';

const DAY_NAMES = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

interface OnCallSchedulesTableProps {
  schedules: OnCallSchedule[];
  onUpdate: () => void;
}

export function OnCallSchedulesTable({ schedules, onUpdate }: OnCallSchedulesTableProps) {
  const [editingSchedule, setEditingSchedule] = useState<OnCallSchedule | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [startTime, setStartTime] = useState<string>('18:00');
  const [endTime, setEndTime] = useState<string>('22:00');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<Tables<'staff'>[]>([]);

  useEffect(() => {
    const loadStaff = async () => {
      try {
        const staff = await staffApi.getAll();
        setStaffList(staff);
        if (staff.length > 0 && !selectedStaffId) {
          setSelectedStaffId(staff[0].id);
        }
      } catch (error) {
        console.error('Failed to load staff:', error);
      }
    };
    loadStaff();
  }, [selectedStaffId]);

  const handleEdit = (schedule: OnCallSchedule) => {
    setEditingSchedule(schedule);
    setStartTime(schedule.start_time);
    setEndTime(schedule.end_time);
    setIsActive(schedule.is_active ?? true);
    setSelectedDay(schedule.day_of_week);
    setSelectedStaffId(schedule.staff_id);
  };

  const handleSave = async () => {
    if (!editingSchedule) return;
    setSaving(true);
    try {
      await callRoutingApi.updateOnCallSchedule(editingSchedule.id, {
        day_of_week: selectedDay,
        start_time: startTime,
        end_time: endTime,
        is_active: isActive,
      });
      setEditingSchedule(null);
      onUpdate();
    } catch (e) {
      alert('Failed to update: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedStaffId) {
      alert('Please select a staff member');
      return;
    }
    setSaving(true);
    try {
      await callRoutingApi.createOnCallSchedule({
        staff_id: selectedStaffId,
        day_of_week: selectedDay,
        start_time: startTime,
        end_time: endTime,
        is_active: isActive,
      });
      setIsAddDialogOpen(false);
      setStartTime('18:00');
      setEndTime('22:00');
      setIsActive(true);
      setSelectedDay(1);
      onUpdate();
    } catch (e) {
      alert('Failed to create: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this on-call schedule?')) return;
    setDeleting(id);
    try {
      await callRoutingApi.deleteOnCallSchedule(id);
      onUpdate();
    } catch (e) {
      alert('Failed to delete: ' + (e as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  const getDayName = (dayOfWeek: number) => {
    return DAY_NAMES.find(d => d.value === dayOfWeek)?.label || `Day ${dayOfWeek}`;
  };

  const getStaffName = (staffId: string) => {
    const staff = staffList.find(s => s.id === staffId);
    return staff ? `${staff.first_name} ${staff.last_name}` : staffId;
  };

  const columns: SettingsDataTableColumn<OnCallSchedule>[] = [
    {
      key: 'staff',
      label: 'Staff',
      render: (schedule) => <span className="font-medium">{getStaffName(schedule.staff_id)}</span>,
      sortValue: (schedule) => getStaffName(schedule.staff_id),
      filterValue: (schedule) => getStaffName(schedule.staff_id),
      searchValue: (schedule) => getStaffName(schedule.staff_id),
    },
    {
      key: 'day',
      label: 'Day',
      render: (schedule) => <span className="font-medium">{getDayName(schedule.day_of_week)}</span>,
      sortValue: (schedule) => schedule.day_of_week,
      filterValue: (schedule) => getDayName(schedule.day_of_week),
      searchValue: (schedule) => getDayName(schedule.day_of_week),
    },
    {
      key: 'start_time',
      label: 'Start Time',
      render: (schedule) => schedule.start_time,
      sortValue: (schedule) => schedule.start_time,
      searchValue: (schedule) => schedule.start_time,
    },
    {
      key: 'end_time',
      label: 'End Time',
      render: (schedule) => schedule.end_time,
      sortValue: (schedule) => schedule.end_time,
      searchValue: (schedule) => schedule.end_time,
    },
    {
      key: 'status',
      label: 'Status',
      render: (schedule) => (
        <span className={`rounded px-2 py-1 text-xs ${
          schedule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {schedule.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
      sortValue: (schedule) => Boolean(schedule.is_active),
      filterValue: (schedule) => schedule.is_active ? 'active' : 'inactive',
      searchValue: (schedule) => schedule.is_active ? 'Active' : 'Inactive',
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">On-Call Schedules</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure recurring weekly on-call schedules for staff. Times are in Adelaide timezone.
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Schedule
        </Button>
      </div>

      <SettingsDataTable
        data={schedules}
        columns={columns}
        getRowId={(schedule) => schedule.id}
        searchPlaceholder="Search on-call schedules..."
        emptyMessage="No on-call schedules configured. Add a schedule to get started."
        filterKeys={['staff', 'day', 'status']}
        filterDefinitions={[
          {
            key: 'staff',
            label: 'Staff',
            options: staffList.map((staff) => ({
              label: `${staff.first_name} ${staff.last_name}`,
              value: `${staff.first_name} ${staff.last_name}`,
            })),
          },
          {
            key: 'day',
            label: 'Day',
            options: DAY_NAMES.map((day) => ({ label: day.label, value: day.label })),
          },
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ],
          },
        ]}
        defaultSort={{ field: 'day', direction: 'asc' }}
        getActions={(schedule) => [
          {
            id: 'edit',
            label: 'Edit',
            description: 'Update this on-call schedule',
            onSelect: () => handleEdit(schedule),
          },
          {
            id: 'delete',
            label: 'Delete',
            description: 'Remove this on-call schedule',
            disabled: deleting === schedule.id,
            onSelect: () => handleDelete(schedule.id),
          },
        ]}
      />

      <AdminDialogShell
        open={!!editingSchedule}
        onClose={() => setEditingSchedule(null)}
        title="Edit On-Call Schedule"
        subtitle={`Update the on-call schedule for ${editingSchedule ? getStaffName(editingSchedule.staff_id) : ''}`}
        footer={(
          <>
            <Button variant="outline" onClick={() => setEditingSchedule(null)}>
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
              <Label htmlFor="edit-day">Day</Label>
              <SearchableSelect<(typeof DAY_NAMES)[number]>
                items={DAY_NAMES}
                value={DAY_NAMES.find((d) => d.value === selectedDay) ?? DAY_NAMES[1]}
                onValueChange={(item) => setSelectedDay(item?.value ?? 1)}
                getItemLabel={(d) => d.label}
                getItemId={(d) => String(d.value)}
                placeholder="Select day"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-start-time">Start Time (Adelaide timezone)</Label>
              <Input
                id="edit-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-end-time">End Time (Adelaide timezone)</Label>
              <Input
                id="edit-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="edit-is-active">Active</Label>
            </div>
          </div>
      </AdminDialogShell>

      <AdminDialogShell
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        title="Add On-Call Schedule"
        subtitle="Set a recurring weekly on-call schedule for a staff member"
        footer={(
          <>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </>
        )}
      >
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-staff">Staff Member</Label>
              <SearchableSelect<Tables<'staff'>>
                items={staffList}
                value={staffList.find((s) => s.id === selectedStaffId) ?? null}
                onValueChange={(item) => setSelectedStaffId(item?.id ?? '')}
                getItemLabel={(s) => `${s.first_name} ${s.last_name}`}
                getItemId={(s) => s.id}
                placeholder="Select staff"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-day">Day</Label>
              <SearchableSelect<(typeof DAY_NAMES)[number]>
                items={DAY_NAMES}
                value={DAY_NAMES.find((d) => d.value === selectedDay) ?? DAY_NAMES[1]}
                onValueChange={(item) => setSelectedDay(item?.value ?? 1)}
                getItemLabel={(d) => d.label}
                getItemId={(d) => String(d.value)}
                placeholder="Select day"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-start-time">Start Time (Adelaide timezone)</Label>
              <Input
                id="add-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-end-time">End Time (Adelaide timezone)</Label>
              <Input
                id="add-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="add-is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="add-is-active">Active</Label>
            </div>
          </div>
      </AdminDialogShell>
    </>
  );
}
