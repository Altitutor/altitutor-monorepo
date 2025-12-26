import { useState, useEffect, useRef } from 'react';
import type { Tables } from '@altitutor/shared';
import { Badge } from "@altitutor/ui";
import { StaffRoleBadge, StaffStatusBadge } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import { Checkbox } from "@altitutor/ui";
import { PhoneInput } from "@altitutor/ui";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import { Loader2, Pencil, Trash2, X, Copy, Check, Mail, UserPlus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatSubjectShortName, getSubjectColorStyle } from '@/shared/utils';
import { useToast } from "@altitutor/ui";
import { SendInviteDialog } from '../SendInviteDialog';

// Form schema for staff details
const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phoneNumber: z
    .string()
    .regex(/^\+?[0-9]{10,14}$/, 'Invalid phone number format')
    .optional()
    .nullish(),
  role: z.enum(['TUTOR','ADMINSTAFF']),
  status: z.enum(['ACTIVE','INACTIVE','TRIAL']),
  officeKeyNumber: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/).transform(Number),
    z.literal('').transform(() => null),
    z.null()
  ]).optional(),
  hasParkingRemote: z.enum(['VIRTUAL', 'PHYSICAL', 'NONE']).nullable().optional(),
  
  // Availability checkboxes
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

interface StaffDetailsTabProps {
  staffMember: Tables<'staff'>;
  isEditing: boolean;
  isLoading: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  onDelete?: () => void;
  isDeleting?: boolean;
  // Subjects props
  staffSubjects?: Tables<'subjects'>[];
  loadingSubjects?: boolean;
  onRemoveSubject?: (subjectId: string) => void;
  onViewSubject?: (subjectId: string) => void;
  addSubjectButton?: React.ReactNode;
  // Account props
  isLoadingAccount?: boolean;
  hasPasswordResetLinkSent?: boolean;
  onPasswordResetRequest?: () => Promise<void>;
}

