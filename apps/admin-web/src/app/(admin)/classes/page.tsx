'use client';

import { Suspense, useState } from 'react';
import { ClassesTable, ViewClassModal, AddClassModal } from '@/features/classes';
import { CalendarView } from '@/features/classes/components/CalendarView';
import { Button, Tabs, TabsList, TabsTrigger } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useClassesWithDetails } from '@/features/classes/hooks/useClassesQuery';
import { useAdminShiftsWithDetails } from '@/features/admin-shifts/hooks/useAdminShiftsQuery';
import type { Tables } from '@altitutor/shared';
import { ViewAdminShiftModal } from '@/features/admin-shifts/components/modal';

export default function ClassesPage() {
  const search = useSearchParams();
  const router = useRouter();
  const viewParam = search.get('view') || 'table';
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedAdminShiftId, setSelectedAdminShiftId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAdminShiftDetailModalOpen, setIsAdminShiftDetailModalOpen] = useState(false);
  const [showAdminShifts, setShowAdminShifts] = useState(false);

  const setView = (v: 'table' | 'calendar') => {
    const params = new URLSearchParams(search.toString());
    params.set('view', v);
    router.push(`/classes?${params.toString()}`);
  };

  const { data, refetch } = useClassesWithDetails();
  const { data: adminShiftsData, refetch: refetchAdminShifts } = useAdminShiftsWithDetails();
  
  const classes: Tables<'classes'>[] = (data?.classes as Tables<'classes'>[]) || [];
  const classSubjects: Record<string, Tables<'subjects'>> = (data?.classSubjects as Record<string, Tables<'subjects'>>) || {};
  const classStudents: Record<string, Tables<'students'>[]> = (data?.classStudents as Record<string, Tables<'students'>[]>) || {};
  const classStaff: Record<string, Tables<'staff'>[]> = (data?.classStaff as Record<string, Tables<'staff'>[]>) || {};
  
  const adminShifts: Tables<'admin_shifts'>[] = (adminShiftsData?.adminShifts as Tables<'admin_shifts'>[]) || [];
  const adminShiftStaff: Record<string, Tables<'staff'>[]> = (adminShiftsData?.adminShiftStaff as Record<string, Tables<'staff'>[]>) || {};

  const handleClassClick = (cls: Tables<'classes'>) => {
    setSelectedClassId(cls.id);
    setIsDetailModalOpen(true);
  };

  const handleAdminShiftClick = (shift: Tables<'admin_shifts'>) => {
    setSelectedAdminShiftId(shift.id);
    setIsAdminShiftDetailModalOpen(true);
  };

  const handleClassUpdated = () => {
    refetch();
  };

  const handleAdminShiftUpdated = () => {
    refetchAdminShifts();
  };
  
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
        <div className="flex items-center gap-4">
          <Tabs value={viewParam} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Class
          </Button>
        </div>
      </div>

      <Suspense>
        {viewParam === 'table' ? (
          <ClassesTable 
            addModalState={[isAddModalOpen, setIsAddModalOpen]}
            viewMode="table"
          />
        ) : (
          <CalendarView
            classes={classes}
            classSubjects={classSubjects}
            classStudents={classStudents}
            classStaff={classStaff}
            onClassClick={handleClassClick}
            adminShifts={adminShifts}
            adminShiftStaff={adminShiftStaff}
            onAdminShiftClick={handleAdminShiftClick}
            showAdminShifts={showAdminShifts}
            onShowAdminShiftsChange={setShowAdminShifts}
          />
        )}
      </Suspense>

      {/* Add Class Modal */}
      <AddClassModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onClassAdded={() => {
          refetch();
        }}
      />

      {/* Class Detail Modal for Calendar View */}
      {selectedClassId && (
        <ViewClassModal 
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedClassId(null);
          }}
          classId={selectedClassId}
          onClassUpdated={handleClassUpdated}
        />
      )}

      {/* Admin Shift Detail Modal for Calendar View */}
      {selectedAdminShiftId && (
        <ViewAdminShiftModal 
          isOpen={isAdminShiftDetailModalOpen}
          onClose={() => {
            setIsAdminShiftDetailModalOpen(false);
            setSelectedAdminShiftId(null);
          }}
          adminShiftId={selectedAdminShiftId}
          onAdminShiftUpdated={handleAdminShiftUpdated}
        />
      )}
    </div>
  );
}


