"use client";
import { useContext } from "react";
import { KeyboardShortcut } from "@altitutor/ui";
import { GoHintsContext } from "./context";
import { pageShortcuts } from "./registry";
export function GoHint({ href, label }: { href: string; label: string }) {
  const active = useContext(GoHintsContext);
  const page = pageShortcuts.find(([, path, title]) => path === href && title === label)
    ?? pageShortcuts.find(([, path]) => path === href);
  return active && page ? (
    <KeyboardShortcut keys={[page[0].toUpperCase()]} className="shrink-0" />
  ) : null;
}
