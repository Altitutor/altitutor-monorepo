import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SubjectSummary = {
  id: string;
  curriculum: string | null;
  year_level: number | null;
  name: string | null;
  long_name?: string | null;
  short_name?: string | null;
  discipline: string | null;
  level: string | null;
  color: string | null;
};

export type ClassSummary = {
  id: string;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  room: string | null;
  level: string | null;
  subject_id: string | null;
  subject: SubjectSummary | null;
};

export type StudentSummary = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
  curriculum: string | null;
  year_level: number | null;
  school: string | null;
};

export type StaffSummary = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  status: string | null;
  email: string | null;
  phone_number: string | null;
};

export type GlobalSearchResult = 
  | { 
      type: 'student'; 
      id: string; 
      score: number; 
      match_type: 'primary' | 'secondary'; 
      data: StudentSummary & {
        classes: ClassSummary[];
      };
    }
  | { 
      type: 'staff'; 
      id: string; 
      score: number; 
      match_type: 'primary' | 'secondary'; 
      data: StaffSummary & {
        classes: ClassSummary[];
      };
    }
  | { 
      type: 'class'; 
      id: string; 
      score: number; 
      match_type: 'primary' | 'secondary'; 
      data: ClassSummary & {
        students: StudentSummary[];
        staff: StaffSummary[];
      };
    };

export type GlobalSearchResponse = {
  results: GlobalSearchResult[];
  total: number;
  has_more: boolean;
};

export type GlobalSearchParams = {
  search: string;
  limit?: number;
  offset?: number;
  weights?: {
    primary?: number;
    secondary?: number;
  };
};

/**
 * Global search API client for unified search across students, staff, and classes
 */
export const searchApi = {
  /**
   * Perform global search across all entity types
   */
  global: async (params: GlobalSearchParams): Promise<GlobalSearchResponse> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { 
      search, 
      limit = 10, 
      offset = 0,
      weights = { primary: 100, secondary: 50 }
    } = params;

    // Note: search_all_admin was dropped in migration 20260118191139
    // This function is deprecated and should be replaced with individual search RPCs
    // For now, return empty results to prevent errors
    type RpcFn = (name: string, params: Record<string, unknown>) => Promise<{ data: GlobalSearchResponse | null; error: Error | null }>;
    const rpc = supabase.rpc as unknown;
    const { data, error } = await (rpc as RpcFn)('search_all_admin', {
      p_search: search,
      p_limit: limit,
      p_offset: offset,
      p_weight_primary: weights.primary ?? 100,
      p_weight_secondary: weights.secondary ?? 50,
    });

    if (error) {
      console.error('Error calling search_all_admin:', error);
      throw error;
    }

    if (!data) {
      return {
        results: [],
        total: 0,
        has_more: false,
      };
    }

    return data as GlobalSearchResponse;
  },
};

