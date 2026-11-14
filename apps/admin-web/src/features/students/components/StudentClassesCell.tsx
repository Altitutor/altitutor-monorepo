'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, EntityChip } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { getSubjectColorStyle } from '@/shared/utils';
import { getDayShortName, formatTime } from '@/shared/utils/datetime';
import { EnrollStudentModal } from '@/features/enrollments';
import { classesApi } from '@/features/classes/api/classes';
import { useCurrentStaff } from '@/shared/hooks';
import { invalidateStudentClassSurfaces } from '@/shared/lib/query-invalidation';

export type DirectoryClass = Pick<Tables<'classes'>, 'id' | 'short_name' | 'long_name' | 'day_of_week' | 'start_time' > & { subject_id?: string | null } & { subject?: Tables<'subjects'> | null };

function classChipLabel(c: DirectoryClass) {
  return c.short_name?.trim() || c.long_name?.trim()
    || [c.day_of_week == null ? '' : getDayShortName(c.day_of_week), formatTime(c.start_time)].filter(Boolean).join(' ')
    || `Class ${c.id.slice(0, 8)}`;
}

export function StudentClassesCell({ student, subjects, classes, onOpenClass }: {
  student: Tables<'students'>;
  subjects: Tables<'subjects'>[];
  classes: DirectoryClass[];
  onOpenClass: (id: string) => void;
}) {
  const [enrolled, setEnrolled] = useState(false);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const { data: staff } = useCurrentStaff();
  const queryClient = useQueryClient();
  const allSubjects = [...new Map([...subjects, ...classes.flatMap((c) => c.subject ? [c.subject] : [])].map((subject) => [subject.id, subject])).values()];
  const ordered = [...classes].sort((a, b) => (a.day_of_week ?? 0) - (b.day_of_week ?? 0) || (a.start_time ?? '').localeCompare(b.start_time ?? ''));
  return <div className="space-y-1" onClick={(event) => event.stopPropagation()}>
    {allSubjects.map((subject) => {
      const enrolled = ordered.filter((c) => (c.subject_id ?? c.subject?.id) === subject.id);
      const { style, textColorClass } = getSubjectColorStyle(subject);
      return <div key={subject.id} className="flex flex-wrap items-center gap-1.5">
        <Badge className={textColorClass} style={style}>{subject.short_name || subject.name}</Badge>
        {enrolled.map((c) => <EntityChip key={c.id} entityType="class" entityId={c.id} label={classChipLabel(c)} onClick={() => onOpenClass(c.id)} />)}
        {!enrolled.length && <Button variant="outline" size="sm" className="h-6 rounded-full px-2 text-xs" disabled={!staff}
          aria-label={`Add class for ${subject.name}`} onClick={() => setSubjectId(subject.id)}><Plus className="mr-1 h-3 w-3" />Add class</Button>}
      </div>;
    })}
    {ordered.filter((c) => !allSubjects.some((subject) => subject.id === (c.subject_id ?? c.subject?.id))).map((c) =>
      <EntityChip key={c.id} entityType="class" entityId={c.id} label={classChipLabel(c)} onClick={() => onOpenClass(c.id)} />)}
    {!allSubjects.length && !classes.length && <span className="text-xs text-muted-foreground">No subjects</span>}
    {subjectId && staff && <EnrollStudentModal isOpen onClose={() => {
      setSubjectId(null);
      if (enrolled) void invalidateStudentClassSurfaces(queryClient, student.id);
      setEnrolled(false);
    }} context="student" student={student}
      studentSubjects={allSubjects} subjectId={subjectId} enrolledClassIds={classes.map((c) => c.id)}
      onFetchClasses={() => classesApi.fetchClassesForSubject(subjectId)} currentStaffId={staff.id}
      onEnroll={async (params) => {
        await classesApi.enrollStudent(params.classId, params.studentId, params.enrolledAt, params.staffId);
        setEnrolled(true);
      }} />}
  </div>;
}
