import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button, MediaDeviceTest } from "@altitutor/ui";
import { TutorPageContainer } from "@/shared/components/layouts";

export default function AudioVideoSettingsPage() {
  return (
    <TutorPageContainer className="space-y-6">
      <header className="space-y-4">
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/settings"><ChevronLeft aria-hidden />All settings</Link>
        </Button>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Audio &amp; video</h1>
          <p className="text-muted-foreground">Check your camera and microphone before your next interview.</p>
        </div>
      </header>
      <MediaDeviceTest />
    </TutorPageContainer>
  );
}
