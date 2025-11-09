import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { TutorLogFormData } from '@/features/tutor-logs/types';

/**
 * POST /api/tutor-logs
 * Create a new tutor log
 * 
 * Authorization:
 * - User must be an active tutor (checked via is_tutor())
 * - Session must be accessible by the tutor (checked via vtutor_sessions view)
 */
export async function POST(request: NextRequest) {
  try {
    const body: TutorLogFormData = await request.json();
    
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
    
    // Verify the session is accessible by this tutor (check vtutor_sessions view)
    const { data: sessionAccess, error: sessionError } = await userClient
      .from('vtutor_sessions')
      .select('session_id')
      .eq('session_id', body.sessionId)
      .maybeSingle();
    
    if (sessionError) {
      console.error('Error checking session access:', sessionError);
      return NextResponse.json(
        { error: 'Failed to verify session access' },
        { status: 500 }
      );
    }
    
    if (!sessionAccess) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have access to this session' },
        { status: 403 }
      );
    }
    
    // Check if a tutor log already exists for this session
    const { data: existingLog, error: existingLogError } = await userClient
      .from('vtutor_tutor_log')
      .select('tutor_log_id')
      .eq('session_id', body.sessionId)
      .maybeSingle();
    
    if (existingLogError) {
      console.error('Error checking existing log:', existingLogError);
      return NextResponse.json(
        { error: 'Failed to check for existing log' },
        { status: 500 }
      );
    }
    
    if (existingLog) {
      return NextResponse.json(
        { error: 'A tutor log already exists for this session' },
        { status: 409 }
      );
    }
    
    // Use service role client to create the tutor log
    const serviceClient = getServiceRoleClient();
    
    try {
      // 1. Create the tutor log
      const tutorLogPayload = {
        id: crypto.randomUUID(),
        session_id: body.sessionId,
        created_by: tutorId,
      };

      const { data: tutorLog, error: tutorLogError } = await serviceClient
        .from('tutor_logs')
        .insert(tutorLogPayload)
        .select()
        .single();

      if (tutorLogError) throw tutorLogError;

      const tutorLogId = tutorLog.id;

      // 2. Create staff attendance records
      if (body.staffAttendance && body.staffAttendance.length > 0) {
        const staffAttendancePayload = body.staffAttendance.map((sa) => ({
          id: crypto.randomUUID(),
          tutor_log_id: tutorLogId,
          staff_id: sa.staffId,
          attended: sa.attended,
          type: sa.type,
        }));

        const { error: staffError } = await serviceClient
          .from('tutor_logs_staff_attendance')
          .insert(staffAttendancePayload);

        if (staffError) throw staffError;
      }

      // 3. Create student attendance records
      if (body.studentAttendance && body.studentAttendance.length > 0) {
        const studentAttendancePayload = body.studentAttendance.map((sa) => ({
          id: crypto.randomUUID(),
          tutor_log_id: tutorLogId,
          student_id: sa.studentId,
          attended: sa.attended,
          created_by: tutorId,
        }));

        const { error: studentError } = await serviceClient
          .from('tutor_logs_student_attendance')
          .insert(studentAttendancePayload);

        if (studentError) throw studentError;
      }

      // 4. Create topic records
      if (body.topics && body.topics.length > 0) {
        const topicsPayload = body.topics.map((t) => ({
          id: crypto.randomUUID(),
          tutor_log_id: tutorLogId,
          topic_id: t.topicId,
          created_by: tutorId,
        }));

        const { data: createdTopics, error: topicsError } = await serviceClient
          .from('tutor_logs_topics')
          .insert(topicsPayload)
          .select();

        if (topicsError) throw topicsError;

        // 5. Create topic-student links
        const topicStudentsPayload: any[] = [];
        body.topics.forEach((t) => {
          const tutorLogTopicRecord = createdTopics?.find(
            (ct: any) => ct.topic_id === t.topicId
          );
          if (tutorLogTopicRecord && t.studentIds) {
            t.studentIds.forEach((studentId) => {
              topicStudentsPayload.push({
                id: crypto.randomUUID(),
                tutor_logs_topics_id: tutorLogTopicRecord.id,
                student_id: studentId,
                created_by: tutorId,
              });
            });
          }
        });

        if (topicStudentsPayload.length > 0) {
          const { error: topicStudentsError } = await serviceClient
            .from('tutor_logs_topics_students')
            .insert(topicStudentsPayload);

          if (topicStudentsError) throw topicStudentsError;
        }
      }

      // 6. Create topic file records
      if (body.topicFiles && body.topicFiles.length > 0) {
        const topicFilesPayload = body.topicFiles.map((tf) => ({
          id: crypto.randomUUID(),
          tutor_log_id: tutorLogId,
          topics_files_id: tf.topicsFilesId,
          created_by: tutorId,
        }));

        const { data: createdTopicFiles, error: topicFilesError } = await serviceClient
          .from('tutor_logs_topics_files')
          .insert(topicFilesPayload)
          .select();

        if (topicFilesError) throw topicFilesError;

        // 7. Create topic file-student links
        const topicFileStudentsPayload: any[] = [];
        body.topicFiles.forEach((tf) => {
          const tutorLogTopicFileRecord = createdTopicFiles?.find(
            (ctf: any) => ctf.topics_files_id === tf.topicsFilesId
          );
          if (tutorLogTopicFileRecord && tf.studentIds) {
            tf.studentIds.forEach((studentId) => {
              topicFileStudentsPayload.push({
                id: crypto.randomUUID(),
                tutor_logs_topics_files_id: tutorLogTopicFileRecord.id,
                student_id: studentId,
                created_by: tutorId,
              });
            });
          }
        });

        if (topicFileStudentsPayload.length > 0) {
          const { error: topicFileStudentsError } = await serviceClient
            .from('tutor_logs_topics_files_students')
            .insert(topicFileStudentsPayload);

          if (topicFileStudentsError) throw topicFileStudentsError;
        }
      }

      // 8. Create notes
      if (body.notes && body.notes.length > 0) {
        const notesPayload = body.notes.map((note) => ({
          id: crypto.randomUUID(),
          target_type: 'tutor_logs',
          target_id: tutorLogId,
          note: note,
          created_by: tutorId,
        }));

        const { error: notesError } = await serviceClient
          .from('notes')
          .insert(notesPayload);

        if (notesError) throw notesError;
      }

      return NextResponse.json({
        success: true,
        tutorLogId: tutorLogId,
        message: 'Tutor log created successfully',
      });
      
    } catch (error) {
      console.error('Error creating tutor log:', error);
      return NextResponse.json(
        { error: 'Failed to create tutor log' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error in POST /api/tutor-logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

