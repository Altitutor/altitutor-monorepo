import { useState } from 'react';
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import { Textarea } from "@altitutor/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@altitutor/ui";
import { Checkbox } from "@altitutor/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { Separator } from "@altitutor/ui";
import type { Tables, Enums } from "@altitutor/shared";
import { StudentStatusBadge } from "@altitutor/ui";
import { Pencil, X, Check, Loader2 } from 'lucide-react';

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
}

export function DetailsTab({
  student,
  isEditing,
  isLoading,
  onEdit,
  onCancelEdit,
  onSubmit
}: DetailsTabProps) {
  const [formData, setFormData] = useState<DetailsFormData>({
    firstName: student.first_name || '',
    lastName: student.last_name || '',
    email: (student as any).email || (student as any).student_email || '',
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

  const handleInputChange = (field: keyof DetailsFormData, value: any) => {
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
      {/* Student Details Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Student Information</CardTitle>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">First Name</Label>
              <p className="text-sm">{student.first_name || '-'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Last Name</Label>
              <p className="text-sm">{student.last_name || '-'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Student Email</Label>
              <p className="text-sm">{(student as any).email || (student as any).student_email || '-'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Student Phone</Label>
              <p className="text-sm">{(student as any).phone || (student as any).student_phone || '-'}</p>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-muted-foreground">School</Label>
            <p className="text-sm">{student.school || '-'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Curriculum</Label>
              <p className="text-sm">
                {student.curriculum ? (
                  <Badge variant="secondary">{student.curriculum}</Badge>
                ) : (
                  '-'
                )}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Year Level</Label>
              <p className="text-sm">
                {student.year_level ? (
                  <Badge variant="secondary">Year {student.year_level}</Badge>
                ) : (
                  '-'
                )}
              </p>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-muted-foreground">Status</Label>
            <div className="mt-1">
              <StudentStatusBadge value={student.status as any} />
            </div>
          </div>

          {student.notes && (
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Notes</Label>
              <p className="text-sm whitespace-pre-wrap">{student.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Removed Parent Details Section */}

      {/* Availability Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Availability</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
} 