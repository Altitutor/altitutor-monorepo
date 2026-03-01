import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { Tables, TablesInsert } from '@altitutor/shared';

/**
 * POST /api/topics-files
 * Create a new topics_file (link a file to a topic)
 * 
 * Authorization:
 * - User must be an active tutor (checked via is_tutor())
 * - topic_id must be in tutor's authorized topics (vtutor_topics)
 * 
 * Note: File should be uploaded to storage first, then the file record
 * should be created, then this endpoint links it to a topic via topics_files
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get the authenticated user's supabase client
    const userClient = createClient();
    
    // Verify user is a tutor
    const { data: isTutor, error: tutorCheckError } = await userClient.rpc('is_tutor');
    
    if (tutorCheckError) {
      console.error('Error checking tutor status:', tutorCheckError);
      return NextResponse.json(
        { error: 'Failed to verify tutor status' },
        { status: 500 }
      );
    }
    
    if (!isTutor) {
      return NextResponse.json(
        { error: 'Unauthorized: User is not a tutor' },
        { status: 403 }
      );
    }
    
    // Get current tutor's staff ID
    const { data: tutorId, error: tutorIdError } = await userClient.rpc('current_tutor_id');
    
    if (tutorIdError || !tutorId) {
      console.error('Error getting tutor ID:', tutorIdError);
      return NextResponse.json(
        { error: 'Failed to get tutor ID' },
        { status: 500 }
      );
    }
    
    // Validate topic_id is in tutor's authorized topics
    const { data: topicAccess, error: topicError } = await userClient
      .from('vtutor_topics')
      .select('id')
      .eq('id', body.topic_id)
      .maybeSingle();
    
    if (topicError) {
      console.error('Error checking topic access:', topicError);
      return NextResponse.json(
        { error: 'Failed to verify topic access' },
        { status: 500 }
      );
    }
    
    if (!topicAccess) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have access to this topic' },
        { status: 403 }
      );
    }
    
    // Use service role client to create the topics_file
    const serviceClient = getServiceRoleClient();
    
    // Get existing topics_files to calculate next index
    const { data: existing } = await serviceClient
      .from('topics_files')
      .select('index')
      .eq('topic_id', body.topic_id)
      .eq('type', body.type)
      .eq('is_solutions', body.is_solutions || false);
    
    type TopicsFileRow = Tables<'topics_files'>;
    const existingRows = (existing ?? []) as TopicsFileRow[];
    const maxIndex = existingRows.length > 0
      ? Math.max(...existingRows.map((t) => t.index))
      : 0;
    const index = maxIndex + 1;
    
    // code is set by database trigger, so we provide empty string (will be overwritten)
    const topicsFileData: TablesInsert<'topics_files'> = {
      topic_id: body.topic_id,
      type: body.type,
      index,
      file_id: body.file_id,
      code: '', // Will be set by trigger
      is_solutions: body.is_solutions || false,
      is_solutions_of_id: body.is_solutions_of_id || null,
      created_by: tutorId,
    };
    
    const { data, error } = await serviceClient
      .from('topics_files')
      .insert(topicsFileData)
      .select(`
        *,
        file:files(*)
      `)
      .single();
    
    if (error) {
      console.error('Error creating topics_file:', error);
      return NextResponse.json(
        { error: 'Failed to create topics_file' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data,
      message: 'Topics file created successfully',
    });
    
  } catch (error) {
    console.error('Error in POST /api/topics-files:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

