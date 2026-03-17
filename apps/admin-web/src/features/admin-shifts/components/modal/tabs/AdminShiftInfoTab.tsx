import { useState, useEffect, useRef } from 'react';
import type { Tables } from '@altitutor/shared';
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { SearchableSelect } from "@altitutor/ui";
import { Alert, AlertDescription, AlertTitle } from "@altitutor/ui";
import { Pencil, AlertTriangle } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatTime, getDayOfWeek } from '@/shared/utils/datetime';
import { sessionsApi } from '@/features/sessions/api/sessions';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

// Form schema for admin shift details
const STATUS_OPTIONS = [
  { value: 'ACTIVE' as const, label: 'Active' },
  { value: 'INACTIVE' as const, label: 'Inactive' },
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

const adminShiftInfoSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  sessionStartDate: z.string().optional().nullable(),
  sessionEndDate: z.string().optional().nullable(),
}).refine((data) => {
  // Validate that end date is after start date if both are provided
  if (data.sessionStartDate && data.sessionEndDate) {
    return new Date(data.sessionStartDate) <= new Date(data.sessionEndDate);
  }
  return true;
}, {
  message: 'Session end date must be after or equal to start date',
  path: ['sessionEndDate'],
}).refine((data) => {
  // Validate that end time is after start time
  if (data.startTime && data.endTime) {
    return data.endTime > data.startTime;
  }
  return true;
}, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export type AdminShiftInfoFormData = z.infer<typeof adminShiftInfoSchema>;

interface AdminShiftInfoTabProps {
  adminShiftData: Tables<'admin_shifts'>;
  isEditing: boolean;
  isLoading: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmit: (data: AdminShiftInfoFormData) => Promise<void>;
}

export function AdminShiftInfoTab({
  adminShiftData,
  isEditing,
  isLoading,
  onEdit,
  onCancelEdit: _onCancelEdit,
  onSubmit,
}: AdminShiftInfoTabProps) {
  const form = useForm<AdminShiftInfoFormData>({
    resolver: zodResolver(adminShiftInfoSchema),
    defaultValues: {
      dayOfWeek: 1,
      startTime: '',
      endTime: '',
      status: 'ACTIVE' as const,
      sessionStartDate: null,
      sessionEndDate: null,
    },
  });

  const hasResetRef = useRef(false);
  const [editKey, setEditKey] = useState(0);

  // Fetch future sessions for this admin shift when editing
  const { data: futureSessionsData } = useQuery({
    queryKey: ['adminShiftFutureSessions', adminShiftData.id, isEditing],
    queryFn: async () => {
      const now = new Date();
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      const result = await sessionsApi.getAllSessionsWithDetails({
        rangeStart: now.toISOString().split('T')[0],
        rangeEnd: endOfYear.toISOString().split('T')[0],
      });
      // Filter to only sessions for this admin shift
      return result.sessions.filter(session => session.admin_shift_id === adminShiftData.id);
    },
    enabled: isEditing && !!adminShiftData.id,
    staleTime: 1000 * 60 * 2,
  });

  const futureSessions = futureSessionsData || [];

  // Reset form values when entering edit mode
  useEffect(() => {
    if (isEditing && !hasResetRef.current && adminShiftData) {
      const dayValue = adminShiftData.day_of_week != null ? adminShiftData.day_of_week : 1;
      form.reset({
        dayOfWeek: dayValue,
        startTime: adminShiftData.start_time || '',
        endTime: adminShiftData.end_time || '',
        status: adminShiftData.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        sessionStartDate: adminShiftData.session_start_date || null,
        sessionEndDate: adminShiftData.session_end_date || null,
      }, {
        keepDefaultValues: false
      });
      form.setValue('dayOfWeek', dayValue, { shouldValidate: false });
      hasResetRef.current = true;
      setEditKey(prev => prev + 1);
    } else if (!isEditing) {
      hasResetRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, adminShiftData?.id]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return isEditing ? (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto">
        <form 
          id="admin-shift-edit-form" 
          onSubmit={form.handleSubmit(onSubmit)} 
          className="space-y-6"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
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
            
            <div>
              <Label htmlFor="dayOfWeek">Day of Week</Label>
              <Controller
                key={`dayOfWeek-${editKey}`}
                control={form.control}
                name="dayOfWeek"
                render={({ field }) => {
                  const fieldValue = field.value != null ? field.value : (adminShiftData?.day_of_week != null ? adminShiftData.day_of_week : 1);
                  const selected = DAY_OPTIONS.find((o) => o.value === fieldValue) ?? DAY_OPTIONS[1];
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
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startTime">Start Time *</Label>
              <Controller
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <Input 
                    id="startTime" 
                    type="time"
                    {...field}
                    disabled={isLoading} 
                    required
                  />
                )}
              />
              {form.formState.errors.startTime && (
                <p className="text-sm text-red-500">{form.formState.errors.startTime.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="endTime">End Time *</Label>
              <Controller
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <Input 
                    id="endTime" 
                    type="time"
                    {...field}
                    disabled={isLoading} 
                    required
                  />
                )}
              />
              {form.formState.errors.endTime && (
                <p className="text-sm text-red-500">{form.formState.errors.endTime.message}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sessionStartDate">Session Start Date (Optional)</Label>
              <Controller
                control={form.control}
                name="sessionStartDate"
                render={({ field }) => (
                  <Input 
                    id="sessionStartDate" 
                    type="date"
                    {...field}
                    value={field.value || ''}
                    disabled={isLoading} 
                  />
                )}
              />
              {form.formState.errors.sessionStartDate && (
                <p className="text-sm text-red-500">{form.formState.errors.sessionStartDate.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="sessionEndDate">Session End Date (Optional)</Label>
              <Controller
                control={form.control}
                name="sessionEndDate"
                render={({ field }) => (
                  <Input 
                    id="sessionEndDate" 
                    type="date"
                    {...field}
                    value={field.value || ''}
                    min={form.watch('sessionStartDate') || undefined}
                    disabled={isLoading} 
                  />
                )}
              />
              {form.formState.errors.sessionEndDate && (
                <p className="text-sm text-red-500">{form.formState.errors.sessionEndDate.message}</p>
              )}
            </div>
          </div>

          {futureSessions.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Future Sessions</AlertTitle>
              <AlertDescription>
                There are {futureSessions.length} future sessions for this admin shift. 
                Changing the day, time, or dates will affect these sessions.
              </AlertDescription>
            </Alert>
          )}
        </form>
      </div>
    </div>
  ) : (
    // View mode - format like ClassInfoTab
    <div className="space-y-6 pb-6 flex-1 overflow-y-auto px-1 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Admin Shift Information</h3>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="text-sm font-medium">Day:</div>
        <div>{getDayOfWeek(adminShiftData.day_of_week)}</div>
        
        <div className="text-sm font-medium">Time:</div>
        <div>
          {formatTime(adminShiftData.start_time)} - {formatTime(adminShiftData.end_time)}
        </div>
        
        <div className="text-sm font-medium">Status:</div>
        <div>
          <Badge className={getStatusBadgeColor(adminShiftData.status)}>
            {adminShiftData.status}
          </Badge>
        </div>
        
        <div className="text-sm font-medium">Session Start Date:</div>
        <div>
          {adminShiftData.session_start_date 
            ? format(new Date(adminShiftData.session_start_date), 'MMM d, yyyy')
            : adminShiftData.created_at 
              ? format(new Date(adminShiftData.created_at), 'MMM d, yyyy')
              : 'Not set'}
        </div>
        
        <div className="text-sm font-medium">Session End Date:</div>
        <div>
          {adminShiftData.session_end_date 
            ? format(new Date(adminShiftData.session_end_date), 'MMM d, yyyy')
            : adminShiftData.created_at
              ? `Dec 31, ${new Date(adminShiftData.created_at).getFullYear()}`
              : 'Not set'}
        </div>
      </div>
    </div>
  );
}
