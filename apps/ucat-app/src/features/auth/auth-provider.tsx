import {
  createContext,
  use,
  useEffect,
  useState,
  useRef,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { bindSentryUser } from "@/lib/sentry-client";

const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
}>({ session: null, loading: true });
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queries = useQueryClient();
  const userId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (userId.current !== next?.user.id) queries.clear();
      userId.current = next?.user.id;
      bindSentryUser(next?.user.id);
      setSession(next);
      setLoading(false);
    });
    const refresh = (state: string) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    refresh(AppState.currentState);
    const listener = AppState.addEventListener("change", refresh);
    return () => {
      subscription.unsubscribe();
      listener.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, [queries]);
  return <AuthContext value={{ session, loading }}>{children}</AuthContext>;
}
export const useAuth = () => use(AuthContext);
