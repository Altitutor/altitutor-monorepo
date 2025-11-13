import { formatDistanceToNow } from 'date-fns';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database, Tables } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

const getSupabase = () => getSupabaseClient() as SupabaseClient<Database>;

/**
 * Get sample students for preview (limit 5)
 */
export async function getSampleStudents(): Promise<Tables<'students'>[]> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('status', 'ACTIVE')
    .limit(5)
    .order('first_name', { ascending: true });
  
  if (error) {
    console.error('Error fetching sample students:', error);
    return [];
  }
  
  return (data || []) as Tables<'students'>[];
}

/**
 * Format relative date ("2 days ago", "just now", etc.)
 */
export function formatRelativeDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    // If less than 60 seconds, show "just now"
    if (diffSeconds < 60) {
      return 'just now';
    }
    
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Truncate preview text
 */
export function truncatePreview(text: string, maxLength: number = 80): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Highlight variables in preview text
 * Returns JSX with variables highlighted
 */
export function highlightVariables(text: string): string {
  // Simple text replacement for preview - we'll use a more sophisticated approach in the component
  return text.replace(/\{(first_name|last_name|classes)\}/gi, (match) => {
    return `{${match.slice(1, -1)}}`; // Keep the variable but we'll style it differently
  });
}




