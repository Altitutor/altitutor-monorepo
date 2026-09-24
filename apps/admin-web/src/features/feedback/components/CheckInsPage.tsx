'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { SegmentedControl, SkeletonTable } from '@altitutor/ui';
import { useFamilyCheckInsData } from '@/features/reconciliation/api/queries';
import { FamilyCheckInsTable } from '@/features/reconciliation/components/FamilyCheckInsTable';

const CHECK_IN_TABS = ['staff', 'students', 'parents'] as const;
type CheckInTab = (typeof CHECK_IN_TABS)[number];

const TAB_OPTIONS = [
  { value: 'staff', label: 'Staff' },
  { value: 'students', label: 'Students' },
  { value: 'parents', label: 'Parents' },
] satisfies Array<{ value: CheckInTab; label: string }>;

function isCheckInTab(value: string | null): value is CheckInTab {
  return CHECK_IN_TABS.includes(value as CheckInTab);
}

function CheckInsSkeleton() {
  return (
    <div className="space-y-6 mt-6" aria-busy="true">
      <SkeletonTable rows={4} columns={4} />
    </div>
  );
}

export function CheckInsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = useFamilyCheckInsData();
  const tabParam = searchParams.get('tab');
  const activeTab: CheckInTab = isCheckInTab(tabParam) ? tabParam : 'staff';

  function handleTabChange(value: string) {
    const nextTab = isCheckInTab(value) ? value : 'staff';
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === 'staff') params.delete('tab');
    else params.set('tab', nextTab);
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  const payload = query.data;
  const options = TAB_OPTIONS.map((option) => {
    if (!payload) return option;
    const count =
      option.value === 'staff'
        ? payload.staff.length
        : option.value === 'students'
          ? payload.students.length
          : payload.parents.length;
    return { ...option, label: `${option.label} (${count})` };
  });

  return (
    <div className="space-y-6">
      <SegmentedControl
        className="w-full max-w-2xl min-w-0"
        fullWidth
        value={activeTab}
        onValueChange={handleTabChange}
        options={options}
      />

      {query.isLoading ? <CheckInsSkeleton /> : null}

      {query.isError ? (
        <div className="mt-6 rounded-md border border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Error loading check-in data. Please try again.</p>
          </div>
        </div>
      ) : null}

      {query.isSuccess && activeTab === 'staff' ? (
        <FamilyCheckInsTable title="Staff check-ins" entity="staff" items={payload?.staff ?? []} />
      ) : null}

      {query.isSuccess && activeTab === 'students' ? (
        <FamilyCheckInsTable title="Student check-ins" entity="student" items={payload?.students ?? []} />
      ) : null}

      {query.isSuccess && activeTab === 'parents' ? (
        <FamilyCheckInsTable title="Parent check-ins" entity="parent" items={payload?.parents ?? []} />
      ) : null}
    </div>
  );
}
