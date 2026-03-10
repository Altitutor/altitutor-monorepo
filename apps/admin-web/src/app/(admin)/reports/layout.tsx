'use client';

import { ReportsProvider } from '@/features/reports/context/ReportsContext';
import { ReportsLayoutContent } from '@/features/reports/components/ReportsLayoutContent';

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ReportsProvider>
      <div className="p-6">
        <ReportsLayoutContent>{children}</ReportsLayoutContent>
      </div>
    </ReportsProvider>
  );
}
