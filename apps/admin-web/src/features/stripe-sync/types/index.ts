import type { StripeCustomer } from '../api/stripe-sync';

/**
 * Props for useStripeSyncData hook
 */
export interface UseStripeSyncDataProps {
  isOpen: boolean;
  studentId: string;
  allStudents?: Array<{
    student_id: string;
    student_name: string;
    stripe_customer_id: string | null;
  }>;
}

/**
 * Match information for comparing student data with Stripe customer data
 */
export interface StripeSyncMatch {
  name: boolean;
  email: boolean;
  paymentMethods: boolean;
}

/**
 * Return type for useStripeSyncData hook
 */
export interface UseStripeSyncDataReturn {
  // Data
  student: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  linkedCustomerId: string | null;
  linkedCustomer: StripeCustomer | null;
  exactMatches: StripeCustomer[];
  searchResults: StripeCustomer[];
  dbPaymentMethods: Array<{
    id: string;
    card_last4: string;
    is_default: boolean;
  }>;
  filteredCustomers: StripeCustomer[];
  linkedMatches: StripeSyncMatch | null;
  customerMatches: Map<string, { nameMatch: boolean; emailMatch: boolean }>;
  
  // State
  isLoadingLinked: boolean;
  isLoadingExactMatches: boolean;
  isSearching: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  
  // Actions
  handleSearch: () => Promise<void>;
  handleSync: (customerId: string) => Promise<void>;
  handleUnlink: () => Promise<void>;
  handleSyncToStripe: () => Promise<void>;
  isSyncing: boolean;
  isUnlinking: boolean;
  isSyncingToStripe: boolean;
}
