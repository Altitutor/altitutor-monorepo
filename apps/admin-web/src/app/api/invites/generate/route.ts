import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { randomUUID } from 'crypto';

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

    const body = await request.json();
    const { type, id } = body;

    // Validate required fields
    if (!type || !id) {
      return NextResponse.json(
        { error: 'Missing required fields: type, id' },
        { status: 400 }
      );
    }

    if (type !== 'staff' && type !== 'student') {
      return NextResponse.json(
        { error: 'Invalid type. Must be "staff" or "student"' },
        { status: 400 }
      );
    }

    // Check if the staff/student already has an account and fetch invite_token
    let existingRecord: { id: string; user_id: string | null; invite_token: string | null };
    if (type === 'staff') {
      const { data: staffRecord, error: fetchError } = await supabase
        .from('staff')
        .select('id, user_id, invite_token')
        .eq('id', id)
        .single<{ id: string; user_id: string | null; invite_token: string | null }>();
      
      if (fetchError) {
        return NextResponse.json(
          { error: 'Staff member not found' },
          { status: 404 }
        );
      }
      
      existingRecord = staffRecord!;
    } else {
      const { data: studentRecord, error: fetchError } = await supabase
        .from('students')
        .select('id, user_id, invite_token')
        .eq('id', id)
        .single<{ id: string; user_id: string | null; invite_token: string | null }>();
      
      if (fetchError) {
        return NextResponse.json(
          { error: 'Student not found' },
          { status: 404 }
        );
      }
      
      existingRecord = studentRecord!;
    }

    // Don't generate invite if they already have an account
    if (existingRecord.user_id) {
      return NextResponse.json(
        { error: 'This person already has an account. Use password reset instead.' },
        { status: 400 }
      );
    }

    // Reuse existing token if available, otherwise generate new one
    let token = existingRecord.invite_token;

    if (!token) {
      // Generate secure random UUID token
      token = randomUUID();

      // Update the respective table with the invite token
      let data: { id: string } | null = null;
      let error;
      
      if (type === 'staff') {
        const result = await supabase
          .from('staff')
          // @ts-expect-error - TypeScript inference issue with Supabase client
          .update({ invite_token: token })
          .eq('id', id)
          .select('id')
          .single<{ id: string }>();
        data = result.data;
        error = result.error;
      } else {
        const result = await supabase
          .from('students')
          // @ts-expect-error - TypeScript inference issue with Supabase client
          .update({ invite_token: token })
          .eq('id', id)
          .select('id')
          .single<{ id: string }>();
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Failed to update invite token:', error);
        return NextResponse.json(
          { error: `Failed to generate invite token: ${error.message}` },
          { status: 500 }
        );
      }

      if (!data) {
        return NextResponse.json(
          { error: `${type} not found` },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({ token, id: existingRecord.id }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error generating invite token:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

