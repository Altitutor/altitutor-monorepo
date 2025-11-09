import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { TablesInsert } from '@altitutor/shared';

/**
 * POST /api/topics
 * Create a new topic
 * 
 * Authorization:
 * - User must be an active tutor (checked via is_tutor())
 * - subject_id must be in tutor's authorized subjects (vtutor_subjects)
 * - parent_id (if provided) must be in tutor's authorized topics (vtutor_topics) and same subject
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
    
    // Validate subject_id is in tutor's authorized subjects
    const { data: subjectAccess, error: subjectError } = await userClient
      .from('vtutor_subjects')
      .select('id')
      .eq('id', body.subject_id)
      .maybeSingle();
    
    if (subjectError) {
      console.error('Error checking subject access:', subjectError);
      return NextResponse.json(
        { error: 'Failed to verify subject access' },
        { status: 500 }
      );
    }
    
    if (!subjectAccess) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have access to this subject' },
        { status: 403 }
      );
    }
    
    // If parent_id is provided, validate it
    if (body.parent_id && body.parent_id !== 'none') {
      const { data: parentAccess, error: parentError } = await userClient
        .from('vtutor_topics')
        .select('id, subject_id')
        .eq('id', body.parent_id)
        .maybeSingle();
      
      if (parentError) {
        console.error('Error checking parent topic access:', parentError);
        return NextResponse.json(
          { error: 'Failed to verify parent topic access' },
          { status: 500 }
        );
      }
      
      if (!parentAccess) {
        return NextResponse.json(
          { error: 'Unauthorized: You do not have access to the parent topic' },
          { status: 403 }
        );
      }
      
      // Type assertion for view result (views aren't in generated types)
      type ParentAccess = { id: string; subject_id: string };
      const parent = parentAccess as ParentAccess;
      
      if (parent.subject_id !== body.subject_id) {
        return NextResponse.json(
          { error: 'Parent topic must be in the same subject' },
          { status: 400 }
        );
      }
    }
    
    // Use service role client to create the topic
    const serviceClient = getServiceRoleClient();
    
    // Get existing topics to calculate next index
    const { data: existing } = await serviceClient
      .from('topics')
      .select('*')
      .eq('subject_id', body.subject_id);
    
    // Calculate next index
    const parentId = body.parent_id === 'none' ? null : (body.parent_id || null);
    const siblingsData = (existing || []).filter((t: any) => 
      (t.parent_id === parentId || (t.parent_id === null && parentId === null))
    );
    const maxIndex = siblingsData.length > 0
      ? Math.max(...siblingsData.map((t: any) => t.index))
      : 0;
    const index = maxIndex + 1;
    
    const topicData: TablesInsert<'topics'> = {
      name: body.name,
      subject_id: body.subject_id,
      parent_id: parentId,
      index,
      created_by: tutorId,
    };
    
    const { data, error } = await serviceClient
      .from('topics')
      .insert(topicData)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating topic:', error);
      return NextResponse.json(
        { error: 'Failed to create topic' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data,
      message: 'Topic created successfully',
    });
    
  } catch (error) {
    console.error('Error in POST /api/topics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

