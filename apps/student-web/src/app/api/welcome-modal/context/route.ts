import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@altitutor/shared';
import { createClient as createServerClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import { formatTime } from '@/shared/utils/datetime';

type StudentSubject = Database['public']['Views']['vstudent_subjects']['Row'];

type HomeworkHelpClassRow = {
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
};

const DAY_NAMES: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

function formatHomeworkHelpTime(homeworkClass: HomeworkHelpClassRow | null): string | null {
  if (!homeworkClass) return null;
  if (!homeworkClass.start_time || !homeworkClass.end_time) return null;

  const dayLabel =
    homeworkClass.day_of_week !== null && DAY_NAMES[homeworkClass.day_of_week]
      ? `${DAY_NAMES[homeworkClass.day_of_week]} `
      : 'Weekly ';

  return `${dayLabel}${formatTime(homeworkClass.start_time)} - ${formatTime(homeworkClass.end_time)}`;
}

/**
 * GET /api/welcome-modal/context
 * Returns dynamic content for the student welcome modal:
 * - Student's enrolled subjects
 * - Homework help session time
 */
export async function GET(_request: NextRequest) {
  try {
    const userClient = createServerClient();

    const { data: isStudent, error: studentCheckError } = await userClient.rpc('is_student');
    if (studentCheckError) {
      console.error('Error checking student status:', studentCheckError);
      return NextResponse.json(
        { error: 'Failed to verify student status' },
        { status: 500 }
      );
    }

    if (!isStudent) {
      return NextResponse.json(
        { error: 'Unauthorized: User is not a student' },
        { status: 403 }
      );
    }

    const { data: studentId, error: studentIdError } = await userClient.rpc('current_student_id');
    if (studentIdError || !studentId) {
      console.error('Error getting student ID:', studentIdError);
      return NextResponse.json(
        { error: 'Failed to get student ID' },
        { status: 500 }
      );
    }

    const { data: subjectsData, error: subjectsError } = await userClient
      .from('vstudent_subjects')
      .select('id, name, long_name, curriculum, year_level, color, discipline')
      .order('curriculum', { ascending: true })
      .order('year_level', { ascending: true })
      .order('name', { ascending: true });

    if (subjectsError) {
      console.error('Error fetching student subjects:', subjectsError);
      return NextResponse.json(
        { error: 'Failed to fetch student subjects' },
        { status: 500 }
      );
    }

    const typedSubjects = (subjectsData ?? []) as StudentSubject[];
    const baseSubjects = typedSubjects
      .filter((subject): subject is StudentSubject & { id: string; name: string } => !!subject.id && !!subject.name)
      .map((subject) => ({
        id: subject.id,
        name: subject.name,
        long_name: subject.long_name,
        curriculum: subject.curriculum,
        year_level: subject.year_level,
        color: subject.color,
        discipline: subject.discipline,
      }));

    const adminClient = getServerSupabaseAdmin();
    const nowIso = new Date().toISOString();
    const subjectIds = baseSubjects.map((subject) => subject.id);

    const { data: defaultClassPricing, error: defaultPricingError } = await adminClient
      .from('billing_pricing')
      .select('hourly_rate_cents')
      .eq('billing_type', 'CLASS')
      .single();

    if (defaultPricingError) {
      console.error('Error fetching default CLASS pricing:', defaultPricingError);
      return NextResponse.json(
        { error: 'Failed to fetch class pricing' },
        { status: 500 }
      );
    }

    const defaultHourlyRateCents = defaultClassPricing.hourly_rate_cents;

    const { data: overridesData, error: overridesError } = await adminClient
      .from('billing_pricing_overrides')
      .select('subject_id, hourly_rate_cents, effective_from, effective_until')
      .eq('billing_type', 'CLASS')
      .in('subject_id', subjectIds.length > 0 ? subjectIds : ['00000000-0000-0000-0000-000000000000']);

    if (overridesError) {
      console.error('Error fetching class pricing overrides:', overridesError);
      return NextResponse.json(
        { error: 'Failed to fetch class pricing overrides' },
        { status: 500 }
      );
    }

    const activeOverridesBySubject = new Map<string, number>();
    for (const override of overridesData ?? []) {
      const effectiveFrom = override.effective_from;
      const effectiveUntil = override.effective_until;
      const isActive =
        effectiveFrom <= nowIso &&
        (effectiveUntil === null || effectiveUntil >= nowIso);

      if (!isActive) continue;

      const existing = activeOverridesBySubject.get(override.subject_id);
      if (existing === undefined || override.hourly_rate_cents < existing) {
        activeOverridesBySubject.set(override.subject_id, override.hourly_rate_cents);
      }
    }

    const subjects = baseSubjects.map((subject) => ({
      ...subject,
      hourly_rate_cents:
        activeOverridesBySubject.get(subject.id) ?? defaultHourlyRateCents,
    }));

    const { data: homeworkHelpClass, error: homeworkHelpError } = await adminClient
      .from('classes')
      .select('day_of_week, start_time, end_time, subjects!inner(name)')
      .eq('status', 'ACTIVE')
      .eq('subjects.name', 'Homework Help')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (homeworkHelpError) {
      console.error('Error fetching homework help class:', homeworkHelpError);
      return NextResponse.json(
        { error: 'Failed to fetch homework help session time' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        student_id: studentId,
        subjects,
        homework_help_time: formatHomeworkHelpTime((homeworkHelpClass ?? null) as HomeworkHelpClassRow | null),
        default_class_hourly_rate_cents: defaultHourlyRateCents,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/welcome-modal/context:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
