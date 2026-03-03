/**
 * Shared types for Supabase Edge Functions
 * Used to avoid @typescript-eslint/no-explicit-any
 */

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/** JSON-serializable value for HTTP responses */
export type JsonBody = Record<string, unknown> | unknown[] | string | number | boolean | null;

/** Supabase client type - use generic Database if available */
export type SupabaseClientType = SupabaseClient;

/** Helper to get error message from unknown error */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return 'Unknown error';
}
