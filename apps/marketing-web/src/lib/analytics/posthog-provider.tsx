"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { captureUcatObservedFirstTouchInBrowser } from "@altitutor/shared";
import { MARKETING_ANALYTICS_CONTEXT } from "./posthog";

let initialized = false;

function PostHogPageView({ enabled }: { enabled: boolean }) {
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
    if (!enabled) return;

    const currentUrl = `${window.location.origin}${pathname}${query ? `?${query}` : ""}`;

    posthog.capture("$pageview", {
      $current_url: currentUrl,
      ...MARKETING_ANALYTICS_CONTEXT,
    });
  }, [enabled, pathname, query]);

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
        defaults: "2026-05-30",
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: false,
        capture_dead_clicks: false,
        cross_subdomain_cookie: true,
        person_profiles: "identified_only",
        disable_session_recording: true,
        disable_surveys: true,
      });
      posthog.register({
        ...MARKETING_ANALYTICS_CONTEXT,
        environment:
          process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
          process.env.NODE_ENV ??
          "development",
      });
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
