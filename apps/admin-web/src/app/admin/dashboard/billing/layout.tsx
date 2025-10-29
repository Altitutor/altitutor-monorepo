'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/utils/index';

const tabs = [
  { label: 'Payments', href: '/admin/dashboard/billing/payments' },
  { label: 'Pricing', href: '/admin/dashboard/billing/pricing' },
];

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="px-6 py-3">
          <h1 className="text-2xl font-bold mb-2">Billing</h1>
          <div className="flex gap-4">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  pathname === tab.href
                    ? 'bg-brand-darkBlue text-white'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}


