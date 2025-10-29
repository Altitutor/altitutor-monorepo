import { useState } from 'react';
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@altitutor/ui";
import { Checkbox } from "@altitutor/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { Separator } from "@altitutor/ui";
import type { Tables, Enums } from "@altitutor/shared";
import { StudentStatusBadge } from "@altitutor/ui";
import { Pencil, X, Check, Loader2, Plus } from 'lucide-react';
import { getSubjectCurriculumColor, getStudentStatusColor, getSubjectIcon } from '@/shared/utils';

export interface DetailsFormData {
  // Student details
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  school?: string;
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
  // Subjects props
  studentSubjects?: Tables<'subjects'>[];
  loadingSubjects?: boolean;
  onAddSubject?: () => void;
  onRemoveSubject?: (subjectId: string) => void;
  onViewSubject?: (subjectId: string) => void;
}

export function DetailsTab({
  student,
  isEditing,
  isLoading,
  onEdit,
  onCancelEdit,
  onSubmit,
  studentSubjects = [],
  loadingSubjects = false,
  onAddSubject,
  onRemoveSubject,
  onViewSubject
}: DetailsTabProps) {
  const [formData, setFormData] = useState<DetailsFormData>({
    firstName: student.first_name || '',
    lastName: student.last_name || '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    email: (student as any).email || (student as any).student_email || '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    phone: (student as any).phone || (student as any).student_phone || '',
    school: student.school || '',
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
    return (
      <div className="space-y-6 pb-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Student Details Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Student Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Student Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="school">School</Label>
                <Input
                  id="school"
                  value={formData.school}
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

              
            </CardContent>
          </Card>

          {/* Availability Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancelEdit} disabled={isLoading}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // View mode
  return (
    <div className="space-y-6 pb-6">
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
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <div>{(student as any).email || (student as any).student_email || '-'}</div>
        
        <div className="text-sm font-medium">Student Phone:</div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <div>{(student as any).phone || (student as any).student_phone || '-'}</div>
        
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

      {/* Subjects Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Subjects</h3>
          {onAddSubject && (
            <Button variant="outline" size="sm" onClick={onAddSubject}>
              <Plus className="h-4 w-4 mr-2" />
              Add Subject
            </Button>
          )}
        </div>
        
        {loadingSubjects ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : studentSubjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subjects assigned to this student</p>
        ) : (
          <div className="space-y-2">
            {studentSubjects.map((subject) => {
              const Icon = getSubjectIcon(subject.discipline);
              const subjectDisplay = [
                subject.curriculum,
                subject.year_level ? `Year ${subject.year_level}` : '',
                subject.name
              ].filter(Boolean).join(' ');
              
              return (
                <div
                  key={subject.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onViewSubject?.(subject.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{subjectDisplay}</div>
                      {subject.level && (
                        <p className="text-xs text-muted-foreground">{subject.level}</p>
                      )}
                    </div>
                  </div>
                  {onRemoveSubject && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSubject(subject.id);
                      }}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
} 