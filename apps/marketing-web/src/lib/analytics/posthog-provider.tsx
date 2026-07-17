"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { MARKETING_ANALYTICS_CONTEXT } from "./posthog";

let initialized = false;

function PostHogPageView({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!enabled) return;

    const query = searchParams.toString();
    const currentUrl = `${window.location.origin}${pathname}${query ? `?${query}` : ""}`;

    posthog.capture("$pageview", {
      $current_url: currentUrl,
      ...MARKETING_ANALYTICS_CONTEXT,
    });
  }, [enabled, pathname, searchParams]);

  return null;
}

export function MarketingPostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(initialized);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    if (!token) return;

    if (!initialized) {
      posthog.init(token, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: false,
        capture_dead_clicks: false,
        cross_subdomain_cookie: true,
        person_profiles: "identified_only",
        disable_session_recording: true,
        disable_surveys: true,
      });
      posthog.register(MARKETING_ANALYTICS_CONTEXT);
      initialized = true;
    }

    setReady(true);
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView enabled={ready} />
      </Suspense>
      {children}
    </PHProvider>
  );
}
