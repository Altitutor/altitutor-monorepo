import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IssueFilters, IssueWithTags, IssueInsert, IssueUpdate, IssueTagInsert, Issue } from '../types';
import type { JSONContent } from '@altitutor/ui';
import { getTagEntity, resolveTagLabels } from '../utils/mentionLabels';

async function appendTagsToDescription(
  description: JSONContent | null | undefined,
  tags?: Omit<IssueTagInsert, 'issue_id'>[]
): Promise<JSONContent | null> {
  if (!tags || tags.length === 0) return description ?? null;
  const labels = await resolveTagLabels(tags);

  const doc: JSONContent =
    description && description.type === 'doc'
      ? description
      : { type: 'doc', content: [] };

  const existingMentionKeys = new Set(
    extractMentions(doc).map((mention) => `${mention.type}:${mention.id}`)
  );

  const mentionParagraphs: JSONContent[] = [];
  tags.forEach((tag) => {
    const entity = getTagEntity(tag);
    if (!entity) return;

    const key = `${entity.type}:${entity.id}`;
    if (existingMentionKeys.has(key)) return;
    existingMentionKeys.add(key);

    mentionParagraphs.push({
      type: 'paragraph',
      content: [
        {
          type: 'mention',
          attrs: {
            id: entity.id,
            type: entity.type,
            label: labels.get(key) || entity.id,
          },
        },
        { type: 'text', text: ' ' },
      ],
    });
  });

  if (mentionParagraphs.length === 0) return description ?? null;

  return {
    ...doc,
    content: [...(doc.content || []), ...mentionParagraphs],
  };
}

/**
 * Issues API client for working with issue data
 */
export const issuesApi = {
  /**
   * Search issues for mention/command palette usage
   */
  search: async (
    search: string,
    limit = 8
  ): Promise<Array<Pick<Issue, 'id' | 'name' | 'status' | 'due_date'>>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const trimmed = search.trim();

    if (trimmed.length > 0) {
      const { data, error } = await supabase
        .from('issues')
        .select('id, name, status, due_date')
        .textSearch('search_vector', trimmed, {
          type: 'websearch',
          config: 'english',
        })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as Array<Pick<Issue, 'id' | 'name' | 'status' | 'due_date'>>;
    }

    const { data, error } = await supabase
      .from('issues')
      .select('id, name, status, due_date')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as Array<Pick<Issue, 'id' | 'name' | 'status' | 'due_date'>>;
  },

  /**
   * Get all issues with optional filters
   */
  list: async (filters?: IssueFilters): Promise<IssueWithTags[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { status, search, ...otherFilters } = filters || {};

    let query = supabase
      .from('issues')
      .select(`
        *,
        created_by_staff:staff!issues_created_by_fkey(id, first_name, last_name)
      `);

    if (status && status.length > 0) {
      query = query.in('status', status);
    }

    // Search filter (full-text search)
    if (search && search.trim().length > 0) {
      query = query.textSearch('search_vector', search.trim(), {
        type: 'websearch',
        config: 'english',
      });
    }

    // Dynamic filters
    for (const [key, value] of Object.entries(otherFilters)) {
      if (!Array.isArray(value) || value.length === 0) continue;

      const dateRanges = value.filter((v) => typeof v === 'object' && v !== null && (v as { type?: string }).type === 'date_range');
      const otherValues = value.filter((v) => typeof v !== 'object' || v === null || (v as { type?: string }).type !== 'date_range');

      if (otherValues.length > 0) {
        query = query.in(key, otherValues);
      }

      if (dateRanges.length > 0) {
        const dr = dateRanges[0] as { operator?: 'gte' | 'lte'; start?: string; end?: string };
        if (dr.operator === 'gte' && dr.start) {
          query = query.gte(key, dr.start);
        } else if (dr.operator === 'lte' && dr.end) {
          query = query.lte(key, dr.end);
        } else if (dr.start && dr.end) {
          query = query.gte(key, dr.start).lte(key, dr.end);
        }
      }
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return ((data ?? []) as unknown as Omit<IssueWithTags, 'tags'>[]).map((issue) => ({
      ...issue,
      tags: [],
    }));
  },

  /**
   * Get a single issue by ID
   */
  get: async (issueId: string): Promise<IssueWithTags | null> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('issues')
      .select(`
        *,
        created_by_staff:staff!issues_created_by_fkey(id, first_name, last_name)
      `)
      .eq('id', issueId)
      .single();

    if (error) throw error;
    return data ? ({ ...(data as unknown as Omit<IssueWithTags, 'tags'>), tags: [] }) : null;
  },

  /**
   * Create a new issue
   */
  create: async ({ issue, tags }: { issue: IssueInsert, tags?: Omit<IssueTagInsert, 'issue_id'>[] }): Promise<IssueWithTags> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const issueWithDescriptionTags: IssueInsert = {
      ...issue,
      description: await appendTagsToDescription(issue.description as JSONContent | null | undefined, tags),
    };
    
    const { data: issueData, error: issueError } = await supabase
      .from('issues')
      .insert(issueWithDescriptionTags)
      .select()
      .single();

    if (issueError) throw issueError;

    return issuesApi.get(issueData.id) as Promise<IssueWithTags>;
  },

  /**
   * Update an issue
   */
  update: async (issueId: string, updates: IssueUpdate): Promise<Issue> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('issues')
      .update(updates)
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw error;

    return data as Issue;
  },

  /**
   * Delete an issue
   */
  delete: async (issueId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { error } = await supabase
      .from('issues')
      .delete()
      .eq('id', issueId);

    if (error) throw error;
  },

  /**
   * Get open issues linked to a specific entity
   */
  getOpenIssuesByEntity: async (
    entityType: 'student' | 'staff' | 'parent' | 'class' | 'session' | 'invoice',
    entityId: string
  ): Promise<IssueWithTags[]> => {
    void entityType;
    void entityId;
    return [];
  }
};
