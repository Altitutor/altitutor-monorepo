'use client';

import { SubjectCard, useResourceSubjects } from '@/features/resources';
import { TutorPageContainer } from '@/shared/components/layouts';

export default function TutorResourcesPage() {
  const { data: subjects, isLoading } = useResourceSubjects();

  return (
    <TutorPageContainer className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
        <p className="mt-1 text-muted-foreground">Browse subjects and learning materials for your classes.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-56 animate-pulse rounded-2xl bg-muted/50 ring-1 ring-black/[0.05] dark:ring-white/10"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(subjects ?? []).map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              href={`/resources/${encodeURIComponent((subject.short_name || subject.name || '').toLowerCase())}`}
            />
          ))}
        </div>
      )}
    </TutorPageContainer>
  );
}
