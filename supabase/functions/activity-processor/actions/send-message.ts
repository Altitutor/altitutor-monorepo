// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveMessageRecipients } from '../recipients.ts';
import { replaceTemplateVariables } from '../utils.ts';

export async function executeSendMessage(
  supabase: SupabaseClient<any>,
  action: any,
  activityEvent: any,
  rule: any
): Promise<void> {
  const config = action.action_config as {
    template_id: string;
    variables?: Record<string, any>;
    contact_id?: string;
    student_id?: string;
    parent_id?: string;
    owned_number_id?: string;
    recipients?: {
      type: 'class_students' | 'class_students_and_parents' | 
            'session_students' | 'session_students_and_parents' | 
            'single';
    };
  };

  if (!config.template_id) {
    throw new Error('template_id required for SEND_MESSAGE action');
  }

  // Load template
  const { data: template, error: templateErr } = await supabase
    .from('message_templates')
    .select('content')
    .eq('id', config.template_id)
    .eq('is_active', true)
    .maybeSingle();

  if (templateErr || !template) {
    throw new Error(`Template not found: ${config.template_id}`);
  }

  // Determine contact IDs
  let contactIds: string[] = [];

  if (config.recipients && config.recipients.type !== 'single') {
    // Bulk recipients based on recipient type
    contactIds = await resolveMessageRecipients(
      supabase,
      config.recipients.type,
      activityEvent
    );
  } else {
    // Single recipient (backward compatible)
    let contactId: string | null = null;
    
    if (config.contact_id) {
      contactId = config.contact_id;
    } else if (config.student_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('student_id', config.student_id)
        .maybeSingle();
      contactId = contact?.id || null;
    } else if (config.parent_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('parent_id', config.parent_id)
        .maybeSingle();
      contactId = contact?.id || null;
    } else if (activityEvent.student_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('student_id', activityEvent.student_id)
        .maybeSingle();
      contactId = contact?.id || null;
    }

    if (contactId) {
      contactIds = [contactId];
    }
  }

  if (contactIds.length === 0) {
    console.warn('[activity-processor] No contacts found for message', {
      ruleId: rule.id,
      actionId: action.id,
      recipientType: config.recipients?.type || 'single',
    });
    return; // Skip if no contacts (don't fail)
  }

  // Get owned number (use provided or default)
  let ownedNumberId = config.owned_number_id;
  if (!ownedNumberId) {
    const { data: defaultOwned } = await supabase
      .from('owned_numbers')
      .select('id')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();
    ownedNumberId = defaultOwned?.id || null;
    
    if (!ownedNumberId) {
      const { data: anyOwned } = await supabase
        .from('owned_numbers')
        .select('id')
        .limit(1)
        .maybeSingle();
      ownedNumberId = anyOwned?.id || null;
    }
  }

  if (!ownedNumberId) {
    throw new Error('No owned number available for sending message');
  }

  // Get owned number details (reused for all messages)
  const { data: ownedNumber } = await supabase
    .from('owned_numbers')
    .select('phone_e164, sender_type')
    .eq('id', ownedNumberId)
    .maybeSingle();

  // Extract variables from activity event and entity data
  // For bulk messages, we'll use generic variables (can be enhanced per-contact later)
  const variables: Record<string, any> = {};
  
  // Load sender name from performed_by staff
  if (activityEvent.performed_by) {
    const { data: staff } = await supabase
      .from('staff')
      .select('first_name, last_name')
      .eq('id', activityEvent.performed_by)
      .maybeSingle();
    
    if (staff) {
      const senderName = `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
      variables.sender_name = senderName || '';
    }
  }
  
  // Merge with any provided variables (config.variables takes precedence)
  const finalVariables = { ...variables, ...(config.variables || {}) };

  // Replace variables (same message body for all recipients)
  const messageBody = replaceTemplateVariables(
    template.content,
    finalVariables
  );

  // Process each contact
  const messageIds: string[] = [];
  const errors: Array<{ contactId: string; error: string }> = [];

  for (const contactId of contactIds) {
    try {
      // Get contact phone number
      const { data: contact } = await supabase
        .from('contacts')
        .select('phone_e164, student_id')
        .eq('id', contactId)
        .maybeSingle();

      if (!contact?.phone_e164) {
        errors.push({ contactId, error: 'Contact has no phone number' });
        continue;
      }

      // Ensure conversation exists
      let conversationId: string;
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contactId)
        .eq('owned_number_id', ownedNumberId)
        .in('status', ['OPEN', 'SNOOZED'])
        .limit(1)
        .maybeSingle();

      if (existingConv?.id) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv, error: convErr } = await supabase
          .from('conversations')
          .insert({
            contact_id: contactId,
            owned_number_id: ownedNumberId,
            status: 'OPEN',
          })
          .select('id')
          .single();

        if (convErr || !newConv) {
          // Handle duplicate key error (race condition)
          if (convErr?.code === '23505') {
            const { data: retryConv } = await supabase
              .from('conversations')
              .select('id')
              .eq('contact_id', contactId)
              .eq('owned_number_id', ownedNumberId)
              .in('status', ['OPEN', 'SNOOZED'])
              .limit(1)
              .maybeSingle();
            if (retryConv?.id) {
              conversationId = retryConv.id;
            } else {
              throw convErr;
            }
          } else {
            throw convErr;
          }
        } else {
          conversationId = newConv.id;
        }
      }

      // Create message (QUEUED)
      const { data: message, error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          direction: 'OUTBOUND',
          body: messageBody,
          status: 'QUEUED',
          created_by_staff_id: null, // Automated
          from_number_e164: ownedNumber?.sender_type === 'PHONE' ? ownedNumber.phone_e164 : null,
          to_number_e164: contact.phone_e164,
        })
        .select('id')
        .single();

      if (msgErr || !message) {
        errors.push({ contactId, error: msgErr?.message || 'Failed to create message' });
        continue;
      }

      messageIds.push(message.id);

      // Invoke send-sms function (fire-and-forget)
      supabase.functions
        .invoke('send-sms', { body: { messageId: message.id } })
        .catch((e: any) => console.error('[activity-processor] Failed to invoke send-sms:', e));
    } catch (contactErr: any) {
      errors.push({ contactId, error: contactErr?.message || 'Unknown error' });
      // Continue with next contact
    }
  }

  console.log('[activity-processor] Messages created and queued', {
    count: messageIds.length,
    messageIds,
    errors: errors.length > 0 ? errors : undefined,
  });
}
