'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useAuth } from '@/features/auth/providers';
import {
  getStudentAnalyticsSurface,
  posthog,
  STUDENT_ANALYTICS_CONTEXT,
} from './posthog';

let initialized = false;

function PostHogPageView({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!enabled) return;
    const query = searchParams.toString();
    const currentUrl = `${window.location.origin}${pathname}${query ? `?${query}` : ''}`;

    posthog.capture('$pageview', {
      $current_url: currentUrl,
      ...STUDENT_ANALYTICS_CONTEXT,
      surface: getStudentAnalyticsSurface(pathname),
    });
  }, [enabled, pathname, searchParams]);

  return null;
}

export function StudentPostHogIdentity() {
  const { session, isLoading } = useAuth();
  const userId = session?.user.id ?? null;
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !posthog.__loaded) return;

    if (userId) {
      posthog.identify(userId, {
        active_product: 'online-learning',
      });
      previousUserId.current = userId;
      return;
    }

    if (previousUserId.current) {
      posthog.reset();
      previousUserId.current = null;
    }
  }, [isLoading, userId]);

  return null;
}

export function StudentPostHogProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(initialized);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    if (!token) return;

    if (!initialized) {
      posthog.init(token, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: false,
        capture_dead_clicks: false,
        cross_subdomain_cookie: true,
        person_profiles: 'identified_only',
        disable_session_recording: true,
        disable_surveys: true,
      });
      posthog.register(STUDENT_ANALYTICS_CONTEXT);
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
