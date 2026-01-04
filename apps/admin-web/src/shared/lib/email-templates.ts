export interface EmailTemplateData {
  firstName: string;
  lastName: string;
  inviteUrl: string;
  linkType: 'invite' | 'registration';
  studentName?: string; // For registration emails sent to parents
}

export function getInviteEmailTemplate({
  firstName,
  lastName,
  inviteUrl,
  linkType,
  studentName,
}: EmailTemplateData): string {
  const title = linkType === 'invite' 
    ? 'Create Your Altitutor Account'
    : studentName
    ? `Complete Registration for ${studentName}`
    : 'Complete Student Registration';
  
  const buttonText = linkType === 'invite'
    ? 'Create Account'
    : 'Complete Registration';

  const greeting = linkType === 'invite'
    ? `Hello ${firstName} ${lastName},`
    : studentName
    ? `Hello ${firstName} ${lastName},`
    : `Hello ${firstName} ${lastName},`;

  const bodyText = linkType === 'invite'
    ? 'You\'ve been invited to create your Altitutor account. Click the button below to get started.'
    : studentName
    ? `Please complete the registration for ${studentName}'s student account. Click the button below to continue.`
    : 'Please complete the registration for your student account. Click the button below to continue.';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${title}</title>
      <!--[if mso]>
      <style type="text/css">
        body, table, td {font-family: Arial, sans-serif !important;}
      </style>
      <![endif]-->
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 30px; background: linear-gradient(135deg, #0a2941 0%, #144e72 100%); border-radius: 8px 8px 0 0;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td align="center">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Altitutor</h1>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <h2 style="margin: 0 0 20px; color: #0a2941; font-size: 24px; font-weight: 600; line-height: 1.3;">${title}</h2>
                  
                  <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                    ${greeting}
                  </p>
                  
                  <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                    ${bodyText}
                  </p>
                  
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 32px 0;">
                    <tr>
                      <td align="center">
                        <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; background-color: #0a2941; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; line-height: 1.5; text-align: center;">
                          ${buttonText}
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                    If the button doesn't work, copy and paste this link into your browser:
                  </p>
                  <p style="margin: 8px 0 0; color: #92b9c6; font-size: 14px; line-height: 1.6; word-break: break-all;">
                    <a href="${inviteUrl}" style="color: #92b9c6; text-decoration: underline;">${inviteUrl}</a>
                  </p>
                  
                  <p style="margin: 32px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                    ${linkType === 'invite' 
                      ? 'This invitation link will expire in 1 hour. If you didn\'t expect this invitation, you can safely ignore this email.'
                      : 'If you didn\'t expect this email, you can safely ignore it.'}
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding-bottom: 20px;">
                        <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                          This email was sent by Altitutor. If you didn't request this email, you can safely ignore it.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center">
                        <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                          © ${new Date().getFullYear()} Altitutor. All rights reserved.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

