"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@altitutor/ui";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuth } from "@/features/auth";
import {
  UCAT_APP_HEADER_RULE,
  UCAT_HEADER_ICON_BUTTON,
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export function AppHeader({ onToggleNav }: { onToggleNav: () => void }) {
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <header
      className={cn(
        "sticky top-0 z-20 h-14 bg-background/90 backdrop-blur",
        UCAT_APP_HEADER_RULE,
      )}
    >
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={UCAT_HEADER_ICON_BUTTON}
            onClick={onToggleNav}
            aria-label="Toggle navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Link
            href="/dashboard"
            className="text-sm font-semibold tracking-wide"
          >
            UCAT Web
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <button
              type="button"
              className={cn(
                UCAT_SURFACE_CARD,
                UCAT_SURFACE_MOTION,
                "inline-flex h-9 items-center gap-2 rounded-ucatControl px-3 text-sm hover:bg-muted active:scale-[0.98]",
              )}
              onClick={async () => {
                await signOut();
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
