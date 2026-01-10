import { useQuery } from '@tanstack/react-query';
import { automationApi } from './automation';
import { automationKeys } from './queryKeys';

/**
 * Get all automation rules with their actions
 */
export function useAutomationRules() {
  return useQuery({
    queryKey: automationKeys.rules(),
    queryFn: () => automationApi.listRules(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Get a single automation rule with its actions
 */
export function useAutomationRule(ruleId: string, enabled = true) {
  return useQuery({
    queryKey: automationKeys.rule(ruleId),
    queryFn: () => automationApi.getRule(ruleId),
    enabled: enabled && !!ruleId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Get notifications for a staff member
 */
export function useNotifications(staffId: string, unreadOnly = false) {
  return useQuery({
    queryKey: automationKeys.staffNotifications(staffId),
    queryFn: () => automationApi.getNotifications(staffId, unreadOnly),
    enabled: !!staffId,
    staleTime: 1000 * 30, // 30 seconds - notifications change frequently
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

