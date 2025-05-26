import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from './types';

/**
 * Admin repository for administrative operations
 * Note: Security is handled by RLS policies, not by this class
 */
export class AdminRepository {
  private getClient() {
    return createClientComponentClient<Database>();
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    const supabase = this.getClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      throw error;
    }
    
    return user;
  }

  /**
   * Check if current user has admin privileges
   * This is determined by RLS policies on the database level
   */
  async checkAdminAccess(): Promise<boolean> {
    const supabase = this.getClient();
    
    try {
      // Try to access an admin-only table/operation
      // If RLS allows it, user has admin access
      const { error } = await supabase
        .from('staff')
        .select('id')
        .limit(1);
      
      return !error;
    } catch {
      return false;
    }
  }
}

export const adminRepository = new AdminRepository(); 