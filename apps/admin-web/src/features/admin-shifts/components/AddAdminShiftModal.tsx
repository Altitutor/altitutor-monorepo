'use client';

import { useState } from 'react';
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
import { useCreateAdminShift } from '../hooks/useAdminShiftsQuery';
import { useCurrentStaff } from '@/shared/hooks';
import type { TablesInsert } from '@altitutor/shared';

interface AddAdminShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdminShiftAdded: () => void;
}

export function AddAdminShiftModal({ isOpen, onClose, onAdminShiftAdded }: AddAdminShiftModalProps) {
  const createMutation = useCreateAdminShift();
  const { data: currentStaff } = useCurrentStaff();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [dayOfWeek, setDayOfWeek] = useState<string>('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [sessionStartDate, setSessionStartDate] = useState<string>('');
  const [sessionEndDate, setSessionEndDate] = useState<string>('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Validate required fields
    if (!dayOfWeek) {
      setError('Day of week is required');
      setLoading(false);
      return;
    }
    
    const dayOfWeekNum = parseInt(dayOfWeek, 10);
    if (isNaN(dayOfWeekNum) || dayOfWeekNum < 0 || dayOfWeekNum > 6) {
      setError('Invalid day of week');
      setLoading(false);
      return;
    }
    
    if (!startTime.trim()) {
      setError('Start time is required');
      setLoading(false);
      return;
    }
    
    if (!endTime.trim()) {
      setError('End time is required');
      setLoading(false);
      return;
    }

    // Validate end time is after start time
    if (endTime <= startTime) {
      setError('End time must be after start time');
      setLoading(false);
      return;
    }
    
    // Validate date range
    if (sessionStartDate && sessionEndDate && sessionStartDate > sessionEndDate) {
      setError('Session start date must be before or equal to end date');
      setLoading(false);
      return;
    }
    
    try {
      const payload: TablesInsert<'admin_shifts'> = {
        id: crypto.randomUUID(),
        day_of_week: dayOfWeekNum,
        start_time: startTime.trim(),
        end_time: endTime.trim(),
        status: 'ACTIVE',
        session_start_date: sessionStartDate || null,
        session_end_date: sessionEndDate || null,
        created_by: currentStaff?.id || null,
      };
      await createMutation.mutateAsync(payload);
      
      onAdminShiftAdded();
      resetForm();
      onClose();
    } catch (err: unknown) {
      let errorMessage = 'Failed to create admin shift';
      if (err && typeof err === 'object') {
        if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
          errorMessage = (err as { message: string }).message;
        } else if ('details' in err && typeof (err as { details: unknown }).details === 'string') {
          errorMessage = (err as { details: string }).details;
        } else if ('hint' in err && typeof (err as { hint: unknown }).hint === 'string') {
          errorMessage = (err as { hint: string }).hint;
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      setError(errorMessage);
      console.error('Error creating admin shift:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setDayOfWeek('');
    setStartTime('');
    setEndTime('');
    setSessionStartDate('');
    setSessionEndDate('');
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Add New Admin Shift</DialogTitle>
          <DialogDescription>
            Create a new recurring admin staff shift. Sessions will be automatically created for this shift.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">
              {error}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="day">Day of Week *</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              <p className="text-xs text-muted-foreground">
                Admin staff work 3.5 hours (15 min early, 15 min late)
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="session-start-date">Session Start Date (Optional)</Label>
              <Input
                id="session-start-date"
                type="date"
                value={sessionStartDate}
                onChange={(e) => setSessionStartDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to create sessions from today. Set a future date to delay session creation.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="session-end-date">Session End Date (Optional)</Label>
              <Input
                id="session-end-date"
                type="date"
                value={sessionEndDate}
                onChange={(e) => setSessionEndDate(e.target.value)}
                min={sessionStartDate || undefined}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to create sessions until end of year. Set an end date to limit session creation.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Admin Shift'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
