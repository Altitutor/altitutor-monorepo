"use client";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";

export function FounderAccessStatus() {
  const { user } = useAuth();
  const client = useQueryClient();
  const { data } = useQuery({
    queryKey: ["founder-access", user?.id],
    enabled: Boolean(user),
    staleTime: 30_000,
    queryFn: async (): Promise<{ accessEndsAt: string | null }> => {
      const response = await fetch("/api/ucat/invitations?status=mine");
      if (!response.ok) throw new Error("Could not load access pass.");
      return response.json();
    },
  });
  useEffect(() => {
    if (!data?.accessEndsAt) return;
    const remaining = Date.parse(data.accessEndsAt) - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(
      () => {
        void client.invalidateQueries({ queryKey: ["founder-access"] });
        void client.invalidateQueries({ queryKey: ["ucat-access"] });
      },
      Math.min(remaining + 100, 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [client, data?.accessEndsAt]);
  if (!data?.accessEndsAt || Date.parse(data.accessEndsAt) <= Date.now())
    return null;
  return (
    <p className="mb-4 rounded-xl border bg-card p-4 text-sm text-card-foreground">
      Your founder access pass gives you Unlimited until{" "}
      <strong>
        {new Date(data.accessEndsAt).toLocaleDateString("en-AU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </strong>
      . It will not renew or charge you. If you subscribe now, paid billing
      starts now.
    </p>
  );
}
