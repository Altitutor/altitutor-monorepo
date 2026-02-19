'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function DashboardRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/dashboard/${format(new Date(), 'yyyy-MM-dd')}`);
  }, [router]);

  return null;
}
