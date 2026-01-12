'use client';

import { Suspense, useState } from 'react';
import { AdminShiftsTable, AddAdminShiftModal } from '@/features/admin-shifts';
import { CalendarView } from '@/features/admin-shifts/components/CalendarView';
import { Button, Tabs, TabsList, TabsTrigger } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAdminShiftsWithDetails } from '@/features/admin-shifts/hooks/useAdminShiftsQuery';
import { useClassesWithDetails } from '@/features/classes/hooks/useClassesQuery';
import type { Tables } from '@altitutor/shared';
import { ViewAdminShiftModal } from '@/features/admin-shifts/components/modal';
import { ViewClassModal } from '@/features/classes';

export default function AdminShiftsPage() {
  const search = useSearchParams();
  const router = useRouter();
  const viewParam = search.get('view') || 'table';
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAdminShiftId, setSelectedAdminShiftId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isClassDetailModalOpen, setIsClassDetailModalOpen] = useState(false);
  const [showClasses, setShowClasses] = useState(false);

  const setView = (v: 'table' | 'calendar') => {
    const params = new URLSearchParams(search.toString());
    params.set('view', v);
    router.push(`/admin-shifts?${params.toString()}`);
  };

  const { data: adminShiftsData, refetch: refetchAdminShifts } = useAdminShiftsWithDetails();
  const { data: classesData, refetch: refetchClasses } = useClassesWithDetails();
  
  const adminShifts: Tables<'admin_shifts'>[] = (adminShiftsData?.adminShifts as Tables<'admin_shifts'>[]) || [];
  const adminShiftStaff: Record<string, Tables<'staff'>[]> = (adminShiftsData?.adminShiftStaff as Record<string, Tables<'staff'>[]>) || {};
  
  const classes: Tables<'classes'>[] = (classesData?.classes as Tables<'classes'>[]) || [];
  const classSubjects: Record<string, Tables<'subjects'>> = (classesData?.classSubjects as Record<string, Tables<'subjects'>>) || {};
  const classStudents: Record<string, Tables<'students'>[]> = (classesData?.classStudents as Record<string, Tables<'students'>[]>) || {};
  const classStaff: Record<string, Tables<'staff'>[]> = (classesData?.classStaff as Record<string, Tables<'staff'>[]>) || {};

  const handleAdminShiftClick = (shift: Tables<'admin_shifts'>) => {
    setSelectedAdminShiftId(shift.id);
    setIsDetailModalOpen(true);
  };

  const handleClassClick = (cls: Tables<'classes'>) => {
    setSelectedClassId(cls.id);
    setIsClassDetailModalOpen(true);
  };

  const handleAdminShiftUpdated = () => {
    refetchAdminShifts();
  };

  const handleClassUpdated = () => {
    refetchClasses();
  };
  
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Admin Shifts</h1>
        <div className="flex items-center gap-4">
          <Tabs value={viewParam} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Admin Shift
          </Button>
        </div>
      </div>

      <Suspense>
        {viewParam === 'table' ? (
          <AdminShiftsTable 
            addModalState={[isAddModalOpen, setIsAddModalOpen]}
            viewMode="table"
          />
        ) : (
          <CalendarView
            adminShifts={adminShifts}
            adminShiftStaff={adminShiftStaff}
            onAdminShiftClick={handleAdminShiftClick}
            classes={classes}
            classSubjects={classSubjects}
            classStudents={classStudents}
            classStaff={classStaff}
            onClassClick={handleClassClick}
            showClasses={showClasses}
            onShowClassesChange={setShowClasses}
          />
        )}
      </Suspense>

      {/* Add Admin Shift Modal */}
      <AddAdminShiftModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAdminShiftAdded={() => {
          refetchAdminShifts();
        }}
      />

      {/* Admin Shift Detail Modal */}
      {selectedAdminShiftId && (
        <ViewAdminShiftModal 
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedAdminShiftId(null);
          }}
          adminShiftId={selectedAdminShiftId}
          onAdminShiftUpdated={handleAdminShiftUpdated}
        />
      )}

      {/* Class Detail Modal for Calendar View */}
      {selectedClassId && (
        <ViewClassModal 
          isOpen={isClassDetailModalOpen}
          onClose={() => {
            setIsClassDetailModalOpen(false);
            setSelectedClassId(null);
          }}
          classId={selectedClassId}
          onClassUpdated={handleClassUpdated}
        />
      )}
    </div>
  );
}
