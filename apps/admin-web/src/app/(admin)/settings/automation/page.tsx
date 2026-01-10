'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Zap } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { AutomationRulesList } from '@/features/automation/components/AutomationRulesList';
import { CreateEditAutomationRuleDialog } from '@/features/automation/components/CreateEditAutomationRuleDialog';
import type { AutomationRuleWithActions } from '@/features/automation/types';

export const dynamic = 'force-dynamic';

export default function AutomationSettingsPage() {
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRuleWithActions | null>(null);

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
        onCreateRule={() => setIsCreateDialogOpen(true)}
        onEditRule={(rule) => setEditingRule(rule)}
      />

      <CreateEditAutomationRuleDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      />

      {editingRule && (
        <CreateEditAutomationRuleDialog
          isOpen={!!editingRule}
          onClose={() => setEditingRule(null)}
          rule={editingRule}
        />
      )}
    </div>
  );
}

