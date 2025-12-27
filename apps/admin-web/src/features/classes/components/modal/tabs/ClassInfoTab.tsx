import { useState, useEffect, useRef } from 'react';
import type { Tables } from '@altitutor/shared';
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { Separator } from "@altitutor/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@altitutor/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@altitutor/ui";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getSubjectColorStyle } from "@/shared/utils";
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

interface ClassInfoTabProps {
  classData: Tables<'classes'>;
  subject?: Tables<'subjects'> | null;
  subjects: Tables<'subjects'>[];
  isEditing: boolean;
  isLoading: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  onDelete?: () => void;
  isDeleting?: boolean;
}

export function ClassInfoTab({
  classData,
  subject,
  subjects,
  isEditing,
  isLoading,
  onEdit,
  onCancelEdit: _onCancelEdit,
  onSubmit,
  onDelete,
  isDeleting = false
}: ClassInfoTabProps) {
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(classInfoSchema),
    defaultValues: {
      level: '',
      dayOfWeek: 1,
      startTime: '',
      endTime: '',
      status: 'ACTIVE' as const,
      subjectId: '',
      room: '',
    },
  });

  const hasResetRef = useRef(false);
  const [editKey, setEditKey] = useState(0);

  // Reset form values when entering edit mode - only once per edit session
  useEffect(() => {
    if (isEditing && !hasResetRef.current && classData) {
      const dayValue = classData.day_of_week != null ? classData.day_of_week : 1;
      form.reset({
        level: classData.level || '',
        dayOfWeek: dayValue,
        startTime: classData.start_time || '',
        endTime: classData.end_time || '',
        status: (classData.status as any) || 'ACTIVE',
        subjectId: classData.subject_id ?? undefined,
        room: classData.room || '',
      }, {
        keepDefaultValues: false
      });
      // Explicitly set dayOfWeek to ensure it's set correctly
      form.setValue('dayOfWeek', dayValue, { shouldValidate: false });
      hasResetRef.current = true;
      setEditKey(prev => prev + 1); // Force re-render of Select
    } else if (!isEditing) {
      // Reset the flag when exiting edit mode
      hasResetRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, classData?.id]); // form is stable, don't include it

  return isEditing ? (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto">
        <form 
          id="class-edit-form" 
          onSubmit={form.handleSubmit(onSubmit)} 
          className="space-y-6"
        >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="level">Level *</Label>
                  <Controller
                    control={form.control}
                    name="level"
                    render={({ field }) => (
                      <Input 
                        id="level" 
                        {...field}
                        disabled={isLoading} 
                        placeholder="e.g., "
                        required
                      />
                    )}
                  />
                  {form.formState.errors.level && (
                    <p className="text-sm text-red-500">{form.formState.errors.level.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Controller
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <Select 
                        disabled={isLoading}
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={'ACTIVE'}>Active</SelectItem>
                          <SelectItem value={'INACTIVE'}>Inactive</SelectItem>
                          <SelectItem value={'FULL'}>Full</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {form.formState.errors.status && (
                    <p className="text-sm text-red-500">{form.formState.errors.status.message}</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dayOfWeek">Day of Week</Label>
                  <Controller
                    key={`dayOfWeek-${editKey}`}
                    control={form.control}
                    name="dayOfWeek"
                    render={({ field }) => {
                      // Ensure value is always a valid number, default to classData value if available
                      const fieldValue = field.value != null ? field.value : (classData?.day_of_week != null ? classData.day_of_week : 1);
                      const selectValue = String(fieldValue);
                      return (
                        <Select 
                          disabled={isLoading}
                          value={selectValue}
                          onValueChange={(value) => field.onChange(parseInt(value, 10))}
                        >
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
                      );
                    }}
                  />
                  {form.formState.errors.dayOfWeek && (
                    <p className="text-sm text-red-500">{form.formState.errors.dayOfWeek.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="room">Room</Label>
                  <Controller
                    control={form.control}
                    name="room"
                    render={({ field }) => (
                      <Input 
                        id="room" 
                        {...field}
                        disabled={isLoading} 
                        placeholder="Room number/name"
                      />
                    )}
                  />
                  {form.formState.errors.room && (
                    <p className="text-sm text-red-500">{form.formState.errors.room.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Controller
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <Input 
                        id="startTime" 
                        type="time"
                        {...field}
                        disabled={isLoading} 
                      />
                    )}
                  />
                  {form.formState.errors.startTime && (
                    <p className="text-sm text-red-500">{form.formState.errors.startTime.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Controller
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <Input 
                        id="endTime" 
                        type="time"
                        {...field}
                        disabled={isLoading} 
                      />
                    )}
                  />
                  {form.formState.errors.endTime && (
                    <p className="text-sm text-red-500">{form.formState.errors.endTime.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="subjectId">Subject</Label>
                <Controller
                  key={`subjectId-${editKey}`}
                  control={form.control}
                  name="subjectId"
                  render={({ field }) => (
                    <Select 
                      disabled={isLoading}
                      value={field.value || "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {subjects?.map((subj) => (
                          <SelectItem key={subj.id} value={subj.id}>
                            {formatSubjectDisplay(subj)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.subjectId && (
                  <p className="text-sm text-red-500">{form.formState.errors.subjectId.message}</p>
                )}
              </div>

              {onDelete && (
                <>
                  <Separator className="my-6" />
                  <div className="pt-4">
                    <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
                      setIsDeleteDialogOpen(open);
                      if (!open) {
                        setDeleteConfirmText('');
                      }
                    }}>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" type="button" className="flex items-center w-full">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Class
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the class
                            "{classData.level}" and all associated data from the database.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-4">
                          <div className="space-y-2">
                            <Label>
                              Type <strong>{classData.level}</strong> to confirm deletion
                            </Label>
                            <Input
                              type="text"
                              placeholder={classData.level || undefined}
                              value={deleteConfirmText}
                              onChange={(e) => setDeleteConfirmText(e.target.value)}
                              className="mt-2"
                            />
                          </div>
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => {
                              if (onDelete) {
                                onDelete();
                                setIsDeleteDialogOpen(false);
                                setDeleteConfirmText('');
                              }
                            }}
                            disabled={isDeleting || deleteConfirmText !== classData.level}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isDeleting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              'Delete'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </>
              )}
            </form>
          </div>
    </div>
  ) : (
    // View mode
    <div className="space-y-6 pb-6 flex-1 overflow-y-auto px-1 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Class Information</h3>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="text-sm font-medium">Level:</div>
        <div>{classData.level || '-'}</div>
        
        <div className="text-sm font-medium">Day:</div>
        <div>{getDayOfWeek(classData.day_of_week)}</div>
        
        <div className="text-sm font-medium">Time:</div>
        <div>
          {formatTime(classData.start_time)} - {formatTime(classData.end_time)}
        </div>
        
        <div className="text-sm font-medium">Status:</div>
        <div>
          <ClassStatusBadge value={classData.status as any} />
        </div>
        
        <div className="text-sm font-medium">Subject:</div>
        <div>
          {subject ? (() => {
            const { style, textColorClass } = getSubjectColorStyle(subject);
            const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
            return (
              <Badge 
                className={defaultClass || textColorClass}
                style={style.backgroundColor ? style : undefined}
              >
                {formatSubjectDisplay(subject)}
              </Badge>
            );
          })() : (
            '-'
          )}
        </div>
        
        <div className="text-sm font-medium">Room:</div>
        <div>{classData.room || '-'}</div>
      </div>
    </div>
  );
}

export { classInfoSchema };
export type { FormData as ClassInfoFormData };
