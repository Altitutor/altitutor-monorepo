// Use Supabase generated types directly
export type { Database, Tables, TablesInsert, TablesUpdate, Enums } from '@altitutor/shared';

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