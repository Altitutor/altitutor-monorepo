import { useEffect } from "react";
import { AppState } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth-provider";
import { supabase } from "@/lib/supabase";

/** This is the full web signup milestone, not the earlier plan-choice milestone. */
export function useOnboardingAccess() {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ["onboarding-access", session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vstudent_ucat_my_access")
        .select("ucat_signup_completed_at")
        .maybeSingle();
      if (error) throw error;
      return { completed: Boolean(data?.ucat_signup_completed_at) };
    },
    staleTime: 0,
  });
  const { refetch } = query;
  useEffect(() => {
    if (!session) return;
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refetch();
    });
    return () => listener.remove();
  }, [session, refetch]);
  return query;
}
