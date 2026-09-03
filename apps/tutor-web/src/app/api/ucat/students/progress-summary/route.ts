import { NextRequest, NextResponse } from 'next/server';
import { requireUcatTutor } from '@/features/ucat/shared/server/guard';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';

export type UcatStudentDeliveryMode = 'in_person' | 'online';
export type UcatStudentOnlineTier = 'free' | 'unlimited';

export type StudentProgressSummaryRow = {
  student_id: string;
  student_name: string;
  account_class: 'external' | 'internal_test';
  total_questions: number;
  total_sets_attempted: number;
  total_mocks_attempted: number;
  last_attempted_at: string | null;
  section_scores: Record<string, number | null>;
  class_ids: string[];
  delivery_mode: UcatStudentDeliveryMode;
  online_tier: UcatStudentOnlineTier;
};

type StudentCandidate = {
  id: string;
  first_name: string;
  last_name: string;
  ucat_onboarding_completed_at: string | null;
  ucat_signup_completed_at: string | null;
  ucat_online_tier_override: string;
  account_class: 'external' | 'internal_test';
};

function resolveOnlineTier(
  student: StudentCandidate,
  subscriptions: Array<{ status: string; plan_tier: string | null }>
): UcatStudentOnlineTier {
  if (student.ucat_online_tier_override === 'force_unlimited') {
    return 'unlimited';
  }
  if (student.ucat_online_tier_override === 'force_free') return 'free';
  if (subscriptions.some((subscription) => ['trialing', 'active', 'past_due'].includes(subscription.status))) {
    return 'unlimited';
  }
  return 'free';
}

