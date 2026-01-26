'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Zap } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { AutomationRulesList } from '@/features/automation/components/AutomationRulesList';
import { CreateAutomationRuleWizard } from '@/features/automation/components/CreateAutomationRuleWizard';
import { EditAutomationRuleDialog } from '@/features/automation/components/EditAutomationRuleDialog';
import type { AutomationRuleWithActions } from '@/features/automation/types';
import { useQueryClient } from '@tanstack/react-query';

export const dynamic = 'force-dynamic';

export default function AutomationSettingsPage() {
  const router = useRouter();
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
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/settings')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Automation Rules</h1>
            <p className="text-muted-foreground">
              Configure automated actions that trigger based on activity events
            </p>
          </div>
        </div>
      </div>

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

