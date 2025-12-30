'use client';

import Link from 'next/link';
import { Button } from '@altitutor/ui';

export default function HomePage() {
  return (
    <div className="container py-10">
      <h1 className="text-2xl font-semibold mb-4">Welcome to Altitutor Student</h1>
      <p className="text-muted-foreground mb-6">
        This is a public landing page. You can browse some content without logging in.
      </p>
      <div className="flex flex-col gap-4">
        <div className="flex gap-4">
          <Link href="/login" className="underline">
            Sign in
          </Link>
          <Link href="/forgot-password" className="underline">
            Forgot password?
          </Link>
        </div>
        <div className="mt-4">
          <Link href="/book-trial">
            <Button size="lg">
              Book a Free Trial Session
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}


