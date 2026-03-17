'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { SearchableSelect } from '@altitutor/ui';
import { Search } from 'lucide-react';
import { SkeletonTable } from '@altitutor/ui';
import type { StudentWithStripe } from '../api/stripe-sync';
import { StudentStripeSyncModal } from './StudentStripeSyncModal';

const STRIPE_FILTER_OPTIONS: { value: 'all' | 'present' | 'absent'; label: string }[] = [
  { value: 'all', label: 'All Students' },
  { value: 'present', label: 'Has Stripe Customer' },
  { value: 'absent', label: 'No Stripe Customer' },
];

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
  const [searchTerm, setSearchTerm] = useState('');
  const [stripeFilter, setStripeFilter] = useState<'all' | 'present' | 'absent'>('all');
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

  // Filter students
  const filteredStudents = useMemo(() => {
    let filtered = students || [];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (student) =>
          student.student_name.toLowerCase().includes(searchLower) ||
          student.student_email?.toLowerCase().includes(searchLower)
      );
    }

    // Apply Stripe customer ID filter
    if (stripeFilter === 'present') {
      filtered = filtered.filter((student) => student.stripe_customer_id !== null);
    } else if (stripeFilter === 'absent') {
      filtered = filtered.filter((student) => student.stripe_customer_id === null);
    }

    return filtered;
  }, [students, searchTerm, stripeFilter]);

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
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              className="pl-8"
              value=""
              disabled
            />
          </div>
          
          <SearchableSelect<{ value: 'all' | 'present' | 'absent'; label: string }>
            items={STRIPE_FILTER_OPTIONS}
            value={null}
            onValueChange={() => {}}
            getItemLabel={(i) => i.label}
            getItemId={(i) => i.value}
            placeholder="Filter by Stripe customer"
            disabled
          />
        </div>
        
        <SkeletonTable rows={8} columns={4} />
        
        <div className="text-sm text-muted-foreground">
          Loading students...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <SearchableSelect<{ value: 'all' | 'present' | 'absent'; label: string }>
            items={STRIPE_FILTER_OPTIONS}
            value={STRIPE_FILTER_OPTIONS.find((i) => i.value === stripeFilter) ?? null}
            onValueChange={(item) => item && setStripeFilter(item.value)}
            getItemLabel={(i) => i.label}
            getItemId={(i) => i.value}
            placeholder="Filter by Stripe customer"
            triggerClassName="w-[200px]"
          />
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead>Student Email</TableHead>
                <TableHead>DB Payment Methods</TableHead>
                <TableHead>Stripe Customer ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No students found
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => (
                  <TableRow
                    key={student.student_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(student.student_id)}
                  >
                    <TableCell className="font-medium">
                      {student.student_name}
                    </TableCell>
                    <TableCell>
                      {student.student_email ?? '-'}
                    </TableCell>
                    <TableCell>
                      {student.db_payment_methods.length === 0 ? (
                        <span className="text-muted-foreground text-sm">None</span>
                      ) : (
                        <div className="space-y-1">
                          {student.db_payment_methods.map((pm) => (
                            <div key={pm.id} className="text-sm">
                              •••• {pm.card_last4}
                              {pm.is_default && (
                                <Badge variant="default" className="ml-2 text-xs">Default</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {student.stripe_customer_id ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {student.stripe_customer_id}
                        </code>
                      ) : (
                        <Badge variant="secondary">Not linked</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

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

