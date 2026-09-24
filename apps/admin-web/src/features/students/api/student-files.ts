import type { Tables, TablesInsert } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { uploadStudentFile, deleteStudentFile, getStudentFileSignedUrl } from '@/shared/lib/supabase/storage';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Student Files API for managing files linked to students
 */

export interface StudentFileWithUrl extends Tables<'student_files'> {
  file: Tables<'files'>;
  signedUrl: string;
}

export const studentFilesApi = {
  uploadStudentFile: async (params: {
    studentId: string;
    file: File;
    displayOrder?: number;
  }): Promise<Tables<'student_files'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: staff } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const createdBy = staff?.id || null;

    const { path } = await uploadStudentFile({
      studentId: params.studentId,
      file: params.file,
    });

    const fileData: TablesInsert<'files'> = {
      mimetype: params.file.type,
      filename: params.file.name,
      size_bytes: params.file.size,
      metadata: {
        originalName: params.file.name,
        uploadedAt: new Date().toISOString(),
      },
      storage_provider: 'supabase',
      bucket: 'student-files',
      storage_path: path,
      created_by: createdBy,
    };

    const { data: createdFile, error: fileError } = await supabase
      .from('files')
      .insert(fileData)
      .select()
      .single();

    if (fileError) {
      try {
        await deleteStudentFile(path);
      } catch (cleanupError) {
        console.error('Failed to cleanup storage file after database error:', cleanupError);
      }
      console.error('Failed to create file record:', fileError);
      throw fileError;
    }

    const studentFileData: TablesInsert<'student_files'> = {
      student_id: params.studentId,
      file_id: createdFile.id,
      display_order: params.displayOrder ?? 0,
      created_by: createdBy,
    };

    const { data: createdStudentFile, error: studentFileError } = await supabase
      .from('student_files')
      .insert(studentFileData)
      .select()
      .single();

    if (studentFileError) {
      try {
        await supabase.from('files').delete().eq('id', createdFile.id);
        await deleteStudentFile(path);
      } catch (cleanupError) {
        console.error('Failed to cleanup after student_file link error:', cleanupError);
      }
      console.error('Failed to create student_file link:', studentFileError);
      throw studentFileError;
    }

    return createdStudentFile as Tables<'student_files'>;
  },

  getStudentFiles: async (studentId: string): Promise<StudentFileWithUrl[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('student_files')
      .select(`
        *,
        file:files(*)
      `)
      .eq('student_id', studentId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Failed to get student files:', error);
      throw error;
    }

    type StudentFileWithNestedFile = Tables<'student_files'> & { file: Tables<'files'> };
    const filesWithUrls = await Promise.all(
      (data || []).map(async (studentFile: StudentFileWithNestedFile) => {
        const file = studentFile.file;
        if (!file.storage_path) {
          throw new Error('Student file record is missing storage_path');
        }
        const signedUrl = await getStudentFileSignedUrl(file.storage_path);

        return {
          ...studentFile,
          file,
          signedUrl,
        } as StudentFileWithUrl;
      })
    );

    return filesWithUrls;
  },

  renameStudentFile: async (studentFileId: string, displayName: string): Promise<Tables<'student_files'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data, error } = await supabase
      .from('student_files')
      .update({ display_name: displayName.trim() || null })
      .eq('id', studentFileId)
      .select()
      .single();

    if (error) {
      console.error('Failed to rename student file:', error);
      throw error;
    }

    return data as Tables<'student_files'>;
  },

  deleteStudentFile: async (studentFileId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data: studentFile, error: studentFileError } = await supabase
      .from('student_files')
      .select('file:files(storage_path)')
      .eq('id', studentFileId)
      .single();

    if (studentFileError) {
      console.error('Failed to get student file:', studentFileError);
      throw studentFileError;
    }

    type StudentFileWithStoragePath = { file: { storage_path: string } };
    const file = (studentFile as StudentFileWithStoragePath).file;

    try {
      await deleteStudentFile(file.storage_path);
    } catch (storageError) {
      console.error('Failed to delete file from storage:', storageError);
    }

    const { error: deleteError } = await supabase
      .from('student_files')
      .delete()
      .eq('id', studentFileId);

    if (deleteError) {
      console.error('Failed to delete student file link:', deleteError);
      throw deleteError;
    }
  },
};
