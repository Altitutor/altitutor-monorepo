'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, AnimatedHamburgerIcon } from '@altitutor/ui';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { ThemeToggle } from '../theme-toggle';
import { useRouter } from 'next/navigation';
import { LogOut, Settings, User } from 'lucide-react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useMobileMenu } from '@/shared/contexts/MobileMenuContext';
import { LogoutConfirmationModal } from '../logout-confirmation-modal';
import { NotificationsTray } from '@/features/notifications';
import { useNotificationsRealtime } from '@/features/notifications';
import { TUTOR_SHELL_PAD_X } from '@/shared/lib/tutor-layout';
import { cn } from '@/shared/utils';
import { tutorBtnOutline } from '@/shared/lib/tutor-visual';

export function Navbar() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { resolvedTheme } = useTheme();
  const { toggle: toggleMobileMenu, isOpen: isMobileMenuOpen } = useMobileMenu();
  // Only fetch staff data when user is authenticated
  const { data: staffRecord } = useCurrentStaff(!!user);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Subscribe to notifications real-time updates
  useNotificationsRealtime(staffRecord?.id ?? '');

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Get user initials
  const getInitials = () => {
    if (staffRecord?.first_name && staffRecord?.last_name) {
      return `${staffRecord.first_name.charAt(0)}${staffRecord.last_name.charAt(0)}`.toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  // Get user full name
  const getFullName = () => {
    if (staffRecord?.first_name && staffRecord?.last_name) {
      return `${staffRecord.first_name} ${staffRecord.last_name}`;
    }
    return user?.email?.split('@')[0] || 'User';
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[var(--navbar-height)] border-0 bg-background/90 shadow-[0_4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md dark:bg-brand-dark-bg/90 dark:shadow-[0_4px_28px_rgba(0,0,0,0.45)] supports-[backdrop-filter]:bg-background/80 dark:supports-[backdrop-filter]:bg-brand-dark-bg/80">
      <div className={cn('mx-auto flex h-full w-full items-center justify-between', TUTOR_SHELL_PAD_X)}>
        <div className="flex items-center gap-4">
          {/* Mobile Hamburger Menu Button */}
          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMobileMenu}
              className="md:hidden flex-shrink-0"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              <AnimatedHamburgerIcon isOpen={isMobileMenuOpen} />
            </Button>
          )}

          {/* Desktop Logo - hidden on mobile */}
          <div className="hidden md:flex items-center">
            <div className="h-12 flex items-center">
              <Image
                src={resolvedTheme === 'dark' ? '/images/logo-banner-dark.svg' : '/images/logo-banner-light.svg'}
                alt="Altitutor Tutor"
                width={160}
                height={36}
                priority
                className="object-contain"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Notifications Button */}
          {user && staffRecord?.id && (
            <NotificationsTray />
          )}
          <ThemeToggle />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className={cn(tutorBtnOutline, 'flex h-9 items-center gap-2')}>
                  <div className="h-6 w-6 rounded-full bg-brand-lightBlue dark:bg-brand-lightBlue flex items-center justify-center text-brand-dark-bg font-medium text-xs">
                    {getInitials()}
                  </div>
                  <span className="hidden sm:inline">{getFullName()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/my-profile" className="flex items-center cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowLogoutModal(true)} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" className={tutorBtnOutline} asChild>
              <Link href="/login">Login</Link>
            </Button>
          )}
        </div>
      </div>
      <LogoutConfirmationModal
        open={showLogoutModal}
        onOpenChange={setShowLogoutModal}
        onConfirm={handleLogout}
      />
    </nav>
  );
} 