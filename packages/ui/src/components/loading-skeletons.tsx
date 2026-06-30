import { Skeleton } from './skeleton';
import { SkeletonTable } from './skeleton-table';

function LoadingStatus({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function SkeletonListRows({
  rows = 5,
  showSubtitle = true,
}: {
  rows?: number;
  showSubtitle?: boolean;
}) {
  return (
    <LoadingStatus label="Loading list">
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              {showSubtitle ? <Skeleton className="h-3 w-56 max-w-full" /> : null}
            </div>
          </div>
        ))}
      </div>
    </LoadingStatus>
  );
}

export function SkeletonFormFields({
  fields = 4,
  columns = 2,
}: {
  fields?: number;
  columns?: 1 | 2;
}) {
  return (
    <LoadingStatus label="Loading form">
      <div className={`grid grid-cols-1 gap-4 ${columns === 2 ? 'md:grid-cols-2' : ''}`}>
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
      </div>
    </LoadingStatus>
  );
}

export function SkeletonPageHeader({ showBack = false }: { showBack?: boolean }) {
  return (
    <LoadingStatus label="Loading page">
      <div className="space-y-4">
        {showBack ? <Skeleton className="h-9 w-28 rounded-xl" /> : null}
        <div className="space-y-2">
          <Skeleton className="h-9 w-48 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>
    </LoadingStatus>
  );
}

export function SkeletonAuthCard() {
  return (
    <LoadingStatus label="Loading">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8">
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-8 w-48" />
          <Skeleton className="mx-auto h-4 w-64 max-w-full" />
        </div>
        <SkeletonFormFields fields={3} columns={1} />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </LoadingStatus>
  );
}

export function SkeletonSegmentedTabs() {
  return <Skeleton className="h-10 w-full max-w-md rounded-lg" />;
}

export function SkeletonTimeSlotGrid() {
  return (
    <LoadingStatus label="Loading time slots">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-9 w-32 shrink-0 rounded-md" />
          <Skeleton className="h-5 w-40 shrink-0" />
          <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, day) => (
            <div key={day} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </LoadingStatus>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <LoadingStatus label="Loading">
      <div className="space-y-4 rounded-xl border p-6">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </LoadingStatus>
  );
}

export function SkeletonMediaPreview() {
  return (
    <LoadingStatus label="Loading preview">
      <Skeleton className="h-[70vh] w-full rounded-md" />
    </LoadingStatus>
  );
}

export function SkeletonInviteUrl() {
  return (
    <LoadingStatus label="Generating invite link">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
    </LoadingStatus>
  );
}

export function SkeletonPaymentMethodCard() {
  return (
    <LoadingStatus label="Loading payment methods">
      <div className="space-y-3 rounded-xl border p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-14 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
    </LoadingStatus>
  );
}

export function SkeletonStripeCardForm() {
  return (
    <LoadingStatus label="Loading payment form">
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </LoadingStatus>
  );
}

export function SkeletonPolicyContent({ lines = 8 }: { lines?: number }) {
  return (
    <LoadingStatus label="Loading policy">
      <div className="space-y-3 py-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </LoadingStatus>
  );
}

export function SkeletonRegistrationFlow() {
  return (
    <LoadingStatus label="Loading registration form">
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <SkeletonFormFields fields={6} columns={2} />
        <div className="flex justify-end gap-3">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
      </div>
    </LoadingStatus>
  );
}

export function SkeletonSheetDetail() {
  return (
    <LoadingStatus label="Loading details">
      <div className="space-y-6">
        <SkeletonSegmentedTabs />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </div>
    </LoadingStatus>
  );
}

export { SkeletonTable };
