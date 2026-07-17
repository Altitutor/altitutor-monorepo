export type ImessageCommandType =
  | 'edit_message'
  | 'unsend_message'
  | 'react'
  | 'mark_chat_read'
  | 'mark_chat_unread'
  | 'create_chat'
  | 'update_chat'
  | 'delete_chat'
  | 'leave_chat'
  | 'add_participant'
  | 'remove_participant'
  | 'set_group_icon'
  | 'remove_group_icon'
  | 'delete_message'
  | 'restart_messages_app'
  | 'mark_alerts_read';

export type ImessageCommandStatus =
  | 'queued'
  | 'claimed'
  | 'succeeded'
  | 'failed'
  | 'ambiguous'
  | 'cancelled';

export interface ImessageCommandRequest {
  commandType: ImessageCommandType;
  conversationId?: string;
  messageId?: string;
  payload?: Record<string, unknown>;
  reason?: string;
  idempotencyKey?: string;
}

export interface ImessageCommandResponse {
  commandId: string;
  status: ImessageCommandStatus;
  command?: ImessageCommandRow;
}

export interface ImessageCommandRow {
  id: string;
  command_type: ImessageCommandType;
  status: ImessageCommandStatus;
  reason: string | null;
  error: string | null;
  attempts: number;
  claimed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImessageConnectorState {
  connector_id: string;
  status: string;
  last_heartbeat_at: string | null;
  app_version: string | null;
  host_label: string | null;
  capabilities: string[] | null;
  metrics: Record<string, unknown> | null;
  last_error_code: string | null;
  updated_at: string;
}

export function getCommandStatusLabel(status: ImessageCommandStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'claimed':
      return 'Claimed';
    case 'succeeded':
      return 'Succeeded';
    case 'failed':
      return 'Failed';
    case 'ambiguous':
      return 'Ambiguous';
    case 'cancelled':
      return 'Cancelled';
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
