import { captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextResponse } from 'next/server';
import {
  FORM_MODEL_OPTION_SOURCES,
  type FormChoiceOption,
  type FormModelOptionSource,
} from '@altitutor/shared';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';

type OptionRow = { value: string; label: string };

export async function GET(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const source = new URL(request.url).searchParams.get('source');
  if (!source || !FORM_MODEL_OPTION_SOURCES.includes(source as FormModelOptionSource)) {
    return NextResponse.json({ error: 'Unsupported option source.' }, { status: 400 });
  }

  const { data, error } = await auth.admin.rpc('get_form_model_options', { p_source: source });
  if (error) return captureApiErrorResponse(error, "/api/forms/model-options", NextResponse.json({ error: error.message }, { status: 500 }));

  const options = ((data ?? []) as OptionRow[]).map<FormChoiceOption>((row) => ({
    id: `${source}_${row.value}`,
    value: row.value,
    label: row.label,
  }));
  return NextResponse.json({ options });
}
