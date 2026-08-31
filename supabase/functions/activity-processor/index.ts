import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { serveWithSentry } from '../_shared/sentry.ts';
import { executeCreateNotification } from './actions/create-notification.ts';
import { executeCreateTask } from './actions/create-task.ts';
import { executeSendMessage } from './actions/send-message.ts';
import { corsHeaders, evaluateConditions, json } from './utils.ts';

type ProcessBody = { execution_id?: string };
type RecordData = Record<string, unknown>;

const ENTITY_TABLES: Record<string, string> = {
  student: 'students', students: 'students', parent: 'parents', parents: 'parents',
  staff: 'staff', class: 'classes', classes: 'classes', session: 'sessions',
  sessions: 'sessions', task: 'tasks', tasks: 'tasks', issue: 'issues',
  issues: 'issues', project: 'projects', projects: 'projects', invoice: 'invoices',
  invoices: 'invoices', tutor_log: 'tutor_logs', tutor_logs: 'tutor_logs',
};

function asRecord(value: unknown): RecordData {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordData
    : {};
}

function lifecycleEventToAutomationContext(
  event: RecordData,
  linkedEntities: RecordData[]
): RecordData {
  const payload = asRecord(event.payload);
  const ids: RecordData = {};
  for (const link of linkedEntities) {
    const entityType = String(link.entity_type || '');
    if (entityType && typeof link.entity_id === 'string') {
      ids[`${entityType}_id`] = link.entity_id;
    }
  }

  const subjectType = String(event.subject_type || '');
  const subjectTable = ENTITY_TABLES[subjectType] || subjectType;
  const tutorLogId = typeof payload.tutor_log_id === 'string' ? payload.tutor_log_id : null;

  return {
    ...ids,
    id: event.id,
    domain_event_id: event.id,
    event_name: event.event_name,
    event_type: event.event_name,
    entity_type: tutorLogId ? 'tutor_logs' : subjectTable,
    entity_id: tutorLogId || event.subject_id,
    subject_type: subjectType,
    subject_id: event.subject_id,
    performed_at: event.recorded_at,
    effective_at: event.effective_at,
    performed_by: event.actor_staff_id,
    metadata: payload,
    changed_fields: asRecord(payload.changes),
  };
}

async function loadEntityContext(
  supabase: SupabaseClient,
  activityEvent: RecordData
): Promise<RecordData> {
  const entityType = String(activityEvent.entity_type || '');
  const entityId = String(activityEvent.entity_id || '');
  const table = ENTITY_TABLES[entityType];
  let entityData: RecordData = {};

  if (table && entityId) {
    const { data, error } = await supabase.from(table).select('*').eq('id', entityId).maybeSingle();
    if (error) console.warn('[activity-processor] Failed to load entity data', error);
    else if (data) entityData = data as RecordData;
  }

  const context: RecordData = { ...entityData, entity: entityData };
  const contextEntities = [
    ['student', 'students'], ['parent', 'parents'], ['staff', 'staff'],
    ['class', 'classes'], ['session', 'sessions'], ['task', 'tasks'],
    ['issue', 'issues'], ['project', 'projects'], ['invoice', 'invoices'],
  ] as const;

  await Promise.all(contextEntities.map(async ([contextKey, contextTable]) => {
    const id = activityEvent[`${contextKey}_id`];
    if (typeof id !== 'string') return;
    const { data, error } = await supabase.from(contextTable).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    context[contextKey] = data || null;
  }));
  return context;
}

async function updateExecution(
  supabase: SupabaseClient,
  executionId: string,
  updates: RecordData
): Promise<void> {
  const { error } = await supabase.from('automation_executions').update(updates).eq('id', executionId);
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
    const { data: existing, error } = await supabase
      .from('automation_executions').select('status').eq('id', executionId).maybeSingle();
    if (error) throw error;
    return { executionId, status: existing?.status || 'NOT_FOUND' };
  }

  try {
    const { data: rule, error: ruleError } = await supabase
      .from('automation_rules').select('*').eq('id', execution.rule_id).maybeSingle();
    if (ruleError) throw ruleError;
    if (!rule?.enabled) {
      await updateExecution(supabase, execution.id, {
        status: 'SKIPPED', completed_at: new Date().toISOString(),
        last_error: rule ? 'Rule is disabled' : 'Rule was deleted',
      });
      return { executionId, status: 'SKIPPED' };
    }

    let activityEvent: RecordData;
    if (execution.domain_event_id) {
      const [{ data: event, error: eventError }, { data: links, error: linksError }] =
        await Promise.all([
          supabase.from('domain_events').select('*').eq('id', execution.domain_event_id).maybeSingle(),
          supabase.from('domain_event_entities').select('entity_type, entity_id, role')
            .eq('domain_event_id', execution.domain_event_id),
        ]);
      if (eventError || !event) throw eventError || new Error('Domain event not found');
      if (linksError) throw linksError;
      activityEvent = lifecycleEventToAutomationContext(event as RecordData, (links || []) as RecordData[]);
    } else {
      activityEvent = {
        id: null, execution_id: execution.id, entity_type: execution.entity_type,
        entity_id: execution.entity_id, event_type: execution.event_type,
        session_id: execution.session_id, changed_fields: null,
        metadata: { operation: 'SCHEDULED', scheduled_for: execution.scheduled_for },
        performed_by: null,
      };
    }

    const entityContext = await loadEntityContext(supabase, activityEvent);
    if (!evaluateConditions(rule.conditions, activityEvent, entityContext)) {
      await updateExecution(supabase, execution.id, {
        status: 'SKIPPED', completed_at: new Date().toISOString(),
        last_error: 'Rule conditions not met at execution time',
      });
      return { executionId, status: 'SKIPPED' };
    }

    const { data: actions, error: actionsError } = await supabase
      .from('automation_actions').select('*').eq('rule_id', rule.id)
      .order('order_index', { ascending: true });
    if (actionsError) throw actionsError;

    for (const action of actions || []) {
      switch (action.action_type) {
        case 'SEND_MESSAGE':
          await executeSendMessage(supabase, action, activityEvent, rule, execution, entityContext);
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
      status: 'COMPLETED', completed_at: new Date().toISOString(), last_error: null,
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

serveWithSentry('activity-processor', async (req: Request, sentry) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as ProcessBody;
    if (!body.execution_id) return json({ error: 'execution_id required' }, 400);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );
    const result = await processExecution(supabase, body.execution_id);
    return json({ processed: true, executions: [result] });
  } catch (error: unknown) {
    sentry.captureException(error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[activity-processor] Error', message);
    return json({ error: message }, 500);
  }
});
