"use client";

import { Button } from "@/components/ui/button";
import { AnimatedHamburgerIcon } from "@altitutor/ui";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { HeaderNotificationPills } from "@/features/layout/components/header-notification-pills";
import { ProfileDropdown } from "@/features/layout/components/profile-dropdown";
import { NotificationTray } from "@/features/notifications";
import { UCAT_HEADER_ICON_BUTTON } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type FloatingAppActionsProps = {
  onToggleNav: () => void;
  isMenuOpen: boolean;
  className?: string;
};

export function FloatingAppActions({
  onToggleNav,
  isMenuOpen,
  className,
}: FloatingAppActionsProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed top-4 left-4 right-4 z-50 flex items-center gap-2",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-auto shrink-0 md:transition-[margin] md:duration-200 md:ease-[cubic-bezier(0.32,0.72,0,1)]",
          isMenuOpen ? "md:ml-[240px]" : "ml-0",
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onToggleNav}
          className={UCAT_HEADER_ICON_BUTTON}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        >
          <AnimatedHamburgerIcon isOpen={isMenuOpen} className="h-5 w-5" />
        </Button>
      </div>
      <div className="pointer-events-auto flex min-w-0 flex-1 justify-center overflow-hidden px-2">
        <HeaderNotificationPills />
      </div>
      <div className="pointer-events-auto flex shrink-0 items-center gap-2">
        <NotificationTray />
        <ThemeToggle />
        <ProfileDropdown />
      </div>
    </div>
  );
}
