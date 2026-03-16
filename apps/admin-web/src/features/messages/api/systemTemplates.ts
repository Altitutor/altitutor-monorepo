import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@altitutor/shared';
import { getEnrollmentConfirmationSmsTemplate } from '@/shared/lib/sms-templates';
import { getUnenrollmentConfirmationSmsTemplate } from '@/shared/lib/sms-templates';
import { getChangeClassConfirmationSmsTemplate } from '@/shared/lib/sms-templates';
import { replaceTemplateVariables } from '../utils/replaceTemplateVariables';

export type SystemTemplateKey =
  | 'booking_confirmation_subsidy_interview'
  | 'booking_confirmation_trial_session'
  | 'booking_confirmation_staff_interview'
  | 'booking_confirmation_drafting'
  | 'booking_confirmation_simple'
  | 'absence_notification'
  | 'student_invite'
  | 'student_registration_invite'
  | 'enrollment_confirmation'
  | 'unenrollment_confirmation'
  | 'change_class_confirmation';

/**
 * Fetch system template content from DB by template_key.
 * Returns null if not found or DB unavailable.
 */
export async function fetchSystemTemplate(
  supabase: SupabaseClient<Database>,
  templateKey: string
): Promise<Tables<'message_templates'> | null> {
  const { data, error } = await supabase
    .from('message_templates')
    .select('*')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  return data as Tables<'message_templates'>;
}

/**
 * Get system template content: DB first, then fallback to hardcoded default.
 */
export async function getSystemTemplateContent(
  supabase: SupabaseClient<Database>,
  templateKey: SystemTemplateKey
): Promise<string> {
  const row = await fetchSystemTemplate(supabase, templateKey);
  if (row?.content) return row.content;

  switch (templateKey) {
    case 'booking_confirmation_subsidy_interview':
      return 'Hi {first_name}, your subsidy interview has been booked for {session_date} at {session_time}. View your confirmation: {booking_url}\n\nKind regards,\n{sender_name}';
    case 'booking_confirmation_trial_session':
      return 'Hi {first_name}, your trial session is confirmed for {session_date} at {session_time}. View details: {booking_url}\n\nKind regards,\n{sender_name}';
    case 'booking_confirmation_staff_interview':
      return 'Hi {first_name}, your staff interview has been booked for {session_date} at {session_time}. View details: {booking_url}\n\nKind regards,\n{sender_name}';
    case 'booking_confirmation_drafting':
      return 'Hi {first_name}, you have been drafted for a session on {session_date} at {session_time}. View details: {booking_url}\n\nKind regards,\n{sender_name}';
    case 'booking_confirmation_simple':
      return 'Hi {first_name}, view your booking confirmation: {booking_url}\n\nKind regards,\n{sender_name}';
    case 'absence_notification':
      return `Hi {recipient_name},

I have processed the following absences for you:
{absence_details}

Kind regards,

{sender_name}, Altitutor Admin`;
    case 'student_invite':
      return 'Hi {first_name}, click on this link to log into your Altitutor account: {invite_url}\n\nKind regards,\n{sender_name}';
    case 'student_registration_invite':
      return 'Hi {first_name},\n\nThank you for coming to your trial session. To register {student_name} as a student at Altitutor, please click the link below:\n\n{invite_url}\n\nKind regards,\n{sender_name}';
    case 'enrollment_confirmation':
      return getEnrollmentConfirmationSmsTemplate({
        name: '{name}',
        className: '{class_name}',
        startDate: '{start_date}',
        senderName: '{sender_name}',
      });
    case 'unenrollment_confirmation':
      return getUnenrollmentConfirmationSmsTemplate({
        name: '{name}',
        className: '{class_name}',
        finalSessionDate: '{final_session_date}',
        senderName: '{sender_name}',
      });
    case 'change_class_confirmation':
      return getChangeClassConfirmationSmsTemplate({
        name: '{name}',
        oldClassName: '{old_class_name}',
        newClassName: '{new_class_name}',
        oldClassLastSessionDate: '{old_class_last_session_date}',
        newClassFirstSessionDate: '{new_class_first_session_date}',
        senderName: '{sender_name}',
      });
    default:
      return '';
  }
}

