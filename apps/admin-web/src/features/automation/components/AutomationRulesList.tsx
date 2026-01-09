'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { SkeletonTable } from '@altitutor/ui';
import { Switch } from '@altitutor/ui';
import { Plus, Edit, Trash2, MoreVertical } from 'lucide-react';
import { useAutomationRules } from '../api/queries';
import { useUpdateAutomationRule, useDeleteAutomationRule } from '../api/mutations';
import type { AutomationRuleWithActions } from '../types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@altitutor/ui';

interface AutomationRulesListProps {
  onCreateRule: () => void;
  onEditRule: (rule: AutomationRuleWithActions) => void;
}

export function AutomationRulesList({ onCreateRule, onEditRule }: AutomationRulesListProps) {
  const { data: rules, isLoading } = useAutomationRules();
  const updateRule = useUpdateAutomationRule();
  const deleteRule = useDeleteAutomationRule();

  const handleToggleEnabled = (rule: AutomationRuleWithActions) => {
    updateRule.mutate({
      id: rule.id,
      updates: { enabled: !rule.enabled },
    });
  };

  const handleDelete = (rule: AutomationRuleWithActions) => {
    if (confirm(`Are you sure you want to delete the rule "${rule.name}"?`)) {
      deleteRule.mutate(rule.id);
    }
  };

  if (isLoading) {
    return <SkeletonTable rows={5} columns={6} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Automation Rules</h2>
          <p className="text-muted-foreground">
            Create rules that automatically trigger actions based on activity events.
          </p>
        </div>
        <Button onClick={onCreateRule}>
          <Plus className="mr-2 h-4 w-4" />
          Create Rule
        </Button>
      </div>

      {!rules || rules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No automation rules yet.</p>
          <Button onClick={onCreateRule} variant="outline" className="mt-4">
            Create your first rule
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Entity Type</TableHead>
              <TableHead>Event Types</TableHead>
              <TableHead>Actions</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">{rule.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{rule.entity_type}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {rule.event_types.map((eventType) => (
                      <Badge key={eventType} variant="secondary" className="text-xs">
                        {eventType}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{rule.actions?.length || 0} action(s)</Badge>
                </TableCell>
                <TableCell>{rule.priority}</TableCell>
                <TableCell>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => handleToggleEnabled(rule)}
                    disabled={updateRule.isPending}
                  />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditRule(rule)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(rule)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

