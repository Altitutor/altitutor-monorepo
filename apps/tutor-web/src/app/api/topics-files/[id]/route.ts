import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { TablesUpdate } from '@altitutor/shared';

/**
 * PATCH /api/topics-files/[id]
 * Update an existing topics_file
 * 
 * Authorization:
 * - User must be an active tutor (checked via is_tutor())
 * - topics_file must be accessible (topic_id in vtutor_topics)
 * 
 * Allowed updates: index, type, is_solutions, is_solutions_of_id
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const topicsFileId = params.id;
    
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
    
    // Verify the topics_file is accessible by this tutor (check vtutor_topics_files view)
    const { data: topicsFileAccess, error: topicsFileError } = await userClient
      .from('vtutor_topics_files')
      .select('id, topic_id')
      .eq('id', topicsFileId)
      .maybeSingle();
    
    if (topicsFileError) {
      console.error('Error checking topics_file access:', topicsFileError);
      return NextResponse.json(
        { error: 'Failed to verify topics_file access' },
        { status: 500 }
      );
    }
    
    if (!topicsFileAccess) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have access to this topics_file' },
        { status: 403 }
      );
    }
    
    // Use service role client to update the topics_file
    const serviceClient = getServiceRoleClient();
    
    const updates: TablesUpdate<'topics_files'> = {};
    if (body.index !== undefined) updates.index = body.index;
    if (body.type !== undefined) updates.type = body.type;
    if (body.is_solutions !== undefined) updates.is_solutions = body.is_solutions;
    if (body.is_solutions_of_id !== undefined) updates.is_solutions_of_id = body.is_solutions_of_id;
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided for update' },
        { status: 400 }
      );
    }
    
    const { data, error } = await serviceClient
      .from('topics_files')
      .update(updates)
      .eq('id', topicsFileId)
      .select(`
        *,
        file:files(*)
      `)
      .single();
    
    if (error) {
      console.error('Error updating topics_file:', error);
      return NextResponse.json(
        { error: 'Failed to update topics_file' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data,
      message: 'Topics file updated successfully',
    });
    
  } catch (error) {
    console.error('Error in PATCH /api/topics-files/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