export type BookingSessionType =
  | 'SUBSIDY_INTERVIEW'
  | 'TRIAL_SESSION'
  | 'STAFF_INTERVIEW'
  | 'DRAFTING';

export interface BookingConfirmationParams {
  firstName: string;
  bookingUrl: string;
  sessionDate?: string;
  sessionTime?: string;
  sessionType?: BookingSessionType | string | null;
  senderName?: string;
}

export function getBookingTemplateKey(
  params: BookingConfirmationParams
): SystemTemplateKey {
  if (!params.sessionDate || !params.sessionTime) {
    return 'booking_confirmation_simple';
  }
  switch (params.sessionType) {
    case 'SUBSIDY_INTERVIEW':
      return 'booking_confirmation_subsidy_interview';
    case 'TRIAL_SESSION':
      return 'booking_confirmation_trial_session';
    case 'STAFF_INTERVIEW':
      return 'booking_confirmation_staff_interview';
    case 'DRAFTING':
      return 'booking_confirmation_drafting';
    default:
      return 'booking_confirmation_drafting';
  }
}

export async function getBookingConfirmationMessage(
  supabase: SupabaseClient<Database>,
  params: BookingConfirmationParams
): Promise<string> {
  const templateKey = getBookingTemplateKey(params);
  const content = await getSystemTemplateContent(supabase, templateKey);
  return replaceTemplateVariables(content, {
    first_name: params.firstName,
    booking_url: params.bookingUrl,
    session_date: params.sessionDate ?? '',
    session_time: params.sessionTime ?? '',
    sender_name: params.senderName ?? '',
  });
}

export interface AbsenceNotificationParams {
  recipientName: string;
  senderName: string;
  absenceDetails: string;
}

export async function getAbsenceNotificationMessage(
  supabase: SupabaseClient<Database>,
  params: AbsenceNotificationParams
): Promise<string> {
  const content = await getSystemTemplateContent(supabase, 'absence_notification');
  return replaceTemplateVariables(content, {
    recipient_name: params.recipientName,
    sender_name: params.senderName,
    absence_details: params.absenceDetails,
  });
}

export interface StudentInviteParams {
  firstName: string;
  inviteUrl: string;
  senderName?: string;
}

export async function getStudentInviteMessage(
  supabase: SupabaseClient<Database>,
  params: StudentInviteParams
): Promise<string> {
  const content = await getSystemTemplateContent(supabase, 'student_invite');
  return replaceTemplateVariables(content, {
    first_name: params.firstName,
    invite_url: params.inviteUrl,
    sender_name: params.senderName ?? '',
  });
}

export interface StudentRegistrationInviteParams {
  firstName: string;
  inviteUrl: string;
  studentName: string;
  senderName?: string;
}

export async function getStudentRegistrationInviteMessage(
  supabase: SupabaseClient<Database>,
  params: StudentRegistrationInviteParams
): Promise<string> {
  const content = await getSystemTemplateContent(supabase, 'student_registration_invite');
  return replaceTemplateVariables(content, {
    first_name: params.firstName,
    invite_url: params.inviteUrl,
    student_name: params.studentName,
    sender_name: params.senderName ?? '',
  });
}

export interface EnrollmentConfirmationParams {
  name: string;
  className: string;
  startDate: string;
  senderName: string;
}

export async function getEnrollmentConfirmationMessage(
  supabase: SupabaseClient<Database>,
  params: EnrollmentConfirmationParams
): Promise<string> {
  const content = await getSystemTemplateContent(supabase, 'enrollment_confirmation');
  return replaceTemplateVariables(content, {
    name: params.name,
    class_name: params.className,
    start_date: params.startDate,
    sender_name: params.senderName,
  });
}

export interface UnenrollmentConfirmationParams {
  name: string;
  className: string;
  finalSessionDate: string;
  senderName: string;
}

