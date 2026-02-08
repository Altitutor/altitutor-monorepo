import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import type { TutorLogFormData } from '@/features/tutor-logs/types';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tutorLogId = params.id;
    const body = await request.json();
    const { data, createdBy } = body as { data: TutorLogFormData; createdBy: string };

    // Validate required fields
    if (!data || !data.sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!createdBy) {
      return NextResponse.json(
        { error: 'createdBy is required' },
        { status: 400 }
      );
    }

    if (!tutorLogId) {
      return NextResponse.json(
        { error: 'Tutor log ID is required' },
        { status: 400 }
      );
    }

    // Get Supabase client with service role key for RPC call
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify tutor log exists
    const { data: existingLog, error: fetchError } = await supabase
      .from('tutor_logs')
      .select('id, session_id')
      .eq('id', tutorLogId)
      .single();

    if (fetchError || !existingLog) {
      return NextResponse.json(
        { error: 'Tutor log not found' },
        { status: 404 }
      );
    }

    // Prepare data for update
    // We'll delete all related records and recreate them atomically
    // This ensures data consistency
    
    // Start transaction by deleting all related records
    // Delete in reverse order of dependencies
    
    // Get topic files IDs first
    const { data: topicFilesData } = await supabase
      .from('tutor_logs_topics_files')
      .select('id')
      .eq('tutor_log_id', tutorLogId);
    
    const topicFileIds = topicFilesData?.map(r => r.id) || [];
    
    // Delete topic files students
    if (topicFileIds.length > 0) {
      await supabase
        .from('tutor_logs_topics_files_students')
        .delete()
        .in('tutor_logs_topics_files_id', topicFileIds);
    }

    // Delete topic files
    await supabase
      .from('tutor_logs_topics_files')
      .delete()
      .eq('tutor_log_id', tutorLogId);

    // Get topic IDs first
    const { data: topicsData } = await supabase
      .from('tutor_logs_topics')
      .select('id')
      .eq('tutor_log_id', tutorLogId);
    
    const topicIds = topicsData?.map(r => r.id) || [];
    
    // Delete topic students
    if (topicIds.length > 0) {
      await supabase
        .from('tutor_logs_topics_students')
        .delete()
        .in('tutor_logs_topics_id', topicIds);
    }

    // Delete topics
    await supabase
      .from('tutor_logs_topics')
      .delete()
      .eq('tutor_log_id', tutorLogId);

    // Delete student attendance
    await supabase
      .from('tutor_logs_student_attendance')
      .delete()
      .eq('tutor_log_id', tutorLogId);

    // Delete staff attendance
    await supabase
      .from('tutor_logs_staff_attendance')
      .delete()
      .eq('tutor_log_id', tutorLogId);

    // Update the tutor log itself
    const { error: updateError } = await supabase
      .from('tutor_logs')
      .update({ created_by: createdBy })
      .eq('id', tutorLogId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Failed to update tutor log' },
        { status: 500 }
      );
    }

    // Now recreate all related records
    // Prepare data for RPC call (reuse create logic)
    const staffAttendance = (data.staffAttendance || []).map((sa) => ({
      staffId: sa.staffId,
      attended: sa.attended,
      type: sa.type,
    }));

    const studentAttendance = (data.studentAttendance || []).map((sa) => ({
      studentId: sa.studentId,
      attended: sa.attended,
    }));

    const topics = (data.topics || []).map((t) => ({
      topicId: t.topicId,
      studentIds: t.studentIds || [],
    }));

    const topicFiles = (data.topicFiles || []).map((tf) => ({
      topicsFilesId: tf.topicsFilesId,
      topicId: tf.topicId,
      studentIds: tf.studentIds || [],
    }));

    // Insert staff attendance
    if (staffAttendance.length > 0) {
      const { error: staffError } = await supabase
        .from('tutor_logs_staff_attendance')
        .insert(
          staffAttendance.map((sa) => ({
            tutor_log_id: tutorLogId,
            staff_id: sa.staffId,
            attended: sa.attended,
            type: sa.type,
          }))
        );

      if (staffError) {
        return NextResponse.json(
          { error: staffError.message || 'Failed to update staff attendance' },
          { status: 500 }
        );
      }
    }

    // Insert student attendance
    if (studentAttendance.length > 0) {
      const { error: studentError } = await supabase
        .from('tutor_logs_student_attendance')
        .insert(
          studentAttendance.map((sa) => ({
            tutor_log_id: tutorLogId,
            student_id: sa.studentId,
            attended: sa.attended,
            created_by: createdBy,
          }))
        );

      if (studentError) {
        return NextResponse.json(
          { error: studentError.message || 'Failed to update student attendance' },
          { status: 500 }
        );
      }
    }

    // Insert topics with students
    for (const topic of topics) {
      const { data: topicRecord, error: topicError } = await supabase
        .from('tutor_logs_topics')
        .insert({
          tutor_log_id: tutorLogId,
          topic_id: topic.topicId,
          created_by: createdBy,
        })
        .select('id')
        .single();

      if (topicError) {
        return NextResponse.json(
          { error: topicError.message || 'Failed to update topics' },
          { status: 500 }
        );
      }

      // Insert topic students
      if (topic.studentIds.length > 0 && topicRecord) {
        const { error: topicStudentsError } = await supabase
          .from('tutor_logs_topics_students')
          .insert(
            topic.studentIds.map((studentId) => ({
              tutor_logs_topics_id: topicRecord.id,
              student_id: studentId,
              created_by: createdBy,
            }))
          );

        if (topicStudentsError) {
          return NextResponse.json(
            { error: topicStudentsError.message || 'Failed to update topic students' },
            { status: 500 }
          );
        }
      }
    }

    // Insert topic files with students
    for (const topicFile of topicFiles) {
      const { data: fileRecord, error: fileError } = await supabase
        .from('tutor_logs_topics_files')
        .insert({
          tutor_log_id: tutorLogId,
          topics_files_id: topicFile.topicsFilesId,
          created_by: createdBy,
        })
        .select('id')
        .single();

      if (fileError) {
        return NextResponse.json(
          { error: fileError.message || 'Failed to update topic files' },
          { status: 500 }
        );
      }

      // Insert file students
      if (topicFile.studentIds.length > 0 && fileRecord) {
        const { error: fileStudentsError } = await supabase
          .from('tutor_logs_topics_files_students')
          .insert(
            topicFile.studentIds.map((studentId) => ({
              tutor_logs_topics_files_id: fileRecord.id,
              student_id: studentId,
              created_by: createdBy,
            }))
          );

        if (fileStudentsError) {
          return NextResponse.json(
            { error: fileStudentsError.message || 'Failed to update file students' },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating tutor log:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
