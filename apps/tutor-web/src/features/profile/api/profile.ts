import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { uploadStaffProfileImage } from '@/shared/lib/supabase/storage';
import type { Database } from '@altitutor/shared';
import type { TablesInsert } from '@altitutor/shared';

type TutorProfile = Database['public']['Views']['vtutor_profile']['Row'];
type StaffRow = Database['public']['Tables']['staff']['Row'];

export interface TutorProfileUpdate {
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

  uploadProfileImage: async (staffId: string, file: File): Promise<StaffRow['profile_image_file_id']> => {
    const supabase = getSupabaseClient();
    const { path } = await uploadStaffProfileImage({ staffId, file });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

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
      created_by: staffId,
    };

    const { data: created, error } = await supabase
      .from('files')
      .insert(fileData)
      .select('id')
      .single();

    if (error || !created) {
      try {
        await supabase.storage.from('staff-profile-images').remove([path]);
      } catch (cleanupError) {
        console.error('Failed to cleanup profile image after file insert error:', cleanupError);
      }
      throw error ?? new Error('Failed to create profile image record');
    }

    return created.id;
  }
};
