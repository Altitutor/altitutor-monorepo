'use client';

import Link from 'next/link';
import { Button } from '@altitutor/ui';
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
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { GlobalSearch } from '../GlobalSearch';

export function Navbar() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { resolvedTheme } = useTheme();
  const { data: staffRecord } = useCurrentStaff();

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
        <div className="flex items-center gap-3 min-w-[220px]">
          <div className="h-12 flex items-center gap-1">
            <Image 
              src={resolvedTheme === 'dark' ? "/images/logo-banner-dark.svg" : "/images/logo-banner-light.svg"}
              alt="Altitutor Admin" 
              width={160} 
              height={36}
              priority
              className="object-contain"
            />
            <span 
              className="text-brand-lightBlue font-normal leading-none"
              style={{ 
                fontFamily: 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif',
                fontSize: '28px',
                letterSpacing: '-0.02em'
              }}
            >
              admin
            </span>
          </div>
        </div>
        <div className="flex-1 flex justify-center">
          <GlobalSearch />
        </div>
        <div className="flex items-center gap-4 min-w-[220px] justify-end">
          <ThemeToggle />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 border-0">
                  <div className="h-8 w-8 rounded-full bg-brand-lightBlue dark:bg-brand-lightBlue flex items-center justify-center text-brand-dark-bg font-medium text-sm">
                    {getInitials()}
                  </div>
                  <span className="hidden sm:inline">{getFullName()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/my-account" className="flex items-center cursor-pointer">
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