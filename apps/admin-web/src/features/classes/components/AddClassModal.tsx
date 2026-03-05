'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, useToast } from '@altitutor/ui';
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
import { useCreateClass } from '../hooks/useClassesQuery';
import type { TablesInsert, Tables } from '@altitutor/shared';
import { SubjectSelectPopover } from '@/features/subjects/components/SubjectSelectPopover';
import { showEntityCreatedToast } from '@/shared/utils';

interface AddClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClassAdded: () => void;
}

export function AddClassModal({ isOpen, onClose, onClassAdded }: AddClassModalProps) {
  const createMutation = useCreateClass();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [level, setLevel] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<string>('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<Tables<'subjects'> | null>(null);
  
  const [room, setRoom] = useState('');
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
    if (startTime && endTime && endTime <= startTime) {
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
      const payload: TablesInsert<'classes'> = {
        id: crypto.randomUUID(),
        level: level.trim() || null,
        day_of_week: dayOfWeekNum,
        start_time: startTime.trim(),
        end_time: endTime.trim(),
        status: 'ACTIVE',
        subject_id: selectedSubject?.id || null,
        room: room.trim() || null,
        session_start_date: sessionStartDate || null,
        session_end_date: sessionEndDate || null,
      };
      const createdClass = await createMutation.mutateAsync(payload);

      if (createdClass?.id) {
        showEntityCreatedToast({
          toast,
          router,
          entityType: 'class',
          entityId: createdClass.id,
          message: 'Class created successfully.',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Class created successfully.',
        });
      }

      onClassAdded();
      resetForm();
      onClose();
    } catch (err: unknown) {
      let errorMessage = 'Failed to create class';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === 'object' && 'details' in err) {
        errorMessage = String((err as { details?: string }).details);
      } else if (err && typeof err === 'object' && 'hint' in err) {
        errorMessage = String((err as { hint?: string }).hint);
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      setError(errorMessage);
      console.error('Error creating class:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setLevel('');
    setDayOfWeek('');
    setStartTime('');
    setEndTime('');
    setSelectedSubject(null);
    
    setRoom('');
    setSessionStartDate('');
    setSessionEndDate('');
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Add New Class</DialogTitle>
          <DialogDescription>
            Create a new class with schedule, subject, and session details.
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
              <Label htmlFor="level">Class Level</Label>
              <Input
                id="level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="A/B/C/D (optional)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subject-id">Subject</Label>
              <SubjectSelectPopover
                selectedSubject={selectedSubject}
                onSelectSubject={setSelectedSubject}
                placeholder="Select subject"
              />
            </div>
          </div>
          
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
            
            <div className="space-y-2">
              <Label htmlFor="room">Room</Label>
              <Input
                id="room"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Room number/name"
              />
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
              {loading ? 'Creating...' : 'Create Class'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 