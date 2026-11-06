import { useQuery } from '@tanstack/react-query';
import type { FormBlock } from '@altitutor/shared';

export type RespondentType = 'student' | 'parent' | 'staff';
export type Person = { id: string; first_name: string | null; last_name: string | null; type?: RespondentType };
export type FillForm = {
  id: string;
  name: string;
  purpose: string;
  form_versions: { id: string; blocks: FormBlock[]; thank_you_message: string; version_number: number } | null;
};

export async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error ?? 'Request failed.');
  return json as T;
}

export type FormRespondent = { type: RespondentType; id: string; name?: string };

export function useFormResponseOptions(sessionId?: string, enabled = true) {
  const url = sessionId
    ? `/api/forms/session-responses?sessionId=${encodeURIComponent(sessionId)}`
    : '/api/forms/manual-responses';
  return useQuery({
    queryKey: ['form-response-options', url],
    queryFn: ({ signal }) => jsonRequest<{ forms: FillForm[]; participants?: Person[] }>(url, { signal }),
    enabled,
  });
}
