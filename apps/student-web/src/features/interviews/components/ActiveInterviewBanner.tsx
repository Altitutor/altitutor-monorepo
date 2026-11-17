"use client";
import { useQuery } from "@tanstack/react-query";
import { InterviewRejoinBanner, type ActiveInterviewLink } from "@altitutor/ui";
import { useAuthStore } from "@/shared/lib/supabase/auth";
import { useInterviewAccess } from "../hooks/use-interviews";

export function ActiveInterviewBanner() {
  const userId = useAuthStore((state) => state.user?.id);
  const access = useInterviewAccess();
  const enabled = !!userId && access.data?.hasAccess === true && !access.isError;
  const query = useQuery({
    queryKey: ["interviews", "active", userId], enabled,
    queryFn: async (): Promise<ActiveInterviewLink[]> => {
      const response = await fetch("/api/interviews/active", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to check active interviews.");
      return response.json();
    },
    refetchInterval: 15_000, refetchOnWindowFocus: "always", retry: false,
  });
  return <InterviewRejoinBanner rounds={enabled && !query.isError ? query.data ?? [] : []} />;
}
