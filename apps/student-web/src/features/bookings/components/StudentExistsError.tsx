'use client';

import { Button } from '@altitutor/ui';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function StudentExistsError() {
  const router = useRouter();
  
  return (
    <div className="space-y-4 text-center py-8">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Already a Student?</h3>
        <p className="text-sm text-muted-foreground">
          It looks like you may already be a current student. Please log in to book a session.
        </p>
      </div>
      <div className="flex gap-3 justify-center">
        <Button onClick={() => router.push('/login')}>
          Log In
        </Button>
        <Button variant="outline" asChild>
          <Link href="https://altitutor.com/contact-us" target="_blank">
            Contact Us
          </Link>
        </Button>
      </div>
    </div>
  );
}

