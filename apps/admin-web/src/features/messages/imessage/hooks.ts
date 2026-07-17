'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import {
  fetchImessageConnectorState,
  fetchRecentImessageCommands,
  invokeImessageControl,
} from './api';
import { messagesKeys } from '../api/queryKeys';
import { getCommandStatusLabel, type ImessageCommandRequest } from './types';

export const imessageKeys = {
  all: ['imessage'] as const,
  connector: () => [...imessageKeys.all, 'connector'] as const,
  commands: () => [...imessageKeys.all, 'commands'] as const,
};

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
    onSuccess: (result) => {
      toast({
        title: 'iMessage action queued',
        description: `Command ${result.commandId} is ${getCommandStatusLabel(result.status).toLowerCase()}.`,
      });
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
