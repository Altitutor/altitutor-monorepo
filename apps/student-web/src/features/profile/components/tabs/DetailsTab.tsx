'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { PhoneInput } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Pencil, Loader2 } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { useUpdateProfile } from '../../hooks';
import type { Database } from '@altitutor/shared';
import { z } from 'zod';
import { isValidPhoneNumber } from 'react-phone-number-input';
import { studentBtnOutline, studentBtnPrimary } from '@/shared/lib/student-visual';

type StudentProfile = Database['public']['Views']['vstudent_profile']['Row'];

interface DetailsTabProps {
  profile: StudentProfile;
}

const detailsFormSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional().nullable(),
  school: z.string().optional(),
});

type DetailsFormData = z.infer<typeof detailsFormSchema>;

export function DetailsTab({ profile }: DetailsTabProps) {
  const { toast } = useToast();
  const updateProfile = useUpdateProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<DetailsFormData>({
    first_name: profile.first_name || '',
    last_name: profile.last_name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    school: profile.school || '',
  });

  const handleInputChange = (field: keyof DetailsFormData, value: string | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhoneChange = (value: string) => {
    handleInputChange('phone', value || null);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      school: profile.school || '',
    });
    setIsEditing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validation = detailsFormSchema.safeParse(formData);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({
        title: 'Validation Error',
        description: firstError.message,
        variant: 'destructive',
      });
      return;
    }

    // Validate phone separately
    if (formData.phone && !isValidPhoneNumber(formData.phone)) {
      toast({
        title: 'Validation Error',
        description: 'Invalid phone number format',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateProfile.mutateAsync({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        school: formData.school || undefined,
      });
      
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
      
      setIsEditing(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const TruncatedText = ({ text, className = '' }: { text: string; className?: string }) => {
    const displayText = text || '-';
    return (
      <div className={`truncate ${className}`} title={displayText}>
        {displayText}
      </div>
    );
  };

  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-2xl font-semibold">Personal Information</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className={studentBtnOutline}
              onClick={handleCancelEdit}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className={studentBtnPrimary}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.first_name}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.last_name}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
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
                onChange={handlePhoneChange}
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
        </form>
      </div>
    );
  }

  // View mode
  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-2xl font-semibold">Personal Information</h3>
        <Button variant="outline" size="sm" className={studentBtnOutline} onClick={handleStartEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="text-sm font-medium">First Name:</div>
        <div>
          <TruncatedText text={profile.first_name || '-'} />
        </div>
        
        <div className="text-sm font-medium">Last Name:</div>
        <div>
          <TruncatedText text={profile.last_name || '-'} />
        </div>
        
        <div className="text-sm font-medium">Student Email:</div>
        <div>
          <TruncatedText text={profile.email || '-'} />
        </div>
        
        <div className="text-sm font-medium">Student Phone:</div>
        <div>
          <TruncatedText text={profile.phone || '-'} />
        </div>
        
        <div className="text-sm font-medium">School:</div>
        <div>
          <TruncatedText text={profile.school || '-'} />
        </div>
        
        <div className="text-sm font-medium">Curriculum:</div>
        <div>
          {profile.curriculum ? (
            <Badge variant="outline">{profile.curriculum}</Badge>
          ) : (
            '-'
          )}
        </div>
        
        <div className="text-sm font-medium">Year Level:</div>
        <div>
          {profile.year_level ? (
            <Badge variant="outline">Year {profile.year_level}</Badge>
          ) : (
            '-'
          )}
        </div>
      </div>
    </div>
  );
}

