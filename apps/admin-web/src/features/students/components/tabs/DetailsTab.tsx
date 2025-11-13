import { useState } from 'react';
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@altitutor/ui";
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
} from "@altitutor/ui";
import type { Tables, Enums } from "@altitutor/shared";
import { Pencil, Loader2, Trash2, X } from 'lucide-react';
import { getSubjectColorStyle, getSubjectCurriculumColor, getStudentStatusColor, formatSubjectShortName } from '@/shared/utils';
import { PhoneInput } from '@/shared/components/PhoneInput';
import { ParentCard } from '@/shared/components/ParentCard';
import { useParentStudents } from '../../hooks/useStudentsQuery';

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
  onViewSubject,
  addSubjectButton,
  parents = [],
  onViewParent,
  onRemoveParent,
  addParentButton,
}: DetailsTabProps) {
  // Fetch students for each parent using React Query
  const parentIds = parents.map(p => p.id);
  const { data: parentStudents = {} } = useParentStudents(parentIds, !isEditing && parents.length > 0);

  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
                  <Select
                    value={formData.curriculum || ''}
                    onValueChange={(value) => handleInputChange('curriculum', value as Enums<'subject_curriculum'>)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select curriculum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={'SACE'}>SACE</SelectItem>
                      <SelectItem value={'IB'}>IB</SelectItem>
                      <SelectItem value={'PRESACE'}>PRESACE</SelectItem>
                      <SelectItem value={'PRIMARY'}>PRIMARY</SelectItem>
                      <SelectItem value={'MEDICINE'}>MEDICINE</SelectItem>
                    </SelectContent>
                  </Select>
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

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange('status', value as Tables<'students'>['status'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={'ACTIVE'}>Active</SelectItem>
                    <SelectItem value={'INACTIVE'}>Inactive</SelectItem>
                    <SelectItem value={'TRIAL'}>Trial</SelectItem>
                    <SelectItem value={'DISCONTINUED'}>Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Subjects Field */}
              <div>
                <Label>Subjects</Label>
                <div className="space-y-2">
                  {studentSubjects.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {studentSubjects.map((subject) => {
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
        <div>{student.first_name || '-'}</div>
        
        <div className="text-sm font-medium">Last Name:</div>
        <div>{student.last_name || '-'}</div>
        
        <div className="text-sm font-medium">Student Email:</div>
        <div>{student.email || '-'}</div>
        
        <div className="text-sm font-medium">Student Phone:</div>
        <div>{student.phone || '-'}</div>
        
        <div className="text-sm font-medium">School:</div>
        <div>{student.school || '-'}</div>
        
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
    </div>
  );
} 