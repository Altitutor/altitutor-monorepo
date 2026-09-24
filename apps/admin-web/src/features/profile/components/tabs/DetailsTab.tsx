'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Button } from '@altitutor/ui';
import { PhoneInput } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Textarea } from '@altitutor/ui';
import { Pencil, Loader2 } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { profileApi } from '../../api';
import { useUpdateProfile } from '../../hooks';
import type { Tables } from '@altitutor/shared';
import { z } from 'zod';
import { isValidPhoneNumber } from 'react-phone-number-input';
import { PropertyForm, PropertyFormRow } from '@/shared/components/PropertyForm';

type StaffProfile = Tables<'staff'>;

interface DetailsTabProps {
  profile: StaffProfile;
}

const detailsFormSchema = z.object({
  phone_number: z.string().optional().nullable(),
  profile_bio: z.string().max(1200, 'Bio must be 1200 characters or fewer').optional().nullable(),
});

type DetailsFormData = z.infer<typeof detailsFormSchema>;

export function DetailsTab({ profile }: DetailsTabProps) {
  const { toast } = useToast();
  const updateProfile = useUpdateProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<DetailsFormData>({
    phone_number: profile.phone_number || '',
    profile_bio: profile.profile_bio || '',
  });

  useEffect(() => {
    let cancelled = false;

    profileApi.getProfileImageUrl(profile.profile_image_file_id).then((url) => {
      if (!cancelled) setProfileImageUrl(url);
    }).catch(() => {
      if (!cancelled) setProfileImageUrl(null);
    });

    return () => {
      cancelled = true;
    };
  }, [profile.profile_image_file_id]);

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
      phone_number: profile.phone_number || '',
      profile_bio: profile.profile_bio || '',
    });
    setSelectedImage(null);
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
      let profileImageFileId = profile.profile_image_file_id;
      if (selectedImage) {
        const uploadedImage = await profileApi.uploadProfileImage(profile.id, selectedImage);
        profileImageFileId = uploadedImage.id;
      }

      await updateProfile.mutateAsync({
        phone_number: formData.phone_number || undefined,
        profile_bio: formData.profile_bio?.trim() || null,
        profile_image_file_id: profileImageFileId,
      });
      
      setIsEditing(false);
      setSelectedImage(null);
    } catch (error) {
      // Error handling is done in the mutation
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

        <form onSubmit={handleSubmit}>
          <PropertyForm>
            <PropertyFormRow label="Phone number">
              <PhoneInput
                value={formData.phone_number || ''}
                onChange={handlePhoneChange}
              />
            </PropertyFormRow>
            <PropertyFormRow label="Public profile picture" htmlFor="profile-image">
              <input
                id="profile-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setSelectedImage(event.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
              />
            </PropertyFormRow>
            <PropertyFormRow label="Public bio" htmlFor="profile-bio" valueClassName="space-y-1">
              <Textarea
                id="profile-bio"
                value={formData.profile_bio || ''}
                onChange={(event) => handleInputChange('profile_bio', event.target.value)}
                rows={6}
                placeholder="Short public bio for the About page"
              />
              <p className="text-xs text-muted-foreground">
                Plain text. Use blank lines for paragraph breaks.
              </p>
            </PropertyFormRow>
          </PropertyForm>
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

      <PropertyForm>
        <PropertyFormRow label="Profile picture">
          <div>
            {profileImageUrl ? (
              <Image
                src={profileImageUrl}
                alt={`${profile.first_name} ${profile.last_name}`}
                width={80}
                height={80}
                className="h-20 w-20 rounded-full object-cover"
                unoptimized
              />
            ) : (
              '-'
            )}
          </div>
        </PropertyFormRow>
        <PropertyFormRow label="First name">
          <TruncatedText text={profile.first_name || '-'} />
        </PropertyFormRow>
        <PropertyFormRow label="Last name">
          <TruncatedText text={profile.last_name || '-'} />
        </PropertyFormRow>
        <PropertyFormRow label="Email">
          <TruncatedText text={profile.email || '-'} />
        </PropertyFormRow>
        <PropertyFormRow label="Phone number">
          <TruncatedText text={profile.phone_number || '-'} />
        </PropertyFormRow>
        <PropertyFormRow label="Public bio">
          <div className="whitespace-pre-wrap text-sm">
            {profile.profile_bio || '-'}
          </div>
        </PropertyFormRow>
        <PropertyFormRow label="Role">
          <div>
            {profile.role ? (
              <Badge variant="outline">{profile.role}</Badge>
            ) : (
              '-'
            )}
          </div>
        </PropertyFormRow>
      </PropertyForm>
    </div>
  );
}



