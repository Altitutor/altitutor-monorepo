'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/auth/store';
import { ThemeToggle } from '@/components/theme-toggle';
import Image from 'next/image';
import { AuthStore } from '@/lib/auth/types';
import { useTheme } from 'next-themes';

export function Navbar() {
  const router = useRouter();
  const { logout } = useAuthStore() as AuthStore;
  const { resolvedTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await authApi.logout();
      logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background dark:bg-brand-dark-bg border-b dark:border-brand-dark-border h-[var(--navbar-height)]">
      <div className="container mx-auto px-4 h-full flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="h-12 flex items-center">
            <Image 
              src={resolvedTheme === 'dark' ? "/images/logo-banner-dark.svg" : "/images/logo-banner-light.svg"}
              alt="Altitutor Admin" 
              width={160} 
              height={36}
              priority
              className="object-contain"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="border-brand-lightBlue hover:bg-brand-lightBlue/10 text-brand-darkBlue dark:border-brand-dark-border dark:text-white dark:hover:bg-brand-dark-card/70 dark:hover:text-white"
          >
            Logout
          </Button>
        </div>
      </div>
    </nav>
  );
} 