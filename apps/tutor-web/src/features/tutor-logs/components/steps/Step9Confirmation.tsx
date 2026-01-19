'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@altitutor/ui';
import { Separator } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import type { TutorLogFormData } from '../../types';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { topicsApi } from '@/features/topics/api/topics';
import { format } from 'date-fns';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

type Step9ConfirmationProps = {
  formData: Partial<TutorLogFormData>;
  onSubmit: () => void;
  isSubmitting: boolean;
};

type SessionDisplay = {
  id: string;
  start_at: string | null;
  end_at: string | null;
  class: {
    subject: {
      name: string | null;
    };
  };
};

export function Step9Confirmation({
  formData,
  onSubmit: _onSubmit,
  isSubmitting: _isSubmitting,
}: Step9ConfirmationProps) {
  const [session, setSession] = useState<SessionDisplay | null>(null);
  const [studentsMap, setStudentsMap] = useState<Map<string, Tables<'students'>>>(new Map());
  const [staffMap, setStaffMap] = useState<Map<string, Tables<'staff'>>>(new Map());
  const [topicsMap, setTopicsMap] = useState<Map<string, Tables<'topics'>>>(new Map());
  const [topicFilesMap, setTopicFilesMap] = useState<Map<string, Tables<'topics_files'>>>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      if (!formData.sessionId) return;
      
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);

      // Get session detail from view
      const { data: sessionDetail } = await supabase
        .from('vtutor_session_detail')
        .select('*')
        .eq('session_id', formData.sessionId)
        .maybeSingle();
      
      if (sessionDetail && sessionDetail.session_id) {
        // Transform session detail to match expected format
        setSession({
          id: sessionDetail.session_id,
          start_at: sessionDetail.start_at,
          end_at: sessionDetail.end_at,
          class: {
            subject: {
              name: sessionDetail.subject_name,
            },
          },
        });
      }

      // Get students from vtutor_students view
      const studentIds = (formData.studentAttendance || []).map((sa) => sa.studentId);
      if (studentIds.length > 0) {
        const { data: students } = await supabase
          .from('vtutor_students')
          .select('*')
          .in('id', studentIds);
        setStudentsMap(new Map((students || [])
          .filter((s): s is Tables<'students'> => s.id != null)
          .map((s) => [s.id, s])));
      }

      // Get staff from session detail or vtutor_profile
      const staffIds = (formData.staffAttendance || []).map((sa) => sa.staffId);
      if (staffIds.length > 0 && sessionDetail?.staff) {
        // Extract staff from session detail
        const staffArray = Array.isArray(sessionDetail.staff) ? sessionDetail.staff : [];
        type StaffRecord = {
          id: string;
          first_name?: string | null;
          last_name?: string | null;
          role?: string | null;
        };
        const staffMap = new Map(
          (staffArray as StaffRecord[])
            .filter((s): s is StaffRecord & { id: string } => s.id != null)
            .map((s) => [s.id, s as unknown as Tables<'staff'>])
        );
        setStaffMap(staffMap);
      } else if (staffIds.length > 0) {
        // Fallback: get from vtutor_profile (only current tutor)
        const { data: currentProfile } = await supabase
          .from('vtutor_profile')
          .select('*')
          .maybeSingle();
        if (currentProfile && currentProfile.id && staffIds.includes(currentProfile.id)) {
          // Type assertion needed because vtutor_profile view has nullable fields
          const staffRecord = currentProfile as unknown as Tables<'staff'>;
          setStaffMap(new Map([[currentProfile.id, staffRecord]]));
        }
      }

      // Get topics from vtutor_topics view
      const topicIds = (formData.topics || []).map((t) => t.topicId);
      if (topicIds.length > 0) {
        const topics = await topicsApi.getAllTopics();
        const validTopics = topics.filter((t): t is Tables<'topics'> => t.id != null && t.name != null && t.subject_id != null && t.index != null);
        setTopicsMap(new Map(validTopics.filter((t) => topicIds.includes(t.id)).map((t) => [t.id, t])));
        
      }

      // Get topic files from vtutor_topics_files view
      const topicFileIds = (formData.topicFiles || []).map((tf) => tf.topicsFilesId);
      if (topicFileIds.length > 0) {
        const { data: files } = await supabase
          .from('vtutor_topics_files')
          .select('*')
          .in('id', topicFileIds);
        // Filter and map to topics_files type (view includes extra file fields)
        setTopicFilesMap(new Map((files || [])
          .filter(f => f.id != null && f.code != null)
          .map((f) => [f.id!, {
            id: f.id!,
            topic_id: f.topic_id!,
            type: f.type,
            index: f.index!,
            code: f.code!,
            file_id: f.file_id!,
            is_solutions: f.is_solutions,
            is_solutions_of_id: f.is_solutions_of_id,
            created_at: f.created_at,
            updated_at: f.updated_at,
            created_by: f.created_by,
          } as Tables<'topics_files'>])));
      }
    };

    if (formData.sessionId) {
      fetchData();
    }
  }, [formData]);

  const attendedStudents = formData.studentAttendance?.filter((sa) => sa.attended) || [];
  const attendedStaff = formData.staffAttendance?.filter((sa) => sa.attended) || [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold">Review and Submit</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Please review the details below before submitting your log.
        </p>
      </div>

      <Separator />

      {/* Session Info */}
      {session && (
        <div>
          <div className="font-medium mb-2">Session</div>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">Date: </span>
              {session.start_at && format(new Date(session.start_at), 'EEEE, dd MMMM yyyy')}
            </div>
            <div>
              <span className="text-muted-foreground">Time: </span>
              {session.start_at && format(new Date(session.start_at), 'HH:mm')} -{' '}
              {session.end_at && format(new Date(session.end_at), 'HH:mm')}
            </div>
            <div>
              <span className="text-muted-foreground">Subject: </span>
              {session.class?.subject?.name}
            </div>
          </div>
        </div>
      )}

      <Separator />

      {/* Staff Attendance */}
      <div>
        <div className="font-medium mb-2">Staff Attendance</div>
        <div className="space-y-2">
          {attendedStaff.map((sa) => {
            const staff = staffMap.get(sa.staffId);
            return (
              <div key={sa.staffId} className="flex items-center gap-2 text-sm">
                <Badge variant={sa.type === 'MAIN_TUTOR' ? 'default' : 'outline'}>
                  {sa.type === 'MAIN_TUTOR' ? 'Main Tutor' : sa.type === 'SECONDARY_TUTOR' ? 'Secondary Tutor' : 'Trial Tutor'}
                </Badge>
                <span>
                  {staff?.first_name} {staff?.last_name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Student Attendance */}
      <div>
        <div className="font-medium mb-2">Student Attendance ({attendedStudents.length})</div>
        <div className="flex flex-wrap gap-2">
          {attendedStudents.map((sa) => {
            const student = studentsMap.get(sa.studentId);
            return (
              <Badge key={sa.studentId} variant="secondary">
                {student?.first_name} {student?.last_name}
              </Badge>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Topics */}
      <Separator />
      <div>
        <div className="font-medium mb-2">Topics Covered ({formData.topics?.length || 0})</div>
        {(formData.topics || []).length > 0 ? (
          <div className="space-y-3">
            {(formData.topics || []).map((topic) => {
              const topicData = topicsMap.get(topic.topicId);
              const topicCode = topicData?.code || '';
              const studentIds = topic.studentIds || [];
              return (
                <div key={topic.topicId} className="space-y-2">
                  <div className="text-sm">
                    <span className="font-mono text-muted-foreground">{topicCode}</span>
                    <span className="font-medium ml-2">{topicData?.name}</span>
                  </div>
                  {studentIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {studentIds.map((studentId) => {
                        const student = studentsMap.get(studentId);
                        if (!student) return null;
                        return (
                          <Badge key={studentId} variant="secondary" className="text-xs">
                            {student.first_name} {student.last_name}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No topics selected</div>
        )}
      </div>

      {/* Files */}
      <Separator />
      <div>
        <div className="font-medium mb-2">Files Used ({formData.topicFiles?.length || 0})</div>
        {(formData.topicFiles || []).length > 0 ? (
          <div className="space-y-3">
            {(formData.topics || []).map((topic) => {
              const topicData = topicsMap.get(topic.topicId);
              const files = (formData.topicFiles || []).filter((tf) => tf.topicId === topic.topicId);
              if (files.length === 0) return null;
              
              return (
                <div key={topic.topicId} className="space-y-2">
                  <div className="text-sm font-medium">{topicData?.name}</div>
                  <div className="space-y-2 pl-4">
                    {files.map((file) => {
                      const fileData = topicFilesMap.get(file.topicsFilesId);
                      if (!fileData) return null;
                      const fileCode = fileData.code || '';
                      const studentIds = file.studentIds || [];
                      
                      return (
                        <div key={file.topicsFilesId} className="space-y-1">
                          <div className="text-sm font-mono text-muted-foreground">{fileCode}</div>
                          {studentIds.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {studentIds.map((studentId) => {
                                const student = studentsMap.get(studentId);
                                if (!student) return null;
                                return (
                                  <Badge key={studentId} variant="secondary" className="text-xs">
                                    {student.first_name} {student.last_name}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No files selected</div>
        )}
      </div>

      {/* Notes */}
      <Separator />
      <div>
        <div className="font-medium mb-2">Notes</div>
        {(formData.notes?.length || 0) > 0 ? (
          <div className="space-y-2">
            {(formData.notes || []).map((note, index) => (
              <div key={index} className="text-sm p-2 bg-muted/30 rounded whitespace-pre-wrap">
                {note}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No notes added</div>
        )}
      </div>
    </div>
  );
}


