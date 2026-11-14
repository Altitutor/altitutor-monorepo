'use client';
export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col"><div className="min-h-0 flex-1 space-y-6 overflow-auto p-6">
    {children}
  </div></div>;
}
