'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { classPlansApi } from '../api/classPlans';
import { useQueryClient } from '@tanstack/react-query';
import { classPlansKeys } from '../hooks/useClassPlansQuery';

interface AddSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  defaultDayOfWeek?: number;
  defaultClassLength?: number;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

export function AddSlotModal({
  isOpen,
  onClose,
  planId,
  defaultDayOfWeek,
  defaultClassLength = 1.5,
}: AddSlotModalProps) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [dayOfWeek, setDayOfWeek] = useState<string>(defaultDayOfWeek?.toString() || '1');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');

  // Update form when defaults change
  useEffect(() => {
    if (isOpen && defaultDayOfWeek !== undefined) {
      setDayOfWeek(defaultDayOfWeek.toString());
    }
  }, [isOpen, defaultDayOfWeek]);

  // Auto-adjust end time when start time changes
  useEffect(() => {
    if (startTime) {
      const [hours, mins] = startTime.split(':').map(Number);
      const startMinutes = hours * 60 + mins;
      const defaultMinutes = defaultClassLength * 60;
      const newEndMinutes = startMinutes + defaultMinutes;
      const newEndHours = Math.floor(newEndMinutes / 60);
      const newEndMins = newEndMinutes % 60;
      setEndTime(`${String(newEndHours).padStart(2, '0')}:${String(newEndMins).padStart(2, '0')}`);
    }
  }, [startTime, defaultClassLength]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await classPlansApi.addSlot(planId, {
        day_of_week: parseInt(dayOfWeek, 10),
        start_time: startTime,
        end_time: endTime,
      });
      
      qc.invalidateQueries({ queryKey: classPlansKeys.detail(planId) });
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add slot');
      console.error('Error adding slot:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setDayOfWeek(defaultDayOfWeek?.toString() || '1');
    setStartTime('09:00');
    setEndTime('10:30');
    setError(null);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Add Time Slot</DialogTitle>
          <DialogDescription>
            Add a new time slot for a day of the week
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="day">Day of Week *</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek} required>
              <SelectTrigger>
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day) => (
                  <SelectItem key={day.value} value={day.value.toString()}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time *</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="end-time">End Time *</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Slot'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
