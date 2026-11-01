"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button, SearchableSelect } from "@altitutor/ui";
import { ChevronDown } from "lucide-react";
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
}: {
  email: string;
  label: string;
  threadId: string;
  mailboxAddress: string;
}) {
  const navigation = useEntityNavigation();
  const client = useQueryClient();
  const [action, setAction] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const person = useQuery({
    queryKey: ["email", "person", email],
    enabled: Boolean(email) && email !== mailboxAddress,
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
      await mailRequest("/people", { email, threadId, type, id });
      await client.invalidateQueries({ queryKey: ["email"] });
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
      <span className="text-sm font-medium">{label || "Altitutor Admin"}</span>
    );
  if (person.data?.person) {
    const target = person.data.person;
    return (
      <button
        className="text-left text-sm font-medium hover:underline"
        onClick={() => navigation.openEntity(target.type, target.id)}
      >
        {target.label}
      </button>
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
          <Button
            variant="ghost"
            size="sm"
            className="h-auto max-w-full px-0 text-left text-sm font-medium"
          >
            <span className="truncate">{label || email}</span>
            <ChevronDown className="ml-1 h-3 w-3 shrink-0" />
          </Button>
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
