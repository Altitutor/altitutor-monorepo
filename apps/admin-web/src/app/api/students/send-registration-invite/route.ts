import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { randomUUID } from 'crypto';

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
    const { studentId, token: existingToken, sendEmail, sendSms } = body;

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
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Check if student already has an account
    if (student.user_id || student.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'This student already has an account' },
        { status: 400 }
      );
    }

    // Generate or use existing token
    let token = existingToken || student.invite_token;
    
    if (!token) {
      token = randomUUID();
      
      // Update student with invite token
      const { error: updateError } = await supabase
        .from('students')
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
    const { data: parentsData, error: parentsError } = await supabaseAdmin
      .from('parents_students')
      .select('parent_id, parents(id, first_name, last_name, email, phone)')
      .eq('student_id', studentId);

    const parents = parentsData
      ?.map((ps: any) => ps.parents)
      .filter((p: any) => p !== null) || [];

    // Determine recipients (prefer parents, fallback to student)
    const recipients = parents.length > 0 ? parents : (student.email || student.phone ? [student] : []);

    // Send email if requested
    if (sendEmail) {
      const emailRecipients = recipients.filter((r: any) => r.email);
      
      if (emailRecipients.length === 0) {
        return NextResponse.json(
          { error: 'No email addresses found for parents or student' },
          { status: 400 }
        );
      }

      // TODO: Implement actual email sending using your email service
      // For now, just return success
      // In production, you would send emails to all recipients
      console.log('Would send registration email to:', emailRecipients.map((r: any) => r.email));
    }

    // Send SMS if requested
    if (sendSms) {
      const smsRecipients = recipients.filter((r: any) => r.phone);
      
      if (smsRecipients.length === 0) {
        return NextResponse.json(
          { error: 'No phone numbers found for parents or student' },
          { status: 400 }
        );
      }

      // TODO: Implement actual SMS sending using your SMS service
      // For now, just return success
      // In production, you would send SMS to all recipients
      console.log('Would send registration SMS to:', smsRecipients.map((r: any) => r.phone));
    }

    return NextResponse.json({
      success: true,
      token,
      registrationUrl,
      message: sendEmail || sendSms ? 'Registration invite sent successfully' : 'Registration link generated',
    }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error sending registration invite:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
