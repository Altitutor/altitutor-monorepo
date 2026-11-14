import { MediaDeviceTest } from "@altitutor/ui";
import { StudentPageContainer } from "@/shared/components/layouts";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";

export default function AudioVideoSettingsPage() {
  return (
    <StudentPageContainer className="space-y-6">
      <SettingsPageHeader
        title="Audio & video"
        description="Check your camera and microphone before your next interview."
        backHref="/settings"
        backLabel="All settings"
      />
      <MediaDeviceTest />
    </StudentPageContainer>
  );
}
