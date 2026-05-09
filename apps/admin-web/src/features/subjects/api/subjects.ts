import type { Tables, TablesInsert, TablesUpdate, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { uploadSubjectImage, deleteFromBucket } from '@/shared/lib/supabase/storage';
import type { SupabaseClient } from '@supabase/supabase-js';

const SUBJECT_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * Subjects API client for working with subject data
 */
export const subjectsApi = {
  /**
   * Get all subjects
   */
  getAllSubjects: async (): Promise<Tables<'subjects'>[]> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('subjects')
      .select('id, name, curriculum, year_level, discipline, color, level, short_name, long_name');
    if (error) throw error;
    return (data ?? []) as Tables<'subjects'>[];
  },
  
  /**
   * Paginated, server-filtered subject list for pickers
   * Uses search_subjects_admin RPC function for optimized search with exact + fuzzy matching
   */
  list: async (params: { 
    search?: string; 
    yearLevels?: number[];
    curriculums?: string[];
    disciplines?: string[];
    levels?: string[];
    limit?: number; 
    offset?: number;
    orderBy?: 'name' | 'curriculum' | 'year_level' | 'discipline' | 'level';
    ascending?: boolean;
  }): Promise<{ subjects: Tables<'subjects'>[]; total: number }> => {
    const { 
      search = '', 
      yearLevels,
      curriculums,
      disciplines,
      levels,
      limit = 20, 
      offset = 0,
      orderBy = 'name',
      ascending = true
    } = params || {};
    
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const trimmed = search.trim();
    
    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_subjects_admin', {
      p_search: trimmed.length > 0 ? trimmed : undefined,
      p_year_levels: yearLevels && yearLevels.length > 0 ? yearLevels : undefined,
      p_curriculums: curriculums && curriculums.length > 0 ? curriculums : undefined,
      p_disciplines: disciplines && disciplines.length > 0 ? disciplines : undefined,
      p_levels: levels && levels.length > 0 ? levels : undefined,
      p_limit: limit,
      p_offset: offset,
      p_order_by: orderBy,
      p_ascending: ascending,
    });

    if (rpcError) throw rpcError;
    if (!rpcResult) return { subjects: [], total: 0 };

    const rpcData = rpcResult as { subjects: Tables<'subjects'>[]; total: number };
    return { 
      subjects: (rpcData.subjects || []) as Tables<'subjects'>[], 
      total: rpcData.total ?? 0 
    };
  },
  
  /**
   * Get a subject by ID
   */
  getSubject: async (id: string): Promise<Tables<'subjects'> | null> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('subjects')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data ?? null) as Tables<'subjects'> | null;
  },

  /**
   * Cover image file linked via subjects_files (for student resources UI).
   */
  getSubjectImageFile: async (subjectId: string): Promise<Tables<'files'> | null> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data: link, error } = await supabase
      .from('subjects_files')
      .select('file_id')
      .eq('subject_id', subjectId)
      .maybeSingle();
    if (error) throw error;
    if (!link?.file_id) return null;

    const { data: fileRow, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', link.file_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (fileError) throw fileError;
    return (fileRow ?? null) as Tables<'files'> | null;
  },

  /**
   * Upload and attach a subject cover image (replaces any existing link).
   */
  setSubjectImage: async (subjectId: string, file: File): Promise<Tables<'files'>> => {
    if (!SUBJECT_IMAGE_MIME.has(file.type)) {
      throw new Error('Please choose a JPEG, PNG, WebP, or GIF image.');
    }

    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { path } = await uploadSubjectImage({ subjectId, file });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    let createdBy: string | null = null;
    if (user?.id) {
      const { data: staff } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      createdBy = staff?.id ?? null;
    }

    const fileData: TablesInsert<'files'> = {
      mimetype: file.type,
      filename: file.name,
      size_bytes: file.size,
      metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        purpose: 'subject-image',
      },
      storage_provider: 'supabase',
      bucket: 'resources',
      storage_path: path,
      created_by: createdBy,
    };

    const { data: created, error: insertError } = await supabase
      .from('files')
      .insert(fileData)
      .select()
      .single();

    if (insertError || !created) {
      try {
        await deleteFromBucket('resources', path);
      } catch (cleanupErr) {
        console.error('Failed to remove storage after files insert error:', cleanupErr);
      }
      throw insertError ?? new Error('Failed to create file record');
    }

    try {
      const { data: existing } = await supabase
        .from('subjects_files')
        .select('id, file_id')
        .eq('subject_id', subjectId)
        .maybeSingle();

      const oldFileId = existing?.file_id ?? null;

      if (existing) {
        const { error: upErr } = await supabase
          .from('subjects_files')
          .update({
            file_id: created.id,
            updated_at: new Date().toISOString(),
          } satisfies TablesUpdate<'subjects_files'>)
          .eq('id', existing.id);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase.from('subjects_files').insert({
          subject_id: subjectId,
          file_id: created.id,
          created_by: createdBy,
        });
        if (insErr) throw insErr;
      }

      if (oldFileId && oldFileId !== created.id) {
        const { error: softErr } = await supabase
          .from('files')
          .update({ deleted_at: new Date().toISOString() } satisfies TablesUpdate<'files'>)
          .eq('id', oldFileId);
        if (softErr) throw softErr;
      }

      return created as Tables<'files'>;
    } catch (err) {
      try {
        await supabase
          .from('files')
          .update({ deleted_at: new Date().toISOString() } satisfies TablesUpdate<'files'>)
          .eq('id', created.id);
        await deleteFromBucket('resources', path);
      } catch (cleanupErr) {
        console.error('Failed to roll back subject image upload:', cleanupErr);
      }
      throw err;
    }
  },

  /**
   * Remove subject cover image link and soft-delete the file row.
   */
  removeSubjectImage: async (subjectId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data: row, error: selErr } = await supabase
      .from('subjects_files')
      .select('file_id')
      .eq('subject_id', subjectId)
      .maybeSingle();
    if (selErr) throw selErr;
    if (!row?.file_id) return;

    const { error: delLinkErr } = await supabase
      .from('subjects_files')
      .delete()
      .eq('subject_id', subjectId);
    if (delLinkErr) throw delLinkErr;

    const { error: softErr } = await supabase
      .from('files')
      .update({ deleted_at: new Date().toISOString() } satisfies TablesUpdate<'files'>)
      .eq('id', row.file_id);
    if (softErr) throw softErr;
  },
  
  /**
   * Search subjects by name, curriculum, or year level
   * Uses search_subjects_admin RPC function for optimized search with exact + fuzzy matching
   */
  searchSubjects: async (query: string): Promise<Tables<'subjects'>[]> => {
    const { subjects } = await subjectsApi.list({ search: query, limit: 20, offset: 0 });
    return subjects;
  },
  
  /**
   * Create a new subject
   */
  createSubject: async (data: TablesInsert<'subjects'>): Promise<Tables<'subjects'>> => {
    const payload: TablesInsert<'subjects'> = { ...data };
    const { data: created, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('subjects')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return created as Tables<'subjects'>;
  },
  
  /**
   * Update a subject
   */
  updateSubject: async (id: string, data: TablesUpdate<'subjects'>): Promise<Tables<'subjects'>> => {
    const { data: updated, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('subjects')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated as Tables<'subjects'>;
  },
  
  /**
   * Delete a subject
   */
  deleteSubject: async (id: string): Promise<void> => {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('subjects')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Bulk update subject colors
   */
  bulkUpdateColors: async (subjectIds: string[], color: string | null): Promise<Tables<'subjects'>[]> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('subjects')
      .update({ color })
      .in('id', subjectIds)
      .select();
    if (error) throw error;
    return (data ?? []) as Tables<'subjects'>[];
  },

  // Removed redundant direct getter alias

  /**
   * Get staff members assigned to a subject
   */
  getSubjectStaff: async (subjectId: string): Promise<Tables<'staff'>[]> => {
    try {
      const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('staff_subjects')
        .select(`
          staff:staff(*)
        `)
        .eq('subject_id', subjectId);
      if (error) throw error;
      const staff = (data ?? [])
        .map((row: { staff: Tables<'staff'> | null }) => row.staff as Tables<'staff'>)
        .filter(Boolean);
      return staff;
    } catch (error) {
      console.error('Error getting subject staff:', error);
      throw error;
    }
  },

  /**
   * Get students enrolled in a subject
   */
  getSubjectStudents: async (subjectId: string): Promise<Tables<'students'>[]> => {
    try {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const [ssRes, manualRes] = await Promise.all([
        supabase
          .from('students_subjects')
          .select('student:students(*)')
          .eq('subject_id', subjectId),
        supabase
          .from('students_online_access_manual')
          .select('student:students(*)')
          .eq('subject_id', subjectId),
      ]);
      if (ssRes.error) throw ssRes.error;
      if (manualRes.error) throw manualRes.error;
      const byId = new Map<string, Tables<'students'>>();
      for (const row of [...(ssRes.data ?? []), ...(manualRes.data ?? [])]) {
        const st = (row as { student: Tables<'students'> | null }).student;
        if (st?.id) byId.set(st.id, st);
      }
      return [...byId.values()];
    } catch (error) {
      console.error('Error getting subject students:', error);
      throw error;
    }
  },

  /**
   * Get classes for a subject
   */
  getSubjectClasses: async (subjectId: string): Promise<Tables<'classes'>[]> => {
    try {
      const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('classes')
        .select('*')
        .eq('subject_id', subjectId);
      if (error) throw error;
      return (data ?? []) as Tables<'classes'>[];
    } catch (error) {
      console.error('Error getting subject classes:', error);
      throw error;
    }
  },

  /**
   * Get topics for a subject
   */
  getSubjectTopics: async (subjectId: string): Promise<Tables<'topics'>[]> => {
    try {
      const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('topics')
        .select('*')
        .eq('subject_id', subjectId)
        .order('number', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tables<'topics'>[];
    } catch (error) {
      console.error('Error getting subject topics:', error);
      throw error;
    }
  },

}; 