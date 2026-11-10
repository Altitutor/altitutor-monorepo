import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import type { StudentWithoutClasses } from '../types';

async function readRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const size = 500;
  const result: T[] = [];
  for (let offset = 0; ; offset += size) {
    const { data, error } = await page(offset, offset + size - 1);
    if (error) throw error;
    result.push(...(data ?? []));
    if (!data || data.length < size) return result;
  }
}

// Both directly assigned subjects and manual access grants count.
export async function loadStudentsWithoutClasses(db: SupabaseClient<Database>): Promise<StudentWithoutClasses[]> {
  const now = new Date().toISOString();
  const results: StudentWithoutClasses[] = [];
  const size = 100;
  for (let offset = 0; ; offset += size) {
    const { data: students, error } = await db.from('students')
      .select('id, first_name, last_name, created_at, updated_at')
      .eq('status', 'ACTIVE').is('deleted_at', null)
      .order('id').range(offset, offset + size - 1);
    if (error) throw error;
    const ids = students.map((row) => row.id);
    if (!ids.length) break;
    const [direct, manual, enrolled] = await Promise.all([
      readRows(async (from, to) => db.from('students_subjects')
        .select('student_id, created_at, subject:subjects(id,name,short_name,long_name,curriculum,year_level)')
        .in('student_id', ids).order('id').range(from, to)),
      readRows(async (from, to) => db.from('students_online_access_manual')
        .select('student_id, created_at, subject:subjects(id,name,short_name,long_name,curriculum,year_level)')
        .in('student_id', ids).order('id').range(from, to)),
      readRows(async (from, to) => db.from('classes_students')
        .select('student_id, class:classes!inner(subject_id)')
        .in('student_id', ids).eq('class.status', 'ACTIVE').lte('enrolled_at', now)
        .or(`unenrolled_at.is.null,unenrolled_at.gt.${now}`).order('id').range(from, to)),
    ]);
    const hasClass = new Set(enrolled.map((row) => `${row.student_id}:${row.class?.subject_id}`));
    const studentById = new Map(students.map((row) => [row.id, row]));
    const handled = new Set<string>();
    for (const row of [...direct, ...manual]) {
      if (!row.subject) continue;
      const key = `${row.student_id}:${row.subject.id}`;
      if (handled.has(key) || hasClass.has(key)) continue;
      const student = studentById.get(row.student_id);
      if (!student) continue;
      handled.add(key);
      results.push({
        student_id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        subject_id: row.subject.id,
        subject_name: row.subject.name ?? '',
        subject_short_name: row.subject.short_name,
        subject_long_name: row.subject.long_name,
        subject_curriculum: row.subject.curriculum,
        subject_year_level: row.subject.year_level,
        subject_added_at: row.created_at,
        created_at: student.created_at ?? '',
        updated_at: student.updated_at ?? '',
      });
    }
    if (students.length < size) break;
  }
  return results;
}
