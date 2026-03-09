/**
 * Reconciliation mode - determines which strategies to run
 */
export type ReconciliationMode = 
  | 'missing-invoices'      // Find invoices in Stripe missing from DB
  | 'incomplete-invoices'   // Fix incomplete invoices in DB
  | 'status-drift'          // Fix status mismatches
  | 'amounts-mismatch'      // Detect and report amount discrepancies
  | 'refund-drift'          // Fix refund status drift (using Events API)
  | 'charge-id-backfill'    // Backfill stripe_charge_id for paid invoices missing it
  | 'all';                  // Run all strategies

/**
 * Reconciliation request parameters
 */
export interface ReconciliationRequest {
  mode?: ReconciliationMode;
  days_back?: number;
  only_missing_items?: boolean;
  only_missing_totals?: boolean;
  fix_status_drift?: boolean;  // Whether to fix status drift or just report
  fix_amounts_mismatch?: boolean; // Whether to fix amounts or just report
  fix_refund_drift?: boolean; // Whether to fix refund drift or just report
  fix_charge_id_backfill?: boolean; // Whether to backfill stripe_charge_id (default false = report only)
}

/**
 * Reconciliation result for a single invoice
 */
export interface InvoiceReconciliationResult {
  invoice_id: string;
  stripe_invoice_id: string;
  reconciled: boolean;
  errors?: string[];
  warnings?: string[];
  changes?: {
    field: string;
    old_value: unknown;
    new_value: unknown;
  }[];
}

/**
 * Strategy execution result
 */
export interface StrategyResult {
  strategy: string;
  reconciled: string[];
  errors: string[];
  skipped: string[];
  warnings: string[];
  mismatches?: InvoiceReconciliationResult[];
  date_range: {
    start: string;
    end: string;
  };
}

/**
 * Overall reconciliation response
 */
export interface ReconciliationResponse {
  ok: boolean;
  strategies: StrategyResult[];
  summary: {
    total_reconciled: number;
    total_errors: number;
    total_skipped: number;
    total_warnings: number;
    total_mismatches?: number;
  };
  date_range: {
    start: string;
    end: string;
  };
}
