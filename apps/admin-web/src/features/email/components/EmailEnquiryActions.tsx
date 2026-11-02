"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SearchableSelect } from "@altitutor/ui";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import {
  useOnboardingJourneys,
  onboardingKey,
} from "@/features/onboarding/api/queries";
import { NewJourney } from "@/features/onboarding/components/NewJourney";
import { useEmailCommand } from "../api/client";
export function EmailEnquiryActions({
  messageId,
  threadId,
}: {
  messageId: string;
  threadId: string;
}) {
  const [creating, setCreating] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");
  const client = useQueryClient();
  const command = useEmailCommand();
  const journeys = useOnboardingJourneys();
  const email = useQuery({
    queryKey: ["email", "enquiry", messageId],
    queryFn: async () => {
      const result = await getSupabaseClient()
        .from("onboarding_emails")
        .select("*,onboarding_email_links(journey_id)")
        .eq("id", messageId)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const row = email.data;
  if (!row || row.direction !== "inbound") return null;
  const actions = [
    row.ignored ? "Restore enquiry review" : "Ignore for enquiry review",
    "Link existing journey",
    ...(row.onboarding_email_links.length ? [] : ["New enquiry"]),
  ];
  async function ignore(value: boolean) {
    const result = await getSupabaseClient()
      .from("onboarding_emails")
      .update({ ignored: value })
      .eq("id", messageId);
    if (result.error) setError(result.error.message);
    else await client.invalidateQueries({ queryKey: ["email"] });
  }
  return (
    <>
      <SearchableSelect
        items={actions}
        value={null}
        getItemId={(item) => item}
        getItemLabel={(item) => item}
        onValueChange={(action) => {
          if (action === "New enquiry") setCreating(true);
          if (action === "Link existing journey") setLinking(true);
          if (action === "Ignore for enquiry review") void ignore(true);
          if (action === "Restore enquiry review") void ignore(false);
        }}
        placeholder={
          row.onboarding_email_links.length
            ? "Enquiry linked"
            : row.ignored
              ? "Enquiry review ignored"
              : "Enquiry actions"
        }
        searchPlaceholder="Search enquiry actions…"
      />
      {(error || command.error) && (
        <p role="alert" className="text-xs text-destructive">
          {error || command.error?.message}
        </p>
      )}
      {creating && (
        <NewJourney sourceEmail={row} onClose={() => setCreating(false)} />
      )}
      <AdminDialogShell
        open={linking}
        onClose={() => setLinking(false)}
        title="Link email to a journey"
        subtitle="This preserves existing enquiry timestamps and conversion evidence."
      >
        <SearchableSelect
          items={journeys.data ?? []}
          value={null}
          getItemId={(journey) => journey.id}
          getItemLabel={(journey) => journey.label}
          onValueChange={async (journey) => {
            if (!journey) return;
            try {
              await command.mutateAsync({
                action: "link",
                threadId,
                recordType: "onboarding_journey",
                recordId: journey.id,
              });
              await client.invalidateQueries({ queryKey: onboardingKey });
              setLinking(false);
            } catch {
              /* The command's error remains visible. */
            }
          }}
          searchPlaceholder="Search journeys…"
          placeholder="Choose existing journey"
        />
        {journeys.error && (
          <p role="alert" className="text-xs text-destructive">
            {journeys.error.message}
          </p>
        )}
        <Button variant="ghost" onClick={() => setLinking(false)}>
          Cancel
        </Button>
      </AdminDialogShell>
    </>
  );
}
