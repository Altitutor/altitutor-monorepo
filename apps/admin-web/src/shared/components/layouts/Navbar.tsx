'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@altitutor/ui';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { ThemeToggle } from '../theme-toggle';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { LogOut, User, Calendar } from 'lucide-react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { format, isValid, parseISO } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { GlobalSearch } from '../GlobalSearch';

// Get today's date in local timezone (YYYY-MM-DD format)
const getTodayLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Validate date string format (YYYY-MM-DD)
const isValidDateString = (dateString: string | null): boolean => {
  if (!dateString) return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  try {
    const date = parseISO(dateString);
    return isValid(date);
  } catch {
    return false;
  }
};

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, signOut } = useAuthStore();
  const { resolvedTheme } = useTheme();
  const { data: staffRecord } = useCurrentStaff();
  
  // Initialize date from URL if on sessions page, otherwise use today
  const getInitialDate = (): string => {
    if (pathname === '/sessions') {
      const dateParam = searchParams.get('date');
      if (isValidDateString(dateParam) && dateParam) {
        return dateParam;
      }
    }
    return getTodayLocalDate();
  };
  
  const [selectedDate, setSelectedDate] = useState<string>(getInitialDate());
  const dateInputRefDesktop = useRef<HTMLInputElement>(null);
  const dateInputRefMobile = useRef<HTMLInputElement>(null);

  // Sync date with URL when on sessions page
  useEffect(() => {
    if (pathname === '/sessions') {
      const dateParam = searchParams.get('date');
      if (isValidDateString(dateParam) && dateParam && dateParam !== selectedDate) {
        setSelectedDate(dateParam);
      } else if (!dateParam) {
        // If no date param, reset to today
        const today = getTodayLocalDate();
        if (selectedDate !== today) {
          setSelectedDate(today);
        }
      }
    }
  }, [pathname, searchParams, selectedDate]);

  // Close date picker on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (dateInputRefDesktop.current && document.activeElement === dateInputRefDesktop.current) {
        dateInputRefDesktop.current.blur();
      }
      if (dateInputRefMobile.current && document.activeElement === dateInputRefMobile.current) {
        dateInputRefMobile.current.blur();
      }
    };

    document.addEventListener('scroll', handleScroll, true);
    
    return () => {
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

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

  // Format date for display
  const formatDateDisplay = (dateString: string): string => {
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return format(new Date(), 'MMM d, yyyy');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateToCheck = new Date(date);
      dateToCheck.setHours(0, 0, 0, 0);
      
      if (dateToCheck.getTime() === today.getTime()) {
        return `Today, ${format(date, 'MMM d')}`;
      }
      return format(date, 'MMM d, yyyy');
    } catch {
      return format(new Date(), 'MMM d, yyyy');
    }
  };

  // Handle date change
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (!newDate) return;
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newDate)) return;
    
    setSelectedDate(newDate);
    
    // Navigate to sessions page with date filter
    router.push(`/sessions?view=table&date=${newDate}`);
  };

  // Handle button click to open date picker (desktop)
  const handleDateButtonClickDesktop = () => {
    const input = dateInputRefDesktop.current;
    if (!input) return;
    
    // Try showPicker() if available (modern browsers)
    if ('showPicker' in input && typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch {
        // Fallback if showPicker throws synchronously
        input.click();
      }
      } else {
        // Fallback: trigger click
      input.click();
    }
  };

  // Handle button click to open date picker (mobile)
  const handleDateButtonClickMobile = () => {
    const input = dateInputRefMobile.current;
    if (!input) return;
    
    // Try showPicker() if available (modern browsers)
    if ('showPicker' in input && typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch {
        // Fallback if showPicker throws synchronously
        input.click();
      }
      } else {
        // Fallback: trigger click
      input.click();
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background dark:bg-brand-dark-bg border-b dark:border-brand-dark-border h-[var(--navbar-height)]">
      <div className="container mx-auto px-4 h-full flex items-center gap-4">
        <div className="flex items-center gap-3 min-w-[220px]">
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
        <div className="flex-1 flex justify-center">
          <GlobalSearch />
        </div>
        <div className="flex items-center gap-4 min-w-[220px] justify-end">
          {/* Date Picker */}
          {user && (
            <>
              <div className="hidden md:flex items-center gap-2">
                <div className="relative">
                  <input
                    ref={dateInputRefDesktop}
                    type="date"
                    value={selectedDate}
                    onChange={handleDateChange}
                    className="sr-only"
                    aria-label="Select date"
                    id="date-picker-desktop"
                  />
                  <Button
                    variant="outline"
                    className="h-9 px-3 text-sm font-normal cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDateButtonClickDesktop();
                    }}
                    type="button"
                    data-date-picker-button
                  >
                    {formatDateDisplay(selectedDate)}
                  </Button>
                </div>
              </div>
              {/* Mobile date picker - icon only */}
              <div className="md:hidden">
                <div className="relative">
                  <input
                    ref={dateInputRefMobile}
                    type="date"
                    value={selectedDate}
                    onChange={handleDateChange}
                    className="sr-only"
                    aria-label="Select date"
                    id="date-picker-mobile"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDateButtonClickMobile();
                    }}
                    title="Select date"
                    type="button"
                    data-date-picker-button
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
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