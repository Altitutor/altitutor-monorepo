"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { EntityChip, SearchableSelect } from "@altitutor/ui";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { useEntityNavigation } from "@/shared/contexts/EntityNavigation";
const AddStudentModal = dynamic(() =>
  import("@/features/students/components/AddStudentModal").then(
    (module) => module.AddStudentModal,
  ),
);
const AddParentModal = dynamic(() =>
  import("@/features/parents/components/AddParentModal").then(
    (module) => module.AddParentModal,
  ),
);
const AddStaffModal = dynamic(() =>
  import("@/features/staff/components/AddStaffModal").then(
    (module) => module.AddStaffModal,
  ),
);
import { searchPaletteEntities } from "@/features/command-palette/api/search";
import { mailRequest } from "../api/client";
const personSchema = z.object({
  type: z.enum(["student", "parent", "staff"]),
  id: z.string(),
  label: z.string(),
});
const actions = [
  "Link existing contact",
  "Create Student",
  "Create Parent",
  "Create Staff",
];
export function EmailParticipant({
  email,
  label,
  threadId,
  mailboxAddress,
  beforeLink,
}: {
  email: string;
  label: string;
  threadId: string;
  mailboxAddress: string;
  beforeLink?: () => Promise<string | undefined>;
}) {
  email = email.trim().toLowerCase();
  const navigation = useEntityNavigation();
  const client = useQueryClient();
  const [action, setAction] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const person = useQuery({
    queryKey: ["email", "person", email],
    enabled: Boolean(email) && email !== mailboxAddress,
    staleTime: 60_000,
    queryFn: async () =>
      z
        .object({ person: personSchema.nullable(), ambiguous: z.boolean() })
        .parse(await mailRequest(`/people?email=${encodeURIComponent(email)}`)),
  });
  const options = useQuery({
    queryKey: ["email", "contact-options", search],
    enabled: action === "Link existing contact",
    queryFn: async () =>
      (
        await Promise.all(
          (["student", "parent", "staff"] as const).map((type) =>
            searchPaletteEntities({ type, search, limit: 30 }),
          ),
        )
      ).flatMap((result) => result.results),
  });
  async function link(type: "student" | "parent" | "staff", id: string) {
    try {
      const savedThreadId = beforeLink ? await beforeLink() : threadId;
      if (!savedThreadId)
        throw new Error("Save the draft before linking this address.");
      await mailRequest("/people", {
        email,
        threadId: savedThreadId,
        type,
        id,
      });
      await client.invalidateQueries({ queryKey: ["email", "person", email] });
      void client.invalidateQueries({ queryKey: ["email", "thread"] });
      void client.invalidateQueries({ queryKey: ["email", "correspondence"] });
      setAction(null);
      setError("");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Contact link failed.",
      );
    }
  }
  if (!email || email === mailboxAddress)
    return (
      <EntityChip
        entityType="email"
        label={label || "Altitutor Admin"}
        disabled
      />
    );
  if (person.isLoading)
    return (
      <EntityChip
        entityType="email"
        label={email}
        disabled
        aria-label={`Resolving ${email}`}
        className="animate-pulse"
      />
    );
  if (person.data?.person) {
    const target = person.data.person;
    return (
      <EntityChip
        entityType={target.type}
        entityId={target.id}
        label={target.label}
        title={email}
        onClick={() => navigation.openEntity(target.type, target.id)}
      />
    );
  }
  return (
    <>
      <SearchableSelect
        items={actions}
        value={null}
        onValueChange={setAction}
        getItemId={(item) => item}
        getItemLabel={(item) => item}
        searchPlaceholder="Search contact actions…"
        trigger={
          <EntityChip
            entityType="email"
            label={email}
            aria-label={`Link ${email}`}
          />
        }
      />
      {person.data?.ambiguous && (
        <p className="text-xs text-muted-foreground">
          Multiple matching records · choose the contact
        </p>
      )}
      {(error || person.error) && (
        <p role="alert" className="text-xs text-destructive">
          {error || person.error?.message}
        </p>
      )}
      <AdminDialogShell
        open={action === "Link existing contact"}
        onClose={() => setAction(null)}
        title="Link email participant"
        subtitle={email}
      >
        <SearchableSelect
          items={options.data ?? []}
          value={null}
          onValueChange={(item) => {
            if (item && ["student", "parent", "staff"].includes(item.type))
              void link(item.type as "student" | "parent" | "staff", item.id);
          }}
          getItemId={(item) => `${item.type}:${item.id}`}
          getItemLabel={(item) => `${item.title} · ${item.type}`}
          searchPlaceholder="Search Students, Parents and Staff…"
          onSearchChange={setSearch}
          loading={options.isLoading}
          placeholder="Choose contact"
        />
        {options.error && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {options.error.message}
          </p>
        )}
      </AdminDialogShell>
      {action === "Create Student" && (
        <AddStudentModal
          isOpen
          onClose={() => setAction(null)}
          initialEmail={email}
          onStudentAdded={(student) => {
            if (student) void link("student", student.id);
          }}
        />
      )}
      {action === "Create Parent" && (
        <AddParentModal
          isOpen
          onClose={() => setAction(null)}
          initialEmail={email}
          onParentAdded={(parent) => {
            if (parent) void link("parent", parent.id);
          }}
        />
      )}
      {action === "Create Staff" && (
        <AddStaffModal
          isOpen
          onClose={() => setAction(null)}
          initialEmail={email}
          onStaffAdded={(staff) => {
            if (staff) void link("staff", staff.id);
          }}
        />
      )}
    </>
  );
}
