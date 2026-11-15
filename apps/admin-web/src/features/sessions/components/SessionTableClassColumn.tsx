'use client';

import type { MouseEvent } from 'react';
import type { Tables } from '@altitutor/shared';
import { Badge } from '@altitutor/ui';
import { EntityActionChip } from '@/shared/components/EntityActionChip';
import { openEntityReference } from '@/shared/utils/entityReference';
import { cn, formatSessionType, getSessionTypeBadgeColor, getSubjectColorStyle } from '@/shared/utils/index';

export type SessionWithOptionalSubject = Tables<'sessions'> & {
  subject?: Tables<'subjects'> | null;
};

export function resolveSessionTableSubject(
  session: SessionWithOptionalSubject,
  classesById: Record<string, Tables<'classes'>>,
  subjectsById: Record<string, Tables<'subjects'>>
): Tables<'subjects'> | null {
  if (session.subject?.id) return session.subject;
  if (session.subject_id && subjectsById[session.subject_id]) {
    return subjectsById[session.subject_id];
  }
  const cls = session.class_id ? classesById[session.class_id] : undefined;
  const sid = cls?.subject_id;
  if (sid && subjectsById[sid]) return subjectsById[sid];
  return null;
}

type SessionTableClassColumnProps = {
  session: SessionWithOptionalSubject;
  classesById: Record<string, Tables<'classes'>>;
  subjectsById: Record<string, Tables<'subjects'>>;
  onClassClick: (classId: string, e: MouseEvent) => void;
};

/**
 * Session table "class" column: session type badge + subject short name as colored pill.
 * Pill opens the class when `session.class_id` is set.
 */
export function SessionTableClassColumn({
  session,
  classesById,
  subjectsById,
  onClassClick,
}: SessionTableClassColumnProps) {
  const subject = resolveSessionTableSubject(session, classesById, subjectsById);
  const cls = session.class_id ? classesById[session.class_id] : undefined;
  const canOpenClass = Boolean(session.class_id);

  const isHomeworkHelp = session.type === 'HOMEWORK_HELP';
  const label = isHomeworkHelp
    ? 'Homework help'
    : subject?.short_name?.trim() || subject?.long_name?.trim();
  const title = isHomeworkHelp
    ? 'Homework help'
    : subject?.long_name?.trim() || subject?.short_name?.trim() || cls?.long_name?.trim() || undefined;

  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
      <Badge className={cn('shrink-0', getSessionTypeBadgeColor(session.type))}>
        {formatSessionType(session.type)}
      </Badge>
      {isHomeworkHelp ? (
        <span title={title} className="inline-flex max-w-[10rem] shrink truncate text-xs font-medium">
          Homework help
        </span>
      ) : subject && label ? (
        <EntityActionChip entityType={canOpenClass ? 'class' : 'subject'} entityId={session.class_id || subject.id} label={label} title={title}
          style={getSubjectColorStyle(subject).style} className={subject.color ? getSubjectColorStyle(subject).textColorClass : undefined}
          onClick={event => { event.stopPropagation(); if (session.class_id) onClassClick(session.class_id, event); else openEntityReference('subject', subject.id); }} />
      ) : cls && session.class_id ? (
        <EntityActionChip entityType="class" entityId={cls.id} label={cls.short_name?.trim() || cls.long_name || 'Class'}
          onClick={event => { event.stopPropagation(); onClassClick(cls.id, event); }} />
      ) : null}
    </div>
  );
}
