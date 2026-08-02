import { OnlineStudentsTable } from '@/features/students/components/OnlineStudentsTable';

export default function OnlineStudentsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Online Students</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage Product app relationships, entitlements, subscriptions, and shared Student details.
        </p>
      </div>
      <OnlineStudentsTable />
    </div>
  );
}
