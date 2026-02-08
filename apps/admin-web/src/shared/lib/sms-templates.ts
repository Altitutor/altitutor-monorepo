export interface SmsTemplateData {
  firstName: string;
  inviteUrl: string;
  linkType: 'invite' | 'registration';
  studentName?: string; // For registration SMS sent to parents
}

export function getInviteSmsTemplate({
  firstName,
  inviteUrl,
  linkType,
  studentName,
}: SmsTemplateData): string {
  if (linkType === 'invite') {
    return `Hi ${firstName}, click on this link to log into your Altitutor account: ${inviteUrl}`;
  } else {
    return `Hi ${firstName}, \n\nThank you for coming to your trial session. To register ${studentName} as a student at Altitutor, please click the link below:\n\n${inviteUrl}`;
  }
}

export interface BookingConfirmationSmsTemplateData {
  firstName: string;
  bookingUrl: string;
  sessionDate?: string;
  sessionTime?: string;
}

export function getBookingConfirmationSmsTemplate({
  firstName,
  bookingUrl,
  sessionDate,
  sessionTime,
}: BookingConfirmationSmsTemplateData): string {
  if (sessionDate && sessionTime) {
    return `Hi ${firstName}, view your booking confirmation for ${sessionDate} at ${sessionTime}: ${bookingUrl}`;
  }
  return `Hi ${firstName}, view your booking confirmation: ${bookingUrl}`;
}

export interface EnrollmentConfirmationSmsTemplateData {
  name: string;
  className: string; // Class name including day and time
  startDate: string; // Start date formatted
  senderName: string;
}

export function getEnrollmentConfirmationSmsTemplate({
  name,
  className,
  startDate,
  senderName,
}: EnrollmentConfirmationSmsTemplateData): string {
  return `Hi ${name},

You have been enrolled in the following class:

${className}, starting on ${startDate}

Kind regards,

${senderName}`;
}

export interface UnenrollmentConfirmationSmsTemplateData {
  name: string;
  className: string; // Class name including day and time
  finalSessionDate: string; // Final session date formatted
  senderName: string;
}

export function getUnenrollmentConfirmationSmsTemplate({
  name,
  className,
  finalSessionDate,
  senderName,
}: UnenrollmentConfirmationSmsTemplateData): string {
  return `Hi ${name},

You have been unenrolled from the following class:

${className}, final session on ${finalSessionDate}

Kind regards,

${senderName}`;
}

export interface ChangeClassConfirmationSmsTemplateData {
  name: string;
  oldClassName: string; // Old class name including day and time
  newClassName: string; // New class name including day and time
  oldClassLastSessionDate: string; // Last session date formatted
  newClassFirstSessionDate: string; // First session date formatted
  senderName: string;
}

export function getChangeClassConfirmationSmsTemplate({
  name,
  oldClassName,
  newClassName,
  oldClassLastSessionDate,
  newClassFirstSessionDate,
  senderName,
}: ChangeClassConfirmationSmsTemplateData): string {
  return `Hi ${name},

Your class has been changed:

From: ${oldClassName}, your last session of this class will be on ${oldClassLastSessionDate}
To: ${newClassName}, your first session of this class will be on ${newClassFirstSessionDate}

Kind regards,

${senderName}`;
}
