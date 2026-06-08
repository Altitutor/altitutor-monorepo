"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, LayoutDashboard, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@altitutor/ui";
import { useAuth } from "@/features/auth";
import { useUcatProfile } from "@/features/layout/hooks/use-ucat-profile";
import { UCAT_HEADER_BTN_OUTLINE } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export function ProfileDropdown() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { data: profile } = useUcatProfile(!!user);

  if (!user) return null;

  const getInitials = () => {
    const fn = profile?.firstName?.trim();
    const ln = profile?.lastName?.trim();
    if (fn && ln) {
      return `${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase();
    }
    if (fn) return fn.charAt(0).toUpperCase();
    return user.email?.charAt(0).toUpperCase() ?? "U";
  };

  const getFullName = () => {
    const fn = profile?.firstName?.trim();
    const ln = profile?.lastName?.trim();
    if (fn && ln) return `${fn} ${ln}`;
    if (fn) return fn;
    return user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            UCAT_HEADER_BTN_OUTLINE,
            "flex h-9 items-center gap-2 px-3 active:scale-[0.98]",
          )}
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sidebar text-xs font-medium text-sidebar-foreground">
            {getInitials()}
          </div>
          <span className="hidden max-w-[10rem] truncate text-sm sm:inline">
            {getFullName()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-lg border-0 bg-card text-card-foreground shadow-lg"
      >
        <DropdownMenuItem asChild>
          <Link href="/dashboard" className="flex cursor-pointer items-center">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex cursor-pointer items-center">
            <User className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
