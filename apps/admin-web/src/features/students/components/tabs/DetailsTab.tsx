import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Student, StudentStatus, SubjectCurriculum } from "@/shared/lib/supabase/database/types";
import { StudentStatusBadge } from "@/components/ui/enum-badge";
import { Pencil, X, Check, Loader2 } from 'lucide-react';

export interface DetailsFormData {
  // Student details
  firstName: string;
  lastName: string;
  studentEmail?: string;
  studentPhone?: string;
  school?: string;
  curriculum?: SubjectCurriculum;
  yearLevel?: number;
  status: StudentStatus;
  notes?: string;
  
  // Parent details
  parentFirstName?: string;
  parentLastName?: string;
  parentEmail?: string;
  parentPhone?: string;
  
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
  student: Student;
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
    firstName: student.firstName || '',
    lastName: student.lastName || '',
    studentEmail: student.studentEmail || '',
    studentPhone: student.studentPhone || '',
    school: student.school || '',
    curriculum: (student.curriculum as SubjectCurriculum) || undefined,
    yearLevel: student.yearLevel || undefined,
    status: student.status || StudentStatus.TRIAL,
    notes: student.notes || '',
    parentFirstName: student.parentFirstName || '',
    parentLastName: student.parentLastName || '',
    parentEmail: student.parentEmail || '',
    parentPhone: student.parentPhone || '',
    availability_monday: student.availabilityMonday || false,
    availability_tuesday: student.availabilityTuesday || false,
    availability_wednesday: student.availabilityWednesday || false,
    availability_thursday: student.availabilityThursday || false,
    availability_friday: student.availabilityFriday || false,
    availability_saturday_am: student.availabilitySaturdayAm || false,
    availability_saturday_pm: student.availabilitySaturdayPm || false,
    availability_sunday_am: student.availabilitySundayAm || false,
    availability_sunday_pm: student.availabilitySundayPm || false,
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
                  <Label htmlFor="studentEmail">Student Email</Label>
                  <Input
                    id="studentEmail"
                    type="email"
                    value={formData.studentEmail}
                    onChange={(e) => handleInputChange('studentEmail', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="studentPhone">Student Phone</Label>
                  <Input
                    id="studentPhone"
                    value={formData.studentPhone}
                    onChange={(e) => handleInputChange('studentPhone', e.target.value)}
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
                    onValueChange={(value) => handleInputChange('curriculum', value as SubjectCurriculum)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select curriculum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SubjectCurriculum.SACE}>SACE</SelectItem>
                      <SelectItem value={SubjectCurriculum.IB}>IB</SelectItem>
                      <SelectItem value={SubjectCurriculum.PRESACE}>PRESACE</SelectItem>
                      <SelectItem value={SubjectCurriculum.PRIMARY}>PRIMARY</SelectItem>
                      <SelectItem value={SubjectCurriculum.MEDICINE}>MEDICINE</SelectItem>
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
                  onValueChange={(value) => handleInputChange('status', value as StudentStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={StudentStatus.ACTIVE}>Active</SelectItem>
                    <SelectItem value={StudentStatus.INACTIVE}>Inactive</SelectItem>
                    <SelectItem value={StudentStatus.TRIAL}>Trial</SelectItem>
                    <SelectItem value={StudentStatus.DISCONTINUED}>Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Parent Details Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Parent Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="parentFirstName">Parent First Name</Label>
                  <Input
                    id="parentFirstName"
                    value={formData.parentFirstName}
                    onChange={(e) => handleInputChange('parentFirstName', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="parentLastName">Parent Last Name</Label>
                  <Input
                    id="parentLastName"
                    value={formData.parentLastName}
                    onChange={(e) => handleInputChange('parentLastName', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="parentEmail">Parent Email</Label>
                  <Input
                    id="parentEmail"
                    type="email"
                    value={formData.parentEmail}
                    onChange={(e) => handleInputChange('parentEmail', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="parentPhone">Parent Phone</Label>
                  <Input
                    id="parentPhone"
                    value={formData.parentPhone}
                    onChange={(e) => handleInputChange('parentPhone', e.target.value)}
                  />
                </div>
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
              <p className="text-sm">{student.firstName || '-'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Last Name</Label>
              <p className="text-sm">{student.lastName || '-'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Student Email</Label>
              <p className="text-sm">{student.studentEmail || '-'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Student Phone</Label>
              <p className="text-sm">{student.studentPhone || '-'}</p>
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
                {student.yearLevel ? (
                  <Badge variant="secondary">Year {student.yearLevel}</Badge>
                ) : (
                  '-'
                )}
              </p>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-muted-foreground">Status</Label>
            <div className="mt-1">
              <StudentStatusBadge value={student.status} />
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

      {/* Parent Details Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Parent Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Parent First Name</Label>
              <p className="text-sm">{student.parentFirstName || '-'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Parent Last Name</Label>
              <p className="text-sm">{student.parentLastName || '-'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Parent Email</Label>
              <p className="text-sm">{student.parentEmail || '-'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Parent Phone</Label>
              <p className="text-sm">{student.parentPhone || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                  { key: 'availabilityMonday', label: 'Monday' },
                  { key: 'availabilityTuesday', label: 'Tuesday' },
                  { key: 'availabilityWednesday', label: 'Wednesday' },
                  { key: 'availabilityThursday', label: 'Thursday' },
                  { key: 'availabilityFriday', label: 'Friday' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${student[key as keyof Student] ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className={`text-sm ${student[key as keyof Student] ? 'text-foreground' : 'text-muted-foreground'}`}>
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
                  { key: 'availabilitySaturdayAm', label: 'Saturday AM' },
                  { key: 'availabilitySaturdayPm', label: 'Saturday PM' },
                  { key: 'availabilitySundayAm', label: 'Sunday AM' },
                  { key: 'availabilitySundayPm', label: 'Sunday PM' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${student[key as keyof Student] ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className={`text-sm ${student[key as keyof Student] ? 'text-foreground' : 'text-muted-foreground'}`}>
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