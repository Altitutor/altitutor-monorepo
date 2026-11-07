"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@altitutor/ui";
import {
  canUsePageFullscreen,
  PAGE_FULLSCREEN_FAILURE_DESCRIPTION,
  PAGE_FULLSCREEN_FAILURE_TITLE,
  pageFullscreenLabel,
  togglePageFullscreen,
  type PageFullscreenTarget,
} from "@/features/layout/lib/page-fullscreen";

function currentPage(): PageFullscreenTarget {
  return {
    fullscreenEnabled: document.fullscreenEnabled,
    fullscreenElement: document.fullscreenElement,
    documentElement: document.documentElement,
    exitFullscreen: () => document.exitFullscreen(),
  };
}

export function usePageFullscreen() {
  const { toast } = useToast();
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => {
      setSupported(canUsePageFullscreen(currentPage()));
      setActive(document.fullscreenElement !== null);
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggle = useCallback(() => {
    const entering = document.fullscreenElement === null;
    void togglePageFullscreen(currentPage()).then((result) => {
      if (result === "failed" && entering) {
        toast({
          title: PAGE_FULLSCREEN_FAILURE_TITLE,
          description: PAGE_FULLSCREEN_FAILURE_DESCRIPTION,
        });
      }
    });
  }, [toast]);

  return {
    supported,
    active,
    toggle,
    label: pageFullscreenLabel(active),
  };
}
