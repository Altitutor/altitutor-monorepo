'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { Calendar, Table } from 'lucide-react';
import { ClassesTable, TimetableView, ViewClassModal } from '@/features/classes/components';
import { useStudentClasses } from '@/features/classes/hooks';

type ViewMode = 'table' | 'calendar';

export default function ClassesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const { data: classes } = useStudentClasses();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Classes</h1>
          <p className="text-muted-foreground mt-1">
            View your enrolled classes and sessions
          </p>
        </div>
        
        {/* View Toggle */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <Table className="h-4 w-4 mr-2" />
            Table
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('calendar')}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Calendar
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {viewMode === 'table' ? (
          <ClassesTable onClassClick={(classId) => setSelectedClassId(classId)} />
        ) : (
          <TimetableView 
            classes={classes || []} 
            onClassClick={(classId) => setSelectedClassId(classId)} 
          />
        )}
      </div>

      {/* View Class Modal */}
      <ViewClassModal
        classId={selectedClassId}
        onClose={() => setSelectedClassId(null)}
      />
    </div>
  );
}

