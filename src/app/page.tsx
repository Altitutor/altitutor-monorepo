'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth/store';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null; // Don't render anything while redirecting
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold">Welcome to Altitutor Admin</h1>
        <p className="text-muted-foreground">
          Manage your tutoring operations efficiently
        </p>
      </div>
    </div>
  );
} 