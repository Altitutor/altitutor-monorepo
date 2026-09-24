import { SettingsProfilePage } from "@/features/settings/components/settings-profile-page";
import { getEnabledSocialAuthProviders } from "@/features/auth/lib/social-auth";

export default function Page() {
  return (
    <SettingsProfilePage
      enabledSocialProviders={getEnabledSocialAuthProviders()}
    />
  );
}
