/**
 * Office print client helpers for admin-web.
 * Types are local until `pnpm db:types` regenerates shared Database types.
 */

import { getSupabaseClient } from '@/shared/lib/supabase/client';

export type PrintJobStatus =
  | 'queued'
  | 'claimed'
  | 'succeeded'
  | 'failed'
  | 'ambiguous'
  | 'cancelled';

export interface PrintJobRow {
  id: string;
  file_id: string;
  filename: string;
  copies: number;
  status: PrintJobStatus;
  cups_job_id: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface EnqueuePrintJobInput {
  fileId: string;
  copies: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function mapPrintJob(value: unknown): PrintJobRow {
  if (!isRecord(value)) {
    throw new Error('Invalid print job response');
  }
  const status = value.status;
  if (
    status !== 'queued' &&
    status !== 'claimed' &&
    status !== 'succeeded' &&
    status !== 'failed' &&
    status !== 'ambiguous' &&
    status !== 'cancelled'
  ) {
    throw new Error('Invalid print job status');
  }
  return {
    id: String(value.id),
    file_id: String(value.file_id),
    filename: String(value.filename ?? ''),
    copies: Number(value.copies ?? 1),
    status,
    cups_job_id: value.cups_job_id == null ? null : String(value.cups_job_id),
    error: value.error == null ? null : String(value.error),
    created_at: String(value.created_at ?? ''),
    completed_at: value.completed_at == null ? null : String(value.completed_at),
  };
}

export async function enqueuePrintJob(
  input: EnqueuePrintJobInput
): Promise<PrintJobRow> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc(
    'enqueue_print_job' as never,
    {
      p_file_id: input.fileId,
      p_copies: input.copies,
    } as never
  );
  if (error) {
    throw new Error(error.message);
  }
  return mapPrintJob(data);
}

export async function getPrintJob(jobId: string): Promise<PrintJobRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('print_jobs' as never)
    .select(
      'id, file_id, filename, copies, status, cups_job_id, error, created_at, completed_at' as never
    )
    .eq('id' as never, jobId as never)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapPrintJob(data);
}

export async function isPrintConnectorOnline(): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc(
    'is_print_connector_online' as never
  );
  if (error) {
    throw new Error(error.message);
  }
  return data === true;
}

export function terminalPrintMessage(job: PrintJobRow): {
  title: string;
  description: string;
  variant?: 'destructive';
} {
  switch (job.status) {
    case 'succeeded':
      return {
        title: 'Sent to office printer',
        description: `${job.filename} · ${job.copies} ${job.copies === 1 ? 'copy' : 'copies'}`,
      };
    case 'failed':
      return {
        title: 'Couldn’t send to printer',
        description: job.error || 'Try again in a moment.',
        variant: 'destructive',
      };
    case 'ambiguous':
      return {
        title: 'Print may have started',
        description:
          'Check the tray before retrying — it may already have printed.',
        variant: 'destructive',
      };
    case 'cancelled':
      return {
        title: 'Print cancelled',
        description: job.filename,
        variant: 'destructive',
      };
    case 'queued':
    case 'claimed':
      return {
        title: 'Printing…',
        description: job.filename,
      };
    default: {
      const _exhaustive: never = job.status;
      return _exhaustive;
    }
  }
}

export async function waitForPrintJobTerminal(
  jobId: string,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<PrintJobRow> {
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const intervalMs = options?.intervalMs ?? 2_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = await getPrintJob(jobId);
    if (!job) {
      throw new Error('Print job not found');
    }
    if (
      job.status === 'succeeded' ||
      job.status === 'failed' ||
      job.status === 'ambiguous' ||
      job.status === 'cancelled'
    ) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timed out waiting for print job');
}
