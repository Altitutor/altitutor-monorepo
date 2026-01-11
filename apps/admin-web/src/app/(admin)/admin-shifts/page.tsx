'use client';

import { Suspense, useState } from 'react';
import { AdminShiftsTable, AddAdminShiftModal } from '@/features/admin-shifts';
import { Button } from '@altitutor/ui';
import { Plus } from 'lucide-react';

export default function AdminShiftsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Admin Shifts</h1>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Admin Shift
        </Button>
      </div>

      <Suspense>
        <AdminShiftsTable 
          addModalState={[isAddModalOpen, setIsAddModalOpen]}
          viewMode="table"
        />
      </Suspense>

      {/* Add Admin Shift Modal */}
      <AddAdminShiftModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAdminShiftAdded={() => {
          // Refetch handled by AdminShiftsTable
        }}
      />
    </div>
  );
}
