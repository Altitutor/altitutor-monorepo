import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { json, corsHeaders, evaluateConditions } from './utils.ts';
import { executeSendMessage } from './actions/send-message.ts';
import { executeCreateNotification } from './actions/create-notification.ts';
import { executeCreateTask } from './actions/create-task.ts';

type ProcessBody = { activity_id?: string; execution_id?: string };
type RecordData = Record<string, unknown>;

async function loadEntityContext(
  supabase: SupabaseClient,
  activityEvent: RecordData
): Promise<RecordData> {
  let entityData: RecordData = {};
  const entityType = String(activityEvent.entity_type || '');
  const entityId = String(activityEvent.entity_id || '');

  if (entityType && entityId) {
    const { data, error } = await supabase
      .from(entityType)
      .select('*')
      .eq('id', entityId)
      .maybeSingle();
    if (error) {
      console.warn('[activity-processor] Failed to load entity data', error);
    } else if (data) {
      entityData = data as RecordData;
    }
  }

  const context: RecordData = { ...entityData, entity: entityData };
  const sessionId = typeof activityEvent.session_id === 'string'
    ? activityEvent.session_id
    : entityType === 'sessions' ? entityId : null;

  if (sessionId) {
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();
    if (sessionError) throw sessionError;
    context.session = session || null;
  }

  return context;
}

async function updateExecution(
  supabase: SupabaseClient,
  executionId: string,
  updates: RecordData
): Promise<void> {
  const { error } = await supabase
    .from('automation_executions')
    .update(updates)
    .eq('id', executionId);
  if (error) throw error;
}

async function processExecution(
  supabase: SupabaseClient,
  executionId: string
): Promise<{ executionId: string; status: string }> {
  const { data: claimedRows, error: claimError } = await supabase
    .rpc('claim_automation_execution', { p_execution_id: executionId });
  if (claimError) throw claimError;

  const execution = claimedRows?.[0];
  if (!execution) {
    const { data: existing, error: existingError } = await supabase
      .from('automation_executions')
      .select('status')
      .eq('id', executionId)
      .maybeSingle();
    if (existingError) throw existingError;
    return { executionId, status: existing?.status || 'NOT_FOUND' };
  }

  try {
    const { data: rule, error: ruleError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('id', execution.rule_id)
      .maybeSingle();
    if (ruleError) throw ruleError;

    if (!rule?.enabled) {
      await updateExecution(supabase, execution.id, {
        status: 'SKIPPED',
        completed_at: new Date().toISOString(),
        last_error: rule ? 'Rule is disabled' : 'Rule was deleted',
      });
      return { executionId, status: 'SKIPPED' };
    }

    let activityEvent: RecordData;
    if (execution.activity_event_id) {
      const { data, error } = await supabase
        .from('activity_events')
        .select('*')
        .eq('id', execution.activity_event_id)
        .maybeSingle();
      if (error || !data) throw error || new Error('Activity event not found');
      activityEvent = data as RecordData;
    } else {
      activityEvent = {
        id: null,
        execution_id: execution.id,
        entity_type: execution.entity_type,
        entity_id: execution.entity_id,
        event_type: execution.event_type,
        session_id: execution.session_id,
        changed_fields: null,
        metadata: { operation: 'SCHEDULED', scheduled_for: execution.scheduled_for },
        performed_by: null,
      };
    }

    const entityContext = await loadEntityContext(supabase, activityEvent);
    if (!evaluateConditions(rule.conditions, activityEvent, entityContext)) {
      await updateExecution(supabase, execution.id, {
        status: 'SKIPPED',
        completed_at: new Date().toISOString(),
        last_error: 'Rule conditions not met at execution time',
      });
      return { executionId, status: 'SKIPPED' };
    }

    const { data: actions, error: actionsError } = await supabase
      .from('automation_actions')
      .select('*')
      .eq('rule_id', rule.id)
      .order('order_index', { ascending: true });
    if (actionsError) throw actionsError;

    for (const action of actions || []) {
      switch (action.action_type) {
        case 'SEND_MESSAGE':
          await executeSendMessage(
            supabase,
            action,
            activityEvent,
            rule,
            execution,
            entityContext
          );
          break;
        case 'CREATE_TASK':
          await executeCreateTask(supabase, action, activityEvent, rule, entityContext);
          break;
        case 'CREATE_NOTIFICATION':
          await executeCreateNotification(supabase, action, activityEvent, rule, entityContext);
          break;
        default:
          throw new Error(`Unknown automation action type: ${action.action_type}`);
      }
    }

    await updateExecution(supabase, execution.id, {
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      last_error: null,
    });
    return { executionId, status: 'COMPLETED' };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const delayMinutes = Math.min(60, 2 ** Math.max(0, execution.attempt_count - 1));
    await updateExecution(supabase, execution.id, {
      status: 'FAILED',
      next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
      last_error: message,
    });
    throw error;
  }
}

async function enqueueActivityExecutions(
  supabase: SupabaseClient,
  activityId: string
): Promise<string[]> {
  const { data: activityEvent, error: activityError } = await supabase
    .from('activity_events')
    .select('*')
    .eq('id', activityId)
    .maybeSingle();
  if (activityError || !activityEvent) {
    throw activityError || new Error('Activity event not found');
  }

  const { data: rules, error: rulesError } = await supabase
    .from('automation_rules')
    .select('id')
    .eq('enabled', true)
    .eq('trigger_kind', 'EVENT')
    .eq('entity_type', activityEvent.entity_type)
    .contains('event_types', [activityEvent.event_type])
    .order('priority', { ascending: false });
  if (rulesError) throw rulesError;

  const executionIds: string[] = [];
  for (const rule of rules || []) {
    const { data: executionId, error: enqueueError } = await supabase.rpc(
      'enqueue_automation_execution',
      {
        p_rule_id: rule.id,
        p_activity_event_id: activityEvent.id,
        p_entity_type: activityEvent.entity_type,
        p_entity_id: activityEvent.entity_id,
        p_event_type: activityEvent.event_type,
        p_session_id: activityEvent.session_id,
        p_source_key: `event:${activityEvent.id}:${rule.id}`,
        p_scheduled_for: activityEvent.performed_at,
      }
    );
    if (enqueueError) throw enqueueError;
    if (executionId) executionIds.push(executionId);
  }
  return executionIds;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ProcessBody;
    if (!body.activity_id && !body.execution_id) {
      return json({ error: 'activity_id or execution_id required' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const executionIds = body.execution_id
      ? [body.execution_id]
      : await enqueueActivityExecutions(supabase, body.activity_id!);
    const results = [];
    for (const executionId of executionIds) {
      results.push(await processExecution(supabase, executionId));
    }

    return json({ processed: true, executions: results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[activity-processor] Error', message);
    return json({ error: message }, 500);
  }
});
