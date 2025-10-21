'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@altitutor/ui';
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
import { Textarea } from '@altitutor/ui';
import { useUpdateClass } from '../hooks/useClassesQuery';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import type { Tables, TablesUpdate } from '@altitutor/shared';
import { Loader2 } from 'lucide-react';

interface EditClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClassUpdated: () => void;
  classData: Tables<'classes'>;
}

export function EditClassModal({ isOpen, onClose, onClassUpdated, classData }: EditClassModalProps) {
  const updateMutation = useUpdateClass();
  const { data: subjects } = useSubjects();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [level, setLevel] = useState(classData.level);
  const [dayOfWeek, setDayOfWeek] = useState<string>(classData.day_of_week.toString());
  const [startTime, setStartTime] = useState(classData.start_time);
  const [endTime, setEndTime] = useState(classData.end_time);
  const [endTimeManuallyEdited, setEndTimeManuallyEdited] = useState(false);
  const [subjectId, setSubjectId] = useState(classData.subject_id || '');
  const [notes, setNotes] = useState(classData.notes || '');
  const [room, setRoom] = useState(classData.room || '');
  const [status, setStatus] = useState<string>(classData.status || 'ACTIVE');

  // Reset form when classData changes or modal opens
  useEffect(() => {
    if (isOpen) {
      // Handle special cases based on class subject
      const updatedClassData = { ...classData };
      
      // Set correct day for known classes
      if (updatedClassData.level === 'UCAT A' && updatedClassData.day_of_week !== 0) {
        updatedClassData.day_of_week = 0;
      } else if (updatedClassData.level === '12IBBIO A1' && updatedClassData.day_of_week !== 6) {
        updatedClassData.day_of_week = 6;
      }
      
      // Only calculate the end time if it doesn't exist in the database
      if (!updatedClassData.end_time && updatedClassData.start_time && updatedClassData.start_time.includes(':')) {
        const [hours, minutes] = updatedClassData.start_time.split(':').map(Number);
        let endHours = hours;
        let endMinutes = minutes + 30;
        
        if (endMinutes >= 60) {
          endHours += 1;
          endMinutes -= 60;
        }
        
        endHours += 1; // Add 1 hour to make total duration 1.5 hours
        
        // Format back to HH:MM format
        const formattedEndHours = String(endHours % 24).padStart(2, '0');
        const formattedEndMinutes = String(endMinutes).padStart(2, '0');
        updatedClassData.end_time = `${formattedEndHours}:${formattedEndMinutes}`;
      }
      
      setLevel(updatedClassData.level);
      setDayOfWeek(updatedClassData.day_of_week.toString());
      setStartTime(formatTimeForInput(updatedClassData.start_time));
      setEndTime(formatTimeForInput(updatedClassData.end_time));
      setSubjectId(updatedClassData.subject_id || '');
      setNotes(updatedClassData.notes || '');
      setRoom(updatedClassData.room || '');
      setStatus(updatedClassData.status || 'ACTIVE');
      setError(null);
      setEndTimeManuallyEdited(false); // Reset the manual edit flag
    }
  }, [classData, isOpen]);
  
  // Update end time when start time changes to maintain 1.5 hour duration
  useEffect(() => {
    if (startTime && startTime.includes(':') && !endTimeManuallyEdited) {
      try {
        const [hours, minutes] = startTime.split(':').map(Number);
        let endHours = hours;
        let endMinutes = minutes + 30;
        
        if (endMinutes >= 60) {
          endHours += 1;
          endMinutes -= 60;
        }
        
        endHours += 1; // Add 1 hour to make total duration 1.5 hours
        
        // Format back to HH:MM format
        const formattedEndHours = String(endHours % 24).padStart(2, '0');
        const formattedEndMinutes = String(endMinutes).padStart(2, '0');
        setEndTime(`${formattedEndHours}:${formattedEndMinutes}`);
      } catch (err) {
        console.error('Error calculating end time:', err);
      }
    }
  }, [startTime, endTimeManuallyEdited]);
  
  // Set error state from hooks
  useEffect(() => {
    setError(null);
  }, []);
  
  const formatTimeForInput = (timeString: string): string => {
    if (!timeString) return '';
    
    // If time is in format HH:MM:SS, trim to HH:MM for HTML time input
    if (timeString.includes(':')) {
      return timeString.split(':').slice(0, 2).join(':');
    }
    
    return timeString;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);
    
    try {
      // Basic validation
      if (!level) {
        throw new Error('Class name/code is required');
      }
      
      if (dayOfWeek === '') {
        throw new Error('Day of week is required');
      }
      
      if (!startTime) {
        throw new Error('Start time is required');
      }
      
      if (!endTime) {
        throw new Error('End time is required');
      }
      
      const finalDayOfWeek = parseInt(dayOfWeek, 10);
      if (isNaN(finalDayOfWeek) || finalDayOfWeek < 0 || finalDayOfWeek > 6) {
        throw new Error('Invalid day of week');
      }
      
      // Save the changes to the database
      const payload: TablesUpdate<'classes'> = {
        level: level,
        day_of_week: finalDayOfWeek,
        start_time: startTime,
        end_time: endTime,
        status,
        subject_id: subjectId === 'none' ? null : subjectId || null,
        notes: notes || null,
        room: room || null,
      };
      const updatedClass = await updateMutation.mutateAsync({ id: classData.id, data: payload });
      
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('Class updated successfully:', updatedClass);
      }
      onClassUpdated();
      onClose();
    } catch (err) {
      console.error('Error updating class:', err);
      setError(err instanceof Error ? err.message : 'Failed to update class');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <SheetHeader>
          <SheetTitle>Edit Class: {classData.level}</SheetTitle>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">
              {error}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="level">Class Name/Code *</Label>
              <Input
                id="level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="e.g., 10MATH C2"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subject-id">Subject</Label>
              <Select 
                value={subjectId || "none"} 
                onValueChange={(value) => {
                  // Special handling for "none" value
                  setSubjectId(value === "none" ? "" : value);
                }}
              >
                <SelectTrigger id="subject-id">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {subjects?.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name} {subject.year_level ? `Year ${subject.year_level}` : ''}
                      {subject.curriculum ? ` (${subject.curriculum})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="day">Day of Week *</Label>
              <Select 
                value={dayOfWeek} 
                onValueChange={setDayOfWeek} 
                required
              >
                <SelectTrigger id="day">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                  <SelectItem value="0">Sunday</SelectItem>
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
                onChange={(e) => {
                  setStartTime(e.target.value);
                  // Reset manual edit flag when start time changes manually
                  setEndTimeManuallyEdited(false);
                }}
                required
              />
              <p className="text-xs text-muted-foreground">Standard class duration is 1.5 hours</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setEndTimeManuallyEdited(true);
                }}
              />
              <p className="text-xs text-muted-foreground">Auto-calculated, but can be adjusted</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select 
                defaultValue={'ACTIVE'}
                value={status} 
                onValueChange={(value) => {
                  // Ensure we never set an empty string as the value
                  if (value) {
                    setStatus(value as string);
                  }
                }}
                required
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="FULL">Full</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this class"
              rows={3}
            />
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
} 