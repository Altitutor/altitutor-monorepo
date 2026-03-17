import { useState } from 'react';
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import { SearchableSelect } from "@altitutor/ui";
import { Checkbox } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { Separator } from "@altitutor/ui";
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
  useToast,
} from "@altitutor/ui";
import type { Tables, Enums } from "@altitutor/shared";
import { Pencil, Loader2, Trash2, X, Copy, Check, Mail, UserPlus } from 'lucide-react';
import { getSubjectColorStyle, getSubjectCurriculumColor, getStudentStatusColor } from '@/shared/utils';
import { PhoneInput } from '@altitutor/ui';
import { ParentCard } from '@/shared/components/ParentCard';
import { useParentStudents } from '../../hooks/useStudentsQuery';
import { SendStudentInviteDialog } from '../SendStudentInviteDialog';

const CURRICULUM_OPTIONS = [
  { value: 'SACE' as const, label: 'SACE' },
  { value: 'IB' as const, label: 'IB' },
  { value: 'PRESACE' as const, label: 'PRESACE' },
  { value: 'PRIMARY' as const, label: 'PRIMARY' },
  { value: 'MEDICINE' as const, label: 'MEDICINE' },
] as const;

export interface DetailsFormData {
  // Student details
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  school: string;
  curriculum?: Enums<'subject_curriculum'>;
  yearLevel?: number;
  status: Tables<'students'>['status'];
  
  // Availability
  availability_monday: boolean;
  availability_tuesday: boolean;
  availability_wednesday: boolean;
  availability_thursday: boolean;
  availability_friday: boolean;
  availability_saturday_am: boolean;
  availability_saturday_pm: boolean;
  availability_sunday_am: boolean;
  availability_sunday_pm: boolean;
}

interface DetailsTabProps {
  student: Tables<'students'>;
  isEditing: boolean;
  isLoading: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmit: (data: DetailsFormData) => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  // Subjects props
  studentSubjects?: Tables<'subjects'>[];
  loadingSubjects?: boolean;
  onRemoveSubject?: (subjectId: string) => void;
  onViewSubject?: (subjectId: string) => void;
  addSubjectButton?: React.ReactNode;
  // Parents props
  parents?: Tables<'parents'>[];
  onViewParent?: (parentId: string) => void;
  onRemoveParent?: (parentId: string) => void;
  addParentButton?: React.ReactNode;
  // Account props
  isLoadingAccount?: boolean;
  hasPasswordResetLinkSent?: boolean;
  onPasswordResetRequest?: () => Promise<void>;
}

