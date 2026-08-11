"use client";

import {
  useEffect,
  useCallback,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/features/auth";
import { AppSidebar } from "@/features/layout/components/app-sidebar";
import { ComingSoonProvider } from "@/features/layout/context/coming-soon-context";
import { FloatingAppActions } from "@/features/layout/components/floating-app-actions";
import { UcatFloatingToolbar } from "@/features/layout/components/ucat-floating-toolbar";
import { UcatExamToolbar } from "@/features/exam-experience/components/ucat-exam-toolbar";
import { ExamExperienceProvider } from "@/features/exam-experience/context/exam-experience-context";
import { useUcatInterfacePreferences } from "@/features/interface-preferences/hooks/use-ucat-interface-preferences";
import type { ExamToolbarLayout } from "@/features/interface-preferences/model/types";
import { isQuestionEngineTutorialPath } from "@/features/onboarding/lib/question-engine-tutorial-gate";
import { isComingSoon } from "@/features/layout/config/coming-soon";
import {
  OnboardingAutoStart,
  OnboardingProvider,
  UCAT_NEXTSTEP_DIM_ONLY_TARGET,
  UCAT_NEXTSTEP_FIXED_VIEWPORT_ID,
} from "@/features/onboarding";
import { UcatLagProvider } from "@/features/question-engine/context/ucat-lag-context";
import {
  ExamAttemptExitSyncProvider,
  useExamAttemptExitSync,
} from "@/features/exam-attempts/context/exam-attempt-exit-sync-context";
import { useToast } from "@altitutor/ui";
import { AppShellLayoutProvider } from "@/features/layout/context/app-shell-layout-context";
import {
  SidebarOverrideProvider,
  useSidebarOverride,
} from "@/features/layout/context/sidebar-override-context";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { QuestionEngineTutorialRedirect } from "@/features/onboarding/components/question-engine-tutorial-redirect";
import { StudyPlanCompanion } from "@/features/study-plan/components/study-plan-companion";
import { StudyPlanCompanionProvider } from "@/features/study-plan/context/study-plan-companion-context";
import { StudyPlanExtraStudyProvider } from "@/features/study-plan/components/study-plan-extra-study";
import { getStudyPlanCompanionMode } from "@/features/study-plan/lib/companion-mode";
import { ProgressAccessGuard } from "@/features/progress/components/progress-access-guard";
import { requiresCompletedQuestion } from "@/features/progress/lib/progress-access";

type AppShellProps = {
  children: React.ReactNode;
};

function ExamAttemptNavigationGuard({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { flushBeforeExit } = useExamAttemptExitSync();
  const navigationPendingRef = useRef(false);

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!enabled || event.defaultPrevented) return;
    if (navigationPendingRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin) return;
    const href = `${destination.pathname}${destination.search}${destination.hash}`;
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (href === currentHref || destination.hash.startsWith("#")) return;

    event.preventDefault();
    event.stopPropagation();
    navigationPendingRef.current = true;
    void flushBeforeExit()
      .then((saved) => {
        if (!saved) {
          toast({
            title: "Unable to save your progress",
            description: "Please try leaving again.",
            variant: "destructive",
          });
          return;
        }
        router.push(href);
      })
      .catch(() => {
        toast({
          title: "Unable to save your progress",
          description: "Please try leaving again.",
          variant: "destructive",
        });
      })
      .finally(() => {
        navigationPendingRef.current = false;
      });
  };

  return <div onClickCapture={handleClickCapture}>{children}</div>;
}

