'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@altitutor/ui';
import { Alert, AlertDescription } from '@altitutor/ui';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useCreateClassPlan } from '../hooks/useClassPlansQuery';
import { useCurrentStaff } from '@/shared/hooks';
import { useToast } from '@altitutor/ui';
import { useRouter } from 'next/navigation';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';

interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TimeSlot = {
  start_time: string;
  end_time: string;
};

// Monday first
const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
];

export function CreatePlanModal({ isOpen, onClose }: CreatePlanModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();
  const createMutation = useCreateClassPlan();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  // Form state
  const [planName, setPlanName] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [defaultLength, setDefaultLength] = useState(1.5);
  const [slots, setSlots] = useState<Record<number, TimeSlot[]>>({
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  });

  const addSlot = (dayOfWeek: number) => {
    setSlots((prev) => ({
      ...prev,
      [dayOfWeek]: [
        ...prev[dayOfWeek],
        { start_time: '09:00', end_time: '10:30' },
      ],
    }));
  };

  const removeSlot = (dayOfWeek: number, index: number) => {
    setSlots((prev) => ({
      ...prev,
      [dayOfWeek]: prev[dayOfWeek].filter((_, i) => i !== index),
    }));
  };

  const updateSlot = (dayOfWeek: number, index: number, field: 'start_time' | 'end_time', value: string) => {
    setSlots((prev) => {
      const updated = prev[dayOfWeek].map((slot, i) => {
        if (i !== index) return slot;
        
        const newSlot = { ...slot, [field]: value };
        
        // If start_time changed, always auto-set end_time to start_time + default length
        if (field === 'start_time' && value) {
          const [startHours, startMins] = value.split(':').map(Number);
          const startMinutes = startHours * 60 + startMins;
          const defaultMinutes = defaultLength * 60;
          const newEndMinutes = startMinutes + defaultMinutes;
          const newEndHours = Math.floor(newEndMinutes / 60);
          const newEndMins = newEndMinutes % 60;
          newSlot.end_time = `${String(newEndHours).padStart(2, '0')}:${String(newEndMins).padStart(2, '0')}`;
        }
        
        // If end_time changed and is now <= start_time, adjust end_time
        if (field === 'end_time') {
          const [startHours, startMins] = slot.start_time.split(':').map(Number);
          const [endHours, endMins] = value.split(':').map(Number);
          const startMinutes = startHours * 60 + startMins;
          const endMinutes = endHours * 60 + endMins;
          
          if (endMinutes <= startMinutes) {
            // Add default length hours to start time
            const defaultMinutes = defaultLength * 60;
            const newEndMinutes = startMinutes + defaultMinutes;
            const newEndHours = Math.floor(newEndMinutes / 60);
            const newEndMins = newEndMinutes % 60;
            newSlot.end_time = `${String(newEndHours).padStart(2, '0')}:${String(newEndMins).padStart(2, '0')}`;
          }
        }
        
        return newSlot;
      });
      
      return {
        ...prev,
        [dayOfWeek]: updated,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!currentStaff?.id) {
      setError('Unable to identify current staff member');
      setLoading(false);
      return;
    }

    try {
      // Convert slots to array format
      const slotsArray: Array<{ day_of_week: number; start_time: string; end_time: string }> = [];
      Object.entries(slots).forEach(([day, daySlots]) => {
        daySlots.forEach((slot) => {
          slotsArray.push({
            day_of_week: parseInt(day, 10),
            start_time: slot.start_time,
            end_time: slot.end_time,
          });
        });
      });

      const plan = await createMutation.mutateAsync({
        name: planName,
        year,
        default_class_length_hours: defaultLength,
        slots: slotsArray,
        created_by: currentStaff.id,
      });

      toast({
        title: 'Success',
        description: 'Class plan created successfully',
      });

      resetForm();
      onClose();
      router.push(`/settings/class-planner/${plan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create class plan');
      console.error('Error creating class plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPlanName('');
    setYear(new Date().getFullYear());
    setDefaultLength(1.5);
    setSlots({
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    });
    setShowWarning(true);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'sm:max-w-[700px] max-h-[90vh] overflow-y-auto',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle>Create Class Plan</DialogTitle>
              <DialogDescription>
                Set up a new class plan with time slots for each day of the week
              </DialogDescription>
            </div>
            <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
          </div>
        </DialogHeader>

        {showWarning && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Make sure students' subjects are set first before creating a class plan.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan-name">Plan Name *</Label>
              <Input
                id="plan-name"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g., 2026 Term 1 Plan"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Year *</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                min={2020}
                max={2100}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-length">Default Class Length (hours)</Label>
            <Input
              id="default-length"
              type="number"
              step="0.5"
              min="0.5"
              max="8"
              value={defaultLength}
              onChange={(e) => setDefaultLength(parseFloat(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Default length for classes when creating new ones (default: 1.5 hours)
            </p>
          </div>

          <div className="space-y-4">
            <Label>Time Slots (per day)</Label>
            <Tabs defaultValue="1" className="w-full">
              <TabsList className="grid w-full grid-cols-7">
                {DAYS_OF_WEEK.map((day) => (
                  <TabsTrigger key={day.value} value={day.value.toString()}>
                    {day.short}
                  </TabsTrigger>
                ))}
              </TabsList>

              {DAYS_OF_WEEK.map((day) => (
                <TabsContent key={day.value} value={day.value.toString()} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{day.label} Slots</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addSlot(day.value)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Slot
                    </Button>
                  </div>

                  {slots[day.value].length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No slots configured for {day.label}. Click "Add Slot" to add one.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {slots[day.value].map((slot, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Start Time</Label>
                              <Input
                                type="time"
                                value={slot.start_time}
                                onChange={(e) =>
                                  updateSlot(day.value, index, 'start_time', e.target.value)
                                }
                                required
                              />
                            </div>
                            <div>
                              <Label className="text-xs">End Time</Label>
                              <Input
                                type="time"
                                value={slot.end_time}
                                onChange={(e) =>
                                  updateSlot(day.value, index, 'end_time', e.target.value)
                                }
                                required
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSlot(day.value, index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !planName.trim()}>
              {loading ? 'Creating...' : 'Create Plan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
