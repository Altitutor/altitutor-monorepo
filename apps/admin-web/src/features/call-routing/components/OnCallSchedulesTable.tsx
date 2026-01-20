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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import {
  callRoutingApi,
  type OnCallSchedule,
} from '../api/call-routing';
import { staffApi } from '@/features/staff/api/staff';
import type { Tables } from '@altitutor/shared';

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

  // Group schedules by staff
  const schedulesByStaff = staffList
    .map(staff => ({
      staff,
      schedules: schedules.filter(s => s.staff_id === staff.id).sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
        return a.start_time.localeCompare(b.start_time);
      }),
    }))
    .filter(({ schedules }) => schedules.length > 0);

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

      {schedulesByStaff.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          No on-call schedules configured. Add a schedule to get started.
        </div>
      ) : (
        <div className="space-y-6">
          {schedulesByStaff.map(({ staff, schedules: staffSchedules }) => (
            <div key={staff.id} className="border rounded-lg">
              <div className="p-4 bg-muted/50 border-b">
                <span className="font-semibold">{staff.first_name} {staff.last_name}</span>
              </div>
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
                  {staffSchedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">
                        {getDayName(schedule.day_of_week)}
                      </TableCell>
                      <TableCell>{schedule.start_time}</TableCell>
                      <TableCell>{schedule.end_time}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          schedule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {schedule.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(schedule)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(schedule.id)}
                            disabled={deleting === schedule.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingSchedule} onOpenChange={() => setEditingSchedule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit On-Call Schedule</DialogTitle>
            <DialogDescription>
              Update the on-call schedule for {editingSchedule && getStaffName(editingSchedule.staff_id)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-day">Day</Label>
              <Select value={selectedDay.toString()} onValueChange={(value) => setSelectedDay(Number(value))}>
                <SelectTrigger id="edit-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSchedule(null)}>
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
            <DialogTitle>Add On-Call Schedule</DialogTitle>
            <DialogDescription>
              Set a recurring weekly on-call schedule for a staff member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-staff">Staff Member</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger id="add-staff">
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
              <Label htmlFor="add-day">Day</Label>
              <Select value={selectedDay.toString()} onValueChange={(value) => setSelectedDay(Number(value))}>
                <SelectTrigger id="add-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
