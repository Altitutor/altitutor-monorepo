import { getSupabaseClient } from '@/shared/lib/supabase/client';

export async function requestCardSetup(studentId: string, email?: string, name?: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('payment-methods', {
    body: {
      action: 'create_setup_intent',
      studentId,
      email,
      name
    }
  });
  
  if (error) throw error;
  if (!data || !data.client_secret) {
    throw new Error('Failed to initialize card setup');
  }
  
  return data as { client_secret: string; setup_intent_id: string };
}



