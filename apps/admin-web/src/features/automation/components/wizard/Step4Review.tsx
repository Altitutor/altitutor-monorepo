'use client';

import { useAutomationRule } from '../../api/queries';
import { Badge } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import type { WizardFormData } from '../CreateAutomationRuleWizard';
import type { Tables } from '@altitutor/shared';
import type { AutomationCondition, AutomationConditionExpression, AutomationAction, ActionConfig } from '../../types';
import { ENTITY_TYPES_DISPLAY, EVENT_NAMES_DISPLAY } from '../../constants';

interface Step4ReviewProps {
  formData: WizardFormData;
  ruleId: string | null;
  templates: Tables<'message_templates'>[];
}

export function Step4Review({ formData, ruleId, templates: _templates }: Step4ReviewProps) {
  const { data: rule, isLoading } = useAutomationRule(ruleId || '', !!ruleId);

  const formatCondition = (condition: AutomationConditionExpression | null | undefined): string => {
    if (!condition) return '';

    if ('all' in condition || 'any' in condition) {
      const expressions = condition.all ?? condition.any ?? [];
      const joiner = condition.all ? ' and ' : ' or ';
      return expressions.map((expression) => `(${formatCondition(expression)})`).join(joiner);
    }

    const leaf = condition as AutomationCondition;

    if (leaf.operator === 'field_changed') {
      return `${leaf.field} changed`;
    }
    if (leaf.operator === 'changed_from') {
      return `${leaf.field} changed from ${leaf.value}`;
    }
    if (leaf.operator === 'changed_to') {
      return `${leaf.field} changed to ${leaf.value}`;
    }
    if (leaf.operator === 'changed_from_to') {
      return `${leaf.field} changed from ${leaf.old_value} to ${leaf.new_value}`;
    }
    
    const operatorLabels: Record<string, string> = {
      equals: 'equals',
      not_equals: 'not equals',
      contains: 'contains',
      not_contains: 'not contains',
      greater_than: 'greater than',
      less_than: 'less than',
    };
    
    return `${leaf.field} ${operatorLabels[leaf.operator] || leaf.operator} ${leaf.value}`;
  };

  const getActionSummary = (action: AutomationAction): string => {
    try {
      if (!action.action_config || typeof action.action_config !== 'object' || Array.isArray(action.action_config)) {
        return 'Invalid action';
      }
      const config = action.action_config as unknown as ActionConfig;
      switch (action.action_type) {
        case 'CREATE_TASK':
          if ('title_template' in config) {
            return config.title_template || 'Create Task (no title template)';
          }
          return 'Create Task (no title template)';
        case 'SEND_MESSAGE':
          if ('message_content' in config && config.message_content) {
            const preview = config.message_content.length > 50 
              ? config.message_content.substring(0, 50) + '...' 
              : config.message_content;
            return `Send Message: ${preview}`;
          }
          return 'Send Message (no content)';
        case 'CREATE_NOTIFICATION':
          if ('title' in config) {
            return config.title || 'Create Notification (no title)';
          }
          return 'Create Notification (no title)';
        default:
          return `Unknown action: ${action.action_type}`;
      }
    } catch {
      return 'Invalid action';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Review</h3>
        <p className="text-sm text-muted-foreground">
          Review your automation rule before creating it.
        </p>
      </div>

      <div className="border rounded-lg p-6 space-y-6 bg-muted/50">
        {/* Basic Info */}
        <div>
          <h4 className="font-medium mb-3">Basic Information</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium">{formData.name}</span>
            </div>
            {formData.description && (
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground">Description:</span>
                <span>{formData.description}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Priority:</span>
              <span>{formData.priority}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={formData.enabled ? 'default' : 'secondary'}>
                {formData.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Trigger */}
        <div>
          <h4 className="font-medium mb-3">Trigger</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">When:</span>
              <span>
                {formData.trigger_kind === 'RELATIVE_TIME'
                  ? `${formData.trigger_config.offset_minutes / 60} hours before a session starts`
                  : `${ENTITY_TYPES_DISPLAY[formData.entity_type] || formData.entity_type} is ${formData.event_names.map(et => EVENT_NAMES_DISPLAY[et] || et).join(', ')}`}
              </span>
            </div>
            {formData.conditions && (
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground">And:</span>
                <span>{formatCondition(formData.conditions)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div>
          <h4 className="font-medium mb-3">Actions</h4>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading actions...</span>
            </div>
          ) : rule?.actions && rule.actions.length > 0 ? (
            <div className="space-y-2">
              {rule.actions
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                .map((action, index) => (
                  <div key={action.id} className="text-sm flex items-start gap-2">
                    <span className="text-muted-foreground">{index + 1}.</span>
                    <span>{getActionSummary(action)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No actions configured yet. You can add actions after creating the rule.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
