"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth";
import { AppSidebar } from "@/features/layout/components/app-sidebar";
import { ComingSoonProvider } from "@/features/layout/context/coming-soon-context";
import { FloatingAppActions } from "@/features/layout/components/floating-app-actions";
import { UcatFloatingToolbar } from "@/features/layout/components/ucat-floating-toolbar";
import { isComingSoon } from "@/features/layout/config/coming-soon";
import {
  OnboardingAutoStart,
  OnboardingProvider,
  UCAT_NEXTSTEP_FIXED_VIEWPORT_ID,
} from "@/features/onboarding";
import { StudyPlannerOnboardingModal } from "@/features/study-planner/components/study-planner-onboarding-modal";
import { UcatLagProvider } from "@/features/question-engine/context/ucat-lag-context";
import { AppShellLayoutProvider } from "@/features/layout/context/app-shell-layout-context";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const reduceMotion = useReducedMotion();
  const prevIsMobileRef = useRef<boolean | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isExamRoute = pathname.startsWith("/exam");

  // For exam routes, start with sidebar collapsed (full-screen content) but allow toggling via floating menu.
  // This effect must be declared before any conditional returns to keep hook order stable.
  useEffect(() => {
    if (isExamRoute) {
      setCollapsed(true);
    }
  }, [isExamRoute]);

  const isSubscribeRoute = pathname.startsWith("/subscribe");

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, router, user]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const prev = prevIsMobileRef.current;
    prevIsMobileRef.current = isMobile;
    if (prev === null) return;

    if (isMobile && !prev) {
      if (!collapsed) setMobileOpen(true);
    } else if (!isMobile && prev) {
      if (mobileOpen) {
        setCollapsed(false);
        setMobileOpen(false);
      }
    }
  }, [isMobile, collapsed, mobileOpen]);

  const handleToggleNav = () => {
    if (isMobile) {
      setMobileOpen((prev) => !prev);
      return;
    }
    setCollapsed((prev) => !prev);
  };

  if (isLoading || !user) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  // Subscribe page gets its own full-page marketing layout — no sidebar/nav shell
  if (isSubscribeRoute) {
    return <>{children}</>;
  }

  const sidebarExpanded = isMobile ? mobileOpen : !collapsed;
  const comingSoonPath = isComingSoon(pathname);

  const handleComingSoonConfirm = () => {
    router.replace("/dashboard");
  };

  return (
    <ComingSoonProvider
      openOnMount={comingSoonPath}
      onConfirmRedirect={handleComingSoonConfirm}
    >
      <OnboardingProvider>
        <OnboardingAutoStart />
        <StudyPlannerOnboardingModal />
        {/* nextstepjs portal target: fixed layer so sidebar highlights stay aligned while main content scrolls */}
        <div
          id={UCAT_NEXTSTEP_FIXED_VIEWPORT_ID}
          className="pointer-events-none fixed inset-0 z-[1100]"
          aria-hidden
        />
        <AppShellLayoutProvider
          value={{
            mainContentHasSidebarInset: sidebarExpanded && !isMobile,
          }}
        >
        <div className="min-h-dvh bg-background" id="ucat-app-shell">
        {isExamRoute ? (
          <UcatLagProvider>
            <UcatFloatingToolbar />
            <div className={cn("flex", "w-screen")}>
              <AppSidebar
                collapsed={collapsed}
                mobileOpen={mobileOpen}
                isMobile={isMobile}
                onCloseMobile={() => setMobileOpen(false)}
              />
              <main
                className={cn(
                  "flex-1 min-h-0 transition-[margin] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  "h-dvh min-h-0 overflow-hidden p-0",
                  sidebarExpanded ? "md:ml-[240px]" : "ml-0",
                )}
              >
                <motion.div
                  key={pathname}
                  initial={reduceMotion ? false : { opacity: 0.94, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.22,
                    ease: [0.32, 0.72, 0, 1],
                  }}
                  className="h-full min-h-0 w-full overflow-hidden"
                >
                  {children}
                </motion.div>
              </main>
            </div>
          </UcatLagProvider>
        ) : (
          <>
            <FloatingAppActions
              onToggleNav={handleToggleNav}
              isMenuOpen={sidebarExpanded}
            />
            <div className={cn("flex", "mx-auto max-w-[1400px]")}>
              <AppSidebar
                collapsed={collapsed}
                mobileOpen={mobileOpen}
                isMobile={isMobile}
                onCloseMobile={() => setMobileOpen(false)}
              />
              <main
                className={cn(
                  "flex-1 min-h-0 min-w-0 transition-[margin] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  "min-h-dvh pt-16 p-6 overflow-x-hidden",
                  sidebarExpanded ? "md:ml-[240px]" : "ml-0",
                )}
              >
                <motion.div
                  key={pathname}
                  initial={reduceMotion ? false : { opacity: 0.94, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.22,
                    ease: [0.32, 0.72, 0, 1],
                  }}
                  className="min-h-0 w-full min-w-0"
                >
                  {children}
                </motion.div>
              </main>
            </div>
          </>
        )}
        </div>
        </AppShellLayoutProvider>
      </OnboardingProvider>
    </ComingSoonProvider>
  );
}
