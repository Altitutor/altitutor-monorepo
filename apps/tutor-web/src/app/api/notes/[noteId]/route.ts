import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';

/**
 * PATCH /api/notes/[noteId]
 * Update a note (only if created by current tutor)
 * 
 * Authorization:
 * - User must be an active tutor
 * - Note must be created by the current tutor
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const body = await request.json();
    const { note } = body;
    
    if (!note || typeof note !== 'string' || !note.trim()) {
      return NextResponse.json(
        { error: 'Note is required' },
        { status: 400 }
      );
    }
    
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
    
    // Verify the note exists and was created by this tutor
    const { data: existingNote, error: noteError } = await userClient
      .from('notes')
      .select('id, created_by')
      .eq('id', params.noteId)
      .maybeSingle();
    
    if (noteError) {
      console.error('Error checking note:', noteError);
      return NextResponse.json(
        { error: 'Failed to verify note' },
        { status: 500 }
      );
    }
    
    if (!existingNote) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }
    
    const noteCreatedBy = (existingNote as any).created_by;
    if (!noteCreatedBy || noteCreatedBy !== tutorId) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only edit your own notes' },
        { status: 403 }
      );
    }
    
    // Use service role client to update the note
    const serviceClient = getServiceRoleClient();
    
    const { data, error } = await serviceClient
      .from('notes')
      .update({ note: note.trim() })
      .eq('id', params.noteId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating note:', error);
      return NextResponse.json(
        { error: 'Failed to update note' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error in PATCH /api/notes/[noteId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notes/[noteId]
 * Delete a note (only if created by current tutor)
 * 
 * Authorization:
 * - User must be an active tutor
 * - Note must be created by the current tutor
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
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
    
    // Verify the note exists and was created by this tutor
    const { data: existingNote, error: noteError } = await userClient
      .from('notes')
      .select('id, created_by')
      .eq('id', params.noteId)
      .maybeSingle();
    
    if (noteError) {
      console.error('Error checking note:', noteError);
      return NextResponse.json(
        { error: 'Failed to verify note' },
        { status: 500 }
      );
    }
    
    if (!existingNote) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }
    
    const noteCreatedBy = (existingNote as any).created_by;
    if (!noteCreatedBy || noteCreatedBy !== tutorId) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only delete your own notes' },
        { status: 403 }
      );
    }
    
    // Use service role client to delete the note
    const serviceClient = getServiceRoleClient();
    
    const { error } = await serviceClient
      .from('notes')
      .delete()
      .eq('id', params.noteId);
    
    if (error) {
      console.error('Error deleting note:', error);
      return NextResponse.json(
        { error: 'Failed to delete note' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error in DELETE /api/notes/[noteId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

