'use client';
import { EntitySidebarSection } from '@/shared/components/EntitySidebarCard';


import { EmailInput } from '@/shared/components/EmailInput';

import React, { useState } from 'react';
import { Separator } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import type { Tables } from "@altitutor/shared";
import { EntityActionChip as EntityChip } from '@/shared/components/EntityActionChip';
import { TruncatedText } from '@/shared/components/TruncatedText';
import { Pencil, X, Copy, Check } from 'lucide-react';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { PhoneInput } from '@altitutor/ui';
import { PropertyForm, PropertyFormRow } from '@/shared/components/PropertyForm';

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
  studentIds: _studentIds,
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
  // Determine which students to display based on edit mode
  const displayStudents = isEditing ? parentStudents : students;
  // Copy to clipboard functionality
  const { copy, copiedField } = useCopyToClipboard();

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
          <PropertyForm>
            <PropertyFormRow label="First Name *" htmlFor="parent-first-name">
              <Input
                id="parent-first-name"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                required
              />
            </PropertyFormRow>
            <PropertyFormRow label="Last Name *" htmlFor="parent-last-name">
              <Input
                id="parent-last-name"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                required
              />
            </PropertyFormRow>
            <PropertyFormRow label="Email" htmlFor="parent-email">
              <EmailInput
                id="parent-email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </PropertyFormRow>
            <PropertyFormRow label="Phone" htmlFor="parent-phone">
              <PhoneInput
                id="parent-phone"
                value={formData.phone || ''}
                onChange={(value) => handleInputChange('phone', value)}
              />
            </PropertyFormRow>
          </PropertyForm>

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
                        <EntityChip
                          entityType="student"
                entityId={student.id}
                label={`${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() || "Student"}
                                                    onClick={() => onViewStudent?.(student.id)}
                        />
                      </div>
                      {onRemoveStudent && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove student ${student.first_name ?? ""} ${student.last_name ?? ""}`.trim()}
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


  return (
    <div className="space-y-4">
      <div className="flex justify-end">

        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        )}
      </div>
      <EntitySidebarSection title="Parent Information">
      <PropertyForm>
        <PropertyFormRow label="First name">
          <TruncatedText text={parent.first_name || '-'} />
        </PropertyFormRow>
        <PropertyFormRow label="Last name">
          <TruncatedText text={parent.last_name || '-'} />
        </PropertyFormRow>
        <PropertyFormRow label="Email">
          <div className="flex items-center gap-2">
            <TruncatedText text={parent.email || '-'} className="flex-1 min-w-0" />
            {parent.email && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => copy(parent.email!, 'email')}
              >
                {copiedField === 'email' ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </PropertyFormRow>
        <PropertyFormRow label="Phone">
          <div className="flex items-center gap-2">
            <TruncatedText text={parent.phone || '-'} className="flex-1 min-w-0" />
            {parent.phone && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => copy(parent.phone!, 'phone')}
              >
                {copiedField === 'phone' ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </PropertyFormRow>
      </PropertyForm>
      </EntitySidebarSection>

      {/* Students Section */}
      <EntitySidebarSection title="Students">

        {displayStudents.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {displayStudents.map((student) => (
              <EntityChip
                key={student.id}
                entityType="student"
                entityId={student.id}
                label={`${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() || "Student"}
                                onClick={() => onViewStudent?.(student.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No students associated with this parent</p>
        )}
      </EntitySidebarSection>
    </div>
  );
}
