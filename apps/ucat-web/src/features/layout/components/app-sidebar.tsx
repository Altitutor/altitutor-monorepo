"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@altitutor/ui";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { SidebarExpandablePanel } from "@/features/layout/components/sidebar-expandable-panel";
import { useComingSoon } from "@/features/layout/context/coming-soon-context";
import { SECTION_NUMBER_TO_NAME } from "@/features/sets/lib/section-labels";
import {
  appNavigation,
  appNavigationFooter,
} from "@/features/layout/config/navigation";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import {
  getUpsellConfigForPath,
  hasAccessForPath,
} from "@/features/ucat-access/lib/route-access";
import { isComingSoon } from "@/features/layout/config/coming-soon";
import { isSetGeneratorEnabled } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/images/logo-banner-dark.svg";

type SidebarNavContentProps = {
  onCloseMobile: () => void;
  showLogo: boolean;
  logoId?: string;
};

function SidebarNavContent({
  onCloseMobile,
  showLogo,
  logoId,
}: SidebarNavContentProps) {
  const pathname = usePathname();
  const access = useUcatAccess();
  const { showComingSoonModal } = useComingSoon();
  const { openInPersonUpsell } = useUpsellDialog();
  const [progressExpanded, setProgressExpanded] = useState(() =>
    pathname.startsWith("/progress"),
  );
  const [setsExpanded, setSetsExpanded] = useState(() =>
    pathname.startsWith("/sets"),
  );

  useEffect(() => {
    if (pathname.startsWith("/progress")) {
      setProgressExpanded(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/sets")) {
      setSetsExpanded(true);
    }
  }, [pathname]);

  const openUpsellForPath = (path: string) => {
    const config = getUpsellConfigForPath(path);
    if (!config || config.requiredAccess !== "inPerson") return;
    openInPersonUpsell();
  };

  return (
    <>
      {showLogo ? (
        <div className="shrink-0 p-3" id={logoId}>
          <Image
            src={LOGO_SRC}
            alt="Altitutor"
            width={140}
            height={32}
            className="h-14 w-auto object-contain object-left"
            priority
          />
        </div>
      ) : null}
      <nav className="flex min-h-0 flex-1 flex-col p-3">
        <div className="ucat-app-scroll min-h-0 flex-1 space-y-1">
          {appNavigation.map((section, sectionIndex) => (
            <div
              key={section.title ?? `section-${sectionIndex}`}
              className="space-y-1"
            >
              {section.title ? (
                <div className="px-3 pt-3 text-[11px] font-semibold tracking-[0.16em] text-sidebar-foreground/60">
                  {section.title}
                </div>
              ) : null}
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                const comingSoon = isComingSoon(item.href);
                const tourId = `nav-${item.href.replace(/^\//, "")}`;

                if (comingSoon) {
                  return (
                    <button
                      key={item.href}
                      type="button"
                      data-tour={tourId}
                      className={cn(
                        "flex w-full cursor-default items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-200 ease-out",
                        "text-sidebar-foreground/50",
                      )}
                      onClick={() => {
                        showComingSoonModal();
                        onCloseMobile();
                      }}
                      aria-label={`${item.label} (coming soon)`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="ml-3 flex-1">{item.label}</span>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        Coming soon
                      </Badge>
                    </button>
                  );
                }

                if (item.expandable && item.href === "/progress") {
                  const isProgressActive =
                    pathname === "/progress" ||
                    pathname.startsWith("/progress/sections/") ||
                    pathname.startsWith("/progress/mocks");
                  return (
                    <div key={item.href} className="space-y-0.5">
                      <Link
                        href={item.href}
                        data-tour={tourId}
                        className={cn(
                          "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ease-out",
                          isProgressActive
                            ? "bg-sidebar-foreground/20 text-sidebar-foreground"
                            : "text-sidebar-foreground/90 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                        )}
                        onClick={onCloseMobile}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="ml-3 flex-1">{item.label}</span>
                        <button
                          type="button"
                          aria-expanded={progressExpanded}
                          aria-label={
                            progressExpanded
                              ? "Collapse progress menu"
                              : "Expand progress menu"
                          }
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setProgressExpanded((prev) => !prev);
                          }}
                          className={cn(
                            "flex items-center justify-center p-1 -m-1 rounded transition-colors duration-200 ease-out",
                            "text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                          )}
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 transition-transform duration-200 ease-out",
                              progressExpanded ? "rotate-0" : "-rotate-90",
                            )}
                            aria-hidden
                          />
                        </button>
                      </Link>
                      <SidebarExpandablePanel expanded={progressExpanded}>
                        <div className="ml-4 space-y-0.5 border-l border-sidebar-foreground/20 pl-2 pt-0.5">
                          {([1, 2, 3, 4] as const).map((num) => {
                            const secActive =
                              pathname === `/progress/sections/${num}`;
                            const label =
                              SECTION_NUMBER_TO_NAME[num] ?? `Section ${num}`;
                            return (
                              <Link
                                key={num}
                                href={`/progress/sections/${num}`}
                                className={cn(
                                  "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors duration-150 ease-out",
                                  secActive
                                    ? "bg-sidebar-foreground/15 text-sidebar-foreground font-medium"
                                    : "text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                                )}
                                onClick={onCloseMobile}
                              >
                                {label}
                              </Link>
                            );
                          })}
                          <Link
                            href="/progress/mocks"
                            className={cn(
                              "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors duration-150 ease-out",
                              pathname === "/progress/mocks" ||
                                pathname.startsWith("/progress/mocks/")
                                ? "bg-sidebar-foreground/15 text-sidebar-foreground font-medium"
                                : "text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                            )}
                            onClick={onCloseMobile}
                          >
                            Mocks
                          </Link>
                        </div>
                      </SidebarExpandablePanel>
                    </div>
                  );
                }

                if (item.expandable && item.href === "/sets") {
                  const accessConfig = getUpsellConfigForPath(item.href);
                  const blocked = !hasAccessForPath(item.href, access);
                  const setGeneratorEnabled = isSetGeneratorEnabled();
                  const isSetsActive =
                    pathname === "/sets" ||
                    pathname.startsWith("/sets/sections/") ||
                    (setGeneratorEnabled &&
                      pathname.startsWith("/sets/set-generator"));
                  const setsSections = [1, 2, 3, 4] as const;

                  if (blocked) {
                    return (
                      <button
                        key={item.href}
                        type="button"
                        data-tour={tourId}
                        onClick={() => {
                          openUpsellForPath(item.href);
                          onCloseMobile();
                        }}
                        className={cn(
                          "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-200 ease-out",
                          "text-sidebar-foreground/90 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="ml-3 flex-1">{item.label}</span>
                        {accessConfig ? (
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-[10px]"
                          >
                            {accessConfig.badgeLabel}
                          </Badge>
                        ) : null}
                      </button>
                    );
                  }

                  return (
                    <div key={item.href} className="space-y-0.5">
                      <Link
                        href={item.href}
                        data-tour={tourId}
                        className={cn(
                          "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ease-out",
                          isSetsActive
                            ? "bg-sidebar-foreground/20 text-sidebar-foreground"
                            : "text-sidebar-foreground/90 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                        )}
                        onClick={onCloseMobile}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="ml-3 flex-1">{item.label}</span>
                        <button
                          type="button"
                          aria-expanded={setsExpanded}
                          aria-label={
                            setsExpanded
                              ? "Collapse sets menu"
                              : "Expand sets menu"
                          }
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSetsExpanded((prev) => !prev);
                          }}
                          className={cn(
                            "flex items-center justify-center p-1 -m-1 rounded transition-colors duration-200 ease-out",
                            "text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                          )}
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 transition-transform duration-200 ease-out",
                              setsExpanded ? "rotate-0" : "-rotate-90",
                            )}
                            aria-hidden
                          />
                        </button>
                      </Link>
                      <SidebarExpandablePanel expanded={setsExpanded}>
                        <div className="ml-4 space-y-0.5 border-l border-sidebar-foreground/20 pl-2 pt-0.5">
                          {setsSections.map((num) => {
                            const secActive =
                              pathname === `/sets/sections/${num}`;
                            const label =
                              SECTION_NUMBER_TO_NAME[num] ?? `Section ${num}`;
                            return (
                              <Link
                                key={num}
                                href={`/sets/sections/${num}`}
                                className={cn(
                                  "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors duration-150 ease-out",
                                  secActive
                                    ? "bg-sidebar-foreground/15 text-sidebar-foreground font-medium"
                                    : "text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                                )}
                                onClick={onCloseMobile}
                              >
                                {label}
                              </Link>
                            );
                          })}
                          {setGeneratorEnabled ? (
                            <Link
                              href="/sets/set-generator"
                              className={cn(
                                "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors duration-150 ease-out",
                                pathname === "/sets/set-generator"
                                  ? "bg-sidebar-foreground/15 text-sidebar-foreground font-medium"
                                  : "text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                              )}
                              onClick={onCloseMobile}
                            >
                              Set Generator
                            </Link>
                          ) : null}
                        </div>
                      </SidebarExpandablePanel>
                    </div>
                  );
                }

                return (() => {
                  const accessConfig = getUpsellConfigForPath(item.href);
                  const blocked = !hasAccessForPath(item.href, access);

                  if (blocked) {
                    return (
                      <button
                        key={item.href}
                        type="button"
                        data-tour={tourId}
                        onClick={() => {
                          openUpsellForPath(item.href);
                          onCloseMobile();
                        }}
                        className={cn(
                          "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-200 ease-out",
                          "text-sidebar-foreground/90 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="ml-3 flex-1">{item.label}</span>
                        {accessConfig ? (
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-[10px]"
                          >
                            {accessConfig.badgeLabel}
                          </Badge>
                        ) : null}
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-tour={tourId}
                      className={cn(
                        "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ease-out",
                        active
                          ? "bg-sidebar-foreground/20 text-sidebar-foreground"
                          : "text-sidebar-foreground/90 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                      )}
                      onClick={onCloseMobile}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="ml-3">{item.label}</span>
                    </Link>
                  );
                })();
              })}
            </div>
          ))}
        </div>

        <div className="mt-auto shrink-0 space-y-1 border-t border-sidebar-foreground/20 pt-3">
          {appNavigationFooter.items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            const accessConfig = getUpsellConfigForPath(item.href);
            const blocked = !hasAccessForPath(item.href, access);
            const tourId = `nav-${item.href.replace(/^\//, "")}`;

            if (blocked) {
              return (
                <button
                  key={item.href}
                  type="button"
                  data-tour={tourId}
                  onClick={() => {
                    openUpsellForPath(item.href);
                    onCloseMobile();
                  }}
                  className={cn(
                    "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-200 ease-out",
                    "text-sidebar-foreground/90 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="ml-3 flex-1">{item.label}</span>
                  {accessConfig ? (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {accessConfig.badgeLabel}
                    </Badge>
                  ) : null}
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={tourId}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ease-out",
                  active
                    ? "bg-sidebar-foreground/20 text-sidebar-foreground"
                    : "text-sidebar-foreground/90 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                )}
                onClick={onCloseMobile}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="ml-3">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function AppSidebar({
  collapsed,
  mobileOpen,
  isMobile,
  onCloseMobile,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  isMobile: boolean;
  onCloseMobile: () => void;
}) {
  const dragStartYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (isMobile && mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) {
      dragStartYRef.current = null;
      dragOffsetRef.current = 0;
      setDragOffset(0);
    }
  }, [mobileOpen]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    dragStartYRef.current = event.touches[0]?.clientY ?? null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (dragStartYRef.current == null) return;
    const nextOffset = Math.max(
      0,
      (event.touches[0]?.clientY ?? dragStartYRef.current) - dragStartYRef.current,
    );
    dragOffsetRef.current = nextOffset;
    setDragOffset(nextOffset);
  };

  const handleTouchEnd = () => {
    if (dragOffsetRef.current > 96) {
      onCloseMobile();
    }
    dragStartYRef.current = null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
  };

  if (isMobile) {
    return (
      <>
        {mobileOpen ? (
          <div
            data-mobile-menu-overlay
            className="fixed inset-0 z-[70] bg-black/60 transition-opacity duration-300 md:hidden"
            onClick={onCloseMobile}
          />
        ) : null}

        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-[80] flex h-[88dvh] flex-col overflow-hidden rounded-t-3xl border-0 bg-sidebar text-sidebar-foreground shadow-2xl ring-1 ring-black/10 transition-transform duration-300 ease-out md:hidden",
            dragOffset > 0 && "transition-none",
            mobileOpen ? "translate-y-0" : "translate-y-full",
          )}
          style={
            mobileOpen && dragOffset > 0
              ? { transform: `translateY(${dragOffset}px)` }
              : undefined
          }
        >
          <div
            className="flex h-14 shrink-0 touch-pan-y items-center px-4"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <div id="ucat-onboarding-welcome">
              <Image
                src={LOGO_SRC}
                alt="Altitutor"
                width={140}
                height={32}
                className="h-10 w-auto object-contain object-left"
                priority
              />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <SidebarNavContent onCloseMobile={onCloseMobile} showLogo={false} />
          </div>
        </div>
      </>
    );
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-dvh overflow-hidden transition-[transform,width] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "rounded-r-ucatShell bg-sidebar text-sidebar-foreground shadow-lg",
        !collapsed ? "w-[240px] translate-x-0" : "w-0 -translate-x-full",
      )}
    >
      <div className="flex h-full w-[240px] flex-col">
        <SidebarNavContent
          onCloseMobile={onCloseMobile}
          showLogo
          logoId="ucat-onboarding-welcome"
        />
      </div>
    </aside>
  );
}