export function StaffDetailsTab({
  staffMember,
  isEditing,
  isLoading,
  onEdit,
  onCancelEdit: _onCancelEdit,
  onSubmit,
  onDelete,
  isDeleting = false,
  staffSubjects = [],
  loadingSubjects: _loadingSubjects = false,
  onRemoveSubject,
  onViewSubject,
  addSubjectButton,
  isLoadingAccount = false,
  hasPasswordResetLinkSent = false,
  onPasswordResetRequest
}: StaffDetailsTabProps) {
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const { toast } = useToast();
  const form = useForm<FormData>({
    // @ts-expect-error - Type mismatch due to duplicate react-hook-form types in node_modules
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      role: staffMember?.role === 'TUTOR' || staffMember?.role === 'ADMINSTAFF' ? staffMember.role : undefined,
      status: staffMember?.status === 'ACTIVE' || staffMember?.status === 'INACTIVE' || staffMember?.status === 'TRIAL' ? staffMember.status : undefined,
      officeKeyNumber: null,
      hasParkingRemote: 'NONE' as const,
      availability_monday: false,
      availability_tuesday: false,
      availability_wednesday: false,
      availability_thursday: false,
      availability_friday: false,
      availability_saturday_am: false,
      availability_saturday_pm: false,
      availability_sunday_am: false,
      availability_sunday_pm: false,
    },
  });

  const hasResetRef = useRef(false);

  // Reset form values when entering edit mode - only once per edit session
  useEffect(() => {
    if (isEditing && !hasResetRef.current) {
      // Ensure role and status are properly set - they must be valid enum values
      const role: 'TUTOR' | 'ADMINSTAFF' = (staffMember.role === 'TUTOR' || staffMember.role === 'ADMINSTAFF') 
        ? staffMember.role 
        : 'TUTOR'; // Default to TUTOR if invalid
      const status: 'ACTIVE' | 'INACTIVE' | 'TRIAL' = (staffMember.status === 'ACTIVE' || staffMember.status === 'INACTIVE' || staffMember.status === 'TRIAL') 
        ? staffMember.status 
        : 'ACTIVE'; // Default to ACTIVE if invalid
      
      console.log('[StaffDetailsTab] Resetting form with values:', {
        role,
        status,
        staffMemberRole: staffMember.role,
        staffMemberStatus: staffMember.status
      });
      
      const resetValues: FormData = {
        firstName: staffMember.first_name || '',
        lastName: staffMember.last_name || '',
        email: staffMember.email || '',
        phoneNumber: staffMember.phone_number || '',
        role,
        status,
        officeKeyNumber: staffMember.office_key_number || null,
        hasParkingRemote: ((staffMember.has_parking_remote === 'VIRTUAL' || staffMember.has_parking_remote === 'PHYSICAL' || staffMember.has_parking_remote === 'NONE') ? staffMember.has_parking_remote : 'NONE') as 'VIRTUAL' | 'PHYSICAL' | 'NONE' | null,
        availability_monday: !!staffMember.availability_monday,
        availability_tuesday: !!staffMember.availability_tuesday,
        availability_wednesday: !!staffMember.availability_wednesday,
        availability_thursday: !!staffMember.availability_thursday,
        availability_friday: !!staffMember.availability_friday,
        availability_saturday_am: !!staffMember.availability_saturday_am,
        availability_saturday_pm: !!staffMember.availability_saturday_pm,
        availability_sunday_am: !!staffMember.availability_sunday_am,
        availability_sunday_pm: !!staffMember.availability_sunday_pm,
      };
      console.log('[StaffDetailsTab] Calling form.reset with values:', resetValues);
      form.reset(resetValues);
      // Force a re-render by getting values after reset
      setTimeout(() => {
        console.log('[StaffDetailsTab] Form values after reset:', form.getValues());
      }, 0);
      hasResetRef.current = true;
    } else if (!isEditing) {
      // Reset the flag when exiting edit mode
      hasResetRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, staffMember.id, staffMember.role, staffMember.status]); // Include role and status in deps

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    console.log('[StaffDetailsTab] Form submit event triggered', e);
    e.preventDefault();
    console.log('[StaffDetailsTab] Calling form.handleSubmit');
    console.log('[StaffDetailsTab] Form state:', {
      isValid: form.formState.isValid,
      errors: form.formState.errors,
      values: form.getValues()
    });
    const result = form.handleSubmit(
      (data) => {
        console.log('[StaffDetailsTab] Form validation passed, data:', data);
        onSubmit(data as unknown as FormData);
      },
      (errors) => {
        console.error('[StaffDetailsTab] Form validation failed, errors:', errors);
        // Show error toast with validation errors
        const errorMessages = Object.entries(errors).map(([field, error]) => {
          if (error && typeof error === 'object' && 'message' in error) {
            return `${field}: ${error.message}`;
          }
          return `${field}: Invalid value`;
        }).join('\n');
        
        toast({
          title: 'Validation Error',
          description: `Please fix the following errors:\n${errorMessages}`,
          variant: 'destructive',
        });
      }
    );
    result(e);
  };

  return isEditing ? (
    <>
      <div className="flex-1 overflow-y-auto">
        <form 
          id="staff-edit-form" 
          onSubmit={handleFormSubmit} 
          className="space-y-6"
        >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Controller
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <Input 
                        id="firstName" 
                        {...field}
                        disabled={isLoading} 
                        required
                      />
                    )}
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-sm text-red-500">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Controller
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <Input 
                        id="lastName" 
                        {...field}
                        disabled={isLoading} 
                        required
                      />
                    )}
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-sm text-red-500">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Controller
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <Input 
                        id="email" 
                        type="email" 
                        {...field}
                        disabled={isLoading} 
                      />
                    )}
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Controller
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <PhoneInput
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        disabled={isLoading}
                        error={form.formState.errors.phoneNumber?.message}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="officeKeyNumber">Office Key Number</Label>
                  <Controller
                    control={form.control}
                    name="officeKeyNumber"
                    render={({ field }) => (
                      <Input
                        id="officeKeyNumber"
                        type="number"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(value === '' || value === null || value === undefined ? null : parseInt(value, 10));
                        }}
                        disabled={isLoading}
                        placeholder="Enter key number"
                      />
                    )}
                  />
                  {form.formState.errors.officeKeyNumber && (
                    <p className="text-sm text-red-500">{form.formState.errors.officeKeyNumber.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="hasParkingRemote">Parking Remote</Label>
                  <Controller
                    control={form.control}
                    name="hasParkingRemote"
                    render={({ field }) => (
                      <Select
                        disabled={isLoading}
                        value={field.value || 'NONE'}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="hasParkingRemote">
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VIRTUAL">Virtual</SelectItem>
                          <SelectItem value="PHYSICAL">Physical</SelectItem>
                          <SelectItem value="NONE">None</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {form.formState.errors.hasParkingRemote && (
                    <p className="text-sm text-red-500">{form.formState.errors.hasParkingRemote.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Controller
                    control={form.control}
                    name="role"
                    render={({ field }) => {
                      // Ensure we always pass a valid string or undefined (not empty string)
                      const selectValue = field.value && (field.value === 'TUTOR' || field.value === 'ADMINSTAFF') ? field.value : undefined;
                      console.log('[StaffDetailsTab] Role Select render - field.value:', field.value, 'selectValue:', selectValue);
                      return (
                      <Select 
                        disabled={isLoading}
                        value={selectValue}
                        onValueChange={(value) => {
                          console.log('[StaffDetailsTab] Role changed to:', value);
                          field.onChange(value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={'TUTOR'}>Tutor</SelectItem>
                          <SelectItem value={'ADMINSTAFF'}>Admin Staff</SelectItem>
                        </SelectContent>
                      </Select>
                      );
                    }}
                  />
                </div>
                
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Controller
                    control={form.control}
                    name="status"
                    render={({ field }) => {
                      // Ensure we always pass a valid string or undefined (not empty string)
                      const selectValue = field.value && (field.value === 'ACTIVE' || field.value === 'INACTIVE' || field.value === 'TRIAL') ? field.value : undefined;
                      console.log('[StaffDetailsTab] Status Select render - field.value:', field.value, 'selectValue:', selectValue);
                      return (
                      <Select 
                        disabled={isLoading}
                        value={selectValue}
                        onValueChange={(value) => {
                          console.log('[StaffDetailsTab] Status changed to:', value);
                          field.onChange(value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={'ACTIVE'}>Active</SelectItem>
                          <SelectItem value={'INACTIVE'}>Inactive</SelectItem>
                          <SelectItem value={'TRIAL'}>Trial</SelectItem>
                        </SelectContent>
                      </Select>
                      );
                    }}
                  />
                </div>
              </div>

              {/* Subjects Field */}
              <div>
                <Label>Subjects</Label>
                <div className="space-y-2">
                  {staffSubjects.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {staffSubjects.map((subject) => {
                        const shortName = formatSubjectShortName(subject);
                        const { style, textColorClass } = getSubjectColorStyle(subject);
                        const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                        return (
                          <Badge
                            key={subject.id}
                            className={defaultClass || `${textColorClass} cursor-pointer hover:opacity-80 flex items-center gap-1 pr-1`}
                            style={style.backgroundColor ? style : undefined}
                            onClick={(e) => {
                              // Don't trigger view if clicking the X button
                              if ((e.target as HTMLElement).closest('.remove-subject-btn')) {
                                return;
                              }
                              onViewSubject?.(subject.id);
                            }}
                          >
                            <span>{shortName}</span>
                            {onRemoveSubject && (
                              <button
                                type="button"
                                className="remove-subject-btn ml-1 rounded-full hover:bg-black/20 p-0.5 flex items-center justify-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveSubject(subject.id);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  {addSubjectButton}
                </div>
              </div>

              <Separator className="my-6" />

              {/* Availability Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Availability</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-medium">Weekdays</h4>
                    {[
                      { key: 'availability_monday', label: 'Monday' },
                      { key: 'availability_tuesday', label: 'Tuesday' },
                      { key: 'availability_wednesday', label: 'Wednesday' },
                      { key: 'availability_thursday', label: 'Thursday' },
                      { key: 'availability_friday', label: 'Friday' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Controller
                          control={form.control}
                          name={key as keyof FormData}
                          render={({ field }) => (
                            <Checkbox 
                              id={key} 
                              checked={field.value as boolean}
                              onCheckedChange={field.onChange}
                              disabled={isLoading}
                            />
                          )}
                        />
                        <Label htmlFor={key}>{label}</Label>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Weekends</h4>
                    {[
                      { key: 'availability_saturday_am', label: 'Saturday AM' },
                      { key: 'availability_saturday_pm', label: 'Saturday PM' },
                      { key: 'availability_sunday_am', label: 'Sunday AM' },
                      { key: 'availability_sunday_pm', label: 'Sunday PM' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Controller
                          control={form.control}
                          name={key as keyof FormData}
                          render={({ field }) => (
                            <Checkbox 
                              id={key} 
                              checked={field.value as boolean}
                              onCheckedChange={field.onChange}
                              disabled={isLoading}
                            />
                          )}
                        />
                        <Label htmlFor={key}>{label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Account Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Account</h3>
                {!staffMember.user_id ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      This staff member does not have an associated user account yet. Send them an invite to create one.
                    </p>
                    
                    <Button
                      variant="default"
                      onClick={() => setInviteDialogOpen(true)}
                      className="justify-start w-fit"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Send Invite
                    </Button>

                    <SendInviteDialog
                      isOpen={inviteDialogOpen}
                      onClose={() => setInviteDialogOpen(false)}
                      staffMember={staffMember}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Send a password reset link to this staff member's email address.
                    </p>
                    
                    <div className="flex flex-col space-y-3">
                      <Button
                        variant="outline"
                        onClick={onPasswordResetRequest}
                        disabled={isLoadingAccount || hasPasswordResetLinkSent || !staffMember.email}
                        className="justify-start w-fit"
                      >
                        {isLoadingAccount ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending reset link...
                          </>
                        ) : hasPasswordResetLinkSent ? (
                          <>
                            <Mail className="mr-2 h-4 w-4" />
                            Reset link sent
                          </>
                        ) : (
                          <>
                            <Mail className="mr-2 h-4 w-4" />
                            Send password reset email
                          </>
                        )}
                      </Button>

                      {!staffMember.email && (
                        <p className="text-sm text-orange-600">
                          No email address set. Please add an email above.
                        </p>
                      )}
                    </div>
                    
                    {hasPasswordResetLinkSent && (
                      <p className="text-sm text-green-600">
                        A password reset link has been sent to {staffMember.email}.
                        The staff member needs to check their email to set a new password.
                      </p>
                    )}
                  </div>
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
                          Delete Staff Member
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the staff member
                            "{staffMember.first_name} {staffMember.last_name}" and all associated data from the database.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-4">
                          <div className="space-y-2">
                            <Label>
                              Type <strong>{staffMember.first_name} {staffMember.last_name}</strong> to confirm deletion
                            </Label>
                            <Input
                              type="text"
                              placeholder={`${staffMember.first_name} ${staffMember.last_name}`}
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
                            disabled={isDeleting || deleteConfirmText !== `${staffMember.first_name} ${staffMember.last_name}`}
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
            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1}>
              Submit
            </button>
            </form>
          </div>
    </>
  ) : (
    <div className="space-y-6 pb-6 flex-1 overflow-y-auto px-1">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Staff Information</h3>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      {(() => {
        const handleCopy = async (text: string, field: string) => {
          if (!text || text === '-') return;
          try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            toast({
              title: 'Copied!',
              description: 'Copied to clipboard',
            });
            setTimeout(() => setCopiedField(null), 2000);
          } catch (error) {
            toast({
              title: 'Failed to copy',
              description: 'Please try again',
              variant: 'destructive',
            });
          }
        };

        const TruncatedText = ({ text, className = '' }: { text: string; className?: string }) => {
          const displayText = text || '-';
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`truncate ${className}`} title={displayText}>
                    {displayText}
                  </div>
                </TooltipTrigger>
                {displayText !== '-' && (
                  <TooltipContent>
                    <p>{displayText}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          );
        };

        return (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="text-sm font-medium">First Name:</div>
            <div>
              <TruncatedText text={staffMember.first_name || '-'} />
            </div>
            
            <div className="text-sm font-medium">Last Name:</div>
            <div>
              <TruncatedText text={staffMember.last_name || '-'} />
            </div>
            
            <div className="text-sm font-medium">Email:</div>
            <div className="flex items-center gap-2">
              <TruncatedText text={staffMember.email || '-'} className="flex-1 min-w-0" />
              {staffMember.email && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => handleCopy(staffMember.email!, 'email')}
                >
                  {copiedField === 'email' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
            
            <div className="text-sm font-medium">Phone Number:</div>
            <div className="flex items-center gap-2">
              <TruncatedText text={staffMember.phone_number || '-'} className="flex-1 min-w-0" />
              {staffMember.phone_number && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => handleCopy(staffMember.phone_number!, 'phone')}
                >
                  {copiedField === 'phone' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
            
            <div className="text-sm font-medium">Office Key Number:</div>
            <div>
              <TruncatedText text={staffMember.office_key_number?.toString() || '-'} />
            </div>
            
            <div className="text-sm font-medium">Parking Remote:</div>
            <div>
              <TruncatedText text={staffMember.has_parking_remote || 'None'} />
            </div>
            
            <div className="text-sm font-medium">Role:</div>
            <div>
              <StaffRoleBadge value={(staffMember.role === 'ADMIN' || staffMember.role === 'TUTOR' || staffMember.role === 'ADMINSTAFF') ? staffMember.role : null} />
            </div>
            
            <div className="text-sm font-medium">Status:</div>
            <div>
              <StaffStatusBadge value={(staffMember.status === 'ACTIVE' || staffMember.status === 'INACTIVE' || staffMember.status === 'TRIAL') ? staffMember.status : null} />
            </div>
            
            <div className="text-sm font-medium">Subjects:</div>
            <div>
              {staffSubjects.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {staffSubjects.map((subject) => {
                    const shortName = formatSubjectShortName(subject);
                    const { style, textColorClass } = getSubjectColorStyle(subject);
                    const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                    return (
                      <Badge
                        key={subject.id}
                        className={defaultClass || `${textColorClass} cursor-pointer hover:opacity-80`}
                        style={style.backgroundColor ? style : undefined}
                        onClick={() => onViewSubject?.(subject.id)}
                      >
                        {shortName}
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <span className="text-muted-foreground">No subjects assigned</span>
              )}
            </div>
          </div>
        );
      })()}

      <Separator className="my-6" />

      {/* Availability Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Availability</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3">Weekdays</h4>
            <div className="space-y-2">
              {[
                { key: 'availability_monday', label: 'Monday' },
                { key: 'availability_tuesday', label: 'Tuesday' },
                { key: 'availability_wednesday', label: 'Wednesday' },
                { key: 'availability_thursday', label: 'Thursday' },
                { key: 'availability_friday', label: 'Friday' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${staffMember[key as keyof Tables<'staff'>] ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={`text-sm ${staffMember[key as keyof Tables<'staff'>] ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Weekends</h4>
            <div className="space-y-2">
              {[
                { key: 'availability_saturday_am', label: 'Saturday AM' },
                { key: 'availability_saturday_pm', label: 'Saturday PM' },
                { key: 'availability_sunday_am', label: 'Sunday AM' },
                { key: 'availability_sunday_pm', label: 'Sunday PM' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${staffMember[key as keyof Tables<'staff'>] ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={`text-sm ${staffMember[key as keyof Tables<'staff'>] ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Account Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Account</h3>
        {!staffMember.user_id ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This staff member does not have an associated user account yet. Send them an invite to create one.
            </p>
            
            <Button
              variant="default"
              onClick={() => setInviteDialogOpen(true)}
              className="justify-start w-fit"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Send Invite
            </Button>

            <SendInviteDialog
              isOpen={inviteDialogOpen}
              onClose={() => setInviteDialogOpen(false)}
              staffMember={staffMember}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send a password reset link to this staff member's email address.
            </p>
            
            <div className="flex flex-col space-y-3">
              <Button
                variant="outline"
                onClick={onPasswordResetRequest}
                disabled={isLoadingAccount || hasPasswordResetLinkSent || !staffMember.email}
                className="justify-start w-fit"
              >
                {isLoadingAccount ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending reset link...
                  </>
                ) : hasPasswordResetLinkSent ? (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Reset link sent
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send password reset email
                  </>
                )}
              </Button>

              {!staffMember.email && (
                <p className="text-sm text-orange-600">
                  No email address set. Please add an email above.
                </p>
              )}
            </div>
            
            {hasPasswordResetLinkSent && (
              <p className="text-sm text-green-600">
                A password reset link has been sent to {staffMember.email}.
                The staff member needs to check their email to set a new password.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { formSchema };
export type { FormData as StaffDetailsFormData }; 