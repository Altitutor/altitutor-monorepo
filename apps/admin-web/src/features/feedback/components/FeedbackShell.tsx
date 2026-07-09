'use client';

import { usePathname, useRouter } from 'next/navigation';
import { SegmentedControl } from '@altitutor/ui';

const NAV = [
  { segment: 'responses', href: '/feedback/responses', label: 'Form responses' },
  { segment: 'reports', href: '/feedback/reports', label: 'Form reports' },
  { segment: 'check-ins', href: '/feedback/check-ins', label: 'Check-ins' },
] as const;

export function FeedbackShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeSegment =
    NAV.find(({ href }) => pathname === href || pathname?.startsWith(`${href}/`))?.segment ??
    NAV[0].segment;

  return (
    <div className="min-w-0 overflow-x-hidden p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
      </div>
      <SegmentedControl
        className="w-full max-w-3xl min-w-0"
        fullWidth
        value={activeSegment}
        onValueChange={(segment) => {
          const item = NAV.find((navItem) => navItem.segment === segment);
          if (item) router.push(item.href);
        }}
        options={NAV.map(({ segment, label }) => ({ value: segment, label }))}
      />
      {children}
    </div>
  );
}
