"use client";
import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ToolbarViewsProvider,
  type ToolbarViewsService,
  type ToolbarViewDialogProps,
} from "@altitutor/ui";
import { useCurrentStaff } from "@/shared/hooks";
import { quickFiltersApi } from "../api/quick-filters";
import { AdminDialogShell } from "@/shared/components/dialog-shell";

function AdminViewDialog({
  open,
  onClose,
  title,
  description,
  busy,
  children,
  footer,
}: ToolbarViewDialogProps) {
  return (
    <AdminDialogShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle={description}
      closeDisabled={busy}
      fillHeight
      bodyClassName="flex min-h-0 flex-1 flex-col p-0 pt-4"
      footer={footer}
    >
      {children}
    </AdminDialogShell>
  );
}

export function AdminToolbarViewsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: staff } = useCurrentStaff();
  const queryClient = useQueryClient();
  const save = useCallback<ToolbarViewsService["save"]>(
    async (view) => {
      const { id, ...values } = view;
      const result = id
        ? await quickFiltersApi.update(id, values)
        : await quickFiltersApi.create(values);
      await queryClient.invalidateQueries({ queryKey: ["quick-filters"] });
      return result;
    },
    [queryClient],
  );
  const remove = useCallback(
    async (id: string) => {
      await quickFiltersApi.delete(id);
      await queryClient.invalidateQueries({ queryKey: ["quick-filters"] });
    },
    [queryClient],
  );
  const service = useMemo(
    () => ({
      userId: staff?.id ?? null,
      save,
      remove,
      Dialog: AdminViewDialog,
    }),
    [staff?.id, save, remove],
  );
  return (
    <ToolbarViewsProvider value={staff?.id ? service : null}>
      {children}
    </ToolbarViewsProvider>
  );
}
