'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { SearchableSelect } from '@altitutor/ui';
import { useUpdateClass } from '../hooks/useClassesQuery';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import type { TablesUpdate } from '@altitutor/shared';
import type { MinimalClass } from '../api/classes';
import { Loader2 } from 'lucide-react';

const DAY_OPTIONS = [
  { id: '0', label: 'Sunday' },
  { id: '1', label: 'Monday' },
  { id: '2', label: 'Tuesday' },
  { id: '3', label: 'Wednesday' },
  { id: '4', label: 'Thursday' },
  { id: '5', label: 'Friday' },
  { id: '6', label: 'Saturday' },
] as const;

const STATUS_OPTIONS = [
  { id: 'ACTIVE', label: 'Active' },
  { id: 'INACTIVE', label: 'Inactive' },
  { id: 'FULL', label: 'Full' },
] as const;

interface EditClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClassUpdated: () => void;
  classData: MinimalClass;
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
      if (dayOfWeek === '') {
        throw new Error('Day of week is required');
      }
      
      if (!startTime) {
        throw new Error('Start time is required');
      }
      
      if (!endTime) {
        throw new Error('End time is required');
      }

      if (endTime <= startTime) {
        throw new Error('End time must be after start time');
      }
      
      const finalDayOfWeek = parseInt(dayOfWeek, 10);
      if (isNaN(finalDayOfWeek) || finalDayOfWeek < 0 || finalDayOfWeek > 6) {
        throw new Error('Invalid day of week');
      }
      
      // Save the changes to the database
      const payload: TablesUpdate<'classes'> = {
        level: level || null,
        day_of_week: finalDayOfWeek,
        start_time: startTime,
        end_time: endTime,
        status,
        subject_id: subjectId || null,
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
      <SheetContent className="w-full md:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <SheetHeader>
          <SheetTitle>Edit Class{classData.level ? `: ${classData.level}` : ''}</SheetTitle>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">
              {error}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="level">Class Name/Code</Label>
              <Input
                id="level"
                value={level || ''}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="A/B/C/D (optional)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subject-id">Subject</Label>
              <SearchableSelect
                items={subjects ?? []}
                value={
                  subjectId
                    ? (subjects?.find((s) => s.id === subjectId) ?? null)
                    : null
                }
                onValueChange={(s) => setSubjectId(s?.id ?? '')}
                getItemId={(s) => s.id}
                getItemLabel={(s) =>
                  `${s.name}${s.year_level ? ` Year ${s.year_level}` : ''}${s.curriculum ? ` (${s.curriculum})` : ''}`
                }
                placeholder="Select subject"
                searchPlaceholder="Search subjects..."
                emptyMessage="No subjects found"
                allowClear
                clearLabel="None"
                trigger={
                  <Button
                    variant="outline"
                    className="w-full justify-start font-normal"
                    id="subject-id"
                  >
                    {subjectId
                      ? (() => {
                          const s = subjects?.find((x) => x.id === subjectId);
                          return s
                            ? `${s.name}${s.year_level ? ` Year ${s.year_level}` : ''}${s.curriculum ? ` (${s.curriculum})` : ''}`
                            : 'Select subject';
                        })()
                      : 'Select subject'}
                  </Button>
                }
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="day">Day of Week *</Label>
              <SearchableSelect<(typeof DAY_OPTIONS)[number]>
                items={[...DAY_OPTIONS]}
                value={DAY_OPTIONS.find((d) => d.id === dayOfWeek) ?? null}
                onValueChange={(d) => d && setDayOfWeek(d.id)}
                getItemId={(d) => d.id}
                getItemLabel={(d) => d.label}
                placeholder="Select day"
                searchPlaceholder="Search days..."
                emptyMessage="No days found"
                trigger={
                  <Button
                    variant="outline"
                    className="w-full justify-start font-normal"
                    id="day"
                  >
                    {DAY_OPTIONS.find((d) => d.id === dayOfWeek)?.label ?? 'Select day'}
                  </Button>
                }
              />
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
              <SearchableSelect<(typeof STATUS_OPTIONS)[number]>
                items={[...STATUS_OPTIONS]}
                value={STATUS_OPTIONS.find((s) => s.id === status) ?? null}
                onValueChange={(s) => s && setStatus(s.id)}
                getItemId={(s) => s.id}
                getItemLabel={(s) => s.label}
                placeholder="Select status"
                searchPlaceholder="Search status..."
                emptyMessage="No status found"
                trigger={
                  <Button
                    variant="outline"
                    className="w-full justify-start font-normal"
                    id="status"
                  >
                    {STATUS_OPTIONS.find((s) => s.id === status)?.label ?? 'Select status'}
                  </Button>
                }
              />
            </div>
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