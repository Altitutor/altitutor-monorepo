'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import type { Database, Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { JSONContent } from '@tiptap/core';

export const richTextTemplatesKeys = {
  all: ['rich-text-templates'] as const,
  list: () => [...richTextTemplatesKeys.all, 'list'] as const,
  detail: (id: string) => [...richTextTemplatesKeys.all, 'detail', id] as const,
};

/**
 * Fetch all rich text templates
 */
export function useRichTextTemplates() {
  return useQuery({
    queryKey: richTextTemplatesKeys.list(),
    queryFn: async (): Promise<Tables<'rich_text_templates'>[]> => {
      const supabase = getSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase Json type causes "excessively deep" inference
      const { data, error } = await (supabase as any)
        .from('rich_text_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as Tables<'rich_text_templates'>[];
    },
  });
}

/**
 * Fetch a single rich text template
 */
export function useRichTextTemplate(id: string) {
  return useQuery({
    queryKey: richTextTemplatesKeys.detail(id),
    queryFn: async (): Promise<Tables<'rich_text_templates'>> => {
      const supabase = getSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase Json type causes "excessively deep" inference
      const { data, error } = await (supabase as any)
        .from('rich_text_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Tables<'rich_text_templates'>;
    },
    enabled: !!id,
  });
}

/**
 * Create a new rich text template
 */
export function useCreateRichTextTemplate() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async (
      template: { name: string; content: JSONContent }
    ): Promise<Tables<'rich_text_templates'>> => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;

      const { data: staffRow } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      const insertData: TablesInsert<'rich_text_templates'> = {
        name: template.name,
        content: template.content as TablesInsert<'rich_text_templates'>['content'],
        created_by: staffRow?.id ?? null,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase Json type causes "excessively deep" inference
      const { data, error } = await (getSupabaseClient() as any)
        .from('rich_text_templates')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data as Tables<'rich_text_templates'>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: richTextTemplatesKeys.list() });
    },
  });
}

/**
 * Update an existing rich text template
 */
export function useUpdateRichTextTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      updates: { name?: string; content?: JSONContent };
    }): Promise<Tables<'rich_text_templates'>> => {
      const updateData: TablesUpdate<'rich_text_templates'> = {
        ...params.updates,
        content:
          params.updates.content !== undefined
            ? (params.updates.content as TablesUpdate<'rich_text_templates'>['content'])
            : undefined,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase Json type causes "excessively deep" inference
      const { data, error } = await (getSupabaseClient() as any)
        .from('rich_text_templates')
        .update(updateData)
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return data as Tables<'rich_text_templates'>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: richTextTemplatesKeys.list() });
      qc.invalidateQueries({ queryKey: richTextTemplatesKeys.detail(data.id) });
    },
  });
}

/**
 * Delete a rich text template
 */
export function useDeleteRichTextTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase Json type causes "excessively deep" inference
      const { error } = await (getSupabaseClient() as any)
        .from('rich_text_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: richTextTemplatesKeys.list() });
    },
  });
}
