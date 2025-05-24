import { useState } from 'react';
import { Student } from "@/lib/supabase/db/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Pencil } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Form schema for availability
const formSchema = z.object({
  availability_monday: z.boolean(),
  availability_tuesday: z.boolean(),
  availability_wednesday: z.boolean(),
  availability_thursday: z.boolean(),
  availability_friday: z.boolean(),
  availability_saturday_am: z.boolean(),
  availability_saturday_pm: z.boolean(),
  availability_sunday_am: z.boolean(),
  availability_sunday_pm: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface AvailabilityTabProps {
  student: Student;
  isEditing: boolean;
  isLoading: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmit: (data: FormData) => Promise<void>;
}

export function AvailabilityTab({
  student,
  isEditing,
  isLoading,
  onEdit,
  onCancelEdit,
  onSubmit
}: AvailabilityTabProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      availability_monday: student.availabilityMonday || false,
      availability_tuesday: student.availabilityTuesday || false,
      availability_wednesday: student.availabilityWednesday || false,
      availability_thursday: student.availabilityThursday || false,
      availability_friday: student.availabilityFriday || false,
      availability_saturday_am: student.availabilitySaturdayAm || false,
      availability_saturday_pm: student.availabilitySaturdayPm || false,
      availability_sunday_am: student.availabilitySundayAm || false,
      availability_sunday_pm: student.availabilitySundayPm || false,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Availability</h3>
        {!isEditing && (
          <Button 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2" 
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        // Edit Mode
        <form id="availability-edit-form" onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-4">
              <h5 className="font-medium text-sm">Weekdays</h5>
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => (
                <div key={day} className="flex items-center space-x-2">
                  <Controller
                    control={form.control}
                    name={`availability_${day}` as keyof FormData}
                    render={({ field }) => (
                      <Checkbox 
                        id={`availability_${day}`} 
                        checked={field.value as boolean}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
                    )}
                  />
                  <Label htmlFor={`availability_${day}`} className="text-sm capitalize">
                    {day}
                  </Label>
                </div>
              ))}
            </div>
            
            <div className="space-y-4">
              <h5 className="font-medium text-sm">Saturday</h5>
              <div className="flex items-center space-x-2">
                <Controller
                  control={form.control}
                  name="availability_saturday_am"
                  render={({ field }) => (
                    <Checkbox 
                      id="availability_saturday_am" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                    />
                  )}
                />
                <Label htmlFor="availability_saturday_am" className="text-sm">Morning</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Controller
                  control={form.control}
                  name="availability_saturday_pm"
                  render={({ field }) => (
                    <Checkbox 
                      id="availability_saturday_pm" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                    />
                  )}
                />
                <Label htmlFor="availability_saturday_pm" className="text-sm">Afternoon</Label>
              </div>
            </div>
            
            <div className="space-y-4">
              <h5 className="font-medium text-sm">Sunday</h5>
              <div className="flex items-center space-x-2">
                <Controller
                  control={form.control}
                  name="availability_sunday_am"
                  render={({ field }) => (
                    <Checkbox 
                      id="availability_sunday_am" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                    />
                  )}
                />
                <Label htmlFor="availability_sunday_am" className="text-sm">Morning</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Controller
                  control={form.control}
                  name="availability_sunday_pm"
                  render={({ field }) => (
                    <Checkbox 
                      id="availability_sunday_pm" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                    />
                  )}
                />
                <Label htmlFor="availability_sunday_pm" className="text-sm">Afternoon</Label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancelEdit}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      ) : (
        // View Mode
        <div>
          <div className="grid grid-cols-3 gap-y-2">
            {student.availabilityMonday && (
              <span className="text-sm">Monday</span>
            )}
            {student.availabilityTuesday && (
              <span className="text-sm">Tuesday</span>
            )}
            {student.availabilityWednesday && (
              <span className="text-sm">Wednesday</span>
            )}
            {student.availabilityThursday && (
              <span className="text-sm">Thursday</span>
            )}
            {student.availabilityFriday && (
              <span className="text-sm">Friday</span>
            )}
            {student.availabilitySaturdayAm && (
              <span className="text-sm">Saturday AM</span>
            )}
            {student.availabilitySaturdayPm && (
              <span className="text-sm">Saturday PM</span>
            )}
            {student.availabilitySundayAm && (
              <span className="text-sm">Sunday AM</span>
            )}
            {student.availabilitySundayPm && (
              <span className="text-sm">Sunday PM</span>
            )}
            {![
              student.availabilityMonday,
              student.availabilityTuesday,
              student.availabilityWednesday,
              student.availabilityThursday,
              student.availabilityFriday,
              student.availabilitySaturdayAm,
              student.availabilitySaturdayPm,
              student.availabilitySundayAm,
              student.availabilitySundayPm
            ].some(Boolean) && (
              <span className="text-sm text-muted-foreground">No availability set</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { formSchema };
export type { FormData as AvailabilityFormData }; 