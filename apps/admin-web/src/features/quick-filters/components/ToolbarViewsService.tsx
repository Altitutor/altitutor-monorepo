"use client";
import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ToolbarViewsProvider, type ToolbarViewsService } from "@altitutor/ui";
import { useCurrentStaff } from "@/shared/hooks";
import { quickFiltersApi } from "../api/quick-filters";

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
  const service = useMemo(
    () => ({ userId: staff?.id ?? null, save }),
    [staff?.id, save],
  );
  return (
    <ToolbarViewsProvider value={staff?.id ? service : null}>
      {children}
    </ToolbarViewsProvider>
  );
}
