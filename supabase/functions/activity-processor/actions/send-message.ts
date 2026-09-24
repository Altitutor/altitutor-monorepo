import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { resolveMessageRecipients } from '../recipients.ts';
import { 
  replaceTemplateVariables, 
  extractTemplateVariables,
  getOrGenerateStudentInviteToken,
  getOrGenerateStudentRegistrationToken,
  buildStudentInviteUrl,
  formatTime,
  formatDayOfWeek
} from '../utils.ts';

export async function executeSendMessage(
  supabase: SupabaseClient,
  action: { id: string; action_config?: unknown },
  activityEvent: Record<string, unknown>,
  rule: Record<string, unknown>,
  execution: { id: string },
  entityData?: Record<string, unknown> | null
): Promise<void> {
  const config = action.action_config as {
    message_content: string;
    variables?: Record<string, unknown>;
    contact_id?: string;
    student_id?: string;
    parent_id?: string;
    owned_number_id?: string;
    recipients?: {
      type: 'class_students' | 'class_students_and_parents' | 
            'session_students' | 'session_students_and_parents' | 
            'student_and_parents' |
            'tutor_log_students' |
            'tutor_log_students_and_parents' |
            'tutor_log_attendees' |
            'single';
    };
  };

  if (!config.message_content || !config.message_content.trim()) {
    throw new Error('message_content required for SEND_MESSAGE action');
  }

  const messageTemplate = config.message_content;

  let targets: Array<{ contactId: string; studentId?: string }> = [];

  if (config.recipients && config.recipients.type !== 'single') {
    // Bulk recipients based on recipient type
    targets = await resolveMessageRecipients(
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
      targets = [{
        contactId,
        studentId: config.student_id ||
          (typeof activityEvent.student_id === 'string' ? activityEvent.student_id : undefined),
      }];
    }
  }

  if (targets.length === 0) {
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
  const variables = await extractTemplateVariables(supabase, activityEvent, entityData);
  
  // Merge with any provided variables (config.variables takes precedence)
  const baseVariables = { ...variables, ...(config.variables || {}) };

  // Check if message content contains per-student link variables
  const hasLinkVariables = /\{(student_invite_link|student_registration_link|student\.invite_link|student\.registration_link)\}/gi.test(messageTemplate);
  
  // For bulk recipients with link variables, we need per-contact message bodies
  // Otherwise, use shared message body
  const usePerContactMessages = hasLinkVariables && config.recipients && config.recipients.type !== 'single';

  // Session-wide notices should reach a shared parent phone once, even when that
  // parent has multiple students in the same session. Registration/invite links
  // remain per student because each link carries a different student context.
  const deliveryTargets = hasLinkVariables
    ? targets
    : [...new Map(targets.map((target) => [target.contactId, target])).values()];

  // Process each contact
  const messageIds: string[] = [];
  const errors: Array<{ contactId: string; error: string }> = [];

  for (const target of deliveryTargets) {
    const { contactId, studentId: targetStudentId } = target;
    let deliveryId: string | null = null;
    try {
      const { data: insertedDelivery, error: deliveryInsertError } = await supabase
        .from('automation_message_deliveries')
        .insert({
          execution_id: execution.id,
          action_id: action.id,
          contact_id: contactId,
          student_id: targetStudentId || null,
          status: 'PROCESSING',
        })
        .select('id')
        .single();

      if (deliveryInsertError?.code === '23505') {
        let existingQuery = supabase
          .from('automation_message_deliveries')
          .select('id, status, message_id, attempt_count')
          .eq('execution_id', execution.id)
          .eq('action_id', action.id)
          .eq('contact_id', contactId);
        existingQuery = targetStudentId
          ? existingQuery.eq('student_id', targetStudentId)
          : existingQuery.is('student_id', null);

        const { data: existingDelivery, error: existingDeliveryError } =
          await existingQuery.single();
        if (existingDeliveryError) throw existingDeliveryError;

        deliveryId = existingDelivery.id;
        if (existingDelivery.status === 'QUEUED' || existingDelivery.status === 'SKIPPED') {
          continue;
        }
        if (existingDelivery.attempt_count >= 8) {
          throw new Error('Message delivery retry limit reached');
        }

        const { error: retryUpdateError } = await supabase
          .from('automation_message_deliveries')
          .update({
            status: 'PROCESSING',
            attempt_count: existingDelivery.attempt_count + 1,
            last_error: null,
          })
          .eq('id', deliveryId);
        if (retryUpdateError) throw retryUpdateError;

        if (existingDelivery.message_id) {
          const { data: existingMessage, error: existingMessageError } = await supabase
            .from('messages')
            .select('status')
            .eq('id', existingDelivery.message_id)
            .single();
          if (existingMessageError) throw existingMessageError;

          // A provider-accepted message must never be sent again merely because
          // the processor failed before updating its own delivery ledger.
          if (['SENDING', 'SENT', 'DELIVERED'].includes(existingMessage.status)) {
            await supabase
              .from('automation_message_deliveries')
              .update({ status: 'QUEUED', last_error: null })
              .eq('id', deliveryId);
            messageIds.push(existingDelivery.message_id);
            continue;
          }

          const { error: invokeError } = await supabase.functions.invoke('send-message', {
            body: { messageId: existingDelivery.message_id },
          });
          if (invokeError) throw invokeError;
          await supabase
            .from('automation_message_deliveries')
            .update({ status: 'QUEUED', last_error: null })
            .eq('id', deliveryId);
          messageIds.push(existingDelivery.message_id);
          continue;
        }
      } else if (deliveryInsertError) {
        throw deliveryInsertError;
      } else {
        deliveryId = insertedDelivery.id;
      }

      // Get contact phone number and student_id
      const { data: contact } = await supabase
        .from('contacts')
        .select('phone_e164, student_id, parent_id')
        .eq('id', contactId)
        .maybeSingle();

      if (!contact?.phone_e164) {
        if (deliveryId) {
          await supabase
            .from('automation_message_deliveries')
            .update({ status: 'SKIPPED', last_error: 'Contact has no phone number' })
            .eq('id', deliveryId);
        }
        continue;
      }

      // Generate per-contact message body if needed (for link variables with bulk recipients OR student_and_parents)
      // For student_and_parents, we need per-contact student data (first_name, last_name, etc.)
      const needsPerContactData = usePerContactMessages || Boolean(targetStudentId) ||
        (config.recipients && config.recipients.type === 'student_and_parents');
      
      let messageBody: string;
      if (needsPerContactData) {
        // Generate per-contact variables
        const contactVariables = { ...baseVariables };
        
        // Determine student_id for this contact
        const studentIdForData: string | null = targetStudentId || contact.student_id || null;
        
        // Load student data if we have a student_id (for first_name, last_name, classes, etc.)
        if (studentIdForData) {
          const { data: student } = await supabase
            .from('students')
            .select('first_name, last_name')
            .eq('id', studentIdForData)
            .maybeSingle();
          
          if (student) {
            contactVariables['first_name'] = student.first_name || '';
            contactVariables['last_name'] = student.last_name || '';
            contactVariables['student.first_name'] = student.first_name || '';
            contactVariables['student.last_name'] = student.last_name || '';
            
            // Load student classes for {classes} variable
            const { data: enrollments } = await supabase
              .from('classes_students')
              .select(`
                class_id,
                classes!inner (
                  id,
                  day_of_week,
                  start_time,
                  end_time,
                  room,
                  level,
                  subject_id,
                  subjects (
                    long_name,
                    short_name,
                    curriculum
                  )
                )
              `)
              .eq('student_id', studentIdForData)
              .is('unenrolled_at', null);
            
            if (enrollments && enrollments.length > 0) {
              const classesList = enrollments
                .map((e: { classes?: { day_of_week?: number; start_time?: string; end_time?: string; subjects?: { short_name?: string; long_name?: string } } }) => {
                  const cls = e.classes;
                  const subject = cls?.subjects;
                  if (!cls) return null;
                  
                  const dayName = formatDayOfWeek(cls.day_of_week);
                  const startTime = cls.start_time ? formatTime(cls.start_time) : '';
                  const endTime = cls.end_time ? formatTime(cls.end_time) : '';
                  const subjectName = subject?.short_name || subject?.long_name || '';
                  
                  return `- ${subjectName} ${dayName} ${startTime} - ${endTime}`;
                })
                .filter(Boolean)
                .join('\n');
              
              contactVariables['classes'] = classesList || 'No classes enrolled';
            } else {
              contactVariables['classes'] = 'No classes enrolled';
            }
          }
          
          // Generate student links if needed
          if (usePerContactMessages) {
            // Generate invite link
            const inviteToken = await getOrGenerateStudentInviteToken(supabase, studentIdForData);
            if (inviteToken) {
              contactVariables['student_invite_link'] = buildStudentInviteUrl(inviteToken, 'invite');
              contactVariables['student.invite_link'] = buildStudentInviteUrl(inviteToken, 'invite');
            } else {
              contactVariables['student_invite_link'] = '';
              contactVariables['student.invite_link'] = '';
            }
            
            // Generate registration link
            const registrationToken = await getOrGenerateStudentRegistrationToken(supabase, studentIdForData);
            if (registrationToken) {
              contactVariables['student_registration_link'] = buildStudentInviteUrl(registrationToken, 'register');
              contactVariables['student.registration_link'] = buildStudentInviteUrl(registrationToken, 'register');
            } else {
              contactVariables['student_registration_link'] = '';
              contactVariables['student.registration_link'] = '';
            }
          }
        } else {
          // No student_id available, set student variables to empty
          contactVariables['first_name'] = '';
          contactVariables['last_name'] = '';
          contactVariables['classes'] = 'No classes enrolled';
          if (usePerContactMessages) {
            contactVariables['student_invite_link'] = '';
            contactVariables['student.invite_link'] = '';
            contactVariables['student_registration_link'] = '';
            contactVariables['student.registration_link'] = '';
          }
        }
        
        messageBody = replaceTemplateVariables(messageTemplate, contactVariables);
      } else {
        // Use shared message body (no per-contact customization needed)
        messageBody = replaceTemplateVariables(messageTemplate, baseVariables);
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

      if (deliveryId) {
        const { error: deliveryMessageError } = await supabase
          .from('automation_message_deliveries')
          .update({ message_id: message.id })
          .eq('id', deliveryId);
        if (deliveryMessageError) throw deliveryMessageError;
      }

      const { error: invokeError } = await supabase.functions.invoke('send-message', {
        body: { messageId: message.id },
      });
      if (invokeError) throw invokeError;

      if (deliveryId) {
        await supabase
          .from('automation_message_deliveries')
          .update({ status: 'QUEUED', last_error: null })
          .eq('id', deliveryId);
      }
    } catch (contactErr: unknown) {
      const msg = contactErr instanceof Error ? contactErr.message : 'Unknown error';
      errors.push({ contactId, error: msg });
      if (deliveryId) {
        await supabase
          .from('automation_message_deliveries')
          .update({ status: 'FAILED', last_error: msg })
          .eq('id', deliveryId);
      }
      // Continue with next contact
    }
  }

  console.log('[activity-processor] Messages created and queued', {
    count: messageIds.length,
    messageIds,
    errors: errors.length > 0 ? errors : undefined,
  });

  if (errors.length > 0) {
    throw new Error(`Failed to send ${errors.length} of ${deliveryTargets.length} automated messages`);
  }
}
