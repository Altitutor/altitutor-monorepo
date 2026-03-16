'use client';

import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { PhoneInput } from '@altitutor/ui';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, UserPlus, Loader2, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { staffKeys } from '@/features/staff/hooks/useStaffQuery';
import { staffApi } from '@/features/staff/api/staff';
import { useCreateStaff } from '@/features/staff/hooks/useStaffQuery';
import { StaffCard } from '@/shared/components/StaffCard';
import type { Tables, TablesInsert } from '@altitutor/shared';

const createStaffFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phoneNumber: z
    .union([
      z.string().regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number format'),
      z.literal(''),
      z.null(),
    ])
    .transform((val) => (val === '' ? null : val))
    .optional()
    .nullable(),
});

type CreateStaffFormValues = z.infer<typeof createStaffFormSchema>;

export interface StaffIntervieweeStepProps {
  staffSearch: string;
  onStaffSearchChange: (value: string) => void;
  selectedIntervieweeId: string;
  onSelectInterviewee: (id: string) => void;
  isCreatingStaff: boolean;
  onToggleCreateStaff: () => void;
  onIntervieweeCreated: (staffId: string) => void;
}

export function StaffIntervieweeStep({
  staffSearch,
  onStaffSearchChange,
  selectedIntervieweeId,
  onSelectInterviewee,
  isCreatingStaff,
  onToggleCreateStaff,
  onIntervieweeCreated,
}: StaffIntervieweeStepProps) {
  const createStaffMutation = useCreateStaff();

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: staffKeys.minimal({
      search: staffSearch,
      statuses: ['TRIAL'],
      limit: 20,
    }),
    queryFn: () =>
      staffApi.listMinimal({
        search: staffSearch,
        statuses: ['TRIAL'],
        limit: 20,
      }),
    enabled: !isCreatingStaff,
  });

  const staffList = staffData?.staff ?? [];

  const form = useForm<CreateStaffFormValues>({
    resolver: zodResolver(createStaffFormSchema) as Resolver<CreateStaffFormValues>,
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
    },
  });

  const handleCreateStaff = form.handleSubmit(async (formData) => {
    const staffData: TablesInsert<'staff'> = {
      id: crypto.randomUUID(),
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email || null,
      phone_number: formData.phoneNumber || null,
      role: 'TUTOR',
      status: 'TRIAL',
      user_id: null,
      office_key_number: null,
      has_parking_remote: 'NONE',
      availability_monday: false,
      availability_tuesday: false,
      availability_wednesday: false,
      availability_thursday: false,
      availability_friday: false,
      availability_saturday_am: false,
      availability_saturday_pm: false,
      availability_sunday_am: false,
      availability_sunday_pm: false,
      drafting_availability: false,
      trial_session_availability: false,
      subsidy_interview_availability: false,
    };

    const createdStaff = await createStaffMutation.mutateAsync(staffData);

    form.reset();
    onIntervieweeCreated(createdStaff.id);
    onToggleCreateStaff();
  });

  if (isCreatingStaff) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Create new staff member (candidate)</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleCreateStaff}
          >
            Cancel
          </Button>
        </div>

        <form onSubmit={handleCreateStaff} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                {...form.register('firstName')}
                disabled={createStaffMutation.isPending}
              />
              {form.formState.errors.firstName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                {...form.register('lastName')}
                disabled={createStaffMutation.isPending}
              />
              {form.formState.errors.lastName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                disabled={createStaffMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Controller
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <PhoneInput
                    value={field.value || ''}
                    onChange={field.onChange}
                    disabled={createStaffMutation.isPending}
                    error={form.formState.errors.phoneNumber?.message}
                  />
                )}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={createStaffMutation.isPending}
          >
            {createStaffMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create & Select
              </>
            )}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Search for a TRIAL staff member (candidate) or create a new one
      </p>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff..."
            value={staffSearch}
            onChange={(e) => onStaffSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            onClick={onToggleCreateStaff}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create new
          </Button>
        </div>
      </div>

      {staffLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : staffList.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground text-center">
          No TRIAL staff found. Create a new staff member instead.
        </p>
      ) : (
        <div className="space-y-2">
          {staffList.map((staffMember) => (
            <StaffCard
              key={staffMember.id}
              staff={staffMember as Tables<'staff'>}
              subjects={[]}
              showSubjects={false}
              showActions={false}
              isSelecting
              isSelected={selectedIntervieweeId === staffMember.id}
              onClick={() => onSelectInterviewee(staffMember.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
