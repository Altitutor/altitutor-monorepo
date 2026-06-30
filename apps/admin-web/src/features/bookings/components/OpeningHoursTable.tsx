'use client';

import { useState, useEffect } from 'react';
import {
  Input,
  Button,
  Label,
  Switch,
} from '@altitutor/ui';
import { openingHoursApi, type OpeningHoursRow } from '../api/opening-hours';
import { AdminDialogShell, SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';

interface OpeningHoursTableProps {
  openingHours: OpeningHoursRow[];
  onUpdate: () => void;
  onCreateTrigger?: number;
}

const DAY_NAMES = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

type OpeningHoursDisplayRow =
  | { id: string; day: number; dayLabel: string; kind: 'empty' }
  | { id: string; day: number; dayLabel: string; kind: 'hours'; hours: OpeningHoursRow };

export function OpeningHoursTable({ openingHours, onUpdate, onCreateTrigger }: OpeningHoursTableProps) {
  const [editingHours, setEditingHours] = useState<OpeningHoursRow | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleEdit = (hours: OpeningHoursRow) => {
    setEditingHours(hours);
    setStartTime(hours.start_time);
    setEndTime(hours.end_time);
    setIsActive(hours.is_active ?? true);
  };

  const handleSave = async () => {
    if (!editingHours) return;
    setSaving(true);
    try {
      await openingHoursApi.updateOpeningHours(editingHours.id, {
        start_time: startTime,
        end_time: endTime,
        is_active: isActive,
      });
      setEditingHours(null);
      onUpdate();
    } catch (e) {
      alert('Failed to update: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      await openingHoursApi.createOpeningHours(selectedDay, startTime, endTime, isActive);
      setIsAddDialogOpen(false);
      setStartTime('09:00');
      setEndTime('17:00');
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
    if (!confirm('Are you sure you want to delete this opening hours entry?')) return;
    setDeleting(id);
    try {
      await openingHoursApi.deleteOpeningHours(id);
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

  const getHoursForDay = (dayOfWeek: number) => {
    return openingHours
      .filter(h => h.day_of_week === dayOfWeek)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const rows: OpeningHoursDisplayRow[] = DAY_NAMES.flatMap<OpeningHoursDisplayRow>((day) => {
    const hoursList = getHoursForDay(day.value);
    if (hoursList.length === 0) {
      return [{ id: `empty-${day.value}`, day: day.value, dayLabel: day.label, kind: 'empty' as const }];
    }
    return hoursList.map((hours) => ({
      id: hours.id,
      day: day.value,
      dayLabel: day.label,
      kind: 'hours' as const,
      hours,
    }));
  });

  const openAddForDay = (day: number) => {
    setSelectedDay(day);
    setIsAddDialogOpen(true);
  };

  // Trigger add dialog when onCreateTrigger changes
  useEffect(() => {
    if (onCreateTrigger && onCreateTrigger > 0) {
      setIsAddDialogOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCreateTrigger]);

  const columns: SettingsDataTableColumn<OpeningHoursDisplayRow>[] = [
    {
      key: 'day',
      label: 'Day',
      render: (row) => <span className="font-medium">{row.dayLabel}</span>,
      sortValue: (row) => row.day,
      filterValue: (row) => row.dayLabel,
      searchValue: (row) => row.dayLabel,
    },
    {
      key: 'start_time',
      label: 'Start Time',
      render: (row) => row.kind === 'hours' ? row.hours.start_time : <span className="text-muted-foreground">No opening hours set</span>,
      sortValue: (row) => row.kind === 'hours' ? row.hours.start_time : '',
      searchValue: (row) => row.kind === 'hours' ? row.hours.start_time : 'No opening hours set',
    },
    {
      key: 'end_time',
      label: 'End Time',
      render: (row) => row.kind === 'hours' ? row.hours.end_time : '-',
      sortValue: (row) => row.kind === 'hours' ? row.hours.end_time : '',
      searchValue: (row) => row.kind === 'hours' ? row.hours.end_time : '',
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        if (row.kind === 'empty') return <span className="text-muted-foreground">-</span>;
        return (
          <span className={`px-2 py-1 rounded text-xs ${
            row.hours.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {row.hours.is_active ? 'Active' : 'Inactive'}
          </span>
        );
      },
      sortValue: (row) => row.kind === 'hours' ? Boolean(row.hours.is_active) : false,
      filterValue: (row) => row.kind === 'hours' && row.hours.is_active ? 'active' : row.kind === 'hours' ? 'inactive' : 'empty',
      searchValue: (row) => row.kind === 'hours' && row.hours.is_active ? 'Active' : row.kind === 'hours' ? 'Inactive' : '',
    },
  ];

  return (
    <>
      <SettingsDataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        searchPlaceholder="Search opening hours..."
        filterKeys={['day', 'status']}
        filterDefinitions={[
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
              { label: 'No hours set', value: 'empty' },
            ],
          },
        ]}
        defaultSort={{ field: 'day', direction: 'asc' }}
        getActions={(row) => {
          if (row.kind === 'empty') {
            return [
              {
                id: 'add',
                label: 'Add range',
                onSelect: () => openAddForDay(row.day),
              },
            ];
          }

          return [
            {
              id: 'edit',
              label: 'Edit',
              onSelect: () => handleEdit(row.hours),
            },
            {
              id: 'add-range',
              label: 'Add range',
              onSelect: () => openAddForDay(row.day),
            },
            {
              id: 'delete',
              label: 'Delete',
              disabled: deleting === row.hours.id,
              onSelect: () => handleDelete(row.hours.id),
            },
          ];
        }}
      />

      <AdminDialogShell
        open={!!editingHours}
        onClose={() => setEditingHours(null)}
        title="Edit Opening Hours"
        subtitle={`Update opening hours for ${editingHours ? getDayName(editingHours.day_of_week) : ''}`}
        footer={(
          <>
            <Button variant="outline" onClick={() => setEditingHours(null)}>
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
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="is-active">Active</Label>
            </div>
          </div>
      </AdminDialogShell>

      <AdminDialogShell
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        title="Add Opening Hours"
        subtitle="Set opening hours for a specific day of the week. You can add multiple time ranges per day to create lunch breaks automatically."
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
              <Label htmlFor="day">Day</Label>
              <select
                id="day"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedDay}
                onChange={(e) => setSelectedDay(Number(e.target.value))}
              >
                {DAY_NAMES.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

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
