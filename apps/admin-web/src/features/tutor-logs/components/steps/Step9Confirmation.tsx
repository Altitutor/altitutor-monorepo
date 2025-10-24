'use client';

import { useEffect, useState } from 'react';
import { Button } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Separator } from '@altitutor/ui';
import { Check } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import type { TutorLogFormData } from '../../types';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { format } from 'date-fns';

type Step9ConfirmationProps = {
  formData: TutorLogFormData;
  onSubmit: () => void;
  isSubmitting: boolean;
};

export function Step9Confirmation({
  formData,
  onSubmit,
  isSubmitting,
}: Step9ConfirmationProps) {
  const [session, setSession] = useState<any>(null);
  const [studentsMap, setStudentsMap] = useState<Map<string, Tables<'students'>>>(new Map());
  const [staffMap, setStaffMap] = useState<Map<string, Tables<'staff'>>>(new Map());
  const [topicsMap, setTopicsMap] = useState<Map<string, Tables<'topics'>>>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      const supabase = getSupabaseClient();

      // Get session
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*, class:classes!inner(*, subject:subjects(*))')
        .eq('id', formData.sessionId)
        .single();
      setSession(sessionData);

      // Get students
      const studentIds = formData.studentAttendance.map((sa) => sa.studentId);
      if (studentIds.length > 0) {
        const { data: students } = await supabase
          .from('students')
          .select('*')
          .in('id', studentIds);
        setStudentsMap(new Map((students || []).map((s: any) => [s.id, s])));
      }

      // Get staff
      const staffIds = formData.staffAttendance.map((sa) => sa.staffId);
      if (staffIds.length > 0) {
        const { data: staff } = await supabase
          .from('staff')
          .select('*')
          .in('id', staffIds);
        setStaffMap(new Map((staff || []).map((s: any) => [s.id, s])));
      }

      // Get topics
      const topicIds = formData.topics.map((t) => t.topicId);
      if (topicIds.length > 0) {
        const { data: topics } = await supabase
          .from('topics')
          .select('*')
          .in('id', topicIds);
        setTopicsMap(new Map((topics || []).map((t: any) => [t.id, t])));
      }
    };

    fetchData();
  }, [formData]);

  const attendedStudents = formData.studentAttendance.filter((sa) => sa.attended);
  const attendedStaff = formData.staffAttendance.filter((sa) => sa.attended);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
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
                <Badge variant={sa.type === 'PRIMARY' ? 'default' : 'outline'}>
                  {sa.type}
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
      <div>
        <div className="font-medium mb-2">Topics Covered ({formData.topics.length})</div>
        <div className="space-y-2">
          {formData.topics.map((topic) => {
            const topicData = topicsMap.get(topic.topicId);
            const studentCount = topic.studentIds.length;
            return (
              <div key={topic.topicId} className="text-sm">
                <span className="font-medium">{topicData?.name}</span>
                <span className="text-muted-foreground ml-2">({studentCount} students)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Files */}
      {formData.topicFiles.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="font-medium mb-2">Files Used ({formData.topicFiles.length})</div>
            <div className="text-sm text-muted-foreground">
              {formData.topicFiles.length} file(s) selected
            </div>
          </div>
        </>
      )}

      {/* Notes */}
      {formData.notes.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="font-medium mb-2">Notes ({formData.notes.length})</div>
            <div className="space-y-2">
              {formData.notes.map((note, index) => (
                <div key={index} className="text-sm p-2 bg-muted/30 rounded">
                  {note}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      <div className="text-center pt-4">
        <Button onClick={onSubmit} disabled={isSubmitting} size="lg">
          {isSubmitting ? 'Submitting...' : 'Submit Log'}
        </Button>
      </div>
    </div>
  );
}

