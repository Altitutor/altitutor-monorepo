"use client";

import { Button } from "@/components/ui/button";
import { AnimatedHamburgerIcon } from "@altitutor/ui";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ExamAttemptHeaderPill } from "@/features/exam-attempts/components/exam-attempt-header-pill";
import { ProfileDropdown } from "@/features/layout/components/profile-dropdown";
import { UCAT_HEADER_ICON_BUTTON } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type FloatingAppActionsProps = {
  onToggleNav: () => void;
  isMenuOpen: boolean;
  className?: string;
  showExamAttemptPill?: boolean;
};

export function FloatingAppActions({
  onToggleNav,
  isMenuOpen,
  className,
  showExamAttemptPill = false,
}: FloatingAppActionsProps) {
  return (
    <div
      className={cn(
        "fixed top-4 left-4 right-4 z-50 flex items-center gap-2",
        className,
      )}
    >
      <div
        className={cn(
          "shrink-0 transition-[margin] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isMenuOpen ? "ml-[240px]" : "ml-0",
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
      {showExamAttemptPill ? (
        <div className="flex min-w-0 flex-1 justify-center px-2">
          <ExamAttemptHeaderPill />
        </div>
      ) : (
        <div className="flex-1" aria-hidden />
      )}
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <ProfileDropdown />
      </div>
    </div>
  );
}
