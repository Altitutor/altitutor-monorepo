import { useState } from 'react';
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
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
import type { Tables } from "@altitutor/shared";
import { Pencil, Loader2, Trash2, X, Copy, Check, UserPlus } from 'lucide-react';
import { PhoneInput } from '@altitutor/ui';
import { ParentCard } from '@/shared/components/ParentCard';
import { useParentStudents } from '../../hooks/useStudentsQuery';
import { SendStudentInviteDialog } from '../SendStudentInviteDialog';
import { AdminPasswordResetSection } from '@/features/auth/components/password-reset/AdminPasswordResetSection';

export interface DetailsFormData {
  // Student details
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthday: string;
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
  studentSubjects: _studentSubjects = [],
  loadingSubjects: _loadingSubjects = false,
  onRemoveSubject: _onRemoveSubject,
  onViewSubject: _onViewSubject,
  addSubjectButton: _addSubjectButton,
  parents = [],
  onViewParent,
  onRemoveParent,
  addParentButton,
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
    birthday: student.birthday || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (field: keyof DetailsFormData, value: string) => {
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
                <Label htmlFor="birthday">Birthday</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={formData.birthday || ''}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => handleInputChange('birthday', e.target.value)}
                />
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
                  
                  // Case 2: No account and not registered -> Send Registration Link
                  if (!hasAccount && !isRegistered) {
                    return (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          This student has not completed registration. Send them a registration link to complete account setup and registration.
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
                  
                  // Case 3: Has account -> Show Reset Password
                  return (
                    <AdminPasswordResetSection
                      userId={student.user_id}
                      email={student.email}
                      userType="student"
                      displayName={`${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || 'Student'}
                      recipients={[
                        {
                          type: 'student',
                          id: student.id,
                          label: `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || 'Student',
                          value: student.phone,
                        },
                        ...parents.map((parent) => ({
                          type: 'parent' as const,
                          id: parent.id,
                          label: `${parent.first_name ?? ''} ${parent.last_name ?? ''}`.trim() || 'Parent',
                          value: parent.phone,
                        })),
                      ]}
                    />
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

        <div className="text-sm font-medium">Birthday:</div>
        <div>
          <TruncatedText text={student.birthday || '-'} />
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
          
          // Case 2: No account and not registered -> Send Registration Link
          if (!hasAccount && !isRegistered) {
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This student has not completed registration. Send them a registration link to complete account setup and registration.
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
          
          // Case 3: Has account -> Show Reset Password
          return (
            <AdminPasswordResetSection
              userId={student.user_id}
              email={student.email}
              userType="student"
              displayName={`${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || 'Student'}
              recipients={[
                {
                  type: 'student',
                  id: student.id,
                  label: `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || 'Student',
                  value: student.phone,
                },
                ...parents.map((parent) => ({
                  type: 'parent' as const,
                  id: parent.id,
                  label: `${parent.first_name ?? ''} ${parent.last_name ?? ''}`.trim() || 'Parent',
                  value: parent.phone,
                })),
              ]}
            />
          );
        })()}
      </div>
    </div>
  );
} 
