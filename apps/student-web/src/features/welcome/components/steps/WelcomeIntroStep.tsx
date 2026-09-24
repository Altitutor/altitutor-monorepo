'use client';

import {
  BookOpen,
  Calculator,
  Loader2,
  Microscope,
  PenTool,
  type LucideIcon,
} from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { cn, getSubjectColorStyle } from '@/shared/utils';

const disciplineIconMap: Record<string, LucideIcon> = {
  ENGLISH: PenTool,
  MATHEMATICS: Calculator,
  SCIENCE: Microscope,
};

export type WelcomeSubject = {
  id: string;
  name: string;
  long_name: string | null;
  curriculum: string | null;
  year_level: number | null;
  color: string | null;
  discipline: string | null;
  hourly_rate_cents: number;
};

type WelcomeIntroStepProps = {
  subjects: WelcomeSubject[];
  isContextLoading: boolean;
};

export function WelcomeIntroStep({
  subjects,
  isContextLoading,
}: WelcomeIntroStepProps) {
  return (
    <section className="space-y-5">
      <p className="text-base leading-relaxed text-muted-foreground">
        Thank you for registering to be a student with us at Altitutor. You have
        registered to be enrolled in classes for the following subjects:
      </p>

      <div className="rounded-2xl bg-muted/45 p-4 ring-1 ring-black/[0.06] dark:ring-white/10">
        {isContextLoading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading your subjects...
          </div>
        ) : subjects.length === 0 ? (
          <div className="text-base leading-relaxed text-muted-foreground">
            Your selected subjects will appear here once loaded.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subjects.map((subject) => {
              const subjectForColor = { color: subject.color } as Tables<'subjects'>;
              const { style, textColorClass } = getSubjectColorStyle(subjectForColor);
              const Icon =
                (subject.discipline && disciplineIconMap[subject.discipline]) ||
                BookOpen;
              const label =
                subject.long_name ||
                [
                  subject.curriculum,
                  subject.year_level !== null && subject.year_level !== undefined
                    ? `Year ${subject.year_level}`
                    : null,
                  subject.name,
                ]
                  .filter(Boolean)
                  .join(' ');

              return (
                <span
                  key={subject.id}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm',
                    subject.color
                      ? textColorClass
                      : 'border-border bg-muted text-foreground',
                  )}
                  style={subject.color ? style : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-base leading-relaxed text-muted-foreground">
        Our admin staff are currently working on enrolling you in sessions for
        these subjects. You will receive a text message with your classes, and
        your schedule on the Altitutor Student portal will be updated.
      </p>
    </section>
  );
}
