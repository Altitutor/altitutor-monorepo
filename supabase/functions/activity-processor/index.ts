// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

type ProcessBody = { activity_id: string };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(resp: any, status = 200) {
  return new Response(JSON.stringify(resp), { 
    status, 
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders 
    } 
  });
}

// Evaluate rule conditions against activity event
function evaluateConditions(conditions: any, activityEvent: any, entityData: any): boolean {
  if (!conditions || Object.keys(conditions).length === 0) {
    return true; // No conditions = always match
  }

  // Simple condition evaluation
  // Supports: { "field": "status", "operator": "equals", "value": "draft" }
  if (conditions.field && conditions.operator && conditions.value !== undefined) {
    const fieldValue = entityData?.[conditions.field];
    
    switch (conditions.operator) {
      case 'equals':
        return fieldValue === conditions.value;
      case 'not_equals':
        return fieldValue !== conditions.value;
      case 'contains':
        return String(fieldValue || '').includes(String(conditions.value));
      case 'not_contains':
        return !String(fieldValue || '').includes(String(conditions.value));
      case 'greater_than':
        return Number(fieldValue) > Number(conditions.value);
      case 'less_than':
        return Number(fieldValue) < Number(conditions.value);
      default:
        console.warn('[activity-processor] Unknown operator:', conditions.operator);
        return false;
    }
  }

  // Complex conditions (AND/OR) can be added later
  return true;
}

// Replace template variables with actual values
// Supports: {first_name}, {last_name}, {classes}, {sender_name}
// Variables are case-insensitive
function replaceTemplateVariables(template: string, variables: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    // Use single braces {variable} format (case-insensitive)
    const placeholder = new RegExp(`\\{${key}\\}`, 'gi');
    result = result.replace(placeholder, String(value || ''));
  }
  return result;
}