function AppShellInner({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const reduceMotion = useReducedMotion();
  const { setTheme } = useTheme();
  const { preferences, updatePreferences } = useUcatInterfacePreferences();
  const prevIsMobileRef = useRef<boolean | null>(null);
  const preImmersiveCollapsedRef = useRef<boolean | null>(null);
  const compactExamToolbarRef = useRef<HTMLDivElement>(null);
  const detailedExamToolbarRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bottomFloatingDockVisible, setBottomFloatingDockVisible] =
    useState(false);
  const [tutorialToolbarVisible, setTutorialToolbarVisible] = useState(false);
  const [tutorialToolbarLayout, setTutorialToolbarLayout] =
    useState<ExamToolbarLayout>("compact_top");
  const sidebarOverride = useSidebarOverride();
  const effectiveCollapsed = sidebarOverride?.collapsedOverride ?? collapsed;
  const hideTopBar = sidebarOverride?.hideTopBar ?? false;
  const isExamRoute = pathname.startsWith("/exam");
  const isImmersiveRoute = isExamRoute;
  const isTutorialRoute = isQuestionEngineTutorialPath(pathname);
  const examToolbarLayout = isMobile
    ? "compact_top"
    : isTutorialRoute
      ? tutorialToolbarLayout
      : preferences.examToolbarLayout;
  const examToolbarVisible = isTutorialRoute
    ? tutorialToolbarVisible
    : preferences.examToolbarVisible;
  const studyPlanCompanionMode = getStudyPlanCompanionMode(pathname);
  // Fullscreen engines hide the orb entirely. In-progress activities stay
  // mounted so completion celebrations can surface, then go silent again.
  const hideFloatingStudyPlanCompanion = studyPlanCompanionMode === "hidden";
  const handleLagModeChange = useCallback(
    (enabled: boolean) => {
      void updatePreferences({ lagModeEnabled: enabled });
    },
    [updatePreferences],
  );

  useEffect(() => {
    if (!isTutorialRoute) return;
    setTutorialToolbarVisible(false);
    setTutorialToolbarLayout("compact_top");
  }, [isTutorialRoute, pathname]);

  useEffect(() => {
    if (compactExamToolbarRef.current) {
      compactExamToolbarRef.current.inert = !examToolbarVisible;
    }
    if (detailedExamToolbarRef.current) {
      detailedExamToolbarRef.current.inert = !examToolbarVisible;
    }
  }, [examToolbarLayout, examToolbarVisible]);

  useEffect(() => {
    setTheme(preferences.theme);
  }, [preferences.theme, setTheme]);

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
  const isSignupSamplerRoute = pathname === "/signup/complete/sampler";
  const isStudyPlanSetupRoute = pathname === "/study-plan/setup";
  const isGoalSetupRoute = pathname === "/ucat-goal/setup";

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
      setMobileOpen(false);
    } else if (!isMobile && prev) {
      if (mobileOpen) {
        setCollapsed(false);
        setMobileOpen(false);
      }
    }
  }, [isMobile, mobileOpen]);

  const handleToggleNav = () => {
    if (isMobile) {
      setMobileOpen((prev) => !prev);
      return;
    }
    setCollapsed((prev) => !prev);
  };

  if (isLoading || !user) {
    return (
      <main className="mx-auto w-full max-w-[1400px] p-6 pt-28">
        <AppPageSkeleton />
      </main>
    );
  }

  if (isSubscribeRoute) {
    return <>{children}</>;
  }

  if (isSignupSamplerRoute || isStudyPlanSetupRoute || isGoalSetupRoute) {
    return (
      <OnboardingProvider>
        <UcatLagProvider>{children}</UcatLagProvider>
      </OnboardingProvider>
    );
  }

  const sidebarExpanded = isMobile ? mobileOpen : !effectiveCollapsed;
  const comingSoonPath = isComingSoon(pathname);
  const guardProgressAccess = requiresCompletedQuestion(pathname);

  const handleComingSoonConfirm = () => {
    router.replace("/dashboard");
  };

  const isProgressCanvasRoute =
    pathname === "/progress" ||
    pathname === "/progress/mocks" ||
    pathname === "/progress/preview" ||
    /^\/progress\/sections\/[1-4]$/.test(pathname);
  const isCanvasRoute =
    pathname.startsWith("/dashboard") || isProgressCanvasRoute;
  const mainPaddingClass = hideTopBar
    ? "px-4 pt-4"
    : isCanvasRoute
      ? "px-0 pt-20"
      : "px-6 pt-28";
  const mainBottomPaddingClass = hideTopBar
    ? "pb-4"
    : isCanvasRoute
      ? "pb-0"
      : "pb-6";

  return (
    <ComingSoonProvider
      openOnMount={comingSoonPath}
      onConfirmRedirect={handleComingSoonConfirm}
    >
      <OnboardingProvider>
        <OnboardingAutoStart />
        <QuestionEngineTutorialRedirect />
        <div
          id={UCAT_NEXTSTEP_FIXED_VIEWPORT_ID}
          className="pointer-events-none fixed inset-0 z-[1100]"
          aria-hidden
        >
          <span
            data-tour={UCAT_NEXTSTEP_DIM_ONLY_TARGET}
            className="absolute -left-24 -top-24 h-px w-px"
          />
        </div>
        <AppShellLayoutProvider
          value={{
            mainContentHasSidebarInset: sidebarExpanded && !isMobile,
            bottomFloatingDockVisible,
            setBottomFloatingDockVisible,
          }}
        >
          <ExamAttemptExitSyncProvider>
            <ExamAttemptNavigationGuard enabled={isImmersiveRoute}>
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
                    <UcatLagProvider
                      enabled={preferences.lagModeEnabled}
                      onEnabledChange={handleLagModeChange}
                    >
                      <ExamExperienceProvider>
                        <UcatFloatingToolbar
                          tutorialToolbarVisible={tutorialToolbarVisible}
                          tutorialToolbarLayout={tutorialToolbarLayout}
                          onTutorialToolbarVisibleChange={
                            setTutorialToolbarVisible
                          }
                        />
                        <div
                          className={cn(
                            "flex h-dvh min-h-0 w-screen overflow-hidden",
                            examToolbarLayout === "compact_top"
                              ? "flex-col"
                              : "flex-row",
                          )}
                        >
                          {examToolbarLayout === "compact_top" ? (
                            <motion.div
                              ref={compactExamToolbarRef}
                              initial={false}
                              animate={{ height: examToolbarVisible ? 48 : 0 }}
                              transition={{
                                duration: reduceMotion ? 0 : 0.2,
                                ease: [0.32, 0.72, 0, 1],
                              }}
                              className="shrink-0 overflow-hidden"
                              aria-hidden={!examToolbarVisible}
                            >
                              <UcatExamToolbar
                                layout="compact_top"
                                onLayoutChange={
                                  isTutorialRoute
                                    ? setTutorialToolbarLayout
                                    : undefined
                                }
                              />
                            </motion.div>
                          ) : null}
                          <main className="min-h-0 min-w-0 flex-1 overflow-hidden p-0">
                            <motion.div
                              key={pathname}
                              initial={
                                reduceMotion ? false : { opacity: 0.94, y: 6 }
                              }
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
                          {examToolbarLayout === "detailed_right" ? (
                            <motion.div
                              ref={detailedExamToolbarRef}
                              initial={false}
                              animate={{ width: examToolbarVisible ? 256 : 0 }}
                              transition={{
                                duration: reduceMotion ? 0 : 0.2,
                                ease: [0.32, 0.72, 0, 1],
                              }}
                              className="shrink-0 overflow-hidden"
                              aria-hidden={!examToolbarVisible}
                            >
                              <UcatExamToolbar
                                layout="detailed_right"
                                onLayoutChange={
                                  isTutorialRoute
                                    ? setTutorialToolbarLayout
                                    : undefined
                                }
                              />
                            </motion.div>
                          ) : null}
                        </div>
                      </ExamExperienceProvider>
                    </UcatLagProvider>
                  ) : (
                    <>
                      {!hideTopBar ? (
                        <FloatingAppActions
                          onToggleNav={handleToggleNav}
                          isMenuOpen={sidebarExpanded}
                          isMobile={isMobile}
                        />
                      ) : null}
                      <AppSidebar
                        collapsed={effectiveCollapsed}
                        mobileOpen={mobileOpen}
                        isMobile={isMobile}
                        onCloseMobile={() => setMobileOpen(false)}
                      />
                      <main
                        data-ucat-app-scroll="main"
                        className={cn(
                          "ucat-app-scroll min-h-0 min-w-0 flex-1",
                          "transition-[margin] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                          sidebarExpanded ? "md:ml-[240px]" : "ml-0",
                        )}
                      >
                        <div
                          className={cn(
                            "mx-auto w-full min-w-0",
                            isCanvasRoute ? "max-w-none" : "max-w-[1400px]",
                            mainPaddingClass,
                            mainBottomPaddingClass,
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
                            {guardProgressAccess ? (
                              <ProgressAccessGuard>
                                {children}
                              </ProgressAccessGuard>
                            ) : (
                              children
                            )}
                          </motion.div>
                        </div>
                      </main>
                    </>
                  )}
                </div>
              </div>
            </ExamAttemptNavigationGuard>
          </ExamAttemptExitSyncProvider>
          <StudyPlanCompanion
            hidden={hideFloatingStudyPlanCompanion}
            mode={studyPlanCompanionMode}
          />
        </AppShellLayoutProvider>
      </OnboardingProvider>
    </ComingSoonProvider>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarOverrideProvider>
      <StudyPlanCompanionProvider>
        <StudyPlanExtraStudyProvider>
          <AppShellInner>{children}</AppShellInner>
        </StudyPlanExtraStudyProvider>
      </StudyPlanCompanionProvider>
    </SidebarOverrideProvider>
  );
}
