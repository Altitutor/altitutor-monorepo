import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import type { FormAnswerPayload } from '@altitutor/shared';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import {
  loadPublishedSubsidyInterviewForm,
  saveSubsidyInterviewResponse,
  subsidyFormValidationError,
} from '@/features/bookings/lib/subsidy-interview-form';

function asAnswers(value: unknown): FormAnswerPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as FormAnswerPayload;
}

async function currentStudent() {
  const userClient = createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { user: null, student: null };
  const admin = getServerSupabaseAdmin();
  const { data: student } = await admin
    .from('students')
    .select('id, first_name, last_name, email, phone, curriculum, year_level')
    .eq('user_id', user.id)
    .maybeSingle();
  return { user, student };
}

export async function GET() {
  try {
    const admin = getServerSupabaseAdmin();
    const [{ user, student }, form] = await Promise.all([
      currentStudent(),
      loadPublishedSubsidyInterviewForm(admin),
    ]);
    return NextResponse.json({
      student: student
        ? {
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            email: student.email,
            phone: student.phone,
            curriculum: student.curriculum,
            year_level: student.year_level,
          }
        : null,
      signed_in: Boolean(user && student),
      form: form
        ? {
            id: form.id,
            name: form.name,
            blocks: form.blocks,
            thank_you_message: form.thankYouMessage,
          }
        : null,
    });
  } catch (error: unknown) {
    captureApiError(error, '/api/bookings/subsidy');
    return NextResponse.json({ error: 'Could not load subsidy booking' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, student } = await currentStudent();
    if (!user || !student) {
      return NextResponse.json({ error: 'Sign in to book this interview' }, { status: 401 });
    }

    const body = await request.json();
    const startAt = new Date(body.start_at);
    const endAt = new Date(body.end_at);
    if (!body.start_at || !body.end_at || Number.isNaN(startAt.getTime()) || endAt <= startAt || startAt < new Date()) {
      return NextResponse.json({ error: 'Choose a valid interview time' }, { status: 400 });
    }

    const admin = getServerSupabaseAdmin();
    const form = await loadPublishedSubsidyInterviewForm(admin);
    const answers = asAnswers(body.form_answers);
    const validationError = subsidyFormValidationError(form, answers);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { data: sessionId, error } = await admin.rpc('create_booking_session', {
      p_session_type: 'SUBSIDY_INTERVIEW',
      p_student_id: student.id,
      p_start_at: body.start_at,
      p_end_at: body.end_at,
      p_created_by: user.id,
    });

    if (error || !sessionId) {
      return NextResponse.json(
        { error: error?.message ?? 'Failed to create booking' },
        { status: 400 },
      );
    }

    if (form && answers) {
      await saveSubsidyInterviewResponse(admin, {
        form,
        answers,
        sessionId,
        studentId: student.id,
        submittedByUserId: user.id,
        respondentIsStudent: true,
      });
    }

    const { data: bookingToken } = await admin.rpc('issue_session_booking_public_token', {
      p_session_id: sessionId,
    });

    return NextResponse.json({
      session_id: sessionId,
      student_id: student.id,
      booking_token: typeof bookingToken === 'string' ? bookingToken : null,
    });
  } catch (error: unknown) {
    captureApiError(error, '/api/bookings/subsidy');
    const message = error instanceof Error ? error.message : 'Failed to create booking';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
