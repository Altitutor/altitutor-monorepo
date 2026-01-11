'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, AnimatedHamburgerIcon } from '@altitutor/ui';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { ThemeToggle } from '../theme-toggle';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, User, LayoutDashboard } from 'lucide-react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { useMobileMenu } from '@/shared/contexts/MobileMenuContext';
import { useProfile } from '@/features/profile';
import { LogoutConfirmationModal } from '../logout-confirmation-modal';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuthStore();
  const { resolvedTheme } = useTheme();
  const { toggle: toggleMobileMenu, isOpen: isMobileMenuOpen } = useMobileMenu();
  const { data: profile } = useProfile();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Hide navbar on booking/trial-session route
  if (pathname === '/booking/trial-session') {
    return null;
  }

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
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  // Get user full name
  const getFullName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    // Fallback to first name only if available
    if (profile?.first_name) {
      return profile.first_name;
    }
    // Final fallback to email username
    return user?.email?.split('@')[0] || 'User';
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background dark:bg-brand-dark-bg border-b dark:border-brand-dark-border h-[var(--navbar-height)]">
      <div className="container mx-auto px-4 h-full flex justify-between items-center">
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
              {!user ? (
                <Link href="/" className="cursor-pointer">
                  <Image 
                    src={resolvedTheme === 'dark' ? "/images/logo-banner-dark.svg" : "/images/logo-banner-light.svg"}
                    alt="Altitutor Student" 
                    width={160} 
                    height={36}
                    priority
                    className="object-contain"
                  />
                </Link>
              ) : (
                <Image 
                  src={resolvedTheme === 'dark' ? "/images/logo-banner-dark.svg" : "/images/logo-banner-light.svg"}
                  alt="Altitutor Student" 
                  width={160} 
                  height={36}
                  priority
                  className="object-contain"
                />
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-brand-lightBlue dark:bg-brand-lightBlue flex items-center justify-center text-brand-dark-bg font-medium">
                    {getInitials()}
                  </div>
                  <span className="hidden sm:inline">{getFullName()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="flex items-center cursor-pointer">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/my-profile" className="flex items-center cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    My Profile
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
            <>
              <Button variant="outline" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button variant="default" asChild>
                <Link href="/booking/trial-session">Book now</Link>
              </Button>
            </>
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