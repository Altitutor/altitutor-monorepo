import { supabase } from '@/lib/supabase';
import { tutorWebFetch } from '@/lib/tutor-web';

function tutorPrintAccess(value: string | null | undefined) {
  return value === 'off' || value === 'unrestricted' ? value : 'office_hours';
}

export async function getOfficePrintAccess() {
  const { data, error } = await supabase
    .from('vtutor_office_print_settings')
    .select('tutor_access')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return tutorPrintAccess(data?.tutor_access);
}

export async function getOfficePrintAvailability() {
  const { data, error } = await supabase
    .from('vtutor_office_print_settings')
    .select('tutor_access, connector_online, window_open')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    online: data?.connector_online === true,
    windowOpen: data?.window_open === true,
    access: tutorPrintAccess(data?.tutor_access),
  };
}

export async function queueOfficePrint(fileId: string, copies: number, userId: string): Promise<string> {
  const response = await tutorWebFetch('/api/print-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, copies }),
  }, userId);
  const body = await response.json().catch(() => null) as { error?: unknown; job?: { id?: unknown } } | null;
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'Could not queue this print job.');
  if (typeof body?.job?.id !== 'string') throw new Error('The print job response could not be confirmed. Check the printer before retrying.');
  return body.job.id;
}

export async function getOfficePrintJob(jobId: string) {
  const { data, error } = await supabase
    .from('vtutor_print_jobs')
    .select('id, status, error')
    .eq('id', jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
