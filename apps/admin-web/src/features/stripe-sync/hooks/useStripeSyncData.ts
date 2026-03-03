import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stripeSyncApi, type StripeCustomer } from '../api/stripe-sync';
import { useToast } from '@altitutor/ui';
import { getErrorMessage } from '@/shared/utils';
import type { UseStripeSyncDataProps, UseStripeSyncDataReturn } from '../types';
import { stripeSyncKeys } from './queryKeys';

// Re-export types for backward compatibility
export type { UseStripeSyncDataProps, StripeSyncMatch, UseStripeSyncDataReturn } from '../types';

/**
 * Hook for managing Stripe sync data and operations.
 * Uses React Query for caching and request deduplication.
 */
export function useStripeSyncData({
  isOpen,
  studentId,
  allStudents = [],
}: UseStripeSyncDataProps): UseStripeSyncDataReturn {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<StripeCustomer[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const enabled = isOpen && !!studentId;

  const studentQuery = useQuery({
    queryKey: stripeSyncKeys.student(studentId ?? ''),
    queryFn: () => stripeSyncApi.getStudentForStripeSync(studentId!),
    enabled,
    staleTime: 1000 * 60 * 2,
  });

  const studentData = studentQuery.data?.student ?? null;
  const linkedCustomerId = enabled ? (studentQuery.data?.linkedCustomerId ?? null) : null;

  const linkedCustomerQuery = useQuery({
    queryKey: stripeSyncKeys.customer(linkedCustomerId ?? ''),
    queryFn: () => stripeSyncApi.getStripeCustomer(linkedCustomerId!),
    enabled: enabled && !!linkedCustomerId,
    staleTime: 1000 * 60 * 2,
  });

  const exactMatchesQuery = useQuery({
    queryKey: stripeSyncKeys.exactMatches(
      studentId ?? '',
      studentData?.email ?? null,
      studentData?.name ?? ''
    ),
    queryFn: () => stripeSyncApi.getExactMatchesForStudent(studentData!),
    enabled: enabled && !!studentData,
    staleTime: 1000 * 60 * 2,
  });

  const paymentMethodsQuery = useQuery({
    queryKey: stripeSyncKeys.paymentMethods(studentId ?? ''),
    queryFn: () => stripeSyncApi.getStudentPaymentMethods(studentId!),
    enabled: enabled && !!linkedCustomerQuery.data,
    staleTime: 1000 * 60 * 1,
  });

  // Toast when student load fails
  useEffect(() => {
    if (enabled && studentQuery.isError) {
      toast({
        title: 'Error',
        description: 'Failed to load student data',
        variant: 'destructive',
      });
    }
  }, [enabled, studentQuery.isError, toast]);

  // Toast when linked customer load fails
  useEffect(() => {
    if (enabled && linkedCustomerId && linkedCustomerQuery.isError) {
      toast({
        title: 'Warning',
        description: 'Failed to load linked Stripe customer',
        variant: 'destructive',
      });
    }
  }, [enabled, linkedCustomerId, linkedCustomerQuery.isError, toast]);

  const student = enabled ? studentData : null;
  const linkedCustomer = enabled ? (linkedCustomerQuery.data ?? null) : null;
  const exactMatches = useMemo(
    () => (enabled ? (exactMatchesQuery.data ?? []) : []),
    [enabled, exactMatchesQuery.data]
  );
  const dbPaymentMethods = useMemo(
    () => (enabled ? (paymentMethodsQuery.data ?? []) : []),
    [enabled, paymentMethodsQuery.data]
  );

  const invalidateStripeSync = () => {
    queryClient.invalidateQueries({ queryKey: stripeSyncKeys.all });
  };

  const syncMutation = useMutation({
    mutationFn: (customerId: string) => stripeSyncApi.syncStudentToStripe(studentId!, customerId),
    onSuccess: (result, _customerId) => {
      toast({
        title: 'Success',
        description: `Synced ${result.syncedPaymentMethods.length} payment method(s)`,
      });
      if (result.errors?.length) {
        toast({
          title: 'Warning',
          description: `Some errors occurred: ${result.errors.join(', ')}`,
          variant: 'destructive',
        });
      }
      invalidateStripeSync();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to sync student',
        variant: 'destructive',
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: () => stripeSyncApi.unlinkStudent(studentId!),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Stripe customer unlinked successfully' });
      invalidateStripeSync();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to unlink student',
        variant: 'destructive',
      });
    },
  });

  const syncToStripeMutation = useMutation({
    mutationFn: () => stripeSyncApi.syncToStripe(studentId!),
    onSuccess: (result) => {
      toast({
        title: 'Success',
        description: result.message || `Synced ${result.updates.join(', ')} to Stripe`,
      });
      invalidateStripeSync();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to sync to Stripe',
        variant: 'destructive',
      });
    },
  });

  const customerToStudentMap = useMemo(() => {
    const map = new Map<string, string>();
    allStudents.forEach((s) => {
      if (s.stripe_customer_id && s.student_id !== studentId) {
        map.set(s.stripe_customer_id, s.student_name);
      }
    });
    return map;
  }, [allStudents, studentId]);

  const stringsMatch = (
    a: string | null | undefined,
    b: string | null | undefined
  ): boolean => {
    const normalize = (str: string | null | undefined): string =>
      !str ? '' : str.trim().replace(/\s+/g, ' ').toLowerCase();
    const an = normalize(a);
    const bn = normalize(b);
    if (!an && !bn) return true;
    if (!an || !bn) return false;
    return an === bn;
  };

  const allCustomers = useMemo(() => {
    const combined = [...exactMatches, ...searchResults];
    const unique = new Map<string, StripeCustomer>();
    combined.forEach((c) => {
      if (!unique.has(c.id)) unique.set(c.id, c);
    });
    return Array.from(unique.values());
  }, [exactMatches, searchResults]);

  const customerMatches = useMemo(() => {
    const map = new Map<string, { nameMatch: boolean; emailMatch: boolean }>();
    if (!student) return map;
    allCustomers.forEach((customer) => {
      map.set(customer.id, {
        nameMatch: stringsMatch(student.name, customer.name ?? null),
        emailMatch: stringsMatch(student.email, customer.email ?? null),
      });
    });
    return map;
  }, [student, allCustomers]);

  const filteredCustomers = useMemo(() => {
    return [...allCustomers].sort((a, b) => {
      const aM = customerMatches.get(a.id);
      const bM = customerMatches.get(b.id);
      const aHas = aM?.nameMatch || aM?.emailMatch;
      const bHas = bM?.nameMatch || bM?.emailMatch;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [allCustomers, customerMatches]);

  const paymentMethodsMatch = (
    dbMethods: Array<{ card_last4: string; is_default: boolean }>,
    stripeMethods: Array<{ last4: string; is_default: boolean }>
  ): boolean => {
    const dbLast4s = dbMethods
      .map((m) => m.card_last4?.trim())
      .filter((x): x is string => !!x)
      .sort();
    const stripeLast4s = stripeMethods
      .map((m) => m.last4?.trim())
      .filter((x): x is string => !!x)
      .sort();
    if (dbLast4s.length === 0 && stripeLast4s.length === 0) return true;
    if (dbLast4s.length !== stripeLast4s.length) return false;
    if (JSON.stringify(dbLast4s) !== JSON.stringify(stripeLast4s)) return false;
    const dbDefault = dbMethods.find((m) => m.is_default)?.card_last4?.trim();
    const stripeDefault = stripeMethods.find((m) => m.is_default)?.last4?.trim();
    if (!dbDefault && !stripeDefault) return true;
    if (!dbDefault || !stripeDefault) return false;
    return dbDefault === stripeDefault;
  };

  const linkedMatches = useMemo(() => {
    if (!linkedCustomer || !student) return null;
    const stripePms = linkedCustomer.payment_methods.map((pm) => ({
      last4: pm.card?.last4 ?? '',
      is_default: pm.is_default ?? false,
    }));
    return {
      name: stringsMatch(student.name, linkedCustomer.name ?? null),
      email: stringsMatch(student.email, linkedCustomer.email ?? null),
      paymentMethods: paymentMethodsMatch(dbPaymentMethods, stripePms),
    };
  }, [linkedCustomer, student, dbPaymentMethods]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await stripeSyncApi.searchStripeCustomers(searchTerm.trim());
      setSearchResults(results);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to search Stripe customers',
        variant: 'destructive',
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSync = async (customerId: string) => {
    const linkedToStudent = customerToStudentMap.get(customerId);
    if (linkedToStudent) {
      toast({
        title: 'Customer Already Linked',
        description: `This customer is already linked to student: ${linkedToStudent}`,
        variant: 'destructive',
      });
      return;
    }
    await syncMutation.mutateAsync(customerId);
  };

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to unlink this Stripe customer? This will remove all payment methods.')) {
      return;
    }
    await unlinkMutation.mutateAsync();
  };

  const handleSyncToStripe = async () => {
    if (!studentId || !linkedCustomerId) return;
    await syncToStripeMutation.mutateAsync();
  };

  return {
    student,
    linkedCustomerId,
    linkedCustomer,
    exactMatches,
    searchResults,
    dbPaymentMethods,
    filteredCustomers,
    linkedMatches,
    customerMatches,
    isLoadingLinked: enabled && !!linkedCustomerId && linkedCustomerQuery.isLoading,
    isLoadingExactMatches: enabled && !!studentData && exactMatchesQuery.isLoading,
    isSearching,
    searchTerm,
    setSearchTerm,
    handleSearch,
    handleSync,
    handleUnlink,
    handleSyncToStripe,
    isSyncing: syncMutation.isPending,
    isUnlinking: unlinkMutation.isPending,
    isSyncingToStripe: syncToStripeMutation.isPending,
  };
}
