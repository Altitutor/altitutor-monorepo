'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  useToast,
} from '@altitutor/ui';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

export interface OfficePrintConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string | null;
  filename: string;
}

type PrintJobStatus =
  | 'queued'
  | 'claimed'
  | 'succeeded'
  | 'failed'
  | 'ambiguous'
  | 'cancelled';

interface PrintJobRow {
  id: string;
  status: PrintJobStatus;
  filename: string;
  copies: number;
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function mapJob(value: unknown): PrintJobRow {
  if (!isRecord(value)) throw new Error('Invalid print job');
  const status = value.status;
  if (
    status !== 'queued' &&
    status !== 'claimed' &&
    status !== 'succeeded' &&
    status !== 'failed' &&
    status !== 'ambiguous' &&
    status !== 'cancelled'
  ) {
    throw new Error('Invalid status');
  }
  return {
    id: String(value.id),
    status,
    filename: String(value.filename ?? ''),
    copies: Number(value.copies ?? 1),
    error: value.error == null ? null : String(value.error),
  };
}

async function pollJob(jobId: string): Promise<PrintJobRow> {
  const supabase = getSupabaseClient();
  const started = Date.now();
  while (Date.now() - started < 120_000) {
    const { data, error } = await supabase
      .from('vtutor_print_jobs' as never)
      .select('id, status, filename, copies, error' as never)
      .eq('id' as never, jobId as never)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      const job = mapJob(data);
      if (
        job.status === 'succeeded' ||
        job.status === 'failed' ||
        job.status === 'ambiguous' ||
        job.status === 'cancelled'
      ) {
        return job;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Timed out waiting for print job');
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
  const [windowOpen, setWindowOpen] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    setCopies(1);
    let cancelled = false;
    void (async () => {
      const supabase = getSupabaseClient();
      try {
        const [onlineRes, windowRes] = await Promise.all([
          supabase.rpc('is_print_connector_online' as never),
          supabase.rpc('is_office_print_window_open' as never),
        ]);
        if (cancelled) return;
        setOnline(onlineRes.data === true);
        setWindowOpen(windowRes.data === true);
      } catch {
        if (!cancelled) {
          setOnline(false);
          setWindowOpen(false);
        }
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
      if (windowOpen === false) {
        toast({
          title: 'Outside admin shift',
          description: 'Office print is only available while an admin shift is on.',
          variant: 'destructive',
        });
        return;
      }
      const response = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, copies }),
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          isRecord(body) && typeof body.error === 'string'
            ? body.error
            : 'Failed to queue print';
        throw new Error(message);
      }
      const jobValue = isRecord(body) ? body.job : null;
      const job = mapJob(jobValue);
      toast({
        title: 'Queued for office printer',
        description: `${filename} · ${copies} ${copies === 1 ? 'copy' : 'copies'}`,
      });
      onOpenChange(false);
      void pollJob(job.id)
        .then((terminal) => {
          if (terminal.status === 'succeeded') {
            toast({
              title: 'Sent to office printer',
              description: `${terminal.filename} · ${terminal.copies} ${terminal.copies === 1 ? 'copy' : 'copies'}`,
            });
            return;
          }
          if (terminal.status === 'ambiguous') {
            toast({
              title: 'Print may have started',
              description: 'Check the tray before retrying — it may already have printed.',
              variant: 'destructive',
            });
            return;
          }
          toast({
            title: 'Couldn’t send to printer',
            description: terminal.error || 'Try again in a moment.',
            variant: 'destructive',
          });
        })
        .catch((error: unknown) => {
          toast({
            title: 'Print status unknown',
            description: error instanceof Error ? error.message : 'Check the printer tray.',
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
  }, [copies, fileId, filename, onOpenChange, online, submitting, toast, windowOpen]);

  const blocked = online === false || windowOpen === false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Print to office</DialogTitle>
          <DialogDescription>
            Sends <span className="font-medium text-foreground">{filename}</span> to
            the FUJ office printer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="tutor-office-print-copies">Copies</Label>
            <Input
              id="tutor-office-print-copies"
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
            Fixed finishing: black &amp; white, A4, double-sided (long edge), one
            staple top-left.
          </p>
          {online === false ? (
            <p className="text-sm text-destructive">Office printer offline.</p>
          ) : null}
          {windowOpen === false ? (
            <p className="text-sm text-destructive">
              Available only during an admin shift.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={submitting || blocked || !fileId}
          >
            {submitting ? 'Sending…' : 'Print to office'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
