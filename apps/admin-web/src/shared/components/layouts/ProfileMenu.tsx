"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bug,
  Laptop,
  LogOut,
  Moon,
  Palette,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@altitutor/ui";
import { useAuthStore } from "@/shared/lib/supabase/auth";
import { useCurrentStaff } from "@/shared/hooks";
import { cn, navLinkInactiveStyles } from "@/shared/utils";
import { openUserFeedback } from "@/lib/sentry/open-user-feedback";
import { LogoutConfirmationModal } from "../logout-confirmation-modal";

export function ProfileMenu({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { setTheme, theme } = useTheme();
  const { data: staffRecord } = useCurrentStaff();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const handleLogout = async () => {
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Get user initials
  const getInitials = () => {
    if (staffRecord?.first_name && staffRecord?.last_name) {
      return `${staffRecord.first_name.charAt(0)}${staffRecord.last_name.charAt(0)}`.toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() || "U";
  };

  // Get user full name
  const getFullName = () => {
    if (staffRecord?.first_name && staffRecord?.last_name) {
      return `${staffRecord.first_name} ${staffRecord.last_name}`;
    }
    return user?.email?.split("@")[0] || "User";
  };

  if (!user) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Open profile menu"
            className={cn(
              "flex h-12 w-full items-center justify-start gap-3 rounded-md px-3 text-sm",
              navLinkInactiveStyles,
              collapsed && "justify-center px-0",
            )}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-lightBlue text-xs font-medium text-brand-dark-bg dark:bg-brand-lightBlue">
              {getInitials()}
            </div>
            {!collapsed && <span className="truncate">{getFullName()}</span>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          sideOffset={12}
          className="z-[90] w-56 max-w-[calc(100vw-2rem)]"
          collisionPadding={16}
        >
          <DropdownMenuItem asChild>
            <Link
              onClick={onNavigate}
              href="/my-account"
              className="flex items-center cursor-pointer"
            >
              <User className="mr-2 h-4 w-4" />
              My Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/settings"
              prefetch={false}
              onClick={onNavigate}
              className="flex items-center cursor-pointer"
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Palette className="mr-2 h-4 w-4" />
              Appearance
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="z-[90] w-44">
              <DropdownMenuRadioGroup
                value={theme ?? "system"}
                onValueChange={setTheme}
              >
                <DropdownMenuRadioItem value="light" className="cursor-pointer">
                  <Sun className="mr-2 h-4 w-4" />
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark" className="cursor-pointer">
                  <Moon className="mr-2 h-4 w-4" />
                  Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="system"
                  className="cursor-pointer"
                >
                  <Laptop className="mr-2 h-4 w-4" />
                  System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            onSelect={() => void openUserFeedback()}
            className="cursor-pointer"
          >
            <Bug className="mr-2 h-4 w-4" />
            Report a bug
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              onNavigate?.();
              setShowLogoutModal(true);
            }}
            className="cursor-pointer !text-destructive focus:!text-destructive focus:bg-destructive/10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LogoutConfirmationModal
        open={showLogoutModal}
        onOpenChange={setShowLogoutModal}
        onConfirm={handleLogout}
      />
    </>
  );
}
