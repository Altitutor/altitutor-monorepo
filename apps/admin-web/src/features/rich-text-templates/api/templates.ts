'use client';

import { useWorkItemRevision, mutateWorkItem } from '@/features/admin-mcp/client/operations';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database, Tables } from '@altitutor/shared';
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
      const { data, error } = await (supabase as SupabaseClient<Database>)
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
      const { data, error } = await (supabase as SupabaseClient<Database>)
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

  return useMutation({
    mutationFn: async (
      template: { name: string; content: JSONContent }
    ): Promise<Tables<'rich_text_templates'>> => {
      return mutateWorkItem<Tables<'rich_text_templates'>>('template', template);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: richTextTemplatesKeys.list() });
    },
  });
}

/**
 * Update an existing rich text template
 */
export function useUpdateRichTextTemplate(editorSession?: string | boolean) {
  const withRevision = useWorkItemRevision(editorSession);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      updates: { name?: string; content?: JSONContent };
    }): Promise<Tables<'rich_text_templates'>> => {
      return withRevision(params.id, (revision) => mutateWorkItem<Tables<'rich_text_templates'>>('template', params.updates, params.id, revision));
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
      const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
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
