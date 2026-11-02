"use client";
import { useState } from "react";
import { EmailInput } from "@/shared/components/EmailInput";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, SearchableSelect } from "@altitutor/ui";
import type { Tables } from "@altitutor/shared";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { useStudentSearchFilter } from "@/features/students/hooks/useStudentSearchFilter";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import { invalidateOnboarding } from "../api/queries";
export function NewJourney({
  onClose,
  sourceEmail,
}: {
  onClose: () => void;
  sourceEmail?: Tables<"onboarding_emails">;
}) {
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState<string>();
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(sourceEmail?.sender ?? "");
  const [historical, setHistorical] = useState(false);
  const [returning, setReturning] = useState(false);
  const [enquiry, setEnquiry] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: searchData } = useStudentSearchFilter(search, [
    "ACTIVE",
    "TRIAL",
    "DISCONTINUED",
  ]);
  const qc = useQueryClient();
  async function create() {
    setBusy(true);
    setError("");
    try {
      if (!studentId && !phone && !email)
        throw new Error("Link a student, phone number, or email address.");
      const db = getSupabaseClient();
      let contactId: string | null = null;
      if (!studentId && phone) {
        if (!/^\+[1-9]\d{7,14}$/.test(phone))
          throw new Error(
            "Enter the enquiry phone number in international format, e.g. +61412345678.",
          );
        const existing = await db
          .from("contacts")
          .select("id")
          .eq("phone_e164", phone)
          .maybeSingle();
        if (existing.error) throw existing.error;
        contactId = existing.data?.id ?? null;
        if (!contactId) {
          const created = await db
            .from("contacts")
            .insert({ phone_e164: phone, contact_type: "LEAD" })
            .select("id")
            .single();
          if (created.error) throw created.error;
          contactId = created.data.id;
        }
      }
      const values = {
        student_id: studentId ?? null, contact_id: contactId, label, enquiry_email: email || null,
        enquiry_at: historical ? null : new Date(`${enquiry}T12:00:00`).toISOString(), historical, is_returning: returning,
      };
      if (sourceEmail) {
        const result = await db.rpc("email_create_enquiry", { p_email_id: sourceEmail.id, p_values: values });
        if (result.error) throw result.error;
      } else {
        const result = await db.from("onboarding_journeys").insert(values);
        if (result.error) throw result.error;
      }
      await qc.invalidateQueries({ queryKey: ["email"] });
      await invalidateOnboarding(qc);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create journey.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminDialogShell
      open
      onClose={onClose}
      title="New enquiry"
      footer={
        <Button
          disabled={busy || !label.trim() || (!historical && !enquiry)}
          onClick={() => void create()}
        >
          Create journey
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Use an existing student when possible. Returning students keep their
          original identity and trial evidence.
        </p>
        <SearchableSelect
          items={searchData?.students ?? []}
          getItemId={(s) => s.id}
          getItemLabel={(s) => `${s.first_name} ${s.last_name}`}
          onSearchChange={setSearch}
          value={searchData?.students.find((s) => s.id === studentId) ?? null}
          onValueChange={(s) => {
            setStudentId(s?.id);
            if (s) setLabel(`${s.first_name} ${s.last_name}`);
          }}
          placeholder="Find existing student"
        />
        <label className="block text-sm">
          Student or family name
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        {!studentId && (
          <label className="block text-sm">
            Enquiry phone number
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+61412345678"
            />
          </label>
        )}{" "}
        {!studentId && (
          <label className="block text-sm">
            Enquiry email
            <EmailInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        <label className="block text-sm">
          First identifiable enquiry
          <Input
            type="date"
            value={enquiry}
            disabled={historical}
            onChange={(e) => setEnquiry(e.target.value)}
          />
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={historical}
            onChange={(e) => setHistorical(e.target.checked)}
          />
          Historical · original enquiry date unknown
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={returning}
            onChange={(e) => setReturning(e.target.checked)}
          />
          Returning student · new journey
        </label>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
    </AdminDialogShell>
  );
}
