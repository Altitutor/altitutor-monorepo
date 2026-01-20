import type { Tables } from '@altitutor/shared';

/**
 * Invoice row type
 */
export type InvoiceRow = Tables<'invoices'>;

/**
 * Invoice item row type
 */
export type InvoiceItemRow = Tables<'invoice_items'>;

/**
 * Missing payment obligation type
 * TODO: Replace with proper type when views are added to generated types
 * This represents data from a database view that isn't yet in the generated types
 */
export type MissingPaymentObligation = unknown;

/**
 * Failed payment attempt type
 * TODO: Replace with proper type when views are added to generated types
 * This represents data from a database view that isn't yet in the generated types
 */
export type FailedPaymentAttempt = unknown;

/**
 * Stuck payment attempt type
 * TODO: Replace with proper type when views are added to generated types
 * This represents data from a database view that isn't yet in the generated types
 */
export type StuckPaymentAttempt = unknown;
