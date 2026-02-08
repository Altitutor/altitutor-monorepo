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
  Switch,
} from '@altitutor/ui';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { openingHoursApi, type OpeningHoursRow } from '../api/opening-hours';

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

  // Trigger add dialog when onCreateTrigger changes
  useEffect(() => {
    if (onCreateTrigger && onCreateTrigger > 0) {
      setIsAddDialogOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCreateTrigger]);

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead>Start Time</TableHead>
              <TableHead>End Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DAY_NAMES.map((day) => {
              const hoursList = getHoursForDay(day.value);
              const hasHours = hoursList.length > 0;
              
              // If no hours, show a single row with "Add" button
              if (!hasHours) {
                return (
                  <TableRow key={day.value}>
                    <TableCell className="font-medium">{day.label}</TableCell>
                    <TableCell colSpan={2}>
                      <span className="text-muted-foreground">No opening hours set</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">-</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedDay(day.value);
                          setIsAddDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              }
              
              // Show all hours for this day, with day name only on first row
              return hoursList.map((hours, index) => (
                <TableRow key={`${day.value}-${hours.id}`}>
                  {index === 0 && (
                    <TableCell className="font-medium" rowSpan={hoursList.length}>
                      {day.label}
                    </TableCell>
                  )}
                  <TableCell>{hours.start_time}</TableCell>
                  <TableCell>{hours.end_time}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      hours.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {hours.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(hours)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(hours.id)}
                        disabled={deleting === hours.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {index === hoursList.length - 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedDay(day.value);
                            setIsAddDialogOpen(true);
                          }}
                          className="ml-2"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Range
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingHours} onOpenChange={() => setEditingHours(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Opening Hours</DialogTitle>
            <DialogDescription>
              Update opening hours for {editingHours && getDayName(editingHours.day_of_week)}
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingHours(null)}>
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
            <DialogTitle>Add Opening Hours</DialogTitle>
            <DialogDescription>
              Set opening hours for a specific day of the week. You can add multiple time ranges per day (e.g., 9-12 and 1-4) to create lunch breaks automatically.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
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

