import type { Tables, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IssueFilters, IssueWithTags, IssueInsert, IssueUpdate, IssueTagInsert, IssueTag, Issue } from '../types';
import { extractMentions } from '../utils/extractMentions';
import type { JSONContent } from '@altitutor/ui';

/**
 * Issues API client for working with issue data
 */
export const issuesApi = {
  /**
   * Sync tags based on mentions in description JSON
   */
  syncTags: async (issueId: string, description: JSONContent | null | undefined): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const mentions = extractMentions(description);

    // Get current tags
    const { data: currentTags } = await supabase
      .from('issue_tags')
      .select('id, student_id, staff_id, class_id, session_id, invoice_id, message_id, conversation_id, parent_id, subject_id')
      .eq('issue_id', issueId);

    const tagsToInsert: Omit<IssueTagInsert, 'issue_id'>[] = [];
    const existingTagMap = new Map<string, string>(); // 'type:id' -> tagId

    currentTags?.forEach(tag => {
      if (tag.student_id) existingTagMap.set(`student:${tag.student_id}`, tag.id);
      else if (tag.staff_id) existingTagMap.set(`staff:${tag.staff_id}`, tag.id);
      else if (tag.class_id) existingTagMap.set(`class:${tag.class_id}`, tag.id);
      else if (tag.session_id) existingTagMap.set(`session:${tag.session_id}`, tag.id);
      else if (tag.invoice_id) existingTagMap.set(`invoice:${tag.invoice_id}`, tag.id);
      else if (tag.message_id) existingTagMap.set(`message:${tag.message_id}`, tag.id);
      else if (tag.conversation_id) existingTagMap.set(`conversation:${tag.conversation_id}`, tag.id);
      else if (tag.parent_id) existingTagMap.set(`parent:${tag.parent_id}`, tag.id);
      else if (tag.subject_id) existingTagMap.set(`subject:${tag.subject_id}`, tag.id);
    });

    const newMentionKeys = new Set(mentions.map(m => `${m.type}:${m.id}`));

    // Determine tags to delete
    const tagIdsToDelete = currentTags
      ?.filter(tag => {
        const key = tag.student_id ? `student:${tag.student_id}` :
                    tag.staff_id ? `staff:${tag.staff_id}` :
                    tag.class_id ? `class:${tag.class_id}` :
                    tag.session_id ? `session:${tag.session_id}` :
                    tag.invoice_id ? `invoice:${tag.invoice_id}` :
                    tag.message_id ? `message:${tag.message_id}` :
                    tag.conversation_id ? `conversation:${tag.conversation_id}` : 
                    tag.parent_id ? `parent:${tag.parent_id}` :
                    tag.subject_id ? `subject:${tag.subject_id}` : null;
        return key && !newMentionKeys.has(key);
      })
      .map(tag => tag.id) || [];

    // Determine tags to insert
    mentions.forEach(mention => {
      const key = `${mention.type}:${mention.id}`;
      if (!existingTagMap.has(key)) {
        const tag: any = {};
        const columnMap: Record<string, string> = {
          student: 'student_id',
          staff: 'staff_id',
          class: 'class_id',
          session: 'session_id',
          invoice: 'invoice_id',
          message: 'message_id',
          conversation: 'conversation_id',
          parent: 'parent_id',
          subject: 'subject_id'
        };
        const column = columnMap[mention.type];
        if (column) {
          tag[column] = mention.id;
          tagsToInsert.push(tag);
        }
      }
    });

    // Execute changes
    if (tagIdsToDelete.length > 0) {
      await supabase.from('issue_tags').delete().in('id', tagIdsToDelete);
    }

    if (tagsToInsert.length > 0) {
      const insertData = tagsToInsert.map(t => ({ ...t, issue_id: issueId }));
      await supabase.from('issue_tags').insert(insertData);
    }
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
        tags:issue_tags(*),
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
        if (Array.isArray(value) && value.length > 0) {
            query = query.in(key, value);
        } else if (value !== undefined && value !== null) {
            query = query.eq(key, value);
        }
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []) as unknown as IssueWithTags[];
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
        tags:issue_tags(*),
        created_by_staff:staff!issues_created_by_fkey(id, first_name, last_name)
      `)
      .eq('id', issueId)
      .single();

    if (error) throw error;
    return data as unknown as IssueWithTags | null;
  },

  /**
   * Create a new issue
   */
  create: async ({ issue, tags }: { issue: IssueInsert, tags?: Omit<IssueTagInsert, 'issue_id'>[] }): Promise<IssueWithTags> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data: issueData, error: issueError } = await supabase
      .from('issues')
      .insert(issue)
      .select()
      .single();

    if (issueError) throw issueError;

    // Sync tags from description mentions
    if (issue.description) {
      await issuesApi.syncTags(issueData.id, issue.description as JSONContent);
    }

    if (tags && tags.length > 0) {
      const tagsToInsert = tags.map(tag => ({ ...tag, issue_id: issueData.id }));
      const { error: tagsError } = await supabase
        .from('issue_tags')
        .insert(tagsToInsert);
      
      if (tagsError) throw tagsError;
    }

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

    // Sync tags from description mentions
    if (updates.description) {
      await issuesApi.syncTags(issueId, updates.description as JSONContent);
    }

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
   * Add a tag to an issue
   */
  addTag: async (tag: IssueTagInsert): Promise<IssueTag> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('issue_tags')
      .insert(tag)
      .select()
      .single();
    
    if (error) throw error;
    return data as IssueTag;
  },

  /**
   * Remove a tag from an issue
   */
  removeTag: async (tagId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { error } = await supabase
      .from('issue_tags')
      .delete()
      .eq('id', tagId);
    
    if (error) throw error;
  }
};
