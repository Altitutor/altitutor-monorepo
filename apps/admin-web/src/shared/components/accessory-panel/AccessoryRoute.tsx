"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccessoryPanel } from "@/shared/contexts/AccessoryPanelContext";
import { accessoryDestination } from "@/shared/hooks/usePaneNavigation";
export function AccessoryRoute({ href }: { href: string }) {
  const panel = useAccessoryPanel();
  const openTab = panel?.openTab;
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    if (!openTab) return;
    const target = accessoryDestination(`${href}?${search.toString()}`);
    if (target) openTab(target);
    router.replace("/dashboard");
  }, [href, search, router, openTab]);
  return null;
}
