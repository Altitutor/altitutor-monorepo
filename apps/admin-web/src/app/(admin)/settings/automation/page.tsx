'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AdminPageActionButton, SettingsPageHeader } from '@/shared/components';
import { AutomationRulesList } from '@/features/automation/components/AutomationRulesList';
import { CreateAutomationRuleWizard } from '@/features/automation/components/CreateAutomationRuleWizard';
import { EditAutomationRuleDialog } from '@/features/automation/components/EditAutomationRuleDialog';
import type { AutomationRuleWithActions } from '@/features/automation/types';
import { useQueryClient } from '@tanstack/react-query';

export const dynamic = 'force-dynamic';

export default function AutomationSettingsPage() {
  const queryClient = useQueryClient();
  const [isCreateWizardOpen, setIsCreateWizardOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRuleWithActions | null>(null);

  const handleCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
  };

  const handleEditClose = () => {
    queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    setEditingRule(null);
  };

  return (
    <div className="p-6">
      <SettingsPageHeader
        title="Automation Rules"
        actions={(
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="Create Rule"
            onClick={() => setIsCreateWizardOpen(true)}
          />
        )}
      />

      <AutomationRulesList
        onCreateRule={() => setIsCreateWizardOpen(true)}
        onEditRule={(rule) => setEditingRule(rule)}
      />

      <CreateAutomationRuleWizard
        isOpen={isCreateWizardOpen}
        onClose={() => setIsCreateWizardOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {editingRule && (
        <EditAutomationRuleDialog
          isOpen={!!editingRule}
          onClose={handleEditClose}
          rule={editingRule}
        />
      )}
    </div>
  );
}
