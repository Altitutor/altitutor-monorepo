"use client";

import { useEffect, useState } from "react";
import { Badge } from "@altitutor/ui";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { useComingSoon } from "@/features/layout/context/coming-soon-context";
import { SECTION_NUMBER_TO_NAME } from "@/features/sets/lib/section-labels";
import {
  appNavigation,
  appNavigationFooter,
} from "@/features/layout/config/navigation";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { AccessUpsellModal } from "@/features/ucat-access/components/access-upsell-modal";
import {
  getUpsellConfigForPath,
  hasAccessForPath,
  type RequiredUcatAccess,
} from "@/features/ucat-access/lib/route-access";
import { isComingSoon } from "@/features/layout/config/coming-soon";
import { cn } from "@/lib/utils";

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
  const pathname = usePathname();
  const access = useUcatAccess();
  const { showComingSoonModal } = useComingSoon();
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [upsellRequiredAccess, setUpsellRequiredAccess] =
    useState<RequiredUcatAccess | null>(null);
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

  // On mobile, visibility is driven only by mobileOpen. On desktop, by !collapsed.
  const isVisible = isMobile ? mobileOpen : !collapsed;
  const logoSrc = "/images/logo-banner-dark.svg";

  const openUpsellForPath = (path: string) => {
    const config = getUpsellConfigForPath(path);
    if (!config) return;
    setUpsellRequiredAccess(config.requiredAccess);
    setUpsellOpen(true);
  };

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen overflow-hidden transition-[transform,width] duration-200 ease-in-out",
          "rounded-r-2xl bg-sidebar text-sidebar-foreground shadow-lg",
          isVisible ? "w-[240px] translate-x-0" : "w-0 -translate-x-full",
        )}
      >
        <div className="flex h-full w-[240px] flex-col">
          <div className="shrink-0 p-3">
            <Image
              src={logoSrc}
              alt="Altitutor"
              width={140}
              height={32}
              className="h-14 w-auto object-contain object-left"
              priority
            />
          </div>
          <nav className="flex min-h-0 flex-1 flex-col p-3">
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
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

                  if (comingSoon) {
                    return (
                      <button
                        key={item.href}
                        type="button"
                        className={cn(
                          "flex w-full cursor-default items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium",
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
                        <Badge
                          variant="secondary"
                          className="shrink-0 text-[10px]"
                        >
                          Coming soon
                        </Badge>
                      </button>
                    );
                  }

                  if (item.expandable && item.href === "/progress") {
                    const isProgressActive =
                      pathname === "/progress" ||
                      pathname.startsWith("/progress/sections/") ||
                      pathname.startsWith("/progress/mocks") ||
                      pathname.startsWith("/progress/mock-attempts");
                    return (
                      <div key={item.href} className="space-y-0.5">
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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
                              "flex items-center justify-center p-1 -m-1 transition-colors rounded",
                              "text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                            )}
                          >
                            {progressExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronLeft className="h-4 w-4" />
                            )}
                          </button>
                        </Link>
                        {progressExpanded && (
                          <div className="ml-4 space-y-0.5 border-l border-sidebar-foreground/20 pl-2">
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
                                    "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors",
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
                                "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors",
                                pathname === "/progress/mocks" ||
                                  pathname.startsWith("/progress/mock-attempts")
                                  ? "bg-sidebar-foreground/15 text-sidebar-foreground font-medium"
                                  : "text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                              )}
                              onClick={onCloseMobile}
                            >
                              Mocks
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (item.expandable && item.href === "/sets") {
                    const accessConfig = getUpsellConfigForPath(item.href);
                    const blocked = !hasAccessForPath(item.href, access);
                    const isSetsActive =
                      pathname === "/sets" ||
                      pathname.startsWith("/sets/sections/") ||
                      pathname.startsWith("/sets/set-generator");
                    const setsSections = [1, 2, 3, 4] as const;

                    if (blocked) {
                      return (
                        <button
                          key={item.href}
                          type="button"
                          onClick={() => {
                            openUpsellForPath(item.href);
                            onCloseMobile();
                          }}
                          className={cn(
                            "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
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
                          className={cn(
                            "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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
                              "flex items-center justify-center p-1 -m-1 transition-colors rounded",
                              "text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                            )}
                          >
                            {setsExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronLeft className="h-4 w-4" />
                            )}
                          </button>
                        </Link>
                        {setsExpanded && (
                          <div className="ml-4 space-y-0.5 border-l border-sidebar-foreground/20 pl-2">
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
                                    "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors",
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
                              href="/sets/set-generator"
                              className={cn(
                                "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors",
                                pathname === "/sets/set-generator"
                                  ? "bg-sidebar-foreground/15 text-sidebar-foreground font-medium"
                                  : "text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                              )}
                              onClick={onCloseMobile}
                            >
                              Set Generator
                            </Link>
                          </div>
                        )}
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
                          onClick={() => {
                            openUpsellForPath(item.href);
                            onCloseMobile();
                          }}
                          className={cn(
                            "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
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
                        className={cn(
                          "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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

                if (blocked) {
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => {
                        openUpsellForPath(item.href);
                        onCloseMobile();
                      }}
                      className={cn(
                        "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
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
                    className={cn(
                      "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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
        </div>
      </aside>
      <AccessUpsellModal
        open={upsellOpen}
        requiredAccess={upsellRequiredAccess}
        onOpenChange={(open) => {
          setUpsellOpen(open);
          if (!open) setUpsellRequiredAccess(null);
        }}
      />
    </>
  );
}
