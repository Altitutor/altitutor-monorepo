import { createContext, use, useRef, type PropsWithChildren } from "react";
import {
  useNavigation,
  useRouter,
  type Href,
  type NativeStackNavigationProp,
} from "expo-router";
import { Platform } from "react-native";

type PendingScreen = { href: Href; isDismissed: () => boolean };
const SheetNavigation = createContext<{
  queue: (pending: PendingScreen) => void;
  finishTransition: () => void;
} | null>(null);
export function SheetNavigationProvider({ children }: PropsWithChildren) {
  const pending = useRef<PendingScreen | null>(null);
  const router = useRouter();
  return (
    <SheetNavigation
      value={{
        queue: (destination) => {
          pending.current = destination;
        },
        finishTransition: () => {
          if (!pending.current?.isDismissed()) return;
          const href = pending.current.href;
          pending.current = null;
          // Let UIKit finish removing the modal presentation before starting a push.
          requestAnimationFrame(() => router.push(href));
        },
      }}
    >
      {children}
    </SheetNavigation>
  );
}
export function useSheetTransition() {
  const context = use(SheetNavigation);
  if (!context) throw new Error("SheetNavigationProvider is required");
  return context.finishTransition;
}
/** Wait for the native stack to finish dismissing a sheet before pushing.
 * Direct replacement gives the destination the dismissed sheet's viewport. */
export function useOpenScreen() {
  const root =
    useNavigation<NativeStackNavigationProp<Record<string, undefined>>>("/");
  const router = useRouter();
  const context = use(SheetNavigation);
  if (!context) throw new Error("SheetNavigationProvider is required");
  return (href: Href) => {
    const state = root.getState();
    const top = state.routes[state.index];
    if (
      Platform.OS !== "web" &&
      top &&
      [
        "study-orb",
        "settings",
        "exam-start",
        "lesson-start",
        "trainer-start",
      ].includes(top.name)
    ) {
      context.queue({
        href,
        isDismissed: () =>
          !root.getState().routes.some((route) => route.key === top.key),
      });
      root.goBack();
    } else router.push(href);
  };
}
