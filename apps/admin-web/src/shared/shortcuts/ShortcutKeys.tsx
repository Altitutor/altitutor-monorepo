"use client";
import { useContext, useSyncExternalStore } from "react";
import { AltHintsContext, ShortcutAvailabilityContext } from "./context";
import { KeyboardShortcut, useKeyboardHints } from "@altitutor/ui";
import { shortcuts, type ShortcutId } from "./registry";
const subscribePlatform = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);
const serverPlatform = () => false;
export function ShortcutKeys({
  id,
  always = false,
}: {
  id: ShortcutId;
  always?: boolean;
}) {
  const mac = useSyncExternalStore(subscribePlatform, isMac, serverPlatform);
  const keys = shortcuts[id].keys.map((key) =>
    key === "Alt" && mac ? "Option" : key,
  );
  const held = useContext(AltHintsContext);
  const bare = useKeyboardHints();
  const available = useContext(ShortcutAvailabilityContext);
  if (available?.[id] === false) return null;
  if (!always && !(id === "left" || id === "right" ? bare : held)) return null;
  return <KeyboardShortcut keys={keys} className="ml-auto" />;
}
