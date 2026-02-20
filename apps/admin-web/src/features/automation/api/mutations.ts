import { useMutation, useQueryClient } from '@tanstack/react-query';
import { automationApi } from './automation';
import { automationKeys } from './queryKeys';
import { useToast } from '@altitutor/ui';
import type { AutomationRuleInsert, AutomationRuleUpdate, AutomationActionInsert, TablesUpdate } from '../types';

/**
 * Create a new automation rule. Caller must pass created_by (e.g. from useCurrentStaff()).
 */
export function useCreateAutomationRule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rule: AutomationRuleInsert) => automationApi.createRule(rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationKeys.rules() });
      toast({
        title: 'Automation rule created',
        description: 'The automation rule has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create automation rule',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Update an automation rule
 */
export function useUpdateAutomationRule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: AutomationRuleUpdate }) =>
      automationApi.updateRule(id, updates),
    onSuccess: (updatedRule, { id }) => {
      queryClient.setQueryData(automationKeys.rule(id), updatedRule);
      queryClient.invalidateQueries({ queryKey: automationKeys.rules() });
      toast({
        title: 'Automation rule updated',
        description: 'The automation rule has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update automation rule',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Delete an automation rule
 */
export function useDeleteAutomationRule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ruleId: string) => automationApi.deleteRule(ruleId),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: automationKeys.rule(deletedId) });
      queryClient.invalidateQueries({ queryKey: automationKeys.rules() });
      toast({
        title: 'Automation rule deleted',
        description: 'The automation rule has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete automation rule',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Create an automation action
 */
export function useCreateAutomationAction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (action: AutomationActionInsert) =>
      automationApi.createAction(action),
    onSuccess: (action) => {
      // Invalidate the rule that contains this action
      queryClient.invalidateQueries({ queryKey: automationKeys.rule(action.rule_id) });
      queryClient.invalidateQueries({ queryKey: automationKeys.rules() });
      toast({
        title: 'Action created',
        description: 'The action has been added to the rule.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create action',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Update an automation action
 */
export function useUpdateAutomationAction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'automation_actions'> }) =>
      automationApi.updateAction(id, updates),
    onSuccess: (updatedAction) => {
      queryClient.invalidateQueries({ queryKey: automationKeys.rule(updatedAction.rule_id) });
      queryClient.invalidateQueries({ queryKey: automationKeys.rules() });
      toast({
        title: 'Action updated',
        description: 'The action has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update action',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Delete an automation action
 */
export function useDeleteAutomationAction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ actionId, ruleId: _ruleId }: { actionId: string; ruleId: string }) =>
      automationApi.deleteAction(actionId),
    onSuccess: (_data, { ruleId }) => {
      queryClient.invalidateQueries({ queryKey: automationKeys.rule(ruleId) });
      queryClient.invalidateQueries({ queryKey: automationKeys.rules() });
      toast({
        title: 'Action deleted',
        description: 'The action has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete action',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Mark notification as read
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ notificationId, staffId: _staffId }: { notificationId: string; staffId: string }) =>
      automationApi.markNotificationRead(notificationId),
    onSuccess: (_, { staffId }) => {
      queryClient.invalidateQueries({ queryKey: automationKeys.staffNotifications(staffId) });
      queryClient.invalidateQueries({ queryKey: automationKeys.notifications() });
    },
  });
}

/**
 * Mark all notifications as read for a staff member
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (staffId: string) =>
      automationApi.markAllNotificationsRead(staffId),
    onSuccess: (_data, staffId) => {
      queryClient.invalidateQueries({ queryKey: automationKeys.staffNotifications(staffId) });
      queryClient.invalidateQueries({ queryKey: automationKeys.notifications() });
      toast({
        title: 'All notifications marked as read',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark notifications as read',
        variant: 'destructive',
      });
    },
  });
}

