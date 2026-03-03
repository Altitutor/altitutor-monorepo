/**
 * Report types for the reports feature
 */

export interface IssueReportEntity {
  id: string;
  name: string;
}

export type ReportEntityKind =
  | 'issue'
  | 'student'
  | 'class'
  | 'enrolment'
  | 'unenrolment'
  | 'absence'
  | 'registration'
  | 'invoice'
  | 'refund'
  | 'credit'
  | 'staff';

export interface ReportEntityLink {
  kind: ReportEntityKind;
  studentId?: string | null;
  classId?: string | null;
  sessionId?: string | null;
  staffId?: string | null;
  invoiceId?: string | null;
}

export interface ReportDataPoint {
  date: string;
  count: number;
  entities: (IssueReportEntity & { link?: ReportEntityLink })[];
}

export interface IssuesReportData {
  openByDay: ReportDataPoint[];
  resolvedByDay: ReportDataPoint[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface StaffAbsencesReportData {
  /**
   * Number of staff absences logged on each day in the range.
   * Each entity represents a specific staff-session absence, with swap details
   * encoded in the entity name for drill-down display.
   */
  absencesByDay: ReportDataPoint[];
}

export interface StudentStatsReportData {
  /**
   * Active students at the end of each day.
   */
  activeStudentsByDay: ReportDataPoint[];
  /**
   * Active classes (classes where the date is between session_start_date
   * and session_end_date) at the end of each day.
   */
  activeClassesByDay: ReportDataPoint[];
  /**
   * Class enrolments created within the day.
   */
  enrolmentsByDay: ReportDataPoint[];
  /**
   * Class unenrolments logged within the day.
   */
  unenrolmentsByDay: ReportDataPoint[];
  /**
   * Student absences logged within the day. Entity names encode whether
   * the absence was credited or rescheduled.
   */
  absencesByDay: ReportDataPoint[];
}

export interface MarketingStatsReportData {
  /**
   * Student registrations created within the day.
   */
  registrationsByDay: ReportDataPoint[];
}

export interface RevenueReportDataPoint extends ReportDataPoint {
  /**
   * Monetary value in cents for the period.
   */
  amountCents: number;
}

export interface BillingStatsReportData {
  /**
   * Predicted revenue for each day in cents (derived from invoice items).
   */
  predictedRevenueByDay: RevenueReportDataPoint[];
  /**
   * Actual revenue recognised each day in cents (amount_due_cents - fee_cents).
   */
  actualRevenueByDay: RevenueReportDataPoint[];
  /**
   * Number of refunds over time. Each entity is the refunded invoice.
   */
  refundsByDay: ReportDataPoint[];
  /**
   * Credit given over time. Each entity is the credit note with reason.
   */
  creditsByDay: RevenueReportDataPoint[];
  /**
   * Invoices voided over time. Each entity is the voided invoice.
   */
  voidedInvoicesByDay: ReportDataPoint[];
}
