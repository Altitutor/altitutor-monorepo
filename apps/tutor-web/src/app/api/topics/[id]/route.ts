import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { TablesUpdate } from '@altitutor/shared';

/**
 * PATCH /api/topics/[id]
 * Update an existing topic
 * 
 * Authorization:
 * - User must be an active tutor (checked via is_tutor())
 * - topic must be in tutor's authorized topics (vtutor_topics)
 * - If changing parent, new parent must be in vtutor_topics and same subject
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const topicId = params.id;
    
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
    
    // Verify the topic is accessible by this tutor (check vtutor_topics view)
    const { data: topicAccess, error: topicError } = await userClient
      .from('vtutor_topics')
      .select('id, subject_id, parent_id')
      .eq('id', topicId)
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
    
    // Type assertion for view result (views aren't in generated types)
    type TopicAccess = { id: string; subject_id: string; parent_id: string | null };
    const topic = topicAccess as TopicAccess;
    
    // If changing parent_id, validate it
    if (body.parent_id !== undefined) {
      const newParentId = body.parent_id === 'none' ? null : body.parent_id;
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'tutor-web/api/topics/[id]/route.ts:72',message:'Parent change check',data:{topicId,topicParentId:topic.parent_id,newParentId,isChanging:newParentId !== topic.parent_id},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Only validate if actually changing parent
      if (newParentId !== topic.parent_id) {
        if (newParentId) {
          const { data: parentAccess, error: parentError } = await userClient
            .from('vtutor_topics')
            .select('id, subject_id')
            .eq('id', newParentId)
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
          
          // Type assertion for parent access
          type ParentAccess = { id: string; subject_id: string };
          const parent = parentAccess as ParentAccess;
          
          if (parent.subject_id !== topic.subject_id) {
            return NextResponse.json(
              { error: 'Parent topic must be in the same subject' },
              { status: 400 }
            );
          }
        }
        
        // Don't calculate index manually - the BEFORE UPDATE trigger will handle it
        // This prevents race conditions and unique constraint violations
        // The trigger will recalculate the index based on the new parent group
        body.parent_id = newParentId;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'tutor-web/api/topics/[id]/route.ts:110',message:'Parent changed - letting trigger handle index',data:{oldParentId:topic.parent_id,newParentId},timestamp:Date.now(),runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
    }
    
    // Use service role client to update the topic
    const serviceClient = getServiceRoleClient();
    
    const updates: TablesUpdate<'topics'> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.parent_id !== undefined) updates.parent_id = body.parent_id;
    // Don't set index - the BEFORE UPDATE trigger will recalculate it when parent_id changes
    // This prevents unique constraint violations
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'tutor-web/api/topics/[id]/route.ts:144',message:'About to update topic',data:{topicId,updates,hasIndex:updates.index !== undefined,hasParentId:updates.parent_id !== undefined},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    const { data, error } = await serviceClient
      .from('topics')
      .update(updates)
      .eq('id', topicId)
      .select()
      .single();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'tutor-web/api/topics/[id]/route.ts:149',message:'Update result',data:{success:!error,errorCode:error?.code,errorMessage:error?.message,updatedIndex:data?.index,updatedParentId:data?.parent_id},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'tutor-web/api/topics/[id]/route.ts:156',message:'Update error details',data:{errorCode:error.code,errorMessage:error.message,errorDetails:error.details,errorHint:error.hint,updates},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      console.error('Error updating topic:', error);
      return NextResponse.json(
        { error: 'Failed to update topic', details: error.message, code: error.code },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data,
      message: 'Topic updated successfully',
    });
    
  } catch (error) {
    console.error('Error in PATCH /api/topics/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

