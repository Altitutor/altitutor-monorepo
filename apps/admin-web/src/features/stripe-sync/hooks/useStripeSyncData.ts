import { useState, useEffect, useMemo } from 'react';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripeSyncApi, type StripeCustomer } from '../api/stripe-sync';
import { useToast } from '@altitutor/ui';
import { getErrorMessage } from '@/shared/utils';
import type { UseStripeSyncDataProps, UseStripeSyncDataReturn } from '../types';

// Re-export types for backward compatibility
export type { UseStripeSyncDataProps, StripeSyncMatch, UseStripeSyncDataReturn } from '../types';

/**
 * Hook for managing Stripe sync data and operations
 * Handles loading student data, linked customer, exact matches, and sync operations
 */
export function useStripeSyncData({
  isOpen,
  studentId,
  allStudents = [],
}: UseStripeSyncDataProps): UseStripeSyncDataReturn {
  const [student, setStudent] = useState<{
    id: string;
    name: string;
    email: string | null;
  } | null>(null);
  const [linkedCustomerId, setLinkedCustomerId] = useState<string | null>(null);
  const [linkedCustomer, setLinkedCustomer] = useState<StripeCustomer | null>(null);
  const [exactMatches, setExactMatches] = useState<StripeCustomer[]>([]);
  const [searchResults, setSearchResults] = useState<StripeCustomer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isSyncingToStripe, setIsSyncingToStripe] = useState(false);
  const [isLoadingLinked, setIsLoadingLinked] = useState(false);
  const [isLoadingExactMatches, setIsLoadingExactMatches] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [dbPaymentMethods, setDbPaymentMethods] = useState<Array<{
    id: string;
    card_last4: string;
    is_default: boolean;
  }>>([]);
  const { toast } = useToast();

  // Load student data and fetch linked customer + exact matches
  useEffect(() => {
    if (!isOpen || !studentId) {
      // Reset state when modal closes
      setStudent(null);
      setLinkedCustomerId(null);
      setLinkedCustomer(null);
      setExactMatches([]);
      setSearchResults([]);
      setSearchTerm('');
      setDbPaymentMethods([]);
      return;
    }

    const loadData = async () => {
      // Load student data
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

      const studentData = {
        id: data.id,
        name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown',
        email: data.email,
      };

      setStudent(studentData);
      const customerId = billing?.stripe_customer_id || null;
      setLinkedCustomerId(customerId);

      // Fetch linked customer if exists
      if (customerId) {
        setIsLoadingLinked(true);
        try {
          const customer = await stripeSyncApi.getStripeCustomer(customerId);
          setLinkedCustomer(customer);
        } catch (error: unknown) {
          console.error('Error fetching linked customer:', error);
          toast({
            title: 'Warning',
            description: 'Failed to load linked Stripe customer',
            variant: 'destructive',
          });
        } finally {
          setIsLoadingLinked(false);
        }
      }

      // Search for exact matches by email and name
      setIsLoadingExactMatches(true);
      const matches: StripeCustomer[] = [];

      try {
        // Search by email if student has email
        if (studentData.email) {
          const emailResults = await stripeSyncApi.searchStripeCustomers(studentData.email);
          // Filter for exact email matches
          const exactEmailMatches = emailResults.filter(
            (c) => c.email?.toLowerCase().trim() === studentData.email?.toLowerCase().trim()
          );
          matches.push(...exactEmailMatches);
        }

        // Search by name if student has name
        if (studentData.name && studentData.name !== 'Unknown') {
          const nameResults = await stripeSyncApi.searchStripeCustomers(studentData.name);
          // Filter for exact name matches (case-insensitive)
          const exactNameMatches = nameResults.filter(
            (c) => c.name?.toLowerCase().trim() === studentData.name?.toLowerCase().trim()
          );
          // Avoid duplicates
          exactNameMatches.forEach((match) => {
            if (!matches.find((m) => m.id === match.id)) {
              matches.push(match);
            }
          });
        }
      } catch (error: unknown) {
        console.error('Error searching for exact matches:', error);
        // Don't show error toast for search failures, just log
      } finally {
        setIsLoadingExactMatches(false);
      }

      setExactMatches(matches);
    };

    loadData();
  }, [isOpen, studentId, toast]);

  // Load payment methods when linked customer changes
  useEffect(() => {
    if (!linkedCustomer || !studentId) {
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

  // Helper functions for matching
  const stringsMatch = (a: string | null | undefined, b: string | null | undefined): boolean => {
    // Normalize strings: trim, collapse multiple spaces, and convert to lowercase
    const normalize = (str: string | null | undefined): string => {
      if (!str) return '';
      return str
        .trim()
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .toLowerCase();
    };
    
    const aNormalized = normalize(a);
    const bNormalized = normalize(b);
    
    if (!aNormalized && !bNormalized) return true;
    if (!aNormalized || !bNormalized) return false;
    return aNormalized === bNormalized;
  };

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

  // Combine exact matches and search results, removing duplicates
  const allCustomers = useMemo(() => {
    const combined = [...exactMatches, ...searchResults];
    const unique = new Map<string, StripeCustomer>();
    combined.forEach((customer) => {
      if (!unique.has(customer.id)) {
        unique.set(customer.id, customer);
      }
    });
    return Array.from(unique.values());
  }, [exactMatches, searchResults]);

  // Check if customer matches student name or email (for highlighting)
  const customerMatches = useMemo(() => {
    if (!student) return new Map<string, { nameMatch: boolean; emailMatch: boolean }>();
    
    const matches = new Map<string, { nameMatch: boolean; emailMatch: boolean }>();
    
    allCustomers.forEach((customer) => {
      const nameMatch = stringsMatch(student.name, customer.name || null);
      const emailMatch = stringsMatch(student.email, customer.email || null);
      
      matches.set(customer.id, { nameMatch, emailMatch });
    });
    
    return matches;
  }, [student, allCustomers]);

  // Filter and sort customers by match status
  const filteredCustomers = useMemo(() => {
    if (allCustomers.length === 0) return [];
    
    // Sort: matched customers first, then by name
    return allCustomers.sort((a, b) => {
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
  }, [allCustomers, customerMatches]);

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

  // Calculate matches for linked customer
  const linkedMatches = useMemo(() => {
    if (!linkedCustomer || !student) return null;
    
    const stripePaymentMethods = linkedCustomer.payment_methods.map((pm: StripeCustomer['payment_methods'][0]) => ({
      last4: pm.card?.last4 || '',
      is_default: pm.is_default || false
    }));
    
    return {
      name: stringsMatch(student.name, linkedCustomer.name || null),
      email: stringsMatch(student.email, linkedCustomer.email || null),
      paymentMethods: paymentMethodsMatch(dbPaymentMethods, stripePaymentMethods),
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
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to search Stripe customers',
        variant: 'destructive',
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

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
      // Reload linked customer
      try {
        const customer = await stripeSyncApi.getStripeCustomer(customerId);
        setLinkedCustomer(customer);
      } catch (error: unknown) {
        console.error('Error reloading linked customer:', error);
      }
      // Note: onClose should be called by the component, not the hook
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to sync student',
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
      setLinkedCustomer(null);
      setDbPaymentMethods([]);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to unlink student',
        variant: 'destructive',
      });
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleSyncToStripe = async () => {
    if (!studentId || !linkedCustomerId) return;

    setIsSyncingToStripe(true);
    try {
      const result = await stripeSyncApi.syncToStripe(studentId);
      
      toast({
        title: 'Success',
        description: result.message || `Synced ${result.updates.join(', ')} to Stripe`,
      });

      // Reload linked customer to reflect changes
      try {
        const customer = await stripeSyncApi.getStripeCustomer(linkedCustomerId);
        setLinkedCustomer(customer);
      } catch (error: unknown) {
        console.error('Error reloading linked customer:', error);
      }

      // Reload payment methods
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data, error } = await supabase
        .from('student_payment_methods')
        .select('id, card_last4, is_default')
        .eq('student_id', studentId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        setDbPaymentMethods(data);
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to sync to Stripe',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingToStripe(false);
    }
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
    isLoadingLinked,
    isLoadingExactMatches,
    isSearching,
    searchTerm,
    setSearchTerm,
    handleSearch,
    handleSync,
    handleUnlink,
    handleSyncToStripe,
    isSyncing,
    isUnlinking,
    isSyncingToStripe,
  };
}
