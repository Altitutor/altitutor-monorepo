"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuth } from "@/features/auth";

export function AppHeader({ onToggleNav }: { onToggleNav: () => void }) {
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-20 h-14 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-muted active:scale-95"
            onClick={onToggleNav}
            aria-label="Toggle navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
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
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-muted active:scale-[0.98]"
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
