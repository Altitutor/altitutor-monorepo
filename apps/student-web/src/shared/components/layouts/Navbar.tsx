'use client';

import Link from 'next/link';
import { Button, AnimatedHamburgerIcon } from '@altitutor/ui';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { ThemeToggle } from '../theme-toggle';
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
} from '@altitutor/ui';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';
import { useMobileMenu } from '@/shared/contexts/MobileMenuContext';

// Lazy client creation to avoid issues during static generation
function getSupabaseClient() {
  return createClientComponentClient<Database>();
}

export function Navbar() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { resolvedTheme } = useTheme();
  const { toggle: toggleMobileMenu, isOpen: isMobileMenuOpen } = useMobileMenu();
  const [studentRecord, setStudentRecord] = useState<any>(null);

  useEffect(() => {
    const loadStudent = async () => {
      if (!user) return;
      
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('vstudent_profile')
        .select('first_name, last_name')
        .maybeSingle();
      
      setStudentRecord(data);
    };

    loadStudent();
  }, [user]);

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
    if (studentRecord?.first_name && studentRecord?.last_name) {
      return `${studentRecord.first_name.charAt(0)}${studentRecord.last_name.charAt(0)}`.toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  // Get user full name
  const getFullName = () => {
    if (studentRecord?.first_name && studentRecord?.last_name) {
      return `${studentRecord.first_name} ${studentRecord.last_name}`;
    }
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
              <Image 
                src={resolvedTheme === 'dark' ? "/images/logo-banner-dark.svg" : "/images/logo-banner-light.svg"}
                alt="Altitutor Student" 
                width={160} 
                height={36}
                priority
                className="object-contain"
              />
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
                    <User className="mr-2 h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
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
    </nav>
  );
} 