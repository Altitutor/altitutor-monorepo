// Re-export all types from various modules
export * from '@/shared/lib/supabase/database/types';

// Define shared types here
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface SortingParams {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterParams {
  [key: string]: unknown;
} 