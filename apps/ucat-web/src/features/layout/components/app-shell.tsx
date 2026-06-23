"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth";
import { AppSidebar } from "@/features/layout/components/app-sidebar";
import { ComingSoonProvider } from "@/features/layout/context/coming-soon-context";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { FloatingAppActions } from "@/features/layout/components/floating-app-actions";
import { UcatFloatingToolbar } from "@/features/layout/components/ucat-floating-toolbar";
import { isComingSoon } from "@/features/layout/config/coming-soon";
import {
  OnboardingAutoStart,
  OnboardingProvider,
  UCAT_NEXTSTEP_FIXED_VIEWPORT_ID,
} from "@/features/onboarding";
import { UcatLagProvider } from "@/features/question-engine/context/ucat-lag-context";
import { AppShellLayoutProvider } from "@/features/layout/context/app-shell-layout-context";
import { SidebarOverrideProvider, useSidebarOverride } from "@/features/layout/context/sidebar-override-context";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
};

function isPracticeEngineRoute(pathname: string): boolean {
  return (
    pathname === "/practice/session" || pathname.startsWith("/practice/stem/")
  );
}

function AppShellInner({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const reduceMotion = useReducedMotion();
  const prevIsMobileRef = useRef<boolean | null>(null);
  const preImmersiveCollapsedRef = useRef<boolean | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarOverride = useSidebarOverride();
  const effectiveCollapsed = sidebarOverride?.collapsedOverride ?? collapsed;
  const hideTopBar = sidebarOverride?.hideTopBar ?? false;
  const { active: activeExamAttempt } = useActiveExamAttempt();

  const isExamRoute = pathname.startsWith("/exam");
  const isImmersiveRoute = isExamRoute || isPracticeEngineRoute(pathname);
  const showExamAttemptPill =
    !isImmersiveRoute && activeExamAttempt != null;

  useEffect(() => {
    if (isImmersiveRoute) {
      setCollapsed((current) => {
        if (preImmersiveCollapsedRef.current === null) {
          preImmersiveCollapsedRef.current = current;
        }
        return true;
      });
      return;
    }

    if (preImmersiveCollapsedRef.current !== null) {
      const restoreCollapsed = preImmersiveCollapsedRef.current;
      preImmersiveCollapsedRef.current = null;
      setCollapsed(restoreCollapsed);
    }
  }, [isImmersiveRoute]);

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

  if (isSubscribeRoute) {
    return <>{children}</>;
  }

  const sidebarExpanded = isMobile ? mobileOpen : !effectiveCollapsed;
  const comingSoonPath = isComingSoon(pathname);

  const handleComingSoonConfirm = () => {
    router.replace("/dashboard");
  };

  const mainPaddingClass = hideTopBar ? "p-4" : "pt-16 p-6";

  return (
    <ComingSoonProvider
      openOnMount={comingSoonPath}
      onConfirmRedirect={handleComingSoonConfirm}
    >
      <OnboardingProvider>
        <OnboardingAutoStart />
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
          <div
            className={cn(
              "bg-background",
              isExamRoute
                ? "flex min-h-dvh flex-col"
                : "flex h-dvh min-h-0 flex-col overflow-hidden",
            )}
            id="ucat-app-shell"
          >
            <div className="flex min-h-0 flex-1 flex-col">
              {isExamRoute ? (
                <UcatLagProvider>
                  <UcatFloatingToolbar />
                  <div className={cn("flex", "w-screen")}>
                    <AppSidebar
                      collapsed={effectiveCollapsed}
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
                  {!hideTopBar ? (
                    <FloatingAppActions
                      onToggleNav={handleToggleNav}
                      isMenuOpen={sidebarExpanded}
                      showExamAttemptPill={showExamAttemptPill}
                    />
                  ) : null}
                  <AppSidebar
                    collapsed={effectiveCollapsed}
                    mobileOpen={mobileOpen}
                    isMobile={isMobile}
                    onCloseMobile={() => setMobileOpen(false)}
                  />
                  <main
                    className={cn(
                      "ucat-app-scroll min-h-0 min-w-0 flex-1",
                      "transition-[margin] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                      sidebarExpanded ? "md:ml-[240px]" : "ml-0",
                    )}
                  >
                    <div
                      className={cn(
                        "mx-auto w-full min-w-0 max-w-[1400px]",
                        mainPaddingClass,
                      )}
                    >
                      <motion.div
                        key={pathname}
                        initial={reduceMotion ? false : { opacity: 0.94 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.22,
                          ease: [0.32, 0.72, 0, 1],
                        }}
                        className="min-h-0 w-full min-w-0"
                      >
                        {children}
                      </motion.div>
                    </div>
                  </main>
                </>
              )}
            </div>
          </div>
        </AppShellLayoutProvider>
      </OnboardingProvider>
    </ComingSoonProvider>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarOverrideProvider>
      <AppShellInner>{children}</AppShellInner>
    </SidebarOverrideProvider>
  );
}
