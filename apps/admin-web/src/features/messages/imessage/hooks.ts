'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import {
  fetchImessageConnectorState,
  fetchRecentImessageCommands,
  invokeImessageControl,
} from './api';
import { messagesKeys } from '../api/queryKeys';
import type { ImessageCommandRequest, ImessageCommandType } from './types';

export const imessageKeys = {
  all: ['imessage'] as const,
  connector: () => [...imessageKeys.all, 'connector'] as const,
  commands: () => [...imessageKeys.all, 'commands'] as const,
};

function queuedActionLabel(commandType: ImessageCommandType): string | null {
  switch (commandType) {
    case 'react':
      return 'Reaction queued';
    case 'edit_message':
      return 'Edit queued';
    case 'unsend_message':
      return 'Unsend queued';
    case 'mark_chat_read':
      return 'Mark read queued';
    case 'mark_chat_unread':
      return 'Mark unread queued';
    case 'restart_messages_app':
      return 'Messages.app restart queued';
    case 'delete_chat':
      return 'Delete chat queued';
    case 'leave_chat':
      return 'Leave chat queued';
    case 'add_participant':
      return 'Add participant queued';
    case 'remove_participant':
      return 'Remove participant queued';
    case 'create_chat':
    case 'update_chat':
    case 'set_group_icon':
    case 'remove_group_icon':
    case 'delete_message':
    case 'mark_alerts_read':
      return 'iMessage action queued';
    default: {
      const exhaustive: never = commandType;
      return exhaustive;
    }
  }
}

export function useImessageConnectorState() {
  return useQuery({
    queryKey: imessageKeys.connector(),
    queryFn: fetchImessageConnectorState,
    refetchInterval: 30_000,
  });
}

export function useRecentImessageCommands() {
  return useQuery({
    queryKey: imessageKeys.commands(),
    queryFn: fetchRecentImessageCommands,
    refetchInterval: 30_000,
  });
}

export function useImessageControl() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (request: ImessageCommandRequest) =>
      invokeImessageControl({
        ...request,
        idempotencyKey: request.idempotencyKey ?? crypto.randomUUID(),
      }),
    onSuccess: (_result, variables) => {
      const title = queuedActionLabel(variables.commandType);
      if (title) {
        toast({ title });
      }
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: imessageKeys.commands() }),
        queryClient.invalidateQueries({ queryKey: imessageKeys.connector() }),
        queryClient.invalidateQueries({ queryKey: messagesKeys.all }),
      ]);
    },
    onError: (error) => {
      toast({
        title: 'iMessage action failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });
}
