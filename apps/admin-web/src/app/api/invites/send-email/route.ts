import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@altitutor/shared';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and has admin role

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or staff with appropriate permissions
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (staffError || !staffData || (staffData.role !== 'ADMIN' && staffData.role !== 'ADMINSTAFF' && staffData.role !== 'OFFICE_ADMIN')) {
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
    const { type, id, token } = body;

    // Validate required fields
    if (!type || !id || !token) {
      return NextResponse.json(
        { error: 'Missing required fields: type, id, token' },
        { status: 400 }
      );
    }

    if (type !== 'staff' && type !== 'student') {
      return NextResponse.json(
        { error: 'Invalid type. Must be "staff" or "student"' },
        { status: 400 }
      );
    }

    // Fetch the record to get email and verify token
    let record;
    let fetchError;
    
    if (type === 'staff') {
      const result = await supabase
        .from('staff')
        .select('id, first_name, last_name, email, invite_token')
        .eq('id', id)
        .single();
      record = result.data;
      fetchError = result.error;
    } else {
      const result = await supabase
        .from('students')
        .select('id, first_name, last_name, email, invite_token')
        .eq('id', id)
        .single();
      record = result.data;
      fetchError = result.error;
    }

    if (fetchError || !record) {
      return NextResponse.json(
        { error: `${type} not found` },
        { status: 404 }
      );
    }

    if (record.invite_token !== token) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 400 }
      );
    }

    if (!record.email) {
      return NextResponse.json(
        { error: `No email address found for this ${type}` },
        { status: 400 }
      );
    }

    // Determine the base URL and redirect path
    const baseUrl = type === 'staff' 
      ? (process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3000')
      : (process.env.NEXT_PUBLIC_STUDENT_URL || 'http://localhost:3001');
    
    const inviteUrl = `${baseUrl}/invite/${token}`;

    // Send email using Supabase's email service
    // Note: For now, we'll use a simple approach. In production, you might want to use
    // a custom email template or a service like SendGrid/Resend
    const emailSubject = `You're invited to join Altitutor`;
    const emailBody = `
      <h2>Hello ${record.first_name} ${record.last_name},</h2>
      <p>You've been invited to create your Altitutor account.</p>
      <p>Click the link below to set up your account:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      <p>Best regards,<br/>The Altitutor Team</p>
    `;

    // For now, we'll use Supabase's built-in email (resetPasswordForEmail as a workaround)
    // In production, you should set up a proper email service
    // This is a placeholder - you'll need to implement actual email sending
    
    // TODO: Implement proper email sending with a service like Resend or SendGrid
    // For now, we'll just log and return success
    console.log('Would send email to:', record.email);
    console.log('Email body:', emailBody);
    console.log('Invite URL:', inviteUrl);

    // Since we don't have a real email service set up yet, we'll just return the URL
    // In production, you would actually send the email here
    return NextResponse.json({ 
      success: true, 
      message: 'Invite email would be sent', 
      inviteUrl // Return URL for testing
    }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error sending invite email:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

