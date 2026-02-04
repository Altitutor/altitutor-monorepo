'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { PhoneInput } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Pencil, Loader2 } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { useUpdateProfile } from '../../hooks';
import type { Database } from '@altitutor/shared';
import { z } from 'zod';
import { isValidPhoneNumber } from 'react-phone-number-input';

type TutorProfile = Database['public']['Views']['vtutor_profile']['Row'];

interface DetailsTabProps {
  profile: TutorProfile;
}

const detailsFormSchema = z.object({
  phone_number: z.string().optional().nullable(),
});

type DetailsFormData = z.infer<typeof detailsFormSchema>;

export function DetailsTab({ profile }: DetailsTabProps) {
  const { toast } = useToast();
  const updateProfile = useUpdateProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<DetailsFormData>({
    phone_number: profile.phone || '',
  });

  const handleInputChange = (field: keyof DetailsFormData, value: string | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhoneChange = (value: string) => {
    handleInputChange('phone_number', value || null);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData({
      phone_number: profile.phone || '',
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
    if (formData.phone_number && !isValidPhoneNumber(formData.phone_number)) {
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
        phone_number: formData.phone_number || undefined,
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
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Personal Information</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelEdit}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <PhoneInput
              value={formData.phone_number || ''}
              onChange={handlePhoneChange}
            />
          </div>
        </form>
      </div>
    );
  }

  // View mode
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Personal Information</h3>
        <Button variant="outline" size="sm" onClick={handleStartEdit}>
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
        
        <div className="text-sm font-medium">Email:</div>
        <div>
          <TruncatedText text={profile.email || '-'} />
        </div>
        
        <div className="text-sm font-medium">Phone Number:</div>
        <div>
          <TruncatedText text={profile.phone || '-'} />
        </div>
        
        <div className="text-sm font-medium">Role:</div>
        <div>
          {profile.role ? (
            <Badge variant="outline">{profile.role}</Badge>
          ) : (
            '-'
          )}
        </div>
      </div>
    </div>
  );
}

