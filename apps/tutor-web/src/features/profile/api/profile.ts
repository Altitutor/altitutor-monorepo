import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import {
  DEFAULT_PROFILE_IMAGE_CROP,
  normalizeProfileImageCrop,
  type ProfileImageCrop,
} from '../types/profile-image';

type TutorProfile = Database['public']['Views']['vtutor_profile']['Row'];
type StaffRow = Database['public']['Tables']['staff']['Row'];

export interface ProfileImageData {
  url: string | null;
  crop: ProfileImageCrop;
}

export interface TutorProfileUpdate {
  phone_number?: string;
  birthday?: string | null;
  profile_bio?: string | null;
  profile_image_file_id?: string | null;
  // Availability fields (individual days)
  availability_monday?: boolean;
  availability_tuesday?: boolean;
  availability_wednesday?: boolean;
  availability_thursday?: boolean;
  availability_friday?: boolean;
  availability_saturday_am?: boolean;
  availability_saturday_pm?: boolean;
  availability_sunday_am?: boolean;
  availability_sunday_pm?: boolean;
}

export const profileApi = {
  /**
   * Get profile from vtutor_profile view
   * Pattern: Read through views (client-side), Write through API routes (server-side)
   */
  getProfile: async (): Promise<TutorProfile | null> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vtutor_profile')
      .select('*')
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Update profile (via API route)
   */
  updateProfile: async (updates: TutorProfileUpdate): Promise<StaffRow> => {
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update profile');
    }

    const result = await response.json();
    return result.data as StaffRow;
  },

  getProfileImage: async (fileId: string | null | undefined): Promise<ProfileImageData> => {
    if (!fileId) return { url: null, crop: DEFAULT_PROFILE_IMAGE_CROP };
    const response = await fetch(`/api/profile/image?fileId=${encodeURIComponent(fileId)}`);
    if (!response.ok) throw new Error('Failed to load profile image');
    const result = await response.json() as { url: string | null; crop?: unknown };
    return { url: result.url, crop: normalizeProfileImageCrop(result.crop) };
  },

  uploadProfileImage: async (
    _staffId: string,
    file: File,
    crop: ProfileImageCrop,
  ): Promise<StaffRow['profile_image_file_id']> => {
    const form = new FormData();
    form.set('file', file);
    form.set('crop', JSON.stringify(crop));
    const response = await fetch('/api/profile/image', { method: 'POST', body: form });
    if (!response.ok) throw new Error('Failed to upload profile image');
    const result = await response.json() as { fileId: string };
    return result.fileId;
  },

  updateProfileImageCrop: async (fileId: string, crop: ProfileImageCrop): Promise<void> => {
    const response = await fetch('/api/profile/image', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, crop }),
    });
    if (!response.ok) throw new Error('Failed to update profile picture crop');
  }
};
