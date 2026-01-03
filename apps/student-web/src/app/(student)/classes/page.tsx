'use client';

import { ClassesTable } from '@/features/classes/components';
import { StudentSessionsCalendarView } from '@/features/sessions/components';

export default function ClassesPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Classes</h1>
          <p className="text-muted-foreground mt-1">
            View your enrolled classes and sessions
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* Classes Section */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Classes</h2>
          <ClassesTable />
        </div>

        {/* Sessions Section */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Sessions</h2>
          <StudentSessionsCalendarView />
        </div>
      </div>
    </div>
  );
}

