import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UcatPageHeader } from "@/features/layout";

type PageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function SubscribeSuccessPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const sessionId = params.session_id;

  if (!sessionId) {
    redirect("/subscribe");
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Subscription activated"
        description="Thank you for subscribing. You now have full access to the UCAT platform."
      />

      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-muted-foreground">
          Your subscription is active. You can start using all features right
          away.
        </p>
        <Button asChild className="mt-4">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
