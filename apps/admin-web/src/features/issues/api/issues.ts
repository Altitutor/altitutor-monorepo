import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IssueFilters, IssueWithTags, IssueInsert, IssueUpdate, IssueTagInsert, IssueTag, Issue } from '../types';
import { extractMentions } from '@/shared/utils/extractMentions';
import type { JSONContent } from '@altitutor/ui';
import { parseTags } from '@/shared/utils/tagParsing';
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
   * Sync tags based on mentions in name and description
   */
  syncTags: async (issueId: string, name?: string | null, description?: JSONContent | null): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // If either name or description is not provided, fetch them from the database
    let finalName = name;
    let finalDescription = description;
    
    if (finalName === undefined || finalDescription === undefined) {
      const { data: issue } = await supabase
        .from('issues')
        .select('name, description')
        .eq('id', issueId)
        .single();
      
      if (issue) {
        if (finalName === undefined) finalName = issue.name;
        if (finalDescription === undefined) finalDescription = issue.description as JSONContent;
      }
    }

    // Extract mentions from description (JSON)
    const descriptionMentions = extractMentions(finalDescription);
    
    // Extract tags from name (Regex)
    const nameTags = parseTags(finalName || '');
    const nameMentions = nameTags.map(tag => ({
      id: tag.id,
      type: tag.type,
      label: tag.displayText
    }));

    // Combine and deduplicate mentions
    const allMentions = Array.from(new Map(
      [...descriptionMentions, ...nameMentions].map(m => [`${m.type}:${m.id}`, m])
    ).values());

    // Get current tags
    const { data: currentTags } = await supabase
      .from('issue_tags')
      .select('id, student_id, staff_id, class_id, session_id, invoice_id, parent_id, subject_id')
      .eq('issue_id', issueId);

    const tagsToInsert: Omit<IssueTagInsert, 'issue_id'>[] = [];
    const existingTagMap = new Map<string, string>(); // 'type:id' -> tagId

    currentTags?.forEach(tag => {
      if (tag.student_id) existingTagMap.set(`student:${tag.student_id}`, tag.id);
      else if (tag.staff_id) existingTagMap.set(`staff:${tag.staff_id}`, tag.id);
      else if (tag.class_id) existingTagMap.set(`class:${tag.class_id}`, tag.id);
      else if (tag.session_id) existingTagMap.set(`session:${tag.session_id}`, tag.id);
      else if (tag.invoice_id) existingTagMap.set(`invoice:${tag.invoice_id}`, tag.id);
      else if (tag.parent_id) existingTagMap.set(`parent:${tag.parent_id}`, tag.id);
      else if (tag.subject_id) existingTagMap.set(`subject:${tag.subject_id}`, tag.id);
    });

    const newMentionKeys = new Set(allMentions.map(m => `${m.type}:${m.id}`));

    // Determine tags to delete
    const tagIdsToDelete = currentTags
      ?.filter(tag => {
        const key = tag.student_id ? `student:${tag.student_id}` :
                    tag.staff_id ? `staff:${tag.staff_id}` :
                    tag.class_id ? `class:${tag.class_id}` :
                    tag.session_id ? `session:${tag.session_id}` :
                    tag.invoice_id ? `invoice:${tag.invoice_id}` :
                    tag.parent_id ? `parent:${tag.parent_id}` :
                    tag.subject_id ? `subject:${tag.subject_id}` : null;
        return key && !newMentionKeys.has(key);
      })
      .map(tag => tag.id) || [];

    // Determine tags to insert
    allMentions.forEach(mention => {
      const key = `${mention.type}:${mention.id}`;
      if (!existingTagMap.has(key)) {
        const tag: Record<string, string> = {};
        const columnMap: Record<string, string> = {
          student: 'student_id',
          staff: 'staff_id',
          class: 'class_id',
          session: 'session_id',
          invoice: 'invoice_id',
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

    // Sync tags from mentions in name or description
    if (issueWithDescriptionTags.name || issueWithDescriptionTags.description) {
      await issuesApi.syncTags(
        issueData.id,
        issueWithDescriptionTags.name,
        issueWithDescriptionTags.description as JSONContent
      );
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

    // Sync tags from mentions in name or description
    if (updates.name || updates.description) {
      await issuesApi.syncTags(issueId, updates.name, updates.description as JSONContent);
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
