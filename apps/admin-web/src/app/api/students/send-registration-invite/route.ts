import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { randomUUID } from 'crypto';
import type { Tables } from '@altitutor/shared';
import { sendEmail } from '@/shared/lib/email';
import { getInviteEmailTemplate } from '@/shared/lib/email-templates';
import { getInviteSmsTemplate } from '@/shared/lib/sms-templates';

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

    const body = await request.json();
    const { studentId, token: existingToken, sendEmail: shouldSendEmail, sendSms: shouldSendSms } = body;

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
      
      // Update student with invite token
      const { error: updateError } = await supabase
        .from('students')
        // @ts-expect-error - TypeScript inference issue with Supabase client
        .update({ invite_token: token })
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

    // Fetch parents for this student
    const { data: parentsData } = await supabaseAdmin
      .from('parents_students')
      .select('parent_id, parents(id, first_name, last_name, email, phone)')
      .eq('student_id', studentId);

    const parents = parentsData
      ?.map((ps: any) => ps.parents)
      .filter((p: any) => p !== null) || [];

    // Determine recipients (prefer parents, fallback to student)
    const recipients = parents.length > 0 ? parents : (student.email || student.phone ? [student] : []);

    // Send email if requested
    if (shouldSendEmail) {
      const emailRecipients = recipients.filter((r: any) => r.email);
      
      if (emailRecipients.length === 0) {
        return NextResponse.json(
          { error: 'No email addresses found for parents or student' },
          { status: 400 }
        );
      }

      // Send emails to all recipients
      let emailSuccessCount = 0;
      let emailFailureCount = 0;
      const emailErrors: string[] = [];

      const emailPromises = emailRecipients.map(async (recipient: any) => {
        try {
          const html = getInviteEmailTemplate({
            firstName: recipient.first_name,
            lastName: recipient.last_name,
            inviteUrl: registrationUrl,
            linkType: 'registration',
            studentName: `${student.first_name} ${student.last_name}`,
          });

          await sendEmail({
            to: recipient.email,
            subject: `Complete Registration for ${student.first_name} ${student.last_name} - Altitutor`,
            html,
          });

          emailSuccessCount++;
        } catch (error) {
          const errorMsg = `Failed to send email to ${recipient.email}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error('Failed to send email:', errorMsg, error);
          emailErrors.push(errorMsg);
          emailFailureCount++;
        }
      });

      await Promise.all(emailPromises);

      // If all emails failed, return error
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

    // Send SMS if requested
    if (shouldSendSms) {
      const smsRecipients = recipients.filter((r: any) => r.phone);
      
      if (smsRecipients.length === 0) {
        return NextResponse.json(
          { error: 'No phone numbers found for parents or student' },
          { status: 400 }
        );
      }

      // Send SMS to all recipients using the same pattern as invite SMS
      let successCount = 0;
      let failureCount = 0;
      const errors: string[] = [];

      for (const recipient of smsRecipients) {
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
              errors.push(errorMsg);
              failureCount++;
              continue; // Skip this recipient
            }

            contactId = newContact.id;
          }

          // Get an owned number for sending
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
            continue; // Skip this recipient
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
              errors.push(errorMsg);
              failureCount++;
              continue; // Skip this recipient
            }

            conversationId = newConvo.id;
          }

          // Create message body using template
          const messageBody = getInviteSmsTemplate({
            firstName: recipient.first_name || 'there',
            inviteUrl: registrationUrl,
            linkType: 'registration',
            studentName: `${student.first_name} ${student.last_name}`,
          });

          // Create message record
          // Note: from_number_e164 and to_number_e164 are required fields
          
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
            console.error('Failed to create message:', messageError);
            errors.push(errorMsg);
            failureCount++;
            continue; // Skip this recipient
          }

          // Call the send-sms edge function
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
          
          if (!supabaseUrl || !supabaseAnonKey) {
            const errorMsg = 'Missing Supabase URL or anon key';
            console.error('Missing Supabase configuration:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseAnonKey });
            errors.push(errorMsg);
            failureCount++;
            continue;
          }

          const sendSmsResponse = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
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
            // Continue with other recipients even if one fails
          } else {
            successCount++;
          }
        } catch (smsError) {
          const errorMsg = `Exception sending SMS to ${recipient.phone}: ${smsError instanceof Error ? smsError.message : 'Unknown error'}`;
          console.error('Exception sending SMS:', smsError);
          errors.push(errorMsg);
          failureCount++;
          // Continue with other recipients even if one fails
        }
      }

      // If all failed, return error with details
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
  } catch (error) {
    console.error('Unexpected error sending registration invite:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
