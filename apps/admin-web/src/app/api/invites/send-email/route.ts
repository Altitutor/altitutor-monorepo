import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { sendEmail } from '@/shared/lib/email';
import { getInviteEmailTemplate } from '@/shared/lib/email-templates';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and has admin role
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or staff with appropriate permissions
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role')
      .eq('user_id', user.id)
      .single<{ role: string }>();

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
    let record: { id: string; first_name: string; last_name: string; email: string; invite_token: string | null; role?: string } | null;
    let fetchError;
    
    if (type === 'staff') {
      const result = await supabase
        .from('staff')
        .select('id, first_name, last_name, email, role, invite_token')
        .eq('id', id)
        .single<{ id: string; first_name: string; last_name: string; email: string; role: string; invite_token: string | null }>();
      record = result.data;
      fetchError = result.error;
    } else {
      const result = await supabase
        .from('students')
        .select('id, first_name, last_name, email, invite_token')
        .eq('id', id)
        .single<{ id: string; first_name: string; last_name: string; email: string; invite_token: string | null }>();
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

    // Determine invite URL based on role (for staff) or type (for students)
    let inviteUrl: string;
    const isDev = process.env.NODE_ENV === 'development';
    
    if (type === 'staff') {
      // For staff, check their role to determine which app to send them to
      const staffRole = 'role' in record ? record.role : undefined;
      if (staffRole === 'TUTOR') {
        const baseUrl = isDev ? 'http://localhost:3002' : (process.env.NEXT_PUBLIC_TUTOR_URL || 'https://tutor.altitutor.com');
        inviteUrl = `${baseUrl}/invite/${token}`;
      } else {
        const baseUrl = isDev ? 'http://localhost:3000' : (process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.altitutor.com');
        inviteUrl = `${baseUrl}/invite/${token}`;
      }
    } else {
      const baseUrl = isDev ? 'http://localhost:3001' : (process.env.NEXT_PUBLIC_STUDENT_URL || 'https://student.altitutor.com');
      inviteUrl = `${baseUrl}/invite/${token}`;
    }

    // Send email using Resend
    try {
      const html = getInviteEmailTemplate({
        firstName: record.first_name,
        lastName: record.last_name,
        inviteUrl,
        linkType: 'invite',
      });

      await sendEmail({
        to: record.email,
        subject: `You've Been Invited to Altitutor`,
        html,
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Invite email sent successfully',
        inviteUrl // Return URL for reference
      }, { status: 200 });
    } catch (error) {
      console.error('Failed to send invite email:', error);
      return NextResponse.json(
        { error: `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected error sending invite email:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

