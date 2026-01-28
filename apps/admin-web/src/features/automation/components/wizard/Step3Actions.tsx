'use client';

import { AutomationActionsList } from '../AutomationActionsList';
import type { Tables } from '@altitutor/shared';
import type { ActivityEntityType } from '../../types';

interface Step3ActionsProps {
  ruleId: string | null;
  entityType: ActivityEntityType;
  templates: Tables<'message_templates'>[];
  staffList: Array<{ id: string; first_name: string; last_name: string }>;
}

export function Step3Actions({
  ruleId,
  entityType,
  templates,
  staffList,
}: Step3ActionsProps) {
  if (!ruleId) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Actions</h3>
          <p className="text-sm text-muted-foreground">
            Configure what happens when this rule triggers.
          </p>
        </div>
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <p>Please complete the previous steps first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Actions</h3>
        <p className="text-sm text-muted-foreground">
          Add actions that will run when this rule triggers. Actions run in order.
        </p>
      </div>
      <AutomationActionsList
        ruleId={ruleId}
        templates={templates}
        staffList={staffList}
      />
    </div>
  );
}
