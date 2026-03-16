import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { sendEmail } from '@/shared/lib/email';
import { getBookingConfirmationEmailTemplate } from '@/shared/lib/email-templates';
import { getBookingConfirmationMessage } from '@/features/messages/api/systemTemplates';
import { getBookingConfirmationUrl } from '@/shared/utils/invites';
import { format } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and has admin role
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin and get staff name for sender_name
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role, first_name, last_name')
      .eq('user_id', user.id)
      .single<{ role: string; first_name: string | null; last_name: string | null }>();

    if (staffError || !staffData || (staffData.role !== 'ADMINSTAFF' && staffData.role !== 'OFFICE_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const senderName = `${staffData.first_name ?? ''} ${staffData.last_name ?? ''}`.trim();

    // Verify admin client is available
    if (!supabaseAdmin) {
      console.error('Admin client not initialized - missing SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      sessionId,
      studentId,
      sendEmail: shouldSendEmail,
      sendSms: shouldSendSms,
      recipientType,
      recipientId,
      customMessage,
    } = body;

    if (!sessionId || !studentId) {
      return NextResponse.json(
        { error: 'sessionId and studentId are required' },
        { status: 400 }
      );
    }

    // Fetch session to get date/time and type
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('id, start_at, end_at, type')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Fetch student
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, first_name, last_name, email, phone')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Fetch parents
    const { data: parentsData, error: parentsError } = await supabaseAdmin
      .from('parents_students')
      .select('parent_id, parents(id, first_name, last_name, email, phone)')
      .eq('student_id', studentId);

    const recipients: Array<{ id: string; first_name: string; last_name: string; email: string | null; phone: string | null }> = [];

    if (!parentsError && parentsData) {
      type ParentStudentRow = { parent_id: string; parents: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null } | null };
      const parentList = (parentsData as ParentStudentRow[])
        .map((ps) => ps.parents)
        .filter((p): p is NonNullable<typeof p> => p !== null);
      recipients.push(...parentList);
    }

    // Always include student in recipients when they have email/phone (for single-recipient dialog flow)
    if (student.email || student.phone) {
      recipients.push({
        id: student.id,
        first_name: student.first_name || '',
        last_name: student.last_name || '',
        email: student.email || null,
        phone: student.phone || null,
      });
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No email or phone found for student or parents' },
        { status: 400 }
      );
    }

    // Filter to single recipient when specified (for dialog send-to-one flow)
    let effectiveRecipients = recipients;
    if (recipientType === 'student') {
      effectiveRecipients = recipients.filter((r) => r.id === studentId);
    } else if (recipientType === 'parent' && recipientId) {
      effectiveRecipients = recipients.filter((r) => r.id === recipientId);
    }

    const bookingUrl = getBookingConfirmationUrl(sessionId);
    const studentName = `${student.first_name} ${student.last_name}`;

    // Format session date and time
    let sessionDate: string | undefined;
    let sessionTime: string | undefined;
    if (session.start_at) {
      const startDate = new Date(session.start_at);
      sessionDate = format(startDate, 'EEEE, dd MMMM yyyy');
      if (session.end_at) {
        const endDate = new Date(session.end_at);
        sessionTime = `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`;
      } else {
        sessionTime = format(startDate, 'h:mm a');
      }
    }

    const errors: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Send emails
    if (shouldSendEmail) {
      const emailRecipients = effectiveRecipients.filter(r => r.email);
      if (emailRecipients.length === 0) {
        return NextResponse.json(
          { error: 'No email addresses found' },
          { status: 400 }
        );
      }

      for (const recipient of emailRecipients) {
        if (!recipient.email) continue;

        try {
          const emailHtml = customMessage
            ? `<!DOCTYPE html><html><body style="font-family: sans-serif; padding: 20px;"><div style="white-space: pre-wrap;">${customMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div><p style="margin-top: 24px;"><a href="${bookingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0a2941; color: #fff; text-decoration: none; border-radius: 6px;">View Booking Confirmation</a></p><p style="margin-top: 16px; font-size: 14px; color: #6b7280;">${bookingUrl}</p></body></html>`
            : getBookingConfirmationEmailTemplate({
                firstName: recipient.first_name || 'there',
                lastName: recipient.last_name || '',
                bookingUrl,
                sessionDate,
                sessionTime,
              });

          await sendEmail({
            to: recipient.email,
            subject: `Booking Confirmation - ${studentName}`,
            html: emailHtml,
          });
          successCount++;
        } catch (error) {
          const errorMsg = `Failed to send email to ${recipient.email}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg, error);
          errors.push(errorMsg);
          failureCount++;
        }
      }
    }

    // Send SMS
    if (shouldSendSms) {
      const smsRecipients = effectiveRecipients.filter(r => r.phone);
      if (smsRecipients.length === 0) {
        return NextResponse.json(
          { error: 'No phone numbers found' },
          { status: 400 }
        );
      }

      for (const recipient of smsRecipients) {
        if (!recipient.phone) continue;

        try {
          // Get or create contact
          let contactId: string;
          const { data: existingContact } = await supabaseAdmin
            .from('contacts')
            .select('id')
            .eq('phone_e164', recipient.phone)
            .eq('contact_type', 'STUDENT')
            .maybeSingle<{ id: string }>();

          if (existingContact) {
            contactId = existingContact.id;
          } else {
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
              console.error(errorMsg);
              errors.push(errorMsg);
              failureCount++;
              continue;
            }
            contactId = newContact.id;
          }

          // Get owned number
          const { data: ownedNumber, error: ownedError } = await supabaseAdmin
            .from('owned_numbers')
            .select('id, phone_e164')
            .limit(1)
            .single<{ id: string; phone_e164: string }>();

          if (ownedError || !ownedNumber) {
            const errorMsg = `No owned number found: ${ownedError?.message || 'Unknown error'}`;
            console.error(errorMsg);
            errors.push(errorMsg);
            failureCount++;
            continue;
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
              console.error(errorMsg);
              errors.push(errorMsg);
              failureCount++;
              continue;
            }
            conversationId = newConvo.id;
          }

          const messageBody = await getBookingConfirmationMessage(
            supabaseAdmin,
            {
              firstName: recipient.first_name || 'there',
              bookingUrl,
              sessionDate,
              sessionTime,
              sessionType: session.type,
              senderName,
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
              to_number_e164: recipient.phone,
            })
            .select('id')
            .single<{ id: string }>();

          if (messageError || !message) {
            const errorMsg = `Failed to create message: ${messageError?.message || 'Unknown error'}`;
            console.error(errorMsg);
            errors.push(errorMsg);
            failureCount++;
            continue;
          }

          // Call send-sms edge function
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
          const errorMsg = `Exception sending SMS to ${recipient.phone}: ${smsError instanceof Error ? smsError.message : 'Unknown error'}`;
          console.error('Exception sending SMS:', smsError);
          errors.push(errorMsg);
          failureCount++;
        }
      }
    }

    // If all failed, return error with details
    if (shouldSendEmail || shouldSendSms) {
      if (successCount === 0 && failureCount > 0) {
        return NextResponse.json(
          { 
            error: 'Failed to send booking confirmation to any recipients',
            details: errors
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      bookingUrl,
      message: shouldSendEmail || shouldSendSms ? 'Booking confirmation sent successfully' : 'Booking confirmation link generated',
    }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error sending booking confirmation:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
