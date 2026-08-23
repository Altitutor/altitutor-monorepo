'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Label } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { AdminDialogShell } from '@/shared/components';

interface ImessageCommandDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason?: string) => void | Promise<void>;
}

export function ImessageCommandDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending = false,
  onOpenChange,
  onConfirm,
}: ImessageCommandDialogProps) {
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    if (!open) {
      setReason('');
      setConfirmation('');
    }
  }, [open]);

  const canConfirm =
    !pending &&
    (!destructive || (reason.trim().length > 0 && confirmation === 'ADMINSTAFF'));

  return (
    <AdminDialogShell
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      subtitle={description}
      footer={(
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={!canConfirm}
            onClick={() => onConfirm(destructive ? reason.trim() : undefined)}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </>
      )}
    >
      {destructive ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="imessage-command-reason">Reason</Label>
            <Input
              id="imessage-command-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Required for the audit log"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imessage-command-confirmation">
              Type ADMINSTAFF to confirm
            </Label>
            <Input
              id="imessage-command-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
      ) : null}
    </AdminDialogShell>
  );
}