export function DetailsTab({
  student,
  isEditing,
  isLoading: _isLoading,
  onEdit,
  onCancelEdit: _onCancelEdit,
  onSubmit,
  onDelete,
  isDeleting = false,
  studentSubjects = [],
  loadingSubjects: _loadingSubjects = false,
  onRemoveSubject,
  onViewSubject: _onViewSubject,
  addSubjectButton,
  parents = [],
  onViewParent,
  onRemoveParent,
  addParentButton,
  isLoadingAccount = false,
  hasPasswordResetLinkSent = false,
  onPasswordResetRequest,
}: DetailsTabProps) {
  // Fetch students for each parent using React Query
  const parentIds = parents.map(p => p.id);
  const { data: parentStudents = {} } = useParentStudents(parentIds, !isEditing && parents.length > 0);
  const { toast } = useToast();

  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteDialogType, setInviteDialogType] = useState<'invite' | 'registration'>('invite');

  const [formData, setFormData] = useState<DetailsFormData>({
    firstName: student.first_name || '',
    lastName: student.last_name || '',
    email: student.email || '',
    phone: student.phone || '',
    school: (student.school || '') as string,
    curriculum: (student.curriculum as Enums<'subject_curriculum'>) || undefined,
    yearLevel: student.year_level || undefined,
    status: student.status,
    availability_monday: !!student.availability_monday,
    availability_tuesday: !!student.availability_tuesday,
    availability_wednesday: !!student.availability_wednesday,
    availability_thursday: !!student.availability_thursday,
    availability_friday: !!student.availability_friday,
    availability_saturday_am: !!student.availability_saturday_am,
    availability_saturday_pm: !!student.availability_saturday_pm,
    availability_sunday_am: !!student.availability_sunday_am,
    availability_sunday_pm: !!student.availability_sunday_pm,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (field: keyof DetailsFormData, value: string | number | boolean | Enums<'subject_curriculum'> | Tables<'students'>['status'] | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isEditing) {
    const studentFullName = `${student.first_name} ${student.last_name}`;
    
    return (
      <>
        <div className="flex-1 overflow-y-auto">
          <form id="student-edit-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Student Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Student Phone</Label>
                  <PhoneInput
                    value={formData.phone || ''}
                    onChange={(value) => handleInputChange('phone', value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="school">School</Label>
                <Input
                  id="school"
                  value={formData.school || ''}
                  onChange={(e) => handleInputChange('school', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="curriculum">Curriculum</Label>
                  <SearchableSelect<(typeof CURRICULUM_OPTIONS)[number]>
                    items={[...CURRICULUM_OPTIONS]}
                    value={CURRICULUM_OPTIONS.find((c) => c.value === formData.curriculum) ?? null}
                    onValueChange={(item) =>
                      handleInputChange('curriculum', (item?.value ?? '') as Enums<'subject_curriculum'>)
                    }
                    getItemLabel={(o) => o.label}
                    getItemId={(o) => o.value}
                    placeholder="Select curriculum"
                  />
                </div>
                <div>
                  <Label htmlFor="yearLevel">Year Level</Label>
                  <Input
                    id="yearLevel"
                    type="number"
                    min="1"
                    max="13"
                    value={formData.yearLevel || ''}
                    onChange={(e) => handleInputChange('yearLevel', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </div>
              </div>


              {/* Subjects Field */}
              <div>
                <Label>Subjects</Label>
                <div className="space-y-2">
                  {studentSubjects.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {studentSubjects.map((subject) => {
                        const shortName = subject?.short_name ?? subject?.long_name ?? subject?.name ?? '';
                        const { style, textColorClass } = getSubjectColorStyle(subject);
                        const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                        return (
                          <Badge
                            key={subject.id}
                            className={defaultClass || `${textColorClass} flex items-center gap-1 pr-1`}
                            style={style.backgroundColor ? style : undefined}
                          >
                            <span>{shortName}</span>
                            {onRemoveSubject && (
                              <button
                                type="button"
                                className="ml-1 rounded-full hover:bg-black/20 p-0.5 flex items-center justify-center"
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

              {/* Parents Section */}
              <div>
                <Label>Parents</Label>
                <div className="space-y-2 mt-2">
                  {parents.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {parents.map((parent) => (
                        <div key={parent.id} className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="cursor-pointer hover:opacity-80 flex items-center gap-1 pr-1"
                            onClick={() => onViewParent?.(parent.id)}
                          >
                            <span>{parent.first_name} {parent.last_name}</span>
                            {onRemoveParent && (
                              <button
                                type="button"
                                className="remove-parent-btn ml-1 rounded-full hover:bg-black/20 p-0.5 flex items-center justify-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveParent(parent.id);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No parents assigned to this student</p>
                  )}
                  {addParentButton}
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
                        <Checkbox
                          id={key}
                          checked={formData[key as keyof DetailsFormData] as boolean}
                          onCheckedChange={(checked) => handleInputChange(key as keyof DetailsFormData, checked)}
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
                        <Checkbox
                          id={key}
                          checked={formData[key as keyof DetailsFormData] as boolean}
                          onCheckedChange={(checked) => handleInputChange(key as keyof DetailsFormData, checked)}
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
                {(() => {
                  const isRegistered = student.status === 'ACTIVE';
                  const hasAccount = !!student.user_id;
                  
                  // Case 1: Registered but no account -> Send Invite
                  if (isRegistered && !hasAccount) {
                    return (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          This student has completed registration but does not have an associated user account yet. Send them an invite to create one.
                        </p>
                        
                        <Button
                          variant="default"
                          onClick={() => {
                            setInviteDialogType('invite');
                            setInviteDialogOpen(true);
                          }}
                          className="justify-start w-fit"
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Send Invite
                        </Button>

                        <SendStudentInviteDialog
                          isOpen={inviteDialogOpen}
                          onClose={() => setInviteDialogOpen(false)}
                          student={student}
                          linkType={inviteDialogType}
                        />
                      </div>
                    );
                  }
                  
                  // Case 2 & 3: Has account but not registered OR no account and not registered -> Send Registration Link
                  if ((hasAccount && !isRegistered) || (!hasAccount && !isRegistered)) {
                    return (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          {hasAccount 
                            ? 'This student has an account but has not completed registration. Send them a registration link to complete the process.'
                            : 'This student has not completed registration. Send them a registration link to complete account setup and registration.'}
                        </p>
                        
                        <Button
                          variant="default"
                          onClick={() => {
                            setInviteDialogType('registration');
                            setInviteDialogOpen(true);
                          }}
                          className="justify-start w-fit"
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Send Registration Link
                        </Button>

                        <SendStudentInviteDialog
                          isOpen={inviteDialogOpen}
                          onClose={() => setInviteDialogOpen(false)}
                          student={student}
                          linkType={inviteDialogType}
                        />
                      </div>
                    );
                  }
                  
                  // Case 4: Registered AND has account -> Show Reset Password
                  return (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Send a password reset link to this student's email address.
                      </p>
                      
                      <div className="flex flex-col space-y-3">
                        <Button
                          variant="outline"
                          onClick={onPasswordResetRequest}
                          disabled={isLoadingAccount || hasPasswordResetLinkSent || !student.email}
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
                    
                        {!student.email && (
                          <p className="text-sm text-orange-600">
                            No email address set. Please add a student email above.
                          </p>
                        )}
                      </div>
                    
                      {hasPasswordResetLinkSent && (
                        <p className="text-sm text-green-600">
                          A password reset link has been sent to {student.email}.
                          The student needs to check their email to set a new password.
                        </p>
                      )}
                    </div>
                  );
                })()}
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
                          Delete Student
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the student
                            "{studentFullName}" and all associated data from the database.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-4">
                          <div className="space-y-2">
                            <Label>
                              Type <strong>{studentFullName}</strong> to confirm deletion
                            </Label>
                            <Input
                              type="text"
                              placeholder={studentFullName}
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
                            disabled={isDeleting || deleteConfirmText !== studentFullName}
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
      </>
    );
  }

  // View mode
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
    <div className="space-y-6 pb-6 flex-1 overflow-y-auto px-1">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Student Information</h3>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="text-sm font-medium">First Name:</div>
        <div>
          <TruncatedText text={student.first_name || '-'} />
        </div>
        
        <div className="text-sm font-medium">Last Name:</div>
        <div>
          <TruncatedText text={student.last_name || '-'} />
        </div>
        
        <div className="text-sm font-medium">Student Email:</div>
        <div className="flex items-center gap-2">
          <TruncatedText text={student.email || '-'} className="flex-1 min-w-0" />
          {student.email && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={() => handleCopy(student.email!, 'email')}
            >
              {copiedField === 'email' ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
        
        <div className="text-sm font-medium">Student Phone:</div>
        <div className="flex items-center gap-2">
          <TruncatedText text={student.phone || '-'} className="flex-1 min-w-0" />
          {student.phone && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={() => handleCopy(student.phone!, 'phone')}
            >
              {copiedField === 'phone' ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
        
        <div className="text-sm font-medium">School:</div>
        <div>
          <TruncatedText text={student.school || '-'} />
        </div>
        
        <div className="text-sm font-medium">Curriculum:</div>
        <div>
          {student.curriculum ? (
            <Badge className={getSubjectCurriculumColor(student.curriculum as Enums<'subject_curriculum'>)}>
              {student.curriculum}
            </Badge>
          ) : (
            '-'
          )}
        </div>
        
        <div className="text-sm font-medium">Year Level:</div>
        <div>
          {student.year_level ? (
            <Badge variant="outline">Year {student.year_level}</Badge>
          ) : (
            '-'
          )}
        </div>
        
        <div className="text-sm font-medium">Status:</div>
        <div>
          <Badge className={getStudentStatusColor(student.status as 'ACTIVE' | 'INACTIVE' | 'TRIAL' | 'DISCONTINUED')}>
            {student.status}
          </Badge>
        </div>
        
        <div className="text-sm font-medium">Subjects:</div>
        <div>
          {studentSubjects.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {studentSubjects.map((subject) => {
                const shortName = subject?.short_name ?? subject?.long_name ?? subject?.name ?? '';
                const { style, textColorClass } = getSubjectColorStyle(subject);
                const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                return (
                  <Badge
                    key={subject.id}
                    className={defaultClass || textColorClass}
                    style={style.backgroundColor ? style : undefined}
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
                  <div className={`w-3 h-3 rounded-full ${student[key as keyof Tables<'students'>] ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={`text-sm ${student[key as keyof Tables<'students'>] ? 'text-foreground' : 'text-muted-foreground'}`}>
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
                  <div className={`w-3 h-3 rounded-full ${student[key as keyof Tables<'students'>] ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={`text-sm ${student[key as keyof Tables<'students'>] ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Parents Section */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Parents</h3>
        {parents.length > 0 ? (
          <div className="space-y-2">
            {parents.map((parent) => (
              <ParentCard
                key={parent.id}
                parent={parent}
                students={parentStudents[parent.id] || []}
                onClick={() => onViewParent?.(parent.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No parents assigned to this student</p>
        )}
      </div>

      <Separator className="my-6" />

      {/* Account Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Account</h3>
        {(() => {
          const isRegistered = student.status === 'ACTIVE';
          const hasAccount = !!student.user_id;
          
          // Case 1: Registered but no account -> Send Invite
          if (isRegistered && !hasAccount) {
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This student has completed registration but does not have an associated user account yet. Send them an invite to create one.
                </p>
                
                <Button
                  variant="default"
                  onClick={() => {
                    setInviteDialogType('invite');
                    setInviteDialogOpen(true);
                  }}
                  className="justify-start w-fit"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Send Invite
                </Button>

                <SendStudentInviteDialog
                  isOpen={inviteDialogOpen}
                  onClose={() => setInviteDialogOpen(false)}
                  student={student}
                  linkType={inviteDialogType}
                />
              </div>
            );
          }
          
          // Case 2 & 3: Has account but not registered OR no account and not registered -> Send Registration Link
          if ((hasAccount && !isRegistered) || (!hasAccount && !isRegistered)) {
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {hasAccount 
                    ? 'This student has an account but has not completed registration. Send them a registration link to complete the process.'
                    : 'This student has not completed registration. Send them a registration link to complete account setup and registration.'}
                </p>
                
                <Button
                  variant="default"
                  onClick={() => {
                    setInviteDialogType('registration');
                    setInviteDialogOpen(true);
                  }}
                  className="justify-start w-fit"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Send Registration Link
                </Button>

                <SendStudentInviteDialog
                  isOpen={inviteDialogOpen}
                  onClose={() => setInviteDialogOpen(false)}
                  student={student}
                  linkType={inviteDialogType}
                />
              </div>
            );
          }
          
          // Case 4: Registered AND has account -> Show Reset Password
          return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Send a password reset link to this student's email address.
              </p>
              
              <div className="flex flex-col space-y-3">
                <Button
                  variant="outline"
                  onClick={onPasswordResetRequest}
                  disabled={isLoadingAccount || hasPasswordResetLinkSent || !student.email}
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
            
                {!student.email && (
                  <p className="text-sm text-orange-600">
                    No email address set. Please add a student email above.
                  </p>
                )}
              </div>
            
              {hasPasswordResetLinkSent && (
                <p className="text-sm text-green-600">
                  A password reset link has been sent to {student.email}.
                  The student needs to check their email to set a new password.
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
} 