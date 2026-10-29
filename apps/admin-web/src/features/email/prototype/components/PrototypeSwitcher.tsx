"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@altitutor/ui";

const variants = [
  { key: "A", name: "Three-pane inbox" },
  { key: "B", name: "Focus inbox" },
  { key: "C", name: "Context workspace" },
] as const;
export type MailVariant = (typeof variants)[number]["key"];

export function PrototypeSwitcher({ variant }: { variant: MailVariant }) {
  const router = useRouter();
  const search = useSearchParams();
  const index = variants.findIndex((item) => item.key === variant);
  const cycle = useCallback(
    (direction: number) => {
      const next =
        variants[(index + direction + variants.length) % variants.length];
      const params = new URLSearchParams(search.toString());
      params.set("variant", next.key);
      router.replace(`/email-prototype?${params.toString()}`, {
        scroll: false,
      });
    },
    [index, search, router],
  );
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "input,textarea,select,[contenteditable=true],[role=dialog]",
        )
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        cycle(event.key === "ArrowRight" ? 1 : -1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle]);
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 flex max-w-[95vw] -translate-x-1/2 items-center gap-2 rounded-full border bg-primary px-2 py-1.5 text-primary-foreground shadow-xl"
      aria-label="Prototype variants"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="Previous layout"
        onClick={() => cycle(-1)}
        className="text-inherit"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-0 text-center text-xs font-medium">
        {variant} · {variants[index].name}{" "}
        <span className="hidden opacity-70 sm:inline">· prototype · ← →</span>
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Next layout"
        onClick={() => cycle(1)}
        className="text-inherit"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
