import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { uploadStaffProfileImage, deleteFromBucket } from '@/shared/lib/supabase/storage';
import type { Tables, TablesInsert } from '@altitutor/shared';

type StaffRow = Tables<'staff'>;

const PROFILE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface StaffProfileUpdate {
  phone_number?: string;
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
   * Get current admin staff profile
   * Uses staff table directly (admin staff have direct access)
   */
  getProfile: async (): Promise<StaffRow | null> => {
    const supabase = getSupabaseClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      return null;
    }
    
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Update profile (via API route)
   */
  updateProfile: async (updates: StaffProfileUpdate): Promise<StaffRow> => {
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

  getProfileImageUrl: async (fileId: string | null | undefined): Promise<string | null> => {
    if (!fileId) return null;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('files')
      .select('bucket, storage_path')
      .eq('id', fileId)
      .maybeSingle();

    if (error) throw error;
    if (!data?.bucket || !data.storage_path) return null;

    const { data: urlData } = supabase.storage
      .from(data.bucket)
      .getPublicUrl(data.storage_path);

    return urlData.publicUrl;
  },

  uploadProfileImage: async (staffId: string, file: File): Promise<Tables<'files'>> => {
    if (!PROFILE_IMAGE_MIME_TYPES.has(file.type)) {
      throw new Error('Please choose a JPEG, PNG, or WebP image.');
    }

    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: staff } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { path } = await uploadStaffProfileImage({ staffId, file });

    const fileData: TablesInsert<'files'> = {
      mimetype: file.type,
      filename: file.name,
      size_bytes: file.size,
      metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        purpose: 'staff-profile-image',
      },
      storage_provider: 'supabase',
      bucket: 'staff-profile-images',
      storage_path: path,
      created_by: staff?.id ?? null,
    };

    const { data: created, error } = await supabase
      .from('files')
      .insert(fileData)
      .select()
      .single();

    if (error || !created) {
      try {
        await deleteFromBucket('staff-profile-images', path);
      } catch (cleanupError) {
        console.error('Failed to cleanup profile image after file insert error:', cleanupError);
      }
      throw error ?? new Error('Failed to create profile image record');
    }

    return created as Tables<'files'>;
  }
};




