import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface UpdatePasswordRequest {
  password: string;
}

/**
 * Shared auth API for cross-feature use (e.g. profile password update).
 * Avoids cross-feature imports from auth feature.
 */
export const sharedAuthApi = {
  /**
   * Update password for authenticated user
   */
  updatePassword: async (data: UpdatePasswordRequest) => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('You must be logged in to update your password.');
    }

    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (updateError) {
      if (updateError.message.includes('same as the old password')) {
        throw new Error('New password must be different from your current password.');
      }
      if (updateError.message.includes('password')) {
        throw new Error(
          'Password does not meet security requirements. Please choose a stronger password.'
        );
      }
      throw new Error(updateError.message || 'Failed to update password. Please try again.');
    }

    if (!updateData.user) {
      throw new Error('Failed to update password. Please try again.');
    }

    return {
      message: 'Password updated successfully',
      user: updateData.user,
    };
  },
};
