'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useAutomationRule } from '../api/queries';
import { useDeleteAutomationAction } from '../api/mutations';
import { CreateEditActionDialog } from './CreateEditActionDialog';
import type { Tables } from '@altitutor/shared';
import type { AutomationAction, ActivityEntityType, ActionConfig } from '../types';

interface AutomationActionsListProps {
  ruleId: string;
  templates: Tables<'message_templates'>[];
  staffList: Array<{ id: string; first_name: string; last_name: string }>;
}

export function AutomationActionsList({
  ruleId,
  templates,
  staffList,
}: AutomationActionsListProps) {
  const { data: rule } = useAutomationRule(ruleId);
  const deleteAction = useDeleteAutomationAction();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<AutomationAction | null>(null);

  const actions = rule?.actions || [];

  const handleDelete = (actionId: string) => {
    if (confirm('Are you sure you want to delete this action?')) {
      deleteAction.mutate({ actionId, ruleId });
    }
  };

  const getActionConfigSummary = (action: AutomationAction): string => {
    try {
      if (!action.action_config || typeof action.action_config !== 'object' || Array.isArray(action.action_config)) {
        return 'Invalid config';
      }
      const config = action.action_config as unknown as ActionConfig;
      switch (action.action_type) {
        case 'CREATE_TASK':
          if ('title_template' in config) {
            return config.title_template || 'No title template';
          }
          return 'No title template';
        case 'SEND_MESSAGE':
          if ('message_content' in config && config.message_content) {
            const preview = config.message_content.length > 40 
              ? config.message_content.substring(0, 40) + '...' 
              : config.message_content;
            return preview;
          }
          return 'No message content';
        case 'CREATE_NOTIFICATION':
          if ('title' in config) {
            return config.title || 'No title';
          }
          return 'No title';
        default:
          return 'Unknown action';
      }
    } catch {
      return 'Invalid config';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Actions ({actions.length})</h4>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setIsCreateDialogOpen(true)}
          disabled={!ruleId}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Action
        </Button>
      </div>

      {actions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <p>No actions configured yet</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            Add your first action
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Configuration</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions
              .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
              .map((action) => (
                <TableRow key={action.id}>
                  <TableCell>{action.order_index || 0}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{action.action_type}</Badge>
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {getActionConfigSummary(action)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingAction(action)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(action.id)}
                        disabled={deleteAction.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      )}

      <CreateEditActionDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        ruleId={ruleId}
        entityType={rule?.entity_type as ActivityEntityType | undefined}
        templates={templates}
        staffList={staffList}
      />

      {editingAction && (
        <CreateEditActionDialog
          isOpen={!!editingAction}
          onClose={() => setEditingAction(null)}
          ruleId={ruleId}
          entityType={rule?.entity_type as ActivityEntityType | undefined}
          action={editingAction}
          templates={templates}
          staffList={staffList}
        />
      )}
    </div>
  );
}

