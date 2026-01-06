'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { useToast } from '@altitutor/ui';
import { Loader2, Search, CreditCard, X, Check } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@altitutor/ui';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripeSyncApi, type StripeCustomer } from '../api/stripe-sync';

interface StudentStripeSyncModalProps {
  isOpen: boolean;
  onClose: (shouldRefresh?: boolean) => void;
  studentId: string;
  stripeCustomers: StripeCustomer[];
  allStudents?: Array<{
    student_id: string;
    student_name: string;
    stripe_customer_id: string | null;
  }>;
}

export function StudentStripeSyncModal({
  isOpen,
  onClose,
  studentId,
  stripeCustomers,
  allStudents = [],
}: StudentStripeSyncModalProps) {
  const [student, setStudent] = useState<{
    id: string;
    name: string;
    email: string | null;
  } | null>(null);
  const [linkedCustomerId, setLinkedCustomerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const { toast } = useToast();

  // Load student data
  useEffect(() => {
    if (!isOpen || !studentId) return;

    const loadStudent = async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, email, students_billing(stripe_customer_id)')
        .eq('id', studentId)
        .maybeSingle();

      if (error || !data) {
        toast({
          title: 'Error',
          description: 'Failed to load student data',
          variant: 'destructive',
        });
        return;
      }

      const billing = Array.isArray(data.students_billing)
        ? data.students_billing[0]
        : data.students_billing;

      setStudent({
        id: data.id,
        name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown',
        email: data.email,
      });
      setLinkedCustomerId(billing?.stripe_customer_id || null);
    };

    loadStudent();
  }, [isOpen, studentId, toast]);

  // Helper functions for matching (same as table)
  const stringsMatch = (a: string | null | undefined, b: string | null | undefined): boolean => {
    const aTrimmed = a?.trim() || '';
    const bTrimmed = b?.trim() || '';
    if (!aTrimmed && !bTrimmed) return true;
    if (!aTrimmed || !bTrimmed) return false;
    return aTrimmed.toLowerCase() === bTrimmed.toLowerCase();
  };

  // Check if customer matches student name or email (for highlighting in right column)
  const customerMatches = useMemo(() => {
    if (!student) return new Map<string, { nameMatch: boolean; emailMatch: boolean }>();
    
    const matches = new Map<string, { nameMatch: boolean; emailMatch: boolean }>();
    
    stripeCustomers.forEach((customer) => {
      const nameMatch = stringsMatch(student.name, customer.name || null);
      const emailMatch = stringsMatch(student.email, customer.email || null);
      
      matches.set(customer.id, { nameMatch, emailMatch });
    });
    
    return matches;
  }, [student, stripeCustomers]);

  // Create a map of stripe_customer_id -> student name for checking if customer is linked to another student
  const customerToStudentMap = useMemo(() => {
    const map = new Map<string, string>();
    allStudents.forEach((student) => {
      if (student.stripe_customer_id && student.student_id !== studentId) {
        map.set(student.stripe_customer_id, student.student_name);
      }
    });
    return map;
  }, [allStudents, studentId]);

  // Filter and sort Stripe customers by search term and match status
  const filteredCustomers = useMemo(() => {
    if (!stripeCustomers || stripeCustomers.length === 0) return [];
    
    let filtered = stripeCustomers;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (customer) =>
          customer.name?.toLowerCase().includes(searchLower) ||
          customer.email?.toLowerCase().includes(searchLower) ||
          customer.id.toLowerCase().includes(searchLower)
      );
    }

    // Sort: matched customers first, then by name
    return filtered.sort((a, b) => {
      const aMatches = customerMatches.get(a.id);
      const bMatches = customerMatches.get(b.id);
      const aHasMatch = aMatches?.nameMatch || aMatches?.emailMatch;
      const bHasMatch = bMatches?.nameMatch || bMatches?.emailMatch;

      // Matched customers first
      if (aHasMatch && !bHasMatch) return -1;
      if (!aHasMatch && bHasMatch) return 1;

      // Then sort by name
      const aName = a.name || '';
      const bName = b.name || '';
      return aName.localeCompare(bName);
    });
  }, [stripeCustomers, searchTerm, customerMatches]);

  // Get linked customer data
  const linkedCustomer = useMemo(() => {
    if (!linkedCustomerId) return null;
    return stripeCustomers.find((c) => c.id === linkedCustomerId) || null;
  }, [linkedCustomerId, stripeCustomers]);

  // Get payment methods for linked customer
  const [dbPaymentMethods, setDbPaymentMethods] = useState<Array<{
    id: string;
    card_last4: string;
    is_default: boolean;
  }>>([]);

  useEffect(() => {
    if (!linkedCustomer) {
      setDbPaymentMethods([]);
      return;
    }

    const loadPaymentMethods = async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data, error } = await supabase
        .from('student_payment_methods')
        .select('id, card_last4, is_default')
        .eq('student_id', studentId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading payment methods:', error);
        return;
      }

      setDbPaymentMethods(data || []);
    };

    loadPaymentMethods();
  }, [linkedCustomer, studentId]);

  const paymentMethodsMatch = (
    dbMethods: Array<{ card_last4: string }>,
    stripeMethods: Array<{ last4: string }>
  ): boolean => {
    const dbLast4s = dbMethods
      .map(m => m.card_last4?.trim())
      .filter((last4): last4 is string => !!last4)
      .sort();
    const stripeLast4s = stripeMethods
      .map(m => m.last4?.trim())
      .filter((last4): last4 is string => !!last4)
      .sort();
    
    if (dbLast4s.length === 0 && stripeLast4s.length === 0) return true;
    if (dbLast4s.length !== stripeLast4s.length) return false;
    return JSON.stringify(dbLast4s) === JSON.stringify(stripeLast4s);
  };

  // Calculate matches for linked customer
  const linkedMatches = useMemo(() => {
    if (!linkedCustomer || !student) return null;
    
    const stripePaymentMethods = linkedCustomer.payment_methods.map(pm => ({
      last4: pm.card?.last4 || ''
    }));
    
    return {
      name: stringsMatch(student.name, linkedCustomer.name || null),
      email: stringsMatch(student.email, linkedCustomer.email || null),
      paymentMethods: paymentMethodsMatch(dbPaymentMethods, stripePaymentMethods),
    };
  }, [linkedCustomer, student, dbPaymentMethods]);

  const handleSync = async (customerId: string) => {
    if (!studentId) return;

    // Check if customer is linked to another student
    const linkedToStudent = customerToStudentMap.get(customerId);
    if (linkedToStudent) {
      toast({
        title: 'Customer Already Linked',
        description: `This customer is already linked to student: ${linkedToStudent}`,
        variant: 'destructive',
      });
      return;
    }

    setIsSyncing(true);
    try {
      const result = await stripeSyncApi.syncStudentToStripe(studentId, customerId);
      
      toast({
        title: 'Success',
        description: `Synced ${result.syncedPaymentMethods.length} payment method(s)`,
      });

      if (result.errors && result.errors.length > 0) {
        toast({
          title: 'Warning',
          description: `Some errors occurred: ${result.errors.join(', ')}`,
          variant: 'destructive',
        });
      }

      setLinkedCustomerId(customerId);
      onClose(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sync student',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUnlink = async () => {
    if (!studentId || !confirm('Are you sure you want to unlink this Stripe customer? This will remove all payment methods.')) {
      return;
    }

    setIsUnlinking(true);
    try {
      await stripeSyncApi.unlinkStudent(studentId);
      toast({
        title: 'Success',
        description: 'Stripe customer unlinked successfully',
      });
      setLinkedCustomerId(null);
      setDbPaymentMethods([]);
      onClose(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to unlink student',
        variant: 'destructive',
      });
    } finally {
      setIsUnlinking(false);
    }
  };

  const formatCardDisplay = (pm: StripeCustomer['payment_methods'][0]) => {
    if (!pm.card) return 'Unknown';
    return `${pm.card.brand.toUpperCase()} •••• ${pm.card.last4} (${pm.card.exp_month}/${pm.card.exp_year})`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose(false);
      }
    }}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <DialogTitle>
            {student ? `Sync Stripe Customer: ${student.name}` : 'Sync Stripe Customer'}
          </DialogTitle>
          <DialogDescription>
            {student?.email && `Student email: ${student.email}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0 flex">
          {/* Left Column - Comparison Table */}
          <div className="w-1/2 border-r p-6 overflow-y-auto">
            {linkedCustomer ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Comparison</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnlink}
                    disabled={isUnlinking}
                  >
                    {isUnlinking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Unlinking...
                      </>
                    ) : (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Unlink
                      </>
                    )}
                  </Button>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Customer ID:</span>{' '}
                    <code className="text-xs bg-background px-2 py-1 rounded">
                      {linkedCustomer.id}
                    </code>
                  </div>
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Field</TableHead>
                        <TableHead>Database</TableHead>
                        <TableHead>Stripe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Name Row */}
                      <TableRow>
                        <TableCell className="font-medium">Name</TableCell>
                        <TableCell className={linkedMatches?.name ? 'bg-green-50 dark:bg-green-950/20' : linkedMatches && !linkedMatches.name ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          {student?.name || '-'}
                        </TableCell>
                        <TableCell className={linkedMatches?.name ? 'bg-green-50 dark:bg-green-950/20' : linkedMatches && !linkedMatches.name ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          {linkedCustomer.name || '-'}
                        </TableCell>
                      </TableRow>
                      
                      {/* Email Row */}
                      <TableRow>
                        <TableCell className="font-medium">Email</TableCell>
                        <TableCell className={linkedMatches?.email ? 'bg-green-50 dark:bg-green-950/20' : linkedMatches && !linkedMatches.email ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          {student?.email || '-'}
                        </TableCell>
                        <TableCell className={linkedMatches?.email ? 'bg-green-50 dark:bg-green-950/20' : linkedMatches && !linkedMatches.email ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          {linkedCustomer.email || '-'}
                        </TableCell>
                      </TableRow>
                      
                      {/* Payment Methods Row */}
                      <TableRow>
                        <TableCell className="font-medium">Payment Methods</TableCell>
                        <TableCell className={linkedMatches?.paymentMethods ? 'bg-green-50 dark:bg-green-950/20' : linkedMatches && !linkedMatches.paymentMethods ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          {dbPaymentMethods.length === 0 ? (
                            <span className="text-muted-foreground text-sm">None</span>
                          ) : (
                            <div className="space-y-1">
                              {dbPaymentMethods.map((pm) => (
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
                        <TableCell className={linkedMatches?.paymentMethods ? 'bg-green-50 dark:bg-green-950/20' : linkedMatches && !linkedMatches.paymentMethods ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          {linkedCustomer.payment_methods.length === 0 ? (
                            <span className="text-muted-foreground text-sm">None</span>
                          ) : (
                            <div className="space-y-1">
                              {linkedCustomer.payment_methods.map((pm) => (
                                <div key={pm.id} className="text-sm">
                                  •••• {pm.card?.last4 || 'N/A'}
                                  {pm.is_default && (
                                    <Badge variant="default" className="ml-2 text-xs">Default</Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No customer linked
              </div>
            )}
          </div>

          {/* Right Column - Other Stripe Customers */}
          <div className="w-1/2 p-6 overflow-y-auto flex flex-col">
            <div className="space-y-4 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between flex-shrink-0">
                <h3 className="font-semibold">
                  {linkedCustomer ? 'Other Stripe Customers' : 'Stripe Customers'}
                </h3>
                <div className="relative flex-1 max-w-sm ml-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="border rounded-lg flex-1 overflow-y-auto min-h-0">
                {filteredCustomers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No customers found
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredCustomers.map((customer) => {
                      const isLinked = customer.id === linkedCustomerId;
                      const matches = customerMatches.get(customer.id);
                      const hasMatch = matches?.nameMatch || matches?.emailMatch;
                      
                      return (
                        <div
                          key={customer.id}
                          className={`p-4 hover:bg-muted/50 ${
                            isLinked ? 'bg-muted/30' : ''
                          } ${
                            hasMatch ? 'bg-green-50 dark:bg-green-950/20 border-l-4 border-l-green-500' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-background px-2 py-1 rounded">
                                  {customer.id}
                                </code>
                                {isLinked && (
                                  <Badge variant="default">
                                    <Check className="mr-1 h-3 w-3" />
                                    Linked
                                  </Badge>
                                )}
                                {hasMatch && !isLinked && (
                                  <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    Match
                                  </Badge>
                                )}
                              </div>
                              {customer.name && (
                                <div className={`font-medium ${matches?.nameMatch ? 'text-green-600 dark:text-green-400' : ''}`}>
                                  {customer.name}
                                </div>
                              )}
                              {customer.email && (
                                <div className={`text-sm ${matches?.emailMatch ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground'}`}>
                                  {customer.email}
                                </div>
                              )}
                              <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                                  <span>{customer.payment_methods.length} payment method(s)</span>
                                </div>
                              </div>
                              {customer.payment_methods.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {customer.payment_methods.map((pm) => (
                                    <div
                                      key={pm.id}
                                      className="text-xs text-muted-foreground pl-4"
                                    >
                                      • {formatCardDisplay(pm)}
                                      {pm.is_default && (
                                        <Badge variant="outline" className="ml-2 text-xs">Default</Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              {!isLinked && (() => {
                                const linkedToStudent = customerToStudentMap.get(customer.id);
                                
                                return (
                                  <Button
                                    size="sm"
                                    onClick={() => handleSync(customer.id)}
                                    disabled={isSyncing}
                                    variant={linkedToStudent ? 'outline' : 'default'}
                                    className={linkedToStudent ? 'opacity-50 cursor-not-allowed' : ''}
                                  >
                                    {isSyncing ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Syncing...
                                      </>
                                    ) : (
                                      'Link'
                                    )}
                                  </Button>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

