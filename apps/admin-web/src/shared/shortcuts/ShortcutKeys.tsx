"use client";
import { useContext, useSyncExternalStore } from "react";
import { AltHintsContext } from "./context";
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
  if (!always && !held) return null;
  return (
    <span
      className="pointer-events-none ml-auto inline-flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground"
      aria-label={keys.join("+")}
    >
      {keys.map((key) => (
        <kbd
          key={key}
          className="rounded border bg-background px-1 py-0.5 font-sans leading-none"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
