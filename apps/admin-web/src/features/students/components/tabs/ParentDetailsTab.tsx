'use client';

import { useState } from 'react';
import { Separator } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import type { Tables } from "@altitutor/shared";
import { StudentCard } from '@/shared/components/StudentCard';
import { Loader2, Pencil, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '../../api/students';
import { PhoneInput } from '@/shared/components/PhoneInput';

export interface ParentDetailsFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface ParentDetailsTabProps {
  parent: Tables<'parents'>;
  studentIds: string[];
  students: Tables<'students'>[];
  onViewStudent?: (studentId: string) => void;
  isEditing?: boolean;
  isLoading?: boolean;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  onSubmit?: (data: ParentDetailsFormData) => void;
  // Students props for edit mode
  parentStudents?: Tables<'students'>[];
  onRemoveStudent?: (studentId: string) => void;
  addStudentButton?: React.ReactNode;
}

export function ParentDetailsTab({
  parent,
  studentIds,
  students,
  onViewStudent,
  isEditing = false,
  isLoading: _isLoading = false,
  onEdit,
  onCancelEdit: _onCancelEdit,
  onSubmit,
  parentStudents = [],
  onRemoveStudent,
  addStudentButton,
}: ParentDetailsTabProps) {
  // Fetch subjects for all students in a single query
  const displayStudents = isEditing ? parentStudents : students;
  const displayStudentIds = isEditing ? parentStudents.map(s => s.id) : studentIds;
  
  const { data: detailsData, isLoading: isLoadingSubjects } = useQuery({
    queryKey: ['parent-students-subjects', displayStudentIds.sort().join(',')],
    queryFn: () => studentsApi.getDetailsForStudentIds(displayStudentIds),
    enabled: displayStudentIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const studentSubjects = detailsData?.studentSubjects || {};

  const [formData, setFormData] = useState<ParentDetailsFormData>({
    firstName: parent.first_name || '',
    lastName: parent.last_name || '',
    email: parent.email || '',
    phone: parent.phone || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(formData);
  };

  const handleInputChange = (field: keyof ParentDetailsFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isEditing) {
    return (
      <div className="flex-1 overflow-y-auto">
        <form id="parent-edit-form" onSubmit={handleSubmit} className="space-y-6">
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <PhoneInput
                value={formData.phone || ''}
                onChange={(value) => handleInputChange('phone', value)}
              />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Students Section */}
          <div>
            <Label>Students</Label>
            <div className="space-y-2 mt-2">
              {displayStudents.length > 0 ? (
                <>
                  {displayStudents.map((student) => (
                    <div key={student.id} className="flex items-center gap-2">
                      <div className="flex-1">
                        <StudentCard
                          student={student}
                          subjects={studentSubjects[student.id] || []}
                          onClick={() => onViewStudent?.(student.id)}
                        />
                      </div>
                      {onRemoveStudent && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveStudent(student.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No students associated with this parent</p>
              )}
              {addStudentButton}
            </div>
          </div>
        </form>
      </div>
    );
  }

  // View mode
  return (
    <div className="space-y-6 pb-6 flex-1 overflow-y-auto px-1">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Parent Information</h3>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="text-sm font-medium">First Name:</div>
        <div>{parent.first_name || '-'}</div>
        
        <div className="text-sm font-medium">Last Name:</div>
        <div>{parent.last_name || '-'}</div>
        
        <div className="text-sm font-medium">Email:</div>
        <div>{parent.email || '-'}</div>
        
        <div className="text-sm font-medium">Phone:</div>
        <div>{parent.phone || '-'}</div>
      </div>

      <Separator className="my-6" />

      {/* Students Section */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Students</h3>
        {isLoadingSubjects ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayStudents.length > 0 ? (
          <div className="space-y-2">
            {displayStudents.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                subjects={studentSubjects[student.id] || []}
                onClick={() => onViewStudent?.(student.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No students associated with this parent</p>
        )}
      </div>
    </div>
  );
}

