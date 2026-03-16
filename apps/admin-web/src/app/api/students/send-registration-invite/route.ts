import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { randomUUID } from 'crypto';
import type { Tables, TablesUpdate } from '@altitutor/shared';
import { sendEmail } from '@/shared/lib/email';
import { getInviteEmailTemplate } from '@/shared/lib/email-templates';
import { getStudentRegistrationInviteMessage } from '@/features/messages/api/systemTemplates';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and has admin role
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role')
      .eq('user_id', user.id)
      .single<{ role: string }>();

    if (staffError || !staffData || (staffData.role !== 'ADMINSTAFF' && staffData.role !== 'OFFICE_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Verify admin client is available
    if (!supabaseAdmin) {
      console.error('Admin client not initialized - missing SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Handle FormData or JSON
    let studentId: string;
    let existingToken: string | undefined;
    let shouldSendEmail: boolean | undefined;
    let shouldSendSms: boolean | undefined;
    let recipientType: 'student' | 'parent' | undefined;
    let recipientId: string | undefined;
    let contactMethod: 'email' | 'sms' | undefined;
    let customMessage: string | undefined;
    let ownedNumberId: string | undefined;
    const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
    
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      studentId = formData.get('studentId') as string;
      existingToken = formData.get('token') as string | undefined;
      shouldSendEmail = formData.get('sendEmail') === 'true';
      shouldSendSms = formData.get('sendSms') === 'true';
      recipientType = formData.get('recipientType') as 'student' | 'parent' | undefined;
      recipientId = formData.get('recipientId') as string | undefined;
      contactMethod = formData.get('contactMethod') as 'email' | 'sms' | undefined;
      customMessage = formData.get('customMessage') as string | undefined;
      ownedNumberId = formData.get('ownedNumberId') as string | undefined;
      
      // Extract attachments
      const attachmentEntries = Array.from(formData.entries()).filter(([key]) => key.startsWith('attachment-'));
      for (const [, file] of attachmentEntries) {
        if (file instanceof File) {
          const buffer = Buffer.from(await file.arrayBuffer());
          attachments.push({
            filename: file.name,
            content: buffer,
            contentType: file.type || undefined,
          });
        }
      }
    } else {
      const body = await request.json();
      studentId = body.studentId;
      existingToken = body.token;
      shouldSendEmail = body.sendEmail;
      shouldSendSms = body.sendSms;
      recipientType = body.recipientType;
      recipientId = body.recipientId;
      contactMethod = body.contactMethod;
      customMessage = body.customMessage;
      ownedNumberId = body.ownedNumberId;
    }

    if (!studentId) {
      return NextResponse.json(
        { error: 'Missing required field: studentId' },
        { status: 400 }
      );
    }

    // Fetch student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, email, phone, status, user_id, invite_token')
      .eq('id', studentId)
      .single<Pick<Tables<'students'>, 'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'status' | 'user_id' | 'invite_token'>>();

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Check if student is already fully registered (has account AND status is ACTIVE)
    if (student.user_id && student.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'This student is already fully registered' },
        { status: 400 }
      );
    }
    
    // If student has account but hasn't registered (status != ACTIVE), allow registration link
    // This will skip password creation in the registration flow

    // Generate or use existing token
    let token = existingToken || student.invite_token;
    
    if (!token) {
      token = randomUUID();
      
      // Update student with invite token (use admin client for proper typing)
      const updateData: TablesUpdate<'students'> = { invite_token: token };
      const { error: updateError } = await supabaseAdmin!
        .from('students')
        .update(updateData)
        .eq('id', studentId);

      if (updateError) {
        console.error('Failed to update invite token:', updateError);
        return NextResponse.json(
          { error: `Failed to generate invite token: ${updateError.message}` },
          { status: 500 }
        );
      }
    }

    // Build registration URL
    const isDev = process.env.NODE_ENV === 'development';
    const baseUrl = isDev ? 'http://localhost:3001' : (process.env.NEXT_PUBLIC_STUDENT_URL || 'https://student.altitutor.com');
    const registrationUrl = `${baseUrl}/register/${token}`;

    // Determine recipient based on recipientType and recipientId
    let recipient: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null } | null = null;

    if (recipientType === 'student') {
      // Use student as recipient
      if (!student.email && !student.phone) {
        return NextResponse.json(
          { error: 'Student has no email or phone number' },
          { status: 400 }
        );
      }
      recipient = {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        phone: student.phone,
      };
    } else if (recipientType === 'parent' && recipientId) {
      // Fetch specific parent
      const { data: parentsData } = await supabaseAdmin
        .from('parents_students')
        .select('parent_id, parents(id, first_name, last_name, email, phone)')
        .eq('student_id', studentId)
        .eq('parent_id', recipientId);

      const parent = parentsData?.[0]?.parents;
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent not found or not associated with this student' },
          { status: 404 }
        );
      }
      recipient = parent;
    } else {
      // Legacy behavior: prefer parents, fallback to student
      const { data: parentsData } = await supabaseAdmin
        .from('parents_students')
        .select('parent_id, parents(id, first_name, last_name, email, phone)')
        .eq('student_id', studentId);

      type ParentStudentRow = { parent_id: string; parents: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null } | null };
      const parents = parentsData
        ? (parentsData as ParentStudentRow[])
            .map((ps) => ps.parents)
            .filter((p): p is NonNullable<typeof p> => p !== null)
        : [];

      type Recipient = { first_name: string; last_name: string; email: string | null; phone: string | null };
      const recipients: Recipient[] = parents.length > 0 ? parents : (student.email || student.phone ? [student] : []);
      
      // For legacy behavior, send to all recipients
      if (shouldSendEmail) {
        const emailRecipients = recipients.filter((r): r is Recipient & { email: string } => !!r.email);
        
        if (emailRecipients.length === 0) {
          return NextResponse.json(
            { error: 'No email addresses found for parents or student' },
            { status: 400 }
          );
        }

        let emailSuccessCount = 0;
        let emailFailureCount = 0;
        const emailErrors: string[] = [];

        const emailPromises = emailRecipients.map(async (r) => {
          try {
            const html = getInviteEmailTemplate({
              firstName: r.first_name,
              lastName: r.last_name,
              inviteUrl: registrationUrl,
              linkType: 'registration',
              studentName: `${student.first_name} ${student.last_name}`,
            });

            await sendEmail({
              to: r.email,
              subject: `Complete Registration for ${student.first_name} ${student.last_name} - Altitutor`,
              html,
              attachments: attachments.length > 0 ? attachments : undefined,
            });

            emailSuccessCount++;
          } catch (error) {
            const errorMsg = `Failed to send email to ${r.email}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error('Failed to send email:', errorMsg, error);
            emailErrors.push(errorMsg);
            emailFailureCount++;
          }
        });

        await Promise.all(emailPromises);

        if (emailSuccessCount === 0 && emailFailureCount > 0) {
          return NextResponse.json(
            { 
              error: 'Failed to send email to any recipients',
              details: emailErrors 
            },
            { status: 500 }
          );
        }
      }

      if (shouldSendSms) {
        const smsRecipients = recipients.filter((r): r is Recipient & { phone: string } => !!r.phone);
        
        if (smsRecipients.length === 0) {
          return NextResponse.json(
            { error: 'No phone numbers found for parents or student' },
            { status: 400 }
          );
        }

        let successCount = 0;
        let failureCount = 0;
        const errors: string[] = [];

        for (const r of smsRecipients) {
          try {
            const { data: contact } = await supabaseAdmin
              .from('contacts')
              .select('id, phone_e164')
              .eq('student_id', studentId)
              .eq('phone_e164', r.phone)
              .maybeSingle<{ id: string; phone_e164: string }>();

            let contactId = contact?.id;

            if (!contactId) {
              const { data: newContact, error: createContactError } = await supabaseAdmin
                .from('contacts')
                .insert({
                  phone_e164: r.phone,
                  contact_type: 'STUDENT',
                  student_id: studentId,
                })
                .select('id')
                .single<{ id: string }>();

              if (createContactError || !newContact) {
                const errorMsg = `Failed to create contact: ${createContactError?.message || 'Unknown error'}`;
                console.error('Failed to create contact:', createContactError);
                errors.push(errorMsg);
                failureCount++;
                continue;
              }

              contactId = newContact.id;
            }

            const { data: ownedNumber, error: ownedError } = await supabaseAdmin
              .from('owned_numbers')
              .select('id, phone_e164')
              .limit(1)
              .single<{ id: string; phone_e164: string }>();

            if (ownedError || !ownedNumber) {
              const errorMsg = `No owned number found: ${ownedError?.message || 'Unknown error'}`;
              console.error('No owned number found:', ownedError);
              errors.push(errorMsg);
              failureCount++;
              continue;
            }

            let conversationId: string;
            const { data: existingConvo } = await supabaseAdmin
              .from('conversations')
              .select('id')
              .eq('contact_id', contactId)
              .eq('owned_number_id', ownedNumber.id)
              .maybeSingle<{ id: string }>();

            if (existingConvo) {
              conversationId = existingConvo.id;
            } else {
              const { data: newConvo, error: convoCreateError } = await supabaseAdmin
                .from('conversations')
                .insert({
                  contact_id: contactId,
                  owned_number_id: ownedNumber.id,
                })
                .select('id')
                .single<{ id: string }>();

              if (convoCreateError || !newConvo) {
                const errorMsg = `Failed to create conversation: ${convoCreateError?.message || 'Unknown error'}`;
                console.error('Failed to create conversation:', convoCreateError);
                errors.push(errorMsg);
                failureCount++;
                continue;
              }

              conversationId = newConvo.id;
            }

            const messageBody = await getStudentRegistrationInviteMessage(
              supabaseAdmin,
              {
                firstName: r.first_name || 'there',
                inviteUrl: registrationUrl,
                studentName: `${student.first_name} ${student.last_name}`,
              }
            );
            
            const { data: message, error: messageError } = await supabaseAdmin
              .from('messages')
              .insert({
                conversation_id: conversationId,
                body: messageBody,
                direction: 'OUTBOUND',
                status: 'QUEUED',
                from_number_e164: ownedNumber.phone_e164,
                to_number_e164: r.phone,
              })
              .select('id')
              .single<{ id: string }>();

            if (messageError || !message) {
              const errorMsg = `Failed to create message: ${messageError?.message || 'Unknown error'}`;
              console.error('Failed to create message:', messageError);
              errors.push(errorMsg);
              failureCount++;
              continue;
            }

            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
            const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
            
            if (!supabaseUrl || !supabaseAnonKey) {
              const errorMsg = 'Missing Supabase URL or anon key';
              console.error('Missing Supabase configuration:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseAnonKey });
              errors.push(errorMsg);
              failureCount++;
              continue;
            }

            const sendSmsResponse = await fetch(`${supabaseUrl}/functions/v1/send-message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({ messageId: message.id }),
            });

            if (!sendSmsResponse.ok) {
              const errorData = await sendSmsResponse.json().catch(() => ({ error: 'Unknown error' }));
              const errorMsg = `Edge function failed: ${errorData.error || sendSmsResponse.statusText}`;
              console.error('Failed to send SMS via edge function:', errorData);
              errors.push(errorMsg);
              failureCount++;
            } else {
              successCount++;
            }
          } catch (smsError) {
            const errorMsg = `Exception sending SMS to ${r.phone}: ${smsError instanceof Error ? smsError.message : 'Unknown error'}`;
            console.error('Exception sending SMS:', smsError);
            errors.push(errorMsg);
            failureCount++;
          }
        }

        if (successCount === 0 && failureCount > 0) {
          return NextResponse.json(
            { 
              error: 'Failed to send SMS to any recipients',
              details: errors
            },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        token,
        registrationUrl,
        message: shouldSendEmail || shouldSendSms ? 'Registration invite sent successfully' : 'Registration link generated',
      }, { status: 200 });
    }

    // Validate recipient has the requested contact method
    if (contactMethod === 'email' && !recipient?.email) {
      return NextResponse.json(
        { error: 'Recipient does not have an email address' },
        { status: 400 }
      );
    }

    if (contactMethod === 'sms' && !recipient?.phone) {
      return NextResponse.json(
        { error: 'Recipient does not have a phone number' },
        { status: 400 }
      );
    }

    // Send email if requested
    if (shouldSendEmail && contactMethod === 'email' && recipient) {
      try {
        // Use custom message if provided, otherwise use template
        let html: string;
        if (customMessage && customMessage.trim()) {
          // For custom messages, create a simple HTML email with the message
          html = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
              <p>${customMessage.replace(/\n/g, '<br>')}</p>
              <p><a href="${registrationUrl}">${registrationUrl}</a></p>
            </body>
            </html>
          `;
        } else {
          html = getInviteEmailTemplate({
            firstName: recipient.first_name,
            lastName: recipient.last_name,
            inviteUrl: registrationUrl,
            linkType: 'registration',
            studentName: `${student.first_name} ${student.last_name}`,
          });
        }

        await sendEmail({
          to: recipient.email!,
          subject: `Complete Registration for ${student.first_name} ${student.last_name} - Altitutor`,
          html,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
      } catch (error) {
        const errorMsg = `Failed to send email to ${recipient.email}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('Failed to send email:', errorMsg, error);
        return NextResponse.json(
          { error: errorMsg },
          { status: 500 }
        );
      }
    }

    // Send SMS if requested
    if (shouldSendSms && contactMethod === 'sms' && recipient && recipient.phone) {
      try {
        // Get or create contact record for this phone number
        const { data: contact } = await supabaseAdmin
          .from('contacts')
          .select('id, phone_e164')
          .eq('student_id', studentId)
          .eq('phone_e164', recipient.phone)
          .maybeSingle<{ id: string; phone_e164: string }>();

        let contactId = contact?.id;

        // If no contact exists, create one
        if (!contactId) {
          const { data: newContact, error: createContactError } = await supabaseAdmin
            .from('contacts')
            .insert({
              phone_e164: recipient.phone,
              contact_type: 'STUDENT',
              student_id: studentId,
            })
            .select('id')
            .single<{ id: string }>();

          if (createContactError || !newContact) {
            const errorMsg = `Failed to create contact: ${createContactError?.message || 'Unknown error'}`;
            console.error('Failed to create contact:', createContactError);
            return NextResponse.json(
              { error: errorMsg },
              { status: 500 }
            );
          }

          contactId = newContact.id;
        }

        // Get owned number for sending (use provided one or default)
        let ownedNumber: { id: string; phone_e164: string } | null = null;
        
        if (ownedNumberId) {
          const { data, error } = await supabaseAdmin
            .from('owned_numbers')
            .select('id, phone_e164')
            .eq('id', ownedNumberId)
            .single<{ id: string; phone_e164: string }>();
          
          if (error || !data) {
            const errorMsg = `Owned number not found: ${error?.message || 'Unknown error'}`;
            console.error('Owned number not found:', error);
            return NextResponse.json(
              { error: errorMsg },
              { status: 400 }
            );
          }
          ownedNumber = data;
        } else {
          // Get default owned number
          const { data, error: ownedError } = await supabaseAdmin
            .from('owned_numbers')
            .select('id, phone_e164')
            .order('is_default', { ascending: false })
            .limit(1)
            .single<{ id: string; phone_e164: string }>();

          if (ownedError || !data) {
            const errorMsg = `No owned number found: ${ownedError?.message || 'Unknown error'}`;
            console.error('No owned number found:', ownedError);
            return NextResponse.json(
              { error: errorMsg },
              { status: 500 }
            );
          }
          ownedNumber = data;
        }

        // Get or create conversation
        let conversationId: string;
        const { data: existingConvo } = await supabaseAdmin
          .from('conversations')
          .select('id')
          .eq('contact_id', contactId)
          .eq('owned_number_id', ownedNumber.id)
          .maybeSingle<{ id: string }>();

        if (existingConvo) {
          conversationId = existingConvo.id;
        } else {
          const { data: newConvo, error: convoCreateError } = await supabaseAdmin
            .from('conversations')
            .insert({
              contact_id: contactId,
              owned_number_id: ownedNumber.id,
            })
            .select('id')
            .single<{ id: string }>();

          if (convoCreateError || !newConvo) {
            const errorMsg = `Failed to create conversation: ${convoCreateError?.message || 'Unknown error'}`;
            console.error('Failed to create conversation:', convoCreateError);
            return NextResponse.json(
              { error: errorMsg },
              { status: 500 }
            );
          }

          conversationId = newConvo.id;
        }

        // Create message body - use custom message if provided, otherwise use template
        const messageBody =
          customMessage && customMessage.trim()
            ? customMessage.trim()
            : await getStudentRegistrationInviteMessage(supabaseAdmin, {
                firstName: recipient.first_name || 'there',
                inviteUrl: registrationUrl,
                studentName: `${student.first_name} ${student.last_name}`,
              });

        // Create message record
        const { data: message, error: messageError } = await supabaseAdmin
          .from('messages')
          .insert({
            conversation_id: conversationId,
            body: messageBody,
            direction: 'OUTBOUND',
            status: 'QUEUED',
            from_number_e164: ownedNumber.phone_e164,
            to_number_e164: recipient.phone!, // Non-null assertion: validated above
          })
          .select('id')
          .single<{ id: string }>();

        if (messageError || !message) {
          const errorMsg = `Failed to create message: ${messageError?.message || 'Unknown error'}`;
          console.error('Failed to create message:', messageError);
          return NextResponse.json(
            { error: errorMsg },
            { status: 500 }
          );
        }

        // Call the send-sms edge function
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        
        if (!supabaseUrl || !supabaseAnonKey) {
          const errorMsg = 'Missing Supabase URL or anon key';
          console.error('Missing Supabase configuration:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseAnonKey });
          return NextResponse.json(
            { error: errorMsg },
            { status: 500 }
          );
        }

        const sendSmsResponse = await fetch(`${supabaseUrl}/functions/v1/send-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ messageId: message.id }),
        });

        if (!sendSmsResponse.ok) {
          const errorData = await sendSmsResponse.json().catch(() => ({ error: 'Unknown error' }));
          const errorMsg = `Edge function failed: ${errorData.error || sendSmsResponse.statusText}`;
          console.error('Failed to send SMS via edge function:', errorData);
          return NextResponse.json(
            { error: errorMsg },
            { status: 500 }
          );
        }
      } catch (smsError) {
        const errorMsg = `Exception sending SMS to ${recipient.phone}: ${smsError instanceof Error ? smsError.message : 'Unknown error'}`;
        console.error('Exception sending SMS:', smsError);
        return NextResponse.json(
          { error: errorMsg },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      token,
      registrationUrl,
      message: shouldSendEmail || shouldSendSms ? 'Registration invite sent successfully' : 'Registration link generated',
    }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error sending registration invite:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
