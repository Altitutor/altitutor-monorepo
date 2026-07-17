import {
  resolveFormModelOptions,
  type Database,
  type FormBlock,
  type FormChoiceOption,
  type FormModelOptionSource,
} from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

type OptionRow = { value: string; label: string };

export async function resolveFormBlocks(admin: SupabaseClient<Database>, blocks: FormBlock[]) {
  return resolveFormModelOptions(blocks, async (source: FormModelOptionSource) => {
    const { data, error } = await admin.rpc('get_form_model_options', { p_source: source });
    if (error) throw new Error(error.message);
    return ((data ?? []) as OptionRow[]).map<FormChoiceOption>((row) => ({
      id: `${source}_${row.value}`,
      value: row.value,
      label: row.label,
    }));
  });
}
