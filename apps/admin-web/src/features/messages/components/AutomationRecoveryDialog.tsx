'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@altitutor/ui';
import { useAutomationRecovery, useRecoverAutomationMessage } from '../api/automationRecovery';

export function AutomationRecoveryDialog({messageId,onClose}:{messageId:string|null;onClose:()=>void}) {
  const query = useAutomationRecovery(messageId);
  const recovery = useRecoverAutomationMessage();
  const preview = query.data;
  return <Dialog open={Boolean(messageId)} onOpenChange={open=>{if(!open && !recovery.isPending) onClose();}}>
    <DialogContent>
      <DialogHeader><DialogTitle>Recover one failed delivery</DialogTitle>
        <DialogDescription>Review the original text and the current corrected recipient before sending.</DialogDescription>
      </DialogHeader>
      {query.isPending ? <p>Loading the current recipient…</p> : query.error ?
        <div role="alert"><p>{query.error.message}</p><Button variant="outline" onClick={()=>void query.refetch()}>Refresh</Button></div> : preview ?
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">Send the original message to {preview.recipientName}’s corrected number.</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
            <dt className="text-muted-foreground">From</dt><dd>{preview.senderLabel}</dd>
            <dt className="text-muted-foreground">To</dt><dd className="break-words">{preview.recipientName} · {preview.destination ?? 'No current phone'}</dd>
            <dt className="text-muted-foreground">Rejected number</dt><dd>{preview.originalDestination}</dd>
            <dt className="text-muted-foreground">Original attempt</dt><dd>{new Date(preview.originalCreatedAt).toLocaleString()}</dd>
          </dl>
          <div className="rounded-xl border bg-muted/40 p-4"><p className="mb-2 text-xs font-medium text-muted-foreground">ORIGINAL MESSAGE · READ ONLY</p><p className="whitespace-pre-wrap break-words">{preview.body}</p></div>
          <p className="text-sm text-muted-foreground">Check that this message is still relevant. For different content, close this review and compose a new message.</p>
          <p className="text-sm">Only this failed delivery is included. Previously accepted messages stay unchanged.</p>
          {preview.reason && <p role="status" className="text-sm text-muted-foreground">{preview.reason}</p>}
          {preview.recipientPath && <a className="text-sm underline" href={preview.recipientPath} target="_blank" rel="noreferrer">Open recipient details</a>}
          {recovery.error && <p role="alert" className="text-sm text-destructive">{recovery.error.message}</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!preview.canSend || !preview.contactId || !preview.destination || recovery.isPending || query.isFetching}
              onClick={()=>{if(preview.contactId && preview.destination) recovery.mutate({messageId:preview.messageId,contactId:preview.contactId,destination:preview.destination,expectedRecoveryId:preview.recoveryMessageId},{onSuccess:onClose});}}>
              {recovery.isPending ? 'Sending…' : 'Send this failed message'}
            </Button>
            <Button variant="outline" disabled={recovery.isPending} onClick={onClose}>Cancel</Button>
            <Button variant="ghost" disabled={recovery.isPending} onClick={()=>void query.refetch()}>Refresh details</Button>
          </div>
        </div> : null}
    </DialogContent>
  </Dialog>;
}
