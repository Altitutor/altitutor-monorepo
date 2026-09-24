'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import { Button, Input, Label, useToast } from '@altitutor/ui';
import { AdminDialogShell } from '@/shared/components';
import {
  enqueuePrintJob,
  isPrintConnectorOnline,
  terminalPrintMessage,
  waitForPrintJobTerminal,
} from '../api/printJobs';

export interface OfficePrintConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string | null;
  filename: string;
}

export function OfficePrintConfirmDialog({
  open,
  onOpenChange,
  fileId,
  filename,
}: OfficePrintConfirmDialogProps): JSX.Element {
  const { toast } = useToast();
  const [copies, setCopies] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    setCopies(1);
    let cancelled = false;
    void (async () => {
      try {
        const value = await isPrintConnectorOnline();
        if (!cancelled) setOnline(value);
      } catch {
        if (!cancelled) setOnline(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleConfirm = useCallback(async () => {
    if (!fileId || submitting) return;
    setSubmitting(true);
    try {
      if (online === false) {
        toast({
          title: 'Office printer offline',
          description: 'Use an office computer, or try again when the bridge is back.',
          variant: 'destructive',
        });
        return;
      }
      const job = await enqueuePrintJob({ fileId, copies });
      toast({
        title: 'Queued for office printer',
        description: `${filename} · ${copies} ${copies === 1 ? 'copy' : 'copies'}`,
      });
      onOpenChange(false);
      void waitForPrintJobTerminal(job.id)
        .then((terminal) => {
          const message = terminalPrintMessage(terminal);
          toast({
            title: message.title,
            description: message.description,
            variant: message.variant,
          });
        })
        .catch((error: unknown) => {
          toast({
            title: 'Print status unknown',
            description:
              error instanceof Error ? error.message : 'Check the printer tray.',
            variant: 'destructive',
          });
        });
    } catch (error: unknown) {
      toast({
        title: 'Couldn’t queue print',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [copies, fileId, filename, onOpenChange, online, submitting, toast]);

  return (
    <AdminDialogShell
      open={open}
      onClose={() => onOpenChange(false)}
      title="Print to office"
      subtitle={
        <>
          Sends <span className="font-medium text-foreground">{filename}</span> to the FUJ office
          printer.
        </>
      }
      contentClassName="md:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={submitting || online === false || !fileId}>
            {submitting ? 'Sending…' : 'Print to office'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="office-print-copies">Copies</Label>
          <Input
            id="office-print-copies"
            type="number"
            min={1}
            max={20}
            value={copies}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) return;
              setCopies(Math.min(20, Math.max(1, Math.trunc(next))));
            }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Fixed finishing: black &amp; white, A4, double-sided (long edge), one staple top-left.
        </p>
        {online === false ? (
          <p className="text-sm text-destructive">
            Office printer offline — printing isn’t available right now.
          </p>
        ) : null}
      </div>
    </AdminDialogShell>
  );
}
