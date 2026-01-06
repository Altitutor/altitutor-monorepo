'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Search, CreditCard } from 'lucide-react';
import { SkeletonTable } from '@altitutor/ui';
import type { StudentWithStripe } from '../api/stripe-sync';
import { StudentStripeSyncModal } from './StudentStripeSyncModal';

interface StripeSyncTableProps {
  students: StudentWithStripe[];
  stripeCustomers: Array<{
    id: string;
    email: string | null;
    name: string | null;
    default_payment_method_id?: string | null;
    payment_methods: Array<{ 
      id: string; 
      is_default: boolean;
      card: { last4: string; brand: string } | null 
    }>;
  }>;
  isLoading?: boolean;
  isFetching?: boolean;
  onRefresh: () => void;
}

export function StripeSyncTable({
  students,
  stripeCustomers,
  isLoading,
  isFetching,
  onRefresh,
}: StripeSyncTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [stripeFilter, setStripeFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Create a map of stripe customer IDs to customer data for quick lookup
  const stripeCustomerMap = useMemo(() => {
    const map = new Map<string, typeof stripeCustomers[0]>();
    stripeCustomers.forEach((customer) => {
      map.set(customer.id, customer);
    });
    return map;
  }, [stripeCustomers]);

  // Helper function to check if strings match (case-insensitive, trimmed)
  // Both blank/null counts as a match
  const stringsMatch = (a: string | null | undefined, b: string | null | undefined): boolean => {
    const aTrimmed = a?.trim() || '';
    const bTrimmed = b?.trim() || '';
    // Both empty counts as match
    if (!aTrimmed && !bTrimmed) return true;
    // If one is empty and other isn't, no match
    if (!aTrimmed || !bTrimmed) return false;
    return aTrimmed.toLowerCase() === bTrimmed.toLowerCase();
  };

  // Helper function to check if payment methods match (including default)
  const paymentMethodsMatch = (
    dbMethods: Array<{ card_last4: string; is_default: boolean }>,
    stripeMethods: Array<{ last4: string; is_default: boolean }>
  ): boolean => {
    const dbLast4s = dbMethods
      .map(m => m.card_last4?.trim())
      .filter((last4): last4 is string => !!last4)
      .sort();
    const stripeLast4s = stripeMethods
      .map(m => m.last4?.trim())
      .filter((last4): last4 is string => !!last4)
      .sort();
    
    // Both empty counts as match
    if (dbLast4s.length === 0 && stripeLast4s.length === 0) return true;
    // Different lengths means no match
    if (dbLast4s.length !== stripeLast4s.length) return false;
    // Payment methods must match
    if (JSON.stringify(dbLast4s) !== JSON.stringify(stripeLast4s)) return false;
    
    // Check that default payment methods match
    const dbDefault = dbMethods.find(m => m.is_default)?.card_last4?.trim();
    const stripeDefault = stripeMethods.find(m => m.is_default)?.last4?.trim();
    
    // Both have no default (or both empty) counts as match
    if (!dbDefault && !stripeDefault) return true;
    // One has default and other doesn't - no match
    if (!dbDefault || !stripeDefault) return false;
    // Defaults must match
    return dbDefault === stripeDefault;
  };

  // Enrich students with Stripe customer data and match indicators
  const enrichedStudents = useMemo(() => {
    if (!students || students.length === 0) return [];
    
    return students.map((student) => {
      const stripeCustomer = student.stripe_customer_id
        ? stripeCustomerMap.get(student.stripe_customer_id)
        : null;

      // Get Stripe payment methods for this customer
      const stripePaymentMethods = stripeCustomer?.payment_methods || [];

      // Check matches - only if stripe customer exists
      const nameMatch = stripeCustomer 
        ? stringsMatch(student.student_name, stripeCustomer?.name || null)
        : false;
      const emailMatch = stripeCustomer
        ? stringsMatch(student.student_email, stripeCustomer?.email || null)
        : false;
      const paymentMethodsMatchResult = stripeCustomer
        ? paymentMethodsMatch(
            student.db_payment_methods,
            stripePaymentMethods.map(pm => ({ 
              last4: pm.card?.last4 || '', 
              is_default: pm.is_default || false 
            }))
          )
        : false;

      return {
        ...student,
        stripe_customer_name: stripeCustomer?.name ?? null,
        stripe_customer_email: stripeCustomer?.email ?? null,
        stripe_payment_methods: stripePaymentMethods.map((pm) => ({
          last4: pm.card?.last4 || 'N/A',
          is_default: pm.is_default || false,
        })),
        matches: {
          name: nameMatch,
          email: emailMatch,
          paymentMethods: paymentMethodsMatchResult,
        },
      };
    });
  }, [students, stripeCustomerMap]);

  // Filter students
  const filteredStudents = useMemo(() => {
    let filtered = enrichedStudents;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (student) =>
          student.student_name.toLowerCase().includes(searchLower) ||
          student.student_email?.toLowerCase().includes(searchLower) ||
          student.stripe_customer_email?.toLowerCase().includes(searchLower) ||
          student.stripe_customer_name?.toLowerCase().includes(searchLower)
      );
    }

    // Apply Stripe customer ID filter
    if (stripeFilter === 'present') {
      filtered = filtered.filter((student) => student.stripe_customer_id !== null);
    } else if (stripeFilter === 'absent') {
      filtered = filtered.filter((student) => student.stripe_customer_id === null);
    }

    return filtered;
  }, [enrichedStudents, searchTerm, stripeFilter]);

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
          
          <Select disabled>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by Stripe customer" />
            </SelectTrigger>
          </Select>
        </div>
        
        <SkeletonTable rows={8} columns={7} />
        
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
          
          <Select value={stripeFilter} onValueChange={(value: 'all' | 'present' | 'absent') => setStripeFilter(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by Stripe customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              <SelectItem value="present">Has Stripe Customer</SelectItem>
              <SelectItem value="absent">No Stripe Customer</SelectItem>
            </SelectContent>
          </Select>
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
                <TableHead>Stripe Name</TableHead>
                <TableHead>Stripe Email</TableHead>
                <TableHead>Stripe Payment Methods</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
                    <TableCell className={`font-medium ${student.matches?.name ? 'bg-green-50 dark:bg-green-950/20' : student.stripe_customer_id && !student.matches?.name ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                      {student.student_name}
                    </TableCell>
                    <TableCell className={student.matches?.email ? 'bg-green-50 dark:bg-green-950/20' : student.stripe_customer_id && !student.matches?.email ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      {student.student_email ?? '-'}
                    </TableCell>
                    <TableCell className={student.stripe_customer_id ? (student.matches?.paymentMethods ? 'bg-green-50 dark:bg-green-950/20' : !student.matches?.paymentMethods ? 'bg-red-50 dark:bg-red-950/20' : '') : undefined}>
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
                    <TableCell className={student.matches?.name ? 'bg-green-50 dark:bg-green-950/20' : student.stripe_customer_id && !student.matches?.name ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      {(student.stripe_customer_name ?? '-') as string}
                    </TableCell>
                    <TableCell className={student.matches?.email ? 'bg-green-50 dark:bg-green-950/20' : student.stripe_customer_id && !student.matches?.email ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      {(student.stripe_customer_email ?? '-') as string}
                    </TableCell>
                    <TableCell className={student.stripe_customer_id ? (student.matches?.paymentMethods ? 'bg-green-50 dark:bg-green-950/20' : !student.matches?.paymentMethods ? 'bg-red-50 dark:bg-red-950/20' : '') : ''}>
                      {student.stripe_payment_methods.length === 0 ? (
                        <span className="text-muted-foreground text-sm">None</span>
                      ) : (
                        <div className="space-y-1">
                          {student.stripe_payment_methods.map((pm, idx) => (
                            <div key={idx} className="text-sm">
                              •••• {pm.last4}
                              {pm.is_default && (
                                <Badge variant="default" className="ml-2 text-xs">Default</Badge>
                              )}
                            </div>
                          ))}
                        </div>
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
          stripeCustomers={stripeCustomers.map(c => ({
            id: c.id,
            email: c.email,
            name: c.name,
            created: Date.now() / 1000, // Use current timestamp as fallback
            metadata: {},
            payment_methods: c.payment_methods.map(pm => ({
              id: pm.id,
              type: 'card',
              is_default: pm.is_default,
              card: pm.card ? {
                brand: pm.card.brand,
                last4: pm.card.last4,
                exp_month: 1,
                exp_year: new Date().getFullYear() + 5,
                country: null,
              } : null,
            })),
          }))}
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

