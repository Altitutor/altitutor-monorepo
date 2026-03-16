'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { BillingPolicyEditor } from '@/features/policies/components/BillingPolicyEditor';

export default function PoliciesPage() {
  const router = useRouter();

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/settings')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Policies
          </h1>
          <p className="text-muted-foreground">
            Configure policy documents shown to students during registration
          </p>
        </div>
      </div>

      <BillingPolicyEditor />
    </div>
  );
}