export async function getUnenrollmentConfirmationMessage(
  supabase: SupabaseClient<Database>,
  params: UnenrollmentConfirmationParams
): Promise<string> {
  const content = await getSystemTemplateContent(supabase, 'unenrollment_confirmation');
  return replaceTemplateVariables(content, {
    name: params.name,
    class_name: params.className,
    final_session_date: params.finalSessionDate,
    sender_name: params.senderName,
  });
}

export interface ChangeClassConfirmationParams {
  name: string;
  oldClassName: string;
  newClassName: string;
  oldClassLastSessionDate: string;
  newClassFirstSessionDate: string;
  senderName: string;
}

export async function getChangeClassConfirmationMessage(
  supabase: SupabaseClient<Database>,
  params: ChangeClassConfirmationParams
): Promise<string> {
  const content = await getSystemTemplateContent(supabase, 'change_class_confirmation');
  return replaceTemplateVariables(content, {
    name: params.name,
    old_class_name: params.oldClassName,
    new_class_name: params.newClassName,
    old_class_last_session_date: params.oldClassLastSessionDate,
    new_class_first_session_date: params.newClassFirstSessionDate,
    sender_name: params.senderName,
  });
}

/**
 * Helper to derive sender name from staff record.
 * Use when building params for system templates.
 */
export function getSenderNameFromStaff(
  staff: { first_name?: string | null; last_name?: string | null } | null | undefined
): string {
  if (!staff) return '';
  return `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim();
}

/**
 * Client-side: fetch system template content using browser Supabase client.
 * Use for React components that need raw template content (e.g. template editor).
 * For pre-rendered messages, prefer the getXxxMessageForClient helpers below.
 */
export async function getSystemTemplateContentForClient(
  templateKey: SystemTemplateKey
): Promise<string> {
  const { getSupabaseClient } = await import('@/shared/lib/supabase/client');
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  return getSystemTemplateContent(supabase, templateKey);
}

async function getSupabaseClientForTemplates(): Promise<SupabaseClient<Database>> {
  const { getSupabaseClient } = await import('@/shared/lib/supabase/client');
  return getSupabaseClient() as SupabaseClient<Database>;
}

/** Client-side: get fully-rendered booking confirmation message. */
export async function getBookingConfirmationMessageForClient(
  params: BookingConfirmationParams
): Promise<string> {
  const supabase = await getSupabaseClientForTemplates();
  return getBookingConfirmationMessage(supabase, params);
}

/** Client-side: get fully-rendered absence notification message. */
export async function getAbsenceNotificationMessageForClient(
  params: AbsenceNotificationParams
): Promise<string> {
  const supabase = await getSupabaseClientForTemplates();
  return getAbsenceNotificationMessage(supabase, params);
}

/** Client-side: get fully-rendered student invite message. */
export async function getStudentInviteMessageForClient(
  params: StudentInviteParams
): Promise<string> {
  const supabase = await getSupabaseClientForTemplates();
  return getStudentInviteMessage(supabase, params);
}

/** Client-side: get fully-rendered student registration invite message. */
export async function getStudentRegistrationInviteMessageForClient(
  params: StudentRegistrationInviteParams
): Promise<string> {
  const supabase = await getSupabaseClientForTemplates();
  return getStudentRegistrationInviteMessage(supabase, params);
}

/** Client-side: get fully-rendered enrollment confirmation message. */
export async function getEnrollmentConfirmationMessageForClient(
  params: EnrollmentConfirmationParams
): Promise<string> {
  const supabase = await getSupabaseClientForTemplates();
  return getEnrollmentConfirmationMessage(supabase, params);
}

/** Client-side: get fully-rendered unenrollment confirmation message. */
export async function getUnenrollmentConfirmationMessageForClient(
  params: UnenrollmentConfirmationParams
): Promise<string> {
  const supabase = await getSupabaseClientForTemplates();
  return getUnenrollmentConfirmationMessage(supabase, params);
}

/** Client-side: get fully-rendered change class confirmation message. */
export async function getChangeClassConfirmationMessageForClient(
  params: ChangeClassConfirmationParams
): Promise<string> {
  const supabase = await getSupabaseClientForTemplates();
  return getChangeClassConfirmationMessage(supabase, params);
}
