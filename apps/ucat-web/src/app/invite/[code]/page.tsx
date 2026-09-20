import { notFound } from "next/navigation";
import { normalizeUcatInvitationCode } from "@altitutor/shared";
import { InvitationCodeEntry } from "@/features/founder-offers/components/invitation-code-entry";

export const metadata = {
  title: "Your invitation | Altitutor UCAT",
  robots: { index: false, follow: false },
};

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const code = normalizeUcatInvitationCode((await params).code);
  if (!code) notFound();
  return (
    <main className="mx-auto min-h-dvh max-w-xl space-y-6 px-4 py-20">
      <p className="text-sm font-medium">Altitutor UCAT</p>
      <h1 className="text-3xl font-semibold">You’re invited</h1>
      <p className="text-muted-foreground">
        Review your invitation and choose when to start preparing.
      </p>
      <InvitationCodeEntry initialCode={code} />
    </main>
  );
}
