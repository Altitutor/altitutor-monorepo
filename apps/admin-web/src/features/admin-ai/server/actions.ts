'use server';

import { revalidatePath } from 'next/cache';
import { chatSettingsSchema, getAdminAiClient, getChatApiKey, getChatProfiles, getChatProviderKind, getChatSettings } from './settings';

export async function saveAdminAiSettings(_previous: string, form: FormData) {
  const client = await getAdminAiClient();
  if (!client) return 'Administrator access required.';

  const parsed = chatSettingsSchema.safeParse({
    model_profile_id: form.get('model_profile_id') || null,
    system_prompt: form.get('system_prompt'),
  });
  if (!parsed.success) return 'Enter a valid model and a system prompt of 1–8,000 characters.';

  try {
    const profileId = parsed.data.model_profile_id;
    if (profileId) {
      const profiles = await getChatProfiles(client);
      const profile = profiles.find(({ id }) => id === profileId);
      if (!profile || !getChatProviderKind(profile.provider)) return 'Select a supported chat model.';
      if (profile.id !== (await getChatSettings(client)).model_profile_id &&
        !getChatApiKey(getChatProviderKind(profile.provider))) return 'Add a server API key for this provider first.';
    }
    const { error } = await client.from('admin_ai_chat_settings').update(parsed.data).eq('id', true).select('id').single();
    if (error) return 'AI settings could not be saved.';
    revalidatePath('/settings/ai');
    return 'AI settings saved.';
  } catch {
    return 'AI settings could not be saved.';
  }
}
