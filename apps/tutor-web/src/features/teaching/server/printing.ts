import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { z } from 'zod';
import { TeachingError } from './auth';
import { requireUUID } from './validation';

type Client = SupabaseClient<Database>;
const schema = z.object({ resourceID: z.string().uuid().transform(id => id.toLowerCase()), copies: z.number().int().min(1).max(20) }).strict();

export async function teachingPrintOptions(client: Client) {
  const [online, window, settings, permission] = await Promise.all([
    client.rpc('is_print_connector_online'), client.rpc('is_office_print_window_open'),
    client.from('vtutor_office_print_settings').select('tutor_access').maybeSingle(), client.rpc('tutor_may_office_print'),
  ]);
  const error = online.error ?? window.error ?? settings.error ?? permission.error;
  if (error) throw new TeachingError(503, 'Office print is temporarily unavailable.', error);
  return { online: online.data === true, windowOpen: window.data === true, access: settings.data?.tutor_access ?? 'office_hours', allowed: permission.data === true };
}

export async function enqueueTeachingPrint(client: Client, body: unknown) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new TeachingError(400, 'Choose a PDF and between 1 and 20 copies.');
  const resource = await client.from('vtutor_topics_files').select('file_id,filename,mimetype,external_url')
    .eq('id', parsed.data.resourceID).is('deleted_at', null).maybeSingle();
  if (resource.error) throw new TeachingError(503, 'Could not verify this print resource.', resource.error);
  if (!resource.data?.file_id) throw new TeachingError(403, 'This resource is not available to print.');
  if (resource.data.external_url || !(resource.data.mimetype === 'application/pdf' || resource.data.filename?.toLowerCase().endsWith('.pdf'))) {
    throw new TeachingError(400, 'Only stored PDF files can be office-printed.');
  }
  // The existing RPC is authoritative for active staff, office access/window,
  // connector health, resource entitlement, copy bounds and duplicate suppression.
  const result = await client.rpc('enqueue_print_job', { p_file_id: resource.data.file_id, p_copies: parsed.data.copies });
  if (result.error) {
    const messages = ['Office printer offline', 'Office print is turned off for tutors', 'Office print is only available during an admin shift', 'A print job for this file is already in progress'];
    if (messages.includes(result.error.message)) throw new TeachingError(400, result.error.message);
    if (result.error.code === '42501') throw new TeachingError(403, 'This resource is not available to print.');
    throw new TeachingError(503, 'Could not queue the office print.', result.error);
  }
  if (!result.data) throw new TeachingError(503, 'The printer did not return a job.');
  const { id, status, filename, copies, error } = result.data;
  return { id, status, filename, copies, error };
}

export async function teachingPrintJob(client: Client, jobID: string) {
  const result = await client.from('vtutor_print_jobs').select('id,status,filename,copies,error').eq('id', requireUUID(jobID)).maybeSingle();
  if (result.error) throw new TeachingError(503, 'Could not read office print status.', result.error);
  if (!result.data) throw new TeachingError(404, 'This print job is not available.');
  return result.data;
}
