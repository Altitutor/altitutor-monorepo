/**
 * Type helpers for working with Supabase Database types
 * These utilities help avoid `as any` assertions
 */

import type { Database } from '../supabase/generated';

// Re-export commonly used types
export type Tables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row'];

export type TablesInsert<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Insert'];

export type TablesUpdate<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Update'];

export type Enums<T extends keyof Database['public']['Enums']> = 
  Database['public']['Enums'][T];

/**
 * Makes specific properties optional
 * Usage: Optional<User, 'email' | 'phone'>
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Makes specific properties required
 * Usage: Required<User, 'email' | 'phone'>
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Makes all properties nullable
 */
export type Nullable<T> = { [K in keyof T]: T[K] | null };

/**
 * Extracts the response type from a Supabase query
 * Handles the data/error pattern
 */
export type SupabaseResponse<T> = {
  data: T | null;
  error: Error | null;
};

/**
 * Helper for paginated responses
 */
export type PaginatedResponse<T> = {
  data: T[];
  count: number | null;
  error: Error | null;
};

/**
 * Common join patterns - extend as needed
 */
export type StudentWithRelations = Tables<'students'> & {
  classes_students?: Array<{
    classes: Tables<'classes'> & {
      subjects: Tables<'subjects'> | null;
    } | null;
  }>;
  parents?: Tables<'parents'>[];
};

export type StaffWithRelations = Tables<'staff'> & {
  classes_staff?: Array<{
    classes: Tables<'classes'> & {
      subjects: Tables<'subjects'> | null;
    } | null;
  }>;
};

export type ClassWithRelations = Tables<'classes'> & {
  subjects: Tables<'subjects'> | null;
  classes_staff?: Array<{
    staff: Tables<'staff'> | null;
  }>;
  classes_students?: Array<{
    students: Tables<'students'> | null;
  }>;
};

export type SessionWithRelations = Tables<'sessions'> & {
  classes: ClassWithRelations | null;
};

/**
 * Form data types - for when API receives partial data
 */
export type StudentFormData = Omit<TablesInsert<'students'>, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type StaffFormData = Omit<TablesInsert<'staff'>, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

/**
 * Safely extract properties that might not exist in the type
 * This is better than `as any`
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Type guard helpers
 */
export function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function hasProperty<T, K extends string>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

