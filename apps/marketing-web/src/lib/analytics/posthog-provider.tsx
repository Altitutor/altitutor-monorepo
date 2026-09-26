"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureUcatObservedFirstTouchInBrowser } from "@altitutor/shared";
import { captureMarketingEvent } from "./posthog";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  useEffect(() => {
    if (pathname.startsWith("/ucat")) {
      captureUcatObservedFirstTouchInBrowser({
        pathname,
        searchParams: new URLSearchParams(query),
      });
    }
    captureMarketingEvent("$pageview", {
      $current_url: `${window.location.origin}${pathname}${query ? `?${query}` : ""}`,
    });
  }, [pathname, query]);
  return null;
}

export function MarketingPostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  );
}
