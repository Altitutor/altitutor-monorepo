'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { classPlansApi } from '../api/classPlans';
import { useQueryClient } from '@tanstack/react-query';
import { classPlansKeys } from '../hooks/useClassPlansQuery';
import { SubjectSelectPopover } from '@/features/subjects/components/SubjectSelectPopover';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import type { Tables } from '@altitutor/shared';

interface CreateDraftClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  defaultDayOfWeek?: number | null;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
  defaultSubjectId?: string | null;
  defaultClassLength?: number;
}

export function CreateDraftClassModal({
  isOpen,
  onClose,
  planId,
  defaultDayOfWeek = null,
  defaultStartTime = null,
  defaultEndTime = null,
  defaultSubjectId = null,
  defaultClassLength = 1.5,
}: CreateDraftClassModalProps) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  // Form state
  const [level, setLevel] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<string>(defaultDayOfWeek?.toString() || '');
  const [startTime, setStartTime] = useState(defaultStartTime || '');
  const [endTime, setEndTime] = useState(defaultEndTime || '');
  const [selectedSubject, setSelectedSubject] = useState<Tables<'subjects'> | null>(null);
  const [room, setRoom] = useState('');

  // Update form when defaults change
  useEffect(() => {
    if (isOpen) {
      setDayOfWeek(defaultDayOfWeek?.toString() || '');
      setStartTime(defaultStartTime || '');
      setEndTime(defaultEndTime || '');
      setSelectedSubject(null); // Will be set via API if defaultSubjectId provided
    }
  }, [isOpen, defaultDayOfWeek, defaultStartTime, defaultEndTime, defaultSubjectId]);

  // Auto-adjust end time when start time changes
  useEffect(() => {
    if (startTime && !endTime) {
      const [hours, mins] = startTime.split(':').map(Number);
      const startMinutes = hours * 60 + mins;
      const defaultMinutes = defaultClassLength * 60;
      const newEndMinutes = startMinutes + defaultMinutes;
      const newEndHours = Math.floor(newEndMinutes / 60);
      const newEndMins = newEndMinutes % 60;
      setEndTime(`${String(newEndHours).padStart(2, '0')}:${String(newEndMins).padStart(2, '0')}`);
    } else if (startTime && endTime) {
      const [startHours, startMins] = startTime.split(':').map(Number);
      const [endHours, endMins] = endTime.split(':').map(Number);
      const startMinutes = startHours * 60 + startMins;
      const endMinutes = endHours * 60 + endMins;
      
      if (startMinutes >= endMinutes) {
        const defaultMinutes = defaultClassLength * 60;
        const newEndMinutes = startMinutes + defaultMinutes;
        const newEndHours = Math.floor(newEndMinutes / 60);
        const newEndMins = newEndMinutes % 60;
        setEndTime(`${String(newEndHours).padStart(2, '0')}:${String(newEndMins).padStart(2, '0')}`);
      }
    }
    // endTime is intentionally excluded to avoid infinite loop (effect sets endTime)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime, defaultClassLength]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await classPlansApi.createDraftClass(planId, {
        subject_id: selectedSubject?.id || null,
        day_of_week: dayOfWeek ? parseInt(dayOfWeek, 10) : null,
        start_time: startTime || null,
        end_time: endTime || null,
        room: room || null,
        level: level || null,
        status: 'ACTIVE',
      });
      
      qc.invalidateQueries({ queryKey: classPlansKeys.detail(planId) });
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create class');
      console.error('Error creating draft class:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setLevel('');
    setDayOfWeek(defaultDayOfWeek?.toString() || '');
    setStartTime(defaultStartTime || '');
    setEndTime(defaultEndTime || '');
    setSelectedSubject(null);
    setRoom('');
    setError(null);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'sm:max-w-[550px]',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle>Create Draft Class</DialogTitle>
              <DialogDescription>
                Create a new draft class. Leave day and time empty to create an unassigned class in the class bank.
              </DialogDescription>
            </div>
            <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
          </div>
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
                placeholder="A/B/C/D"
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
              <Label htmlFor="day">Day of Week</Label>
              <select
                id="day"
                value={dayOfWeek || "none"}
                onChange={(e) => setDayOfWeek(e.target.value === "none" ? "" : e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="none">None (Unassigned)</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
                <option value="0">Sunday</option>
              </select>
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
          </div>
          
          <p className="text-xs text-muted-foreground">
            Leave day and time empty to create an unassigned class in the class bank.
          </p>
          
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
