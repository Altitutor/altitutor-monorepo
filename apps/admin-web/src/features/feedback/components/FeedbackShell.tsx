'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, SegmentedControl } from '@altitutor/ui';
import { ClipboardList, FilePenLine } from 'lucide-react';
import { FillFormDialog } from '@/features/forms/components/FillFormDialog';

const NAV = [
  { segment: 'responses', href: '/feedback/responses', label: 'Form responses' },
  { segment: 'reports', href: '/feedback/reports', label: 'Form reports' },
  { segment: 'check-ins', href: '/feedback/check-ins', label: 'Check-ins' },
] as const;

export function FeedbackShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [fillFormOpen, setFillFormOpen] = useState(false);
  const activeSegment =
    NAV.find(({ href }) => pathname === href || pathname?.startsWith(`${href}/`))?.segment ??
    NAV[0].segment;

  return (
    <div className="min-w-0 overflow-x-hidden p-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => router.push('/settings/forms')}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Edit forms
          </Button>
          <Button type="button" onClick={() => setFillFormOpen(true)}>
            <FilePenLine className="mr-2 h-4 w-4" />
            Fill form
          </Button>
        </div>
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
      <FillFormDialog open={fillFormOpen} onClose={() => setFillFormOpen(false)} />
    </div>
  );
}
