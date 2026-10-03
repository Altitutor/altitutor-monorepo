"use client";
import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AltHintsContext } from "./context";
import { searchControl } from "./search";
import { ShortcutKeys } from "./ShortcutKeys";
export function SearchHint({ activeKey }: { activeKey?: string | null }) {
  const held = useContext(AltHintsContext);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  useEffect(() => {
    if (!held) return;
    const update = () => {
      const input = searchControl(activeKey);
      const rect = input?.getBoundingClientRect();
      setPosition(
        rect ? { top: rect.top + rect.height / 2, left: rect.right - 8 } : null,
      );
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [held, activeKey]);
  return held && position
    ? createPortal(
        <span
          className="pointer-events-none fixed z-[150] -translate-x-full -translate-y-1/2 rounded bg-background p-1"
          style={position}
        >
          <ShortcutKeys id="search" always />
        </span>,
        document.body,
      )
    : null;
}
