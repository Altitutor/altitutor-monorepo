'use client';

import { useState } from 'react';
import { ClassesTable } from '@/features/classes';
import { Button } from '@altitutor/ui';
import { Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ClassesPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Class
        </Button>
      </div>
      
      <ClassesTable addModalState={[isAddModalOpen, setIsAddModalOpen]} />
    </div>
  );
}


