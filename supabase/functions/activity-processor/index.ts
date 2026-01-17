// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { json, corsHeaders, evaluateConditions } from './utils.ts';
import { executeSendMessage } from './actions/send-message.ts';
import { executeCreateNotification } from './actions/create-notification.ts';
import { executeCreateTask } from './actions/create-task.ts';

type ProcessBody = { activity_id: string };

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
              case 'SEND_MESSAGE':
                await executeSendMessage(supabase, action, activityEvent, rule, entityData);
                break;

              case 'CREATE_TASK':
                await executeCreateTask(supabase, action, activityEvent, rule);
                break;

              case 'CREATE_NOTIFICATION':
                await executeCreateNotification(supabase, action, activityEvent, rule, entityData);
                break;

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
