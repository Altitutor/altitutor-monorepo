"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useAuth } from "@/features/auth";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import {
  getUcatAnalyticsSurface,
  posthog,
  UCAT_ANALYTICS_CONTEXT,
} from "./posthog";
import { buildEmailCtaLandingAttribution } from "@/lib/analytics/email-cta-attribution";

let initialized = false;

function PostHogPageView({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    if (!enabled) return;
    const currentSearchParams = new URLSearchParams(query);
    const currentUrl = `${window.location.origin}${pathname}${query ? `?${query}` : ""}`;

    posthog.capture("$pageview", {
      $current_url: currentUrl,
      ...UCAT_ANALYTICS_CONTEXT,
      surface: getUcatAnalyticsSurface(pathname),
    });

    const attribution = buildEmailCtaLandingAttribution(
      pathname,
      currentSearchParams,
    );
    if (!attribution) return;

    try {
      const storageKey = `ucat-email-cta-landed:${attribution.dedupeKey}`;
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Tracking remains fail-open when storage is unavailable.
    }

    posthog.capture("email_cta_landed", {
      ...UCAT_ANALYTICS_CONTEXT,
      ...attribution.properties,
    });
  }, [enabled, pathname, query]);

  return null;
}

export function UcatPostHogIdentity() {
  const { user, isLoading } = useAuth();
  const access = useUcatAccess();
  const userId = user?.id ?? null;
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || access.isLoading || !posthog.__loaded) return;

    if (userId) {
      posthog.identify(userId, {
        active_product: "ucat",
        account_class: access.analyticsAccountClass,
        ucat_test_year: access.testYear,
        ucat_test_date: access.testDate,
      });
      previousUserId.current = userId;
      return;
    }

    if (previousUserId.current) {
      posthog.reset();
      previousUserId.current = null;
    }
  }, [
    access.analyticsAccountClass,
    access.isLoading,
    access.testDate,
    access.testYear,
    isLoading,
    userId,
  ]);

  return null;
}

export function UcatPostHogProvider({
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
        ...UCAT_ANALYTICS_CONTEXT,
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
