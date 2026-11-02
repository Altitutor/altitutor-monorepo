"use client";
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { ClipboardList, FilePenLine } from 'lucide-react';
import { FillFormDialog } from '@/features/forms/components/FillFormDialog';
import { AdminPageActions } from '@/shared/components/AdminPageActions';

export function FeedbackShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [fillFormOpen, setFillFormOpen] = useState(false);
  return <div className="min-w-0 p-6 space-y-6">
    <AdminPageActions>
      <Button variant="outline" onClick={() => router.push('/settings/forms')}><ClipboardList />Edit forms</Button>
      <Button onClick={() => setFillFormOpen(true)}><FilePenLine />Fill form</Button>
    </AdminPageActions>
    {children}
    <FillFormDialog open={fillFormOpen} onClose={() => setFillFormOpen(false)} />
  </div>;
}