export async function GET(_request: NextRequest) {
  const access = await requireUcatTutor();
  if (!access.ok) return access.response;

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'UCAT student reporting is not configured on this server' }, { status: 500 });
  }

  const { data: subject, error: subjectError } = await supabaseAdmin
    .from('subjects')
    .select('id')
    .eq('name', 'UCAT')
    .maybeSingle();

  if (subjectError || !subject?.id) {
    return NextResponse.json({ error: subjectError?.message ?? 'UCAT subject not found' }, { status: 500 });
  }

  const [studentsResult, classesResult, sectionsResult] = await Promise.all([
    supabaseAdmin
      .from('students')
      .select(
        'id, first_name, last_name, ucat_onboarding_completed_at, ucat_signup_completed_at, ucat_online_tier_override, account_class'
      )
      .not('user_id', 'is', null),
    supabaseAdmin.from('classes').select('id, short_name, long_name').eq('subject_id', subject.id),
    supabaseAdmin.from('ucat_sections').select('id, name, section_number').order('section_number'),
  ]);

  const initialError = studentsResult.error ?? classesResult.error ?? sectionsResult.error;
  if (initialError) {
    return NextResponse.json({ error: initialError.message }, { status: 500 });
  }

  const students = (studentsResult.data ?? []) as StudentCandidate[];
  const classes = classesResult.data ?? [];
  const classIds = classes.map((item) => item.id);
  const studentIds = students.map((student) => student.id);

  const [enrolmentsResult, subscriptionsResult] = await Promise.all([
    classIds.length > 0
      ? supabaseAdmin
          .from('classes_students')
          .select('class_id, student_id')
          .in('class_id', classIds)
          .is('unenrolled_at', null)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length > 0
      ? supabaseAdmin
          .from('student_subscriptions')
          .select('student_id, status, plan_tier')
          .eq('subject_id', subject.id)
          .in('student_id', studentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const accessError = enrolmentsResult.error ?? subscriptionsResult.error;
  if (accessError) {
    return NextResponse.json({ error: accessError.message }, { status: 500 });
  }

  const classIdsByStudent = new Map<string, string[]>();
  for (const enrolment of enrolmentsResult.data ?? []) {
    const current = classIdsByStudent.get(enrolment.student_id) ?? [];
    current.push(enrolment.class_id);
    classIdsByStudent.set(enrolment.student_id, current);
  }

  const subscriptionsByStudent = new Map<string, Array<{ status: string; plan_tier: string | null }>>();
  for (const subscription of subscriptionsResult.data ?? []) {
    const current = subscriptionsByStudent.get(subscription.student_id) ?? [];
    current.push({
      status: subscription.status,
      plan_tier: subscription.plan_tier,
    });
    subscriptionsByStudent.set(subscription.student_id, current);
  }

  const eligibleStudents = students.filter((student) => {
    const hasCompletedUcatSignup =
      student.ucat_signup_completed_at != null || student.ucat_onboarding_completed_at != null;
    const isInPerson = (classIdsByStudent.get(student.id)?.length ?? 0) > 0;
    const hasOnlineSubscription =
      subscriptionsByStudent
        .get(student.id)
        ?.some((subscription) => ['trialing', 'active', 'past_due'].includes(subscription.status)) ?? false;
    return hasCompletedUcatSignup || isInPerson || hasOnlineSubscription;
  });
  const eligibleStudentIds = eligibleStudents.map((student) => student.id);

  if (eligibleStudentIds.length === 0) {
    return NextResponse.json({
      students: [],
      sections: sectionsResult.data ?? [],
      classes: classes.map((item) => ({
        id: item.id,
        name: item.long_name ?? item.short_name ?? 'Unnamed class',
      })),
    });
  }

  const [projectionResult, questionResult, setResult, mockResult] = await Promise.all([
    supabaseAdmin
      .from('ucat_score_projection_snapshots')
      .select('student_id, snapshot_date, section_estimates')
      .in('student_id', eligibleStudentIds)
      .order('snapshot_date', { ascending: false }),
    supabaseAdmin
      .from('student_question_attempts')
      .select('student_id, attempted_at')
      .in('student_id', eligibleStudentIds)
      .eq('is_submitted', true),
    supabaseAdmin
      .from('student_question_set_attempts')
      .select('id, student_id, attempted_at, completed_at')
      .in('student_id', eligibleStudentIds)
      .not('completed_at', 'is', null),
    supabaseAdmin
      .from('student_ucat_mock_attempts')
      .select('id, student_id, attempted_at, completed_at')
      .in('student_id', eligibleStudentIds)
      .not('completed_at', 'is', null),
  ]);

  const reportingError = projectionResult.error ?? questionResult.error ?? setResult.error ?? mockResult.error;
  if (reportingError) {
    return NextResponse.json({ error: reportingError.message }, { status: 500 });
  }

  const projectionByStudent = new Map<string, Record<string, number>>();
  for (const snapshot of projectionResult.data ?? []) {
    if (projectionByStudent.has(snapshot.student_id)) continue;
    const estimates = snapshot.section_estimates;
    projectionByStudent.set(
      snapshot.student_id,
      estimates && typeof estimates === 'object' && !Array.isArray(estimates)
        ? Object.fromEntries(
            Object.entries(estimates).filter((entry): entry is [string, number] => typeof entry[1] === 'number')
          )
        : {}
    );
  }

  const totalsByStudent = new Map<
    string,
    {
      questions: number;
      sets: number;
      mocks: number;
      lastAttempted: string | null;
    }
  >(eligibleStudentIds.map((id) => [id, { questions: 0, sets: 0, mocks: 0, lastAttempted: null }]));
  const recordActivity = (studentId: string, date: string | null) => {
    const totals = totalsByStudent.get(studentId);
    if (!totals || !date) return;
    if (!totals.lastAttempted || date > totals.lastAttempted) {
      totals.lastAttempted = date;
    }
  };

  for (const question of questionResult.data ?? []) {
    const totals = totalsByStudent.get(question.student_id);
    if (!totals) continue;
    totals.questions += 1;
    recordActivity(question.student_id, question.attempted_at);
  }
  for (const set of setResult.data ?? []) {
    const totals = totalsByStudent.get(set.student_id);
    if (!totals) continue;
    totals.sets += 1;
    recordActivity(set.student_id, set.completed_at ?? set.attempted_at);
  }
  for (const mock of mockResult.data ?? []) {
    const totals = totalsByStudent.get(mock.student_id);
    if (!totals) continue;
    totals.mocks += 1;
    recordActivity(mock.student_id, mock.completed_at ?? mock.attempted_at);
  }

  const sections = (sectionsResult.data ?? []).map((section) => ({
    id: section.id,
    name: section.name ?? 'Unknown',
    section_number: section.section_number ?? 0,
  }));
  const result = eligibleStudents
    .map((student): StudentProgressSummaryRow => {
      const totals = totalsByStudent.get(student.id) ?? {
        questions: 0,
        sets: 0,
        mocks: 0,
        lastAttempted: null,
      };
      const classIdsForStudent = classIdsByStudent.get(student.id) ?? [];
      const projections = projectionByStudent.get(student.id) ?? {};
      return {
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`.trim() || 'Unnamed student',
        account_class: student.account_class,
        total_questions: totals.questions,
        total_sets_attempted: totals.sets,
        total_mocks_attempted: totals.mocks,
        last_attempted_at: totals.lastAttempted,
        section_scores: Object.fromEntries(
          sections.map((section) => [
            section.id,
            projections[section.id] != null ? Math.round(projections[section.id]) : null,
          ])
        ),
        class_ids: classIdsForStudent,
        delivery_mode: classIdsForStudent.length > 0 ? 'in_person' : 'online',
        online_tier: resolveOnlineTier(student, subscriptionsByStudent.get(student.id) ?? []),
      };
    })
    .sort((a, b) => (b.last_attempted_at ?? '').localeCompare(a.last_attempted_at ?? ''));

  return NextResponse.json({
    students: result,
    sections,
    classes: classes.map((item) => ({
      id: item.id,
      name: item.long_name ?? item.short_name ?? 'Unnamed class',
    })),
  });
}
