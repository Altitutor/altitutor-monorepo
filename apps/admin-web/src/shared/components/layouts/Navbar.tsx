'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@altitutor/ui';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  AnimatedHamburgerIcon,
} from '@altitutor/ui';
import { useCurrentStaff } from '@/shared/hooks';
import { useMobileMenu } from '@/shared/contexts/MobileMenuContext';
import { useCommandPalette } from '@/shared/contexts/CommandPaletteContext';
import { LogoutConfirmationModal } from '../logout-confirmation-modal';
import { Search } from 'lucide-react';
import { NotificationsTray } from '@/features/notifications';
import { useNotificationsRealtime } from '@/features/notifications';
import { DashboardDatePicker } from './DashboardDatePicker';
import { MessagesDropdown } from '@/features/messages/components/MessagesDropdown';

export function Navbar() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { resolvedTheme, setTheme } = useTheme();
  const { data: staffRecord } = useCurrentStaff();
  const { toggle: toggleMobileMenu, isOpen: isMobileMenuOpen } = useMobileMenu();
  const { toggle: toggleCommandPalette, isOpen: isCommandPaletteOpen, close: closeCommandPalette } = useCommandPalette();
  
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Subscribe to notifications real-time updates
  useNotificationsRealtime(staffRecord?.id ?? '');

  // Keyboard shortcut for command palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
      // Also close with Escape when open
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        closeCommandPalette();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCommandPaletteOpen, toggleCommandPalette, closeCommandPalette]);

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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background dark:bg-brand-dark-bg border-b dark:border-brand-dark-border h-[var(--navbar-height)]">
      <div className="container mx-auto px-4 h-full flex items-center gap-4">
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
        <div className="hidden md:flex items-center gap-3 min-w-[220px]">
          <div className="h-12 flex items-center gap-1">
            <Image 
              src={resolvedTheme === 'dark' ? "/images/logo-banner-dark.svg" : "/images/logo-banner-light.svg"}
              alt="Altitutor" 
              width={160} 
              height={36}
              priority
              className="object-contain"
              style={{ width: 'auto', height: 'auto' }}
            />
          </div>
        </div>
        
        {/* Search Button - same on desktop and mobile */}
        {user && (
          <div className="flex-1 flex justify-center min-w-0">
            {/* Spacer to center the search button */}
          </div>
        )}
        
        <div className="flex items-center gap-2 flex-shrink-0 justify-end">
          {user && <DashboardDatePicker />}

          {/* Command palette */}
          {user && (
            <Button
              variant="outline"
              size="icon"
              onClick={toggleCommandPalette}
              className="h-9 w-9"
              aria-label="Open command palette"
              title="Search (Cmd+K / Ctrl+K)"
            >
              <Search className="h-4 w-4" />
            </Button>
          )}

          {/* Notifications Button */}
          {user && staffRecord?.id && (
            <NotificationsTray staffId={staffRecord.id} />
          )}
          
          {/* Messages Button */}
          {user && <MessagesDropdown />}
          
          {/* Profile Menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 h-9">
                  <div className="h-6 w-6 rounded-full bg-brand-lightBlue dark:bg-brand-lightBlue flex items-center justify-center text-brand-dark-bg font-medium text-xs">
                    {getInitials()}
                  </div>
                  <span className="hidden sm:inline">{getFullName()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 max-w-[calc(100vw-2rem)]" collisionPadding={16}>
                <DropdownMenuItem asChild>
                  <Link href="/my-account" className="flex items-center cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTheme('light')} className="cursor-pointer">
                  Light Theme
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')} className="cursor-pointer">
                  Dark Theme
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')} className="cursor-pointer">
                  System Theme
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowLogoutModal(true)} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" asChild>
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
