import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { createClient as createServerClient } from '@/shared/lib/supabase/server-ssr';

/**
 * POST /api/sessions/[sessionId]/files
 * Upload a file for a session
 * 
 * Authorization:
 * - User must be a student
 * - Student must be enrolled in the session (checked via sessions_students)
 * - File must be uploaded to session-files bucket
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get authenticated user's supabase client
    const userClient = createServerClient();

    // Verify user is a student
    const { data: isStudent, error: studentCheckError } = await userClient.rpc('is_student');

    if (studentCheckError) {
      console.error('Error checking student status:', studentCheckError);
      return NextResponse.json(
        { error: 'Failed to verify student status' },
        { status: 500 }
      );
    }

    if (!isStudent) {
      return NextResponse.json(
        { error: 'Unauthorized: User is not a student' },
        { status: 403 }
      );
    }

    // Verify student is enrolled in this session (using vstudent_sessions view)
    // The view already filters by current_student_id(), so we just need to check if the session exists
    const { data: sessionStudent, error: sessionCheckError } = await userClient
      .from('vstudent_sessions')
      .select('session_student_id')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (sessionCheckError) {
      console.error('Error checking session enrollment:', sessionCheckError);
      return NextResponse.json(
        { error: 'Failed to verify session enrollment' },
        { status: 500 }
      );
    }

    if (!sessionStudent) {
      return NextResponse.json(
        { error: 'Unauthorized: You are not enrolled in this session' },
        { status: 403 }
      );
    }

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const displayOrderStr = formData.get('displayOrder') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds 50MB limit. File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed types: PDF, Word, Excel, PowerPoint, Images` },
        { status: 400 }
      );
    }

    // Upload file to storage using user's client (storage RLS will handle access)
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${sessionId}/${timestamp}_${sanitizedFilename}`;

    const { data: uploadData, error: uploadError } = await userClient.storage
      .from('session-files')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get Supabase admin client for database writes
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      // Clean up uploaded file
      try {
        await userClient.storage.from('session-files').remove([storagePath]);
      } catch (cleanupError) {
        console.error('Failed to cleanup storage file:', cleanupError);
      }
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create file database record
    const fileData = {
      mimetype: file.type,
      filename: file.name,
      size_bytes: file.size,
      metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
      storage_provider: 'supabase',
      bucket: 'session-files',
      storage_path: uploadData.path,
      created_by: null, // Students don't have staff ID
    };

    const { data: createdFile, error: fileError } = await supabaseAdmin
      .from('files')
      .insert(fileData)
      .select()
      .single();

    if (fileError) {
      console.error('Failed to create file record:', fileError);
      // Clean up storage file
      try {
        await userClient.storage.from('session-files').remove([storagePath]);
      } catch (cleanupError) {
        console.error('Failed to cleanup storage file:', cleanupError);
      }
      return NextResponse.json(
        { error: `Failed to create file record: ${fileError.message}` },
        { status: 500 }
      );
    }

    // Create sessions_files link
    const displayOrder = displayOrderStr ? parseInt(displayOrderStr, 10) : 0;
    const sessionFileData = {
      session_id: sessionId,
      file_id: createdFile.id,
      display_order: displayOrder,
      created_by: null, // Students don't have staff ID
    };

    const { data: createdSessionFile, error: sessionFileError } = await supabaseAdmin
      .from('sessions_files')
      .insert(sessionFileData)
      .select()
      .single();

    if (sessionFileError) {
      console.error('Failed to create session_file link:', sessionFileError);
      // Clean up file record and storage
      try {
        await supabaseAdmin.from('files').delete().eq('id', createdFile.id);
        await userClient.storage.from('session-files').remove([storagePath]);
      } catch (cleanupError) {
        console.error('Failed to cleanup after session_file link error:', cleanupError);
      }
      return NextResponse.json(
        { error: `Failed to link file to session: ${sessionFileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionFile: createdSessionFile,
      file: createdFile,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('Unexpected error uploading session file:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


