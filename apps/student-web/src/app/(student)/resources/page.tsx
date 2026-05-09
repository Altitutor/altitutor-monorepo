'use client';

import { SubjectCard, useResourceSubjects } from '@/features/resources';
import { StudentPageContainer } from '@/shared/components/layouts';

export default function ResourcesPage() {
  const { data: subjects, isLoading } = useResourceSubjects();

  return (
    <StudentPageContainer maxWidth="6xl" className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
        <p className="text-muted-foreground mt-1">Browse your subjects and learning materials.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-56 rounded-lg border bg-muted/40" />
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
    </StudentPageContainer>
  );
}
