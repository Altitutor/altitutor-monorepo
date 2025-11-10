'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import type { Database, Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

// Query keys
const templatesKeys = {
  all: ['message-templates'] as const,
  list: () => [...templatesKeys.all, 'list'] as const,
  detail: (id: string) => [...templatesKeys.all, 'detail', id] as const,
};

/**
 * Fetch all message templates
 */
export function useMessageTemplates() {
  return useQuery({
    queryKey: templatesKeys.list(),
    queryFn: async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Tables<'message_templates'>[];
    },
  });
}

/**
 * Fetch a single message template
 */
export function useMessageTemplate(id: string) {
  return useQuery({
    queryKey: templatesKeys.detail(id),
    queryFn: async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Tables<'message_templates'>;
    },
    enabled: !!id,
  });
}

/**
 * Create a new message template
 */
export function useCreateTemplate() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  return useMutation({
    mutationFn: async (template: { name: string; content: string }) => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      // Get staff ID
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      const insertData: TablesInsert<'message_templates'> = {
        name: template.name,
        content: template.content,
        created_by: staffRow?.id || null,
      };

      const { data, error } = await supabase
        .from('message_templates')
        .insert(insertData)
        .select()
        .single();
      
      if (error) throw error;
      return data as Tables<'message_templates'>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templatesKeys.list() });
    },
  });
}

/**
 * Update an existing message template
 */
export function useUpdateTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; updates: { name?: string; content?: string; is_active?: boolean } }) => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      const updateData: TablesUpdate<'message_templates'> = params.updates;

      const { data, error } = await supabase
        .from('message_templates')
        .update(updateData)
        .eq('id', params.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Tables<'message_templates'>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: templatesKeys.list() });
      qc.invalidateQueries({ queryKey: templatesKeys.detail(data.id) });
    },
  });
}

/**
 * Delete a message template (soft delete by setting is_active to false)
 */
export function useDeleteTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      const { data, error } = await supabase
        .from('message_templates')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Tables<'message_templates'>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templatesKeys.list() });
    },
  });
}





