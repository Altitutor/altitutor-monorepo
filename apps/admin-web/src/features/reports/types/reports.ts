/**
 * Report types for the reports feature
 */

/**
 * Optional display values for report entity table columns.
 * Keys match ReportsEntitiesTable column keys (createdBy, assignee, etc.).
 */
export interface ReportEntityMeta {
  createdBy?: string;
  assignee?: string;
  completedAt?: string;
  completedBy?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  projectLead?: string;
  registeredAt?: string;
  discontinuedAt?: string;
  discontinuedBy?: string;
  absenceDate?: string;
  dateLogged?: string;
  loggedBy?: string;
  class?: string;
  staff?: string;
  student?: string;
  enrolledAt?: string;
  enrolledBy?: string;
  unenrolledAt?: string;
  unenrolledBy?: string;
  session?: string;
  sessionDate?: string;
  classPrice?: string;
  invoiceDate?: string;
  amount?: string;
  type?: string;
  invoice?: string;
  price?: string;
  subject?: string;
  createdAt?: string;
}

export interface IssueReportEntity {
  id: string;
  name: string;
  meta?: ReportEntityMeta;
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
  | 'staff'
  | 'task'
  | 'project'
  | 'session';

export interface ReportEntityLink {
  kind: ReportEntityKind;
  studentId?: string | null;
  classId?: string | null;
  sessionId?: string | null;
  staffId?: string | null;
  invoiceId?: string | null;
  taskId?: string | null;
  projectId?: string | null;
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

export interface TasksReportData {
  openByDay: ReportDataPoint[];
  completedByDay: ReportDataPoint[];
}

export interface ProjectsReportData {
  openByDay: ReportDataPoint[];
  finishedByDay: ReportDataPoint[];
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
   * Student registrations created within the day (based on registered_at).
   */
  registrationsByDay: ReportDataPoint[];
  /**
   * Student discontinuations within the day (based on discontinued_at).
   */
  discontinuationsByDay: ReportDataPoint[];
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
   * Credit given over time. Each entity is a credit-related event (credit notes and
   * credit balance transactions) with reason and amount for drill-down.
   */
  creditsByDay: RevenueReportDataPoint[];
  /**
   * Invoices voided over time. Each entity is the voided invoice.
   */
  voidedInvoicesByDay: ReportDataPoint[];
  /**
   * Number of student subsidies that are effective and where the student is
   * enrolled in a class for that subject, per day.
   */
  subsidiesEnrolledByDay: ReportDataPoint[];
  /**
   * Number of student subsidies created each day in the selected period.
   */
  subsidiesCreatedByDay: ReportDataPoint[];
}
