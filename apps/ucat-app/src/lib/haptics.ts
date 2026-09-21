import * as Haptics from "expo-haptics";

export type HapticKind =
  | "selection"
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error";

export function haptic(kind: HapticKind = "selection") {
  if (process.env.EXPO_OS === "web") return;
  switch (kind) {
    case "light":
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    case "medium":
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    case "heavy":
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    case "success":
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    case "warning":
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    case "error":
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    default:
      void Haptics.selectionAsync();
  }
}

export function withHaptic<Args extends unknown[]>(
  action: (...args: Args) => void,
  kind?: HapticKind,
): (...args: Args) => void;
export function withHaptic<Args extends unknown[]>(
  action: ((...args: Args) => void) | undefined,
  kind?: HapticKind,
): ((...args: Args) => void) | undefined;
export function withHaptic<Args extends unknown[]>(
  action: ((...args: Args) => void) | undefined,
  kind: HapticKind = "selection",
): ((...args: Args) => void) | undefined {
  if (!action) return action;
  return (...args) => {
    haptic(kind);
    action(...args);
  };
}
