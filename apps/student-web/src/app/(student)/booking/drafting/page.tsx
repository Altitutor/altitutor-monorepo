'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BookDraftingPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to classes page where the booking modal is available
    router.replace('/classes');
  }, [router]);

  return null;
}
