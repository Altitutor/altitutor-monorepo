import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { replaceTemplateVariables, extractTemplateVariables } from '../utils.ts';

export async function executeCreateTask(
  supabase: SupabaseClient,
  action: { action_config?: unknown },
  activityEvent: Record<string, unknown>,
  rule: Record<string, unknown>,
  entityData?: Record<string, unknown> | null
): Promise<void> {
  const config = action.action_config as {
    title_template: string;
    description_template?: string;
    assigned_to?: string;
    priority?: number;
    due_date_offset_days?: number;
    estimate?: number;
    variables?: Record<string, unknown>;
  };

  // Extract variables from activity event and entity data
  const variables = await extractTemplateVariables(supabase, activityEvent, entityData);
  
  // Merge with any provided variables (config.variables takes precedence)
  const finalVariables = { ...variables, ...(config.variables || {}) };

  // Replace variables in templates
  const title = replaceTemplateVariables(
    config.title_template,
    finalVariables
  );
  const description = config.description_template
    ? replaceTemplateVariables(config.description_template, finalVariables)
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
}
