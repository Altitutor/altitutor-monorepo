import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getInviteSmsTemplate } from '@/shared/lib/sms-templates';

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
    const { type, id, token, customMessage, ownedNumberId } = body;

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

    // Fetch the record to get phone and verify token
    let record: { id: string; first_name: string; last_name: string; invite_token: string | null; role?: string } | null;
    let fetchError;
    let phoneNumber: string | null = null;
    
    if (type === 'staff') {
      const result = await supabase
        .from('staff')
        .select('id, first_name, last_name, phone_number, role, invite_token')
        .eq('id', id)
        .single<{ id: string; first_name: string; last_name: string; phone_number: string | null; role: string; invite_token: string | null }>();
      record = result.data;
      fetchError = result.error;
      phoneNumber = result.data?.phone_number ?? null;
    } else {
      const result = await supabase
        .from('students')
        .select('id, first_name, last_name, phone, invite_token')
        .eq('id', id)
        .single<{ id: string; first_name: string; last_name: string; phone: string | null; invite_token: string | null }>();
      record = result.data;
      fetchError = result.error;
      phoneNumber = result.data?.phone ?? null;
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

    if (!phoneNumber) {
      return NextResponse.json(
        { error: `No phone number found for this ${type}` },
        { status: 400 }
      );
    }

    // Get or create contact record for this phone number
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, phone_e164')
      .eq(type === 'staff' ? 'staff_id' : 'student_id', id)
      .eq('phone_e164', phoneNumber)
      .maybeSingle<{ id: string; phone_e164: string }>();

    let contactId = contact?.id;

    // If no contact exists, create one
    if (!contactId) {
      const contactData = type === 'staff' 
        ? { phone_e164: phoneNumber, contact_type: 'STAFF' as const, staff_id: id }
        : { phone_e164: phoneNumber, contact_type: 'STAFF' as const, student_id: id };
      
      const { data: newContact, error: createContactError } = await supabase
        .from('contacts')
        // @ts-expect-error - TypeScript inference issue with Supabase client
        .insert(contactData)
        .select('id')
        .single<{ id: string }>();

      if (createContactError || !newContact) {
        console.error('Failed to create contact:', createContactError);
        return NextResponse.json(
          { error: 'Failed to create contact for SMS' },
          { status: 500 }
        );
      }

      contactId = newContact.id;
    }

    // Get owned number for sending (use provided one or default)
    let ownedNumber: { id: string; phone_e164: string } | null = null;
    
    if (ownedNumberId) {
      const { data, error } = await supabase
        .from('owned_numbers')
        .select('id, phone_e164')
        .eq('id', ownedNumberId)
        .single<{ id: string; phone_e164: string }>();
      
      if (error || !data) {
        console.error('Owned number not found:', error);
        return NextResponse.json(
          { error: 'Owned number not found' },
          { status: 400 }
        );
      }
      ownedNumber = data;
    } else {
      // Get default owned number
      const { data, error: ownedError } = await supabase
        .from('owned_numbers')
        .select('id, phone_e164')
        .order('is_default', { ascending: false })
        .limit(1)
        .single<{ id: string; phone_e164: string }>();

      if (ownedError || !data) {
        console.error('No owned number found:', ownedError);
        return NextResponse.json(
          { error: 'No SMS number available' },
          { status: 500 }
        );
      }
      ownedNumber = data;
    }

    // Get or create conversation
    let conversationId: string;
    const { data: existingConvo } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('owned_number_id', ownedNumber.id)
      .maybeSingle<{ id: string }>();

    if (existingConvo) {
      conversationId = existingConvo.id;
    } else {
      const { data: newConvo, error: convoCreateError } = await supabase
        .from('conversations')
        // @ts-expect-error - TypeScript inference issue with Supabase client
        .insert({
          contact_id: contactId,
          owned_number_id: ownedNumber.id,
        })
        .select('id')
        .single<{ id: string }>();

      if (convoCreateError || !newConvo) {
        console.error('Failed to create conversation:', convoCreateError);
        return NextResponse.json(
          { error: 'Failed to create conversation for SMS' },
          { status: 500 }
        );
      }

      conversationId = newConvo.id;
    }

    // Determine invite URL based on role (for staff) or type (for students)
    let inviteUrl: string;
    const isDev = process.env.NODE_ENV === 'development';
    
    if (type === 'staff') {
      // For staff, check their role to determine which app to send them to
      const staffRole = record.role;
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

    // Create message body - use custom message if provided, otherwise use template
    const messageBody = customMessage && customMessage.trim() 
      ? customMessage.trim()
      : getInviteSmsTemplate({
          firstName: record.first_name,
          inviteUrl,
          linkType: 'invite',
        });

    // Create message record
    // Note: Need to get from/to numbers from conversation
    type ConversationData = {
      owned_number: { phone_e164: string } | null;
      contact: { phone_e164: string } | null;
    };
    
    const { data: convData, error: convDataError } = await supabase
      .from('conversations')
      .select('owned_number:owned_numbers(phone_e164), contact:contacts(phone_e164)')
      .eq('id', conversationId)
      .single<ConversationData>();

    if (convDataError || !convData) {
      console.error('Failed to fetch conversation data:', convDataError);
      return NextResponse.json(
        { error: 'Failed to fetch conversation data' },
        { status: 500 }
      );
    }

    const fromNumber = convData.owned_number?.phone_e164;
    const toNumber = convData.contact?.phone_e164;

    if (!fromNumber || !toNumber) {
      return NextResponse.json(
        { error: 'Missing phone numbers in conversation' },
        { status: 500 }
      );
    }

    const { data: message, error: messageError } = await supabase
      .from('messages')
      // @ts-expect-error - TypeScript inference issue with Supabase client
      .insert({
        conversation_id: conversationId,
        body: messageBody,
        direction: 'OUTBOUND',
        status: 'QUEUED',
        from_number_e164: fromNumber,
        to_number_e164: toNumber,
      })
      .select('id')
      .single<{ id: string }>();

    if (messageError || !message) {
      console.error('Failed to create message:', messageError);
      return NextResponse.json(
        { error: 'Failed to create message' },
        { status: 500 }
      );
    }

    // Call the send-sms edge function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const sendSmsResponse = await fetch(`${supabaseUrl}/functions/v1/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ messageId: message.id }),
    });

    if (!sendSmsResponse.ok) {
      const errorData = await sendSmsResponse.json();
      console.error('Failed to send SMS:', errorData);
      return NextResponse.json(
        { error: 'Failed to send SMS' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Invite SMS sent successfully',
      messageId: message.id 
    }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error sending invite SMS:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

