'use client';

import type { MouseEvent, ReactNode } from 'react';
import type { Tables } from '@altitutor/shared';
import { Badge, Button } from '@altitutor/ui';
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

function SubjectPill({
  subject,
  title,
  interactive,
  onClick,
  children,
}: {
  subject: Tables<'subjects'>;
  title?: string;
  interactive: boolean;
  onClick?: (e: MouseEvent) => void;
  children: ReactNode;
}) {
  const { style, textColorClass } = getSubjectColorStyle(subject);
  const defaultClass = !subject.color ? 'bg-muted text-foreground' : '';
  const pillClass = cn(
    'inline-flex max-w-[7rem] shrink-0 items-center truncate rounded-md px-2 py-0.5 text-left text-xs font-medium sm:max-w-[10rem]',
    defaultClass || textColorClass,
    interactive ? 'cursor-pointer hover:underline' : 'cursor-default'
  );
  const inlineStyle = style.backgroundColor ? style : undefined;

  if (interactive && onClick) {
    return (
      <button type="button" title={title} className={pillClass} style={inlineStyle} onClick={onClick}>
        {children}
      </button>
    );
  }
  return (
    <span title={title} className={pillClass} style={inlineStyle}>
      {children}
    </span>
  );
}

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

  const label = subject?.short_name?.trim() || subject?.long_name?.trim();
  const title = subject?.long_name?.trim() || subject?.short_name?.trim() || cls?.long_name?.trim() || undefined;

  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
      <Badge className={cn('shrink-0', getSessionTypeBadgeColor(session.type))}>
        {formatSessionType(session.type)}
      </Badge>
      {subject && label ? (
        <SubjectPill
          subject={subject}
          title={title}
          interactive={canOpenClass}
          onClick={
            canOpenClass
              ? (e) => {
                  e.stopPropagation();
                  onClassClick(session.class_id!, e);
                }
              : undefined
          }
        >
          <span className="truncate">{label}</span>
        </SubjectPill>
      ) : cls && session.class_id ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto min-w-0 max-w-[10rem] shrink truncate p-0 text-xs font-medium"
          title={cls.long_name?.trim() || undefined}
          onClick={(e) => {
            e.stopPropagation();
            onClassClick(session.class_id!, e);
          }}
        >
          {cls.short_name?.trim() || cls.long_name || 'Class'}
        </Button>
      ) : null}
    </div>
  );
}
