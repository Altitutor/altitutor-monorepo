'use client';

import { useEffect, useMemo, useState } from 'react';

type HistoryRow = {
  id: string;
  student_id: string;
  action: string;
  rating: string | null;
  answered_at: string;
  duration_ms: number | null;
  undone_at: string | null;
};

type Student = { id: string; first_name: string | null; last_name: string | null };

export function FlashcardReviewHistory({ subjectId }: { subjectId: string }) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/flashcards/review-history?subjectId=${encodeURIComponent(subjectId)}`, { cache: 'no-store', signal: controller.signal })
      .then((response) => response.json())
      .then((result) => {
        setHistory(result.data?.history ?? []);
        setStudents(result.data?.students ?? []);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setHistory([]);
        setStudents([]);
      });
    return () => controller.abort();
  }, [subjectId]);

  const visibleHistory = useMemo(() => studentId ? history.filter((row) => row.student_id === studentId) : [], [history, studentId]);

  return (
    <section className="space-y-3 rounded-xl border p-5">
      <div>
        <h2 className="text-lg font-semibold">Student review history</h2>
        <p className="text-sm text-muted-foreground">Read-only history for students you currently teach in this subject.</p>
      </div>
      <select aria-label="Student" className="w-full rounded-md border bg-background px-3 py-2" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
        <option value="">Choose a student</option>
        {students.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>)}
      </select>
      {studentId && visibleHistory.length === 0 ? <p className="text-sm text-muted-foreground">No flashcard history for this subject yet.</p> : null}
      <div className="space-y-2">
        {visibleHistory.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <span className="capitalize">{row.action}{row.rating ? ` · ${row.rating}` : ''}{row.undone_at ? ' · undone' : ''}</span>
            <span className="text-muted-foreground">{new Date(row.answered_at).toLocaleString()}{row.duration_ms != null ? ` · ${(row.duration_ms / 1000).toFixed(1)}s` : ''}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
