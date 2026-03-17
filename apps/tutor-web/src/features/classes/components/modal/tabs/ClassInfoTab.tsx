import type { Tables } from '@altitutor/shared';
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import { SearchableSelect } from "@altitutor/ui";
import { Loader2, Pencil } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ClassStatusBadge } from "@altitutor/ui";
import { formatSubjectDisplay } from "@/shared/utils";
import { formatTime, getDayOfWeek } from '@/shared/utils/datetime';

// Form schema for class details
const classInfoSchema = z.object({
  level: z.string().min(1, 'Level is required'),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  status: z.enum(['ACTIVE','INACTIVE','FULL']),
  subjectId: z.string().optional(),
  room: z.string().optional(),
});

type FormData = z.infer<typeof classInfoSchema>;

const STATUS_OPTIONS = [
  { value: 'ACTIVE' as const, label: 'Active' },
  { value: 'INACTIVE' as const, label: 'Inactive' },
  { value: 'FULL' as const, label: 'Full' },
] as const;

const DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

interface ClassInfoTabProps {
  classData: Tables<'classes'>;
  subject?: Tables<'subjects'> | null;
  subjects: Tables<'subjects'>[];
  isEditing: boolean;
  isLoading: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmit: (data: FormData) => Promise<void>;
}

export function ClassInfoTab({
  classData,
  subject,
  subjects,
  isEditing,
  isLoading,
  onEdit,
  onCancelEdit,
  onSubmit
}: ClassInfoTabProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(classInfoSchema),
    defaultValues: {
      level: classData.level || '',
      dayOfWeek: classData.day_of_week || 1,
      startTime: classData.start_time || '',
      endTime: classData.end_time || '',
      status: (classData.status as 'ACTIVE' | 'INACTIVE' | 'FULL') || 'ACTIVE',
      subjectId: classData.subject_id || '',
      room: classData.room || '',
    },
  });

  

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Class Information</h3>
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
        <form id="class-edit-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="level">Level</Label>
              <Input 
                id="level" 
                {...form.register('level')} 
                disabled={isLoading} 
                placeholder="A/B/C/D"
              />
              {form.formState.errors.level && (
                <p className="text-sm text-red-500">{form.formState.errors.level.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => {
                  const selected = STATUS_OPTIONS.find((o) => o.value === field.value) ?? null;
                  return (
                    <SearchableSelect<typeof STATUS_OPTIONS[number]>
                      items={[...STATUS_OPTIONS]}
                      value={selected}
                      onValueChange={(item) => field.onChange(item?.value)}
                      getItemLabel={(o) => o.label}
                      getItemId={(o) => o.value}
                      placeholder="Select status"
                      disabled={isLoading}
                    />
                  );
                }}
              />
              {form.formState.errors.status && (
                <p className="text-sm text-red-500">{form.formState.errors.status.message}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dayOfWeek">Day of Week</Label>
              <Controller
                control={form.control}
                name="dayOfWeek"
                render={({ field }) => {
                  const selected = DAY_OPTIONS.find((o) => o.value === field.value) ?? DAY_OPTIONS[1];
                  return (
                    <SearchableSelect<typeof DAY_OPTIONS[number]>
                      items={[...DAY_OPTIONS]}
                      value={selected}
                      onValueChange={(item) => field.onChange(item?.value ?? 1)}
                      getItemLabel={(o) => o.label}
                      getItemId={(o) => String(o.value)}
                      placeholder="Select day"
                      disabled={isLoading}
                    />
                  );
                }}
              />
              {form.formState.errors.dayOfWeek && (
                <p className="text-sm text-red-500">{form.formState.errors.dayOfWeek.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="room">Room</Label>
              <Input 
                id="room" 
                {...form.register('room')} 
                disabled={isLoading} 
                placeholder="Room number/name"
              />
              {form.formState.errors.room && (
                <p className="text-sm text-red-500">{form.formState.errors.room.message}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input 
                id="startTime" 
                type="time"
                {...form.register('startTime')} 
                disabled={isLoading} 
              />
              {form.formState.errors.startTime && (
                <p className="text-sm text-red-500">{form.formState.errors.startTime.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input 
                id="endTime" 
                type="time"
                {...form.register('endTime')} 
                disabled={isLoading} 
              />
              {form.formState.errors.endTime && (
                <p className="text-sm text-red-500">{form.formState.errors.endTime.message}</p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subjectId">Subject</Label>
            <Controller
              control={form.control}
              name="subjectId"
              render={({ field }) => {
                const subjectItems = [
                  { id: 'none', long_name: 'None' },
                  ...(subjects ?? []),
                ];
                const selected =
                  field.value && field.value !== 'none'
                    ? subjects?.find((s) => s.id === field.value) ?? null
                    : subjectItems[0];
                return (
                  <SearchableSelect<{ id: string; long_name?: string | null }>
                    items={subjectItems}
                    value={selected}
                    onValueChange={(item) =>
                      field.onChange(item?.id === 'none' ? null : item?.id ?? null)
                    }
                    getItemLabel={(s) => s?.long_name ?? 'None'}
                    getItemId={(s) => s.id}
                    placeholder="Select subject"
                    disabled={isLoading}
                  />
                );
              }}
            />
            {form.formState.errors.subjectId && (
              <p className="text-sm text-red-500">{form.formState.errors.subjectId.message}</p>
            )}
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
        <>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
            <div className="text-sm font-medium">Day:</div>
            <div className="min-w-0">{getDayOfWeek(classData.day_of_week)}</div>
            
            <div className="text-sm font-medium">Time:</div>
            <div className="min-w-0">
              {formatTime(classData.start_time)} - {formatTime(classData.end_time)}
            </div>
            
            <div className="text-sm font-medium">Status:</div>
            <div className="min-w-0">
              <ClassStatusBadge value={classData.status as 'ACTIVE' | 'INACTIVE' | 'FULL' | null} />
            </div>
            
            <div className="text-sm font-medium">Subject:</div>
            <div className="min-w-0">
              {subject ? formatSubjectDisplay(subject) : 'None'}
            </div>
            
            <div className="text-sm font-medium">Room:</div>
            <div className="min-w-0">{classData.room || '-'}</div>
          </div>
          
          
        </>
      )}
    </div>
  );
}

export { classInfoSchema };
export type { FormData as ClassInfoFormData }; 