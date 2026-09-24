import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadActiveAttempt } from "./current-attempt";

export const ATTEMPT_BANNER_HIDDEN_ROUTES = [
  "/exam",
  "/calculator",
  "/exam-menu",
  "/question-navigator",
] as const;

export function shouldShowAttemptBanner(
  pathname: string,
  hasActiveAttempt: boolean,
): boolean {
  return (
    hasActiveAttempt &&
    !ATTEMPT_BANNER_HIDDEN_ROUTES.includes(
      pathname as (typeof ATTEMPT_BANNER_HIDDEN_ROUTES)[number],
    )
  );
}

const AttemptBannerInsetContext = createContext(false);

export function AttemptBannerInsetProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const query = useQuery({
    queryKey: ["active"],
    queryFn: loadActiveAttempt,
    refetchInterval: 30000,
  });
  const visible = shouldShowAttemptBanner(
    pathname,
    Boolean(query.data?.active),
  );

  return (
    <AttemptBannerInsetContext.Provider value={visible}>
      {children}
    </AttemptBannerInsetContext.Provider>
  );
}

/** True when the root attempt banner is reserving the top safe area. */
export function useAttemptBannerInset(): boolean {
  return useContext(AttemptBannerInsetContext);
}

/** Stack screenOptions override while the attempt banner owns the top inset. */
export function useAttemptBannerStackScreenOptions():
  | {
      safeAreaInsets: {
        top: number;
        bottom: number;
        left: number;
        right: number;
      };
    }
  | Record<string, never> {
  const insets = useSafeAreaInsets();
  const reserveTopInsetForBanner = useAttemptBannerInset();
  if (!reserveTopInsetForBanner) return {};
  return {
    safeAreaInsets: {
      top: 0,
      bottom: insets.bottom,
      left: insets.left,
      right: insets.right,
    },
  };
}
