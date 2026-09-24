'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@altitutor/ui';
import { SkeletonTable } from '@altitutor/ui';
import type { StudentWithStripe } from '../api/stripe-sync';
import { StudentStripeSyncModal } from './StudentStripeSyncModal';
import { SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';

interface StripeSyncTableProps {
  students: StudentWithStripe[];
  isLoading?: boolean;
  isFetching?: boolean;
  onRefresh: () => void;
  initialStudentId?: string | null;
}

export function StripeSyncTable({
  students,
  isLoading,
  onRefresh,
  initialStudentId,
}: StripeSyncTableProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Open modal for initial student ID if provided
  useEffect(() => {
    if (initialStudentId && !isLoading && students.length > 0) {
      // Check if student exists in the list
      const studentExists = students.some(s => s.student_id === initialStudentId);
      if (studentExists) {
        setSelectedStudentId(initialStudentId);
        setIsModalOpen(true);
      }
    }
  }, [initialStudentId, isLoading, students]);

  const handleRowClick = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsModalOpen(true);
  };

  const handleCloseModal = (shouldRefresh: boolean = false) => {
    setIsModalOpen(false);
    setSelectedStudentId(null);
    if (shouldRefresh) {
      onRefresh();
    }
  };

  // Loading state
  if (isLoading && students.length === 0) {
    return (
      <div className="space-y-4">
        <SkeletonTable rows={8} columns={4} />
        
        <div className="text-sm text-muted-foreground">
          Loading students...
        </div>
      </div>
    );
  }

  const columns: SettingsDataTableColumn<StudentWithStripe>[] = [
    {
      key: 'student_name',
      label: 'Student Name',
      render: (student) => <span className="font-medium">{student.student_name}</span>,
      sortValue: (student) => student.student_name,
      searchValue: (student) => student.student_name,
    },
    {
      key: 'student_email',
      label: 'Student Email',
      render: (student) => student.student_email ?? '-',
      sortValue: (student) => student.student_email ?? '',
      searchValue: (student) => student.student_email ?? '',
    },
    {
      key: 'payment_methods',
      label: 'DB Payment Methods',
      render: (student) =>
        student.db_payment_methods.length === 0 ? (
          <span className="text-muted-foreground text-sm">None</span>
        ) : (
          <div className="space-y-1">
            {student.db_payment_methods.map((pm) => (
              <div key={pm.id} className="text-sm">
                **** {pm.card_last4}
                {pm.is_default && (
                  <Badge variant="default" className="ml-2 text-xs">Default</Badge>
                )}
              </div>
            ))}
          </div>
        ),
      sortValue: (student) => student.db_payment_methods.length,
      searchValue: (student) => student.db_payment_methods.map((pm) => pm.card_last4).join(' '),
    },
    {
      key: 'stripe_customer',
      label: 'Stripe Customer ID',
      render: (student) =>
        student.stripe_customer_id ? (
          <code className="text-xs bg-muted px-2 py-1 rounded">
            {student.stripe_customer_id}
          </code>
        ) : (
          <Badge variant="secondary">Not linked</Badge>
        ),
      sortValue: (student) => student.stripe_customer_id ?? '',
      filterValue: (student) => student.stripe_customer_id ? 'present' : 'absent',
      searchValue: (student) => student.stripe_customer_id ?? '',
    },
  ];

  return (
    <>
      <SettingsDataTable
        data={students}
        columns={columns}
        getRowId={(student) => student.student_id}
        emptyMessage="No students found"
        searchPlaceholder="Search by name or email..."
        filterKeys={['stripe_customer']}
        filterDefinitions={[
          {
            key: 'stripe_customer',
            label: 'Stripe Customer',
            options: [
              { label: 'Has Stripe Customer', value: 'present' },
              { label: 'No Stripe Customer', value: 'absent' },
            ],
          },
        ]}
        defaultSort={{ field: 'student_name', direction: 'asc' }}
        isLoading={isLoading}
        getActions={(student) => [
          {
            id: 'view',
            label: 'View',
            onSelect: () => handleRowClick(student.student_id),
          },
        ]}
      />

      {selectedStudentId && (
        <StudentStripeSyncModal
          isOpen={isModalOpen}
          onClose={(shouldRefresh) => handleCloseModal(shouldRefresh)}
          studentId={selectedStudentId}
          allStudents={students.map(s => ({
            student_id: s.student_id,
            student_name: s.student_name,
            stripe_customer_id: s.stripe_customer_id,
          }))}
        />
      )}
    </>
  );
}
