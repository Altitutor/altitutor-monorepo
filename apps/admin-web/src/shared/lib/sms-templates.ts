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
    return `Hi ${firstName}, you've been invited to create your Altitutor account. Click here to get started: ${inviteUrl}`;
  } else {
    // Registration link
    if (studentName) {
      return `Hi ${firstName}, complete registration for ${studentName} on Altitutor: ${inviteUrl}`;
    } else {
      return `Hi ${firstName}, complete your student registration on Altitutor: ${inviteUrl}`;
    }
  }
}

