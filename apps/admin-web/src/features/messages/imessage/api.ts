import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ImessageCommandRequest,
  ImessageCommandResponse,
  ImessageCommandRow,
  ImessageConnectorState,
} from './types';

interface ImessageLocalDatabase {
  public: {
    Tables: {
      imessage_connector_state: {
        Row: ImessageConnectorState;
        Insert: Partial<ImessageConnectorState>;
        Update: Partial<ImessageConnectorState>;
        Relationships: [];
      };
      imessage_commands: {
        Row: ImessageCommandRow;
        Insert: Partial<ImessageCommandRow>;
        Update: Partial<ImessageCommandRow>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

function getImessageSupabaseClient(): SupabaseClient<ImessageLocalDatabase> {
  return getSupabaseClient() as unknown as SupabaseClient<ImessageLocalDatabase>;
}

export async function invokeImessageControl(
  request: ImessageCommandRequest
): Promise<ImessageCommandResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke<ImessageCommandResponse>(
    'imessage-control',
    { body: request }
  );

  if (error) throw error;
  if (!data?.commandId || !data.status) {
    throw new Error('iMessage control returned an invalid response');
  }
  return data;
}

export async function fetchImessageConnectorState(): Promise<ImessageConnectorState | null> {
  const supabase = getImessageSupabaseClient();
  const { data, error } = await supabase
    .from('imessage_connector_state')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchRecentImessageCommands(): Promise<ImessageCommandRow[]> {
  const supabase = getImessageSupabaseClient();
  const { data, error } = await supabase
    .from('imessage_commands')
    .select('*')
    .in('status', ['failed', 'ambiguous'])
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}
