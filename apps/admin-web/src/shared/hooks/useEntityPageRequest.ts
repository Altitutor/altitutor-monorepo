"use client";
import { useEffect, useRef } from "react";
import { usePaneNavigation } from "./usePaneNavigation";
/** Compatibility for existing selection callbacks while callers move to direct links. */
export function useEntityPageRequest(
  isOpen: boolean,
  href: string | null,
  onClose: () => void,
) {
  const { router } = usePaneNavigation();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!isOpen || !href) return;
    close.current();
    router.push(href);
  }, [isOpen, href, router]);
}