// Format class name for display
function formatClassName(classData: any, subject: any): string {
  const parts: string[] = [];
  
  if (subject?.long_name) {
    parts.push(subject.long_name);
  }
  
  if (classData.day_of_week != null) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    parts.push(days[classData.day_of_week] || '');
  }
  
  if (classData.start_time && classData.end_time) {
    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    };
    parts.push(`${formatTime(classData.start_time)} - ${formatTime(classData.end_time)}`);
  }
  
  return parts.join(' ');
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let activityId: string | undefined;

  try {
    const body = (await req.json()) as ProcessBody;
    activityId = body.activity_id;
    
    if (!activityId) {
      return json({ error: 'activity_id required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    console.log('[activity-processor] Processing activity', { activityId });

    // Load activity event
    const { data: activityEvent, error: activityErr } = await supabase
      .from('activity_events')
      .select('*')
      .eq('id', activityId)
      .maybeSingle();
    
    if (activityErr || !activityEvent) {
      throw activityErr || new Error('Activity event not found');
    }

    console.log('[activity-processor] Loaded activity event', {
      id: activityEvent.id,
      entity_type: activityEvent.entity_type,
      event_type: activityEvent.event_type,
    });

    // Query matching automation rules
    const { data: rules, error: rulesErr } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('enabled', true)
      .eq('entity_type', activityEvent.entity_type)
      .contains('event_types', [activityEvent.event_type])
      .order('priority', { ascending: false }); // Higher priority first

    if (rulesErr) throw rulesErr;

    if (!rules || rules.length === 0) {
      console.log('[activity-processor] No matching rules found');
      return json({ processed: true, rulesMatched: 0 });
    }

    console.log('[activity-processor] Found matching rules', { count: rules.length });

    // Load entity data for condition evaluation
    let entityData: any = null;
    try {
      const { data, error } = await supabase
        .from(activityEvent.entity_type)
        .select('*')
        .eq('id', activityEvent.entity_id)
        .maybeSingle();
      
      if (!error && data) {
        entityData = data;
      }
    } catch (e) {
      console.warn('[activity-processor] Failed to load entity data', e);
    }

    const processedRules: string[] = [];
    const errors: Array<{ ruleId: string; error: string }> = [];

    // Process each matching rule
    for (const rule of rules) {
      try {
        // Evaluate conditions
        if (!evaluateConditions(rule.conditions, activityEvent, entityData)) {
          console.log('[activity-processor] Rule conditions not met', { ruleId: rule.id });
          continue;
        }

        console.log('[activity-processor] Rule matched, executing actions', { ruleId: rule.id });

        // Load actions for this rule (ordered by order_index)
        const { data: actions, error: actionsErr } = await supabase
          .from('automation_actions')
          .select('*')
          .eq('rule_id', rule.id)
          .order('order_index', { ascending: true });

        if (actionsErr) {
          errors.push({ ruleId: rule.id, error: `Failed to load actions: ${actionsErr.message}` });
          continue;
        }

        if (!actions || actions.length === 0) {
          console.log('[activity-processor] Rule has no actions', { ruleId: rule.id });
          continue;
        }

        // Execute actions in order
        for (const action of actions) {
          try {
            console.log('[activity-processor] Executing action', {
              ruleId: rule.id,
              actionId: action.id,
              actionType: action.action_type,
            });

            switch (action.action_type) {
              case 'SEND_MESSAGE': {
                const config = action.action_config as {
                  template_id: string;
                  variables?: Record<string, any>;
                  contact_id?: string;
                  student_id?: string;
                  parent_id?: string;
                  owned_number_id?: string;
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

                // Extract variables from activity event and entity data
                const variables: Record<string, any> = {};
                
                // Determine student_id (from config, activity event, or contact)
                let studentId: string | null = config.student_id || activityEvent.student_id || null;
                
                // If we have a contact_id but no student_id, try to get it from contact
                if (!studentId && config.contact_id) {
                  const { data: contact } = await supabase
                    .from('contacts')
                    .select('student_id')
                    .eq('id', config.contact_id)
                    .maybeSingle();
                  studentId = contact?.student_id || null;
                }
                
                // Load student data if we have student_id
                if (studentId) {
                  const { data: student } = await supabase
                    .from('students')
                    .select('first_name, last_name')
                    .eq('id', studentId)
                    .maybeSingle();
                  
                  if (student) {
                    variables.first_name = student.first_name || '';
                    variables.last_name = student.last_name || '';
                    
                    // Load and format student classes
                    const { data: enrollments } = await supabase
                      .from('classes_students')
                      .select(`
                        class:classes(*, subject:subjects(*))
                      `)
                      .eq('student_id', studentId)
                      .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
                    
                    if (enrollments && enrollments.length > 0) {
                      const classesText = enrollments
                        .map((enrollment: any) => {
                          const cls = enrollment.class;
                          const subject = cls?.subject || null;
                          if (cls) {
                            return `- ${formatClassName(cls, subject)}`;
                          }
                          return null;
                        })
                        .filter((text: string | null) => text !== null)
                        .join('\n');
                      variables.classes = classesText || 'No classes enrolled';
                    } else {
                      variables.classes = 'No classes enrolled';
                    }
                  }
                }
                
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

                // Replace variables
                const messageBody = replaceTemplateVariables(
                  template.content,
                  finalVariables
                );

                // Determine contact ID
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

                if (!contactId) {
                  throw new Error('Could not determine contact ID for message');
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

                // Get contact phone number
                const { data: contact } = await supabase
                  .from('contacts')
                  .select('phone_e164')
                  .eq('id', contactId)
                  .maybeSingle();

                if (!contact?.phone_e164) {
                  throw new Error('Contact has no phone number');
                }

                // Get owned number details
                const { data: ownedNumber } = await supabase
                  .from('owned_numbers')
                  .select('phone_e164, sender_type')
                  .eq('id', ownedNumberId)
                  .maybeSingle();

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
                  throw msgErr || new Error('Failed to create message');
                }

                // Invoke send-sms function (fire-and-forget)
                supabase.functions
                  .invoke('send-sms', { body: { messageId: message.id } })
                  .catch((e: any) => console.error('[activity-processor] Failed to invoke send-sms:', e));

                console.log('[activity-processor] Message created and queued', { messageId: message.id });
                break;
              }

              case 'CREATE_TASK': {
                const config = action.action_config as {
                  title_template: string;
                  description_template?: string;
                  assigned_to?: string;
                  priority?: number;
                  due_date_offset_days?: number;
                  estimate?: number;
                  variables?: Record<string, any>;
                };

                // Replace variables in templates
                const title = replaceTemplateVariables(
                  config.title_template,
                  config.variables || {}
                );
                const description = config.description_template
                  ? replaceTemplateVariables(config.description_template, config.variables || {})
                  : null;

                // Calculate due date if offset provided
                let dueDate: string | null = null;
                if (config.due_date_offset_days !== undefined) {
                  const date = new Date();
                  date.setDate(date.getDate() + config.due_date_offset_days);
                  dueDate = date.toISOString();
                }

                // Create task
                const { data: task, error: taskErr } = await supabase
                  .from('tasks')
                  .insert({
                    title,
                    description,
                    assigned_to: config.assigned_to || null,
                    priority: config.priority ?? 0,
                    due_date: dueDate,
                    estimate: config.estimate || null,
                    created_by: null, // Automated
                    source_rule_id: rule.id,
                    source_activity_id: activityEvent.id,
                    status: 'backlog',
                  })
                  .select('id')
                  .single();

                if (taskErr || !task) {
                  throw taskErr || new Error('Failed to create task');
                }

                console.log('[activity-processor] Task created', { taskId: task.id });
                break;
              }

              case 'CREATE_NOTIFICATION': {
                const config = action.action_config as {
                  notification_type: string;
                  title: string;
                  body?: string;
                  action_url?: string;
                  staff_id?: string;
                  variables?: Record<string, any>;
                };

                // Replace variables
                const title = replaceTemplateVariables(config.title, config.variables || {});
                const body = config.body
                  ? replaceTemplateVariables(config.body, config.variables || {})
                  : null;

                // Determine staff_id (use provided or from activity event)
                let staffId: string | null = config.staff_id || activityEvent.staff_id || activityEvent.performed_by || null;

                if (!staffId) {
                  throw new Error('Could not determine staff_id for notification');
                }

                // Create notification
                const { data: notification, error: notifErr } = await supabase
                  .from('notifications')
                  .insert({
                    staff_id: staffId,
                    activity_event_id: activityEvent.id,
                    notification_type: config.notification_type,
                    title,
                    body,
                    action_url: config.action_url || null,
                  })
                  .select('id')
                  .single();

                if (notifErr || !notification) {
                  throw notifErr || new Error('Failed to create notification');
                }

                console.log('[activity-processor] Notification created', { notificationId: notification.id });
                break;
              }

              default:
                console.warn('[activity-processor] Unknown action type', { actionType: action.action_type });
            }
          } catch (actionErr: any) {
            console.error('[activity-processor] Action execution failed', {
              ruleId: rule.id,
              actionId: action.id,
              error: actionErr?.message || actionErr,
            });
            errors.push({
              ruleId: rule.id,
              error: `Action ${action.id} failed: ${actionErr?.message || actionErr}`,
            });
            // Continue with next action (don't fail entire rule)
          }
        }

        processedRules.push(rule.id);
      } catch (ruleErr: any) {
        console.error('[activity-processor] Rule processing failed', {
          ruleId: rule.id,
          error: ruleErr?.message || ruleErr,
        });
        errors.push({
          ruleId: rule.id,
          error: ruleErr?.message || ruleErr,
        });
        // Continue with next rule
      }
    }

    return json({
      processed: true,
      rulesMatched: rules.length,
      rulesProcessed: processedRules.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    console.error('[activity-processor] Error', e?.message || e);
    return json({ error: e?.message || 'Unknown error' }, 500);
  }
});

