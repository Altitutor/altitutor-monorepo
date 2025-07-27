'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
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