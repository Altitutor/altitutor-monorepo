import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  from = 'Altitutor <noreply@altitutor.com>',
}: SendEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured. Please set RESEND_API_KEY in your environment variables.');
  }

  // Initialize Resend client each time to ensure fresh instance
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message || JSON.stringify(error)}`);
  }

  return data;
}

