"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, SearchableSelect } from "@altitutor/ui";
import { Plus } from "lucide-react";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { useEntityNavigation } from "@/shared/contexts/EntityNavigation";
import { searchPaletteEntities } from "@/features/command-palette/api/search";
import { useEmailCommand } from "../api/client";
import type { EmailThread } from "../types";
export function EmailContextLinks({ thread }: { thread: EmailThread }) {
  const navigation = useEntityNavigation();
  const command = useEmailCommand();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const options = useQuery({
    queryKey: ["email", "context-options", search],
    enabled: open,
    queryFn: async () =>
      (
        await Promise.all(
          (["student", "parent", "staff", "session"] as const).map((type) =>
            searchPaletteEntities({ type, search, limit: 20 }),
          ),
        )
      ).flatMap((result) => result.results),
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {thread.links.map((link) => (
        <Button
          key={`${link.recordType}:${link.recordId}`}
          size="sm"
          variant="outline"
          className="h-7 rounded-full text-xs"
          onClick={() => {
            if (link.recordType !== "onboarding_journey")
              navigation.openEntity(link.recordType, link.recordId);
          }}
        >
          {link.label || link.recordType}
          {link.source === "explicit" ? " · linked" : ""}
        </Button>
      ))}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-1 h-3 w-3" />
        Link context
      </Button>
      <AdminDialogShell
        open={open}
        onClose={() => setOpen(false)}
        title="Link email context"
        subtitle="Choose the relevant Student or other record. A Parent's children are never added automatically."
      >
        <SearchableSelect
          items={options.data ?? []}
          value={null}
          onSearchChange={setSearch}
          loading={options.isLoading}
          getItemId={(item) => `${item.type}:${item.id}`}
          getItemLabel={(item) => `${item.title} · ${item.type}`}
          onValueChange={async (item) => {
            if (
              !item ||
              !["student", "parent", "staff", "session"].includes(item.type)
            )
              return;
            try {
              await command.mutateAsync({
                action: "link",
                threadId: thread.id,
                recordType: item.type as
                  | "student"
                  | "parent"
                  | "staff"
                  | "session",
                recordId: item.id,
              });
              setOpen(false);
            } catch {
              /* Keep the error and selection visible. */
            }
          }}
          placeholder="Choose context"
          searchPlaceholder="Search Students, Parents, Staff or Sessions…"
        />
        {(options.error || command.error) && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {options.error?.message ?? command.error?.message}
          </p>
        )}
      </AdminDialogShell>
    </div>
  );
}
