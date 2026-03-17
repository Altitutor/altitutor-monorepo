'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TablePagination,
} from '@altitutor/ui';
import { Eye } from 'lucide-react';
import type {
  ReportDataPoint,
  RevenueReportDataPoint,
  ReportEntityLink,
  ReportEntityMeta,
} from '../types';

type BaseEntity =
  | (ReportDataPoint['entities'][number] & { link?: ReportEntityLink; meta?: ReportEntityMeta })
  | (RevenueReportDataPoint['entities'][number] & { meta?: ReportEntityMeta });

export type ReportsEntitiesTableVariant =
  | 'openTasks'
  | 'completedTasks'
  | 'openIssues'
  | 'resolvedIssues'
  | 'openProjects'
  | 'activeStudents'
  | 'studentRegistrations'
  | 'discontinuations'
  | 'studentAbsences'
  | 'staffAbsences'
  | 'activeClasses'
  | 'classEnrolments'
  | 'classUnenrolments'
  | 'predictedRevenue'
  | 'actualRevenue'
  | 'billingErrors'
  | 'subsidies';

interface ColumnConfig {
  key: string;
  header: string;
}

const TABLE_CONFIG: Record<ReportsEntitiesTableVariant, ColumnConfig[]> = {
  openTasks: [
    { key: 'task', header: 'Task' },
    { key: 'createdBy', header: 'Created by' },
    { key: 'assignee', header: 'Assignee' },
  ],
  completedTasks: [
    { key: 'task', header: 'Task' },
    { key: 'completedBy', header: 'Completed by' },
    { key: 'completedAt', header: 'Completed at' },
  ],
  openIssues: [
    { key: 'issue', header: 'Issue' },
    { key: 'createdBy', header: 'Created by' },
  ],
  resolvedIssues: [
    { key: 'issue', header: 'Issue' },
    { key: 'resolvedBy', header: 'Resolved by' },
    { key: 'resolvedAt', header: 'Resolved at' },
  ],
  openProjects: [
    { key: 'project', header: 'Project' },
    { key: 'createdBy', header: 'Created by' },
    { key: 'projectLead', header: 'Project lead' },
  ],
  activeStudents: [{ key: 'student', header: 'Student' }],
  studentRegistrations: [
    { key: 'student', header: 'Student' },
    { key: 'registeredAt', header: 'Registered at' },
  ],
  discontinuations: [
    { key: 'student', header: 'Student' },
    { key: 'discontinuedAt', header: 'Discontinued at' },
    { key: 'discontinuedBy', header: 'Discontinued by' },
  ],
  studentAbsences: [
    { key: 'student', header: 'Student' },
    { key: 'class', header: 'Class' },
    { key: 'absenceDate', header: 'Absence date' },
    { key: 'loggedBy', header: 'Logged by' },
  ],
  staffAbsences: [
    { key: 'staff', header: 'Staff' },
    { key: 'class', header: 'Class' },
    { key: 'absenceDate', header: 'Absence date' },
    { key: 'loggedBy', header: 'Logged by' },
  ],
  activeClasses: [{ key: 'class', header: 'Class' }],
  classEnrolments: [
    { key: 'class', header: 'Class' },
    { key: 'student', header: 'Student' },
    { key: 'enrolledAt', header: 'Enrolled at' },
    { key: 'enrolledBy', header: 'Enrolled by' },
  ],
  classUnenrolments: [
    { key: 'class', header: 'Class' },
    { key: 'student', header: 'Student' },
    { key: 'unenrolledAt', header: 'Unenrolled at' },
    { key: 'unenrolledBy', header: 'Unenrolled by' },
  ],
  predictedRevenue: [
    { key: 'session', header: 'Session' },
    { key: 'student', header: 'Student' },
    { key: 'sessionDate', header: 'Session date' },
    { key: 'classPrice', header: 'Class price' },
  ],
  actualRevenue: [
    { key: 'invoice', header: 'Invoice' },
    { key: 'student', header: 'Student' },
    { key: 'invoiceDate', header: 'Invoice date' },
    { key: 'amount', header: 'Amount' },
  ],
  billingErrors: [
    { key: 'type', header: 'Type' },
    { key: 'invoice', header: 'Invoice' },
    { key: 'amount', header: 'Amount' },
  ],
  subsidies: [
    { key: 'student', header: 'Student' },
    { key: 'class', header: 'Class' },
    { key: 'price', header: 'Price' },
  ],
};

interface ReportsEntitiesTableProps {
  entities: BaseEntity[];
  variant: ReportsEntitiesTableVariant;
  onEntityClick?: (entity: BaseEntity) => void;
}

function getPrimaryLabelKey(variant: ReportsEntitiesTableVariant): string {
  switch (variant) {
    case 'openTasks':
    case 'completedTasks':
      return 'task';
    case 'openIssues':
    case 'resolvedIssues':
      return 'issue';
    case 'openProjects':
      return 'project';
    case 'activeStudents':
    case 'studentRegistrations':
    case 'discontinuations':
    case 'studentAbsences':
    case 'classEnrolments':
    case 'classUnenrolments':
      return 'student';
    case 'staffAbsences':
      return 'staff';
    case 'activeClasses':
      return 'class';
    case 'predictedRevenue':
      return 'session';
    case 'actualRevenue':
      return 'invoice';
    case 'billingErrors':
      return 'type';
    case 'subsidies':
      return 'student';
    default:
      return 'value';
  }
}

function getCellValue(entity: BaseEntity, variant: ReportsEntitiesTableVariant, key: string): string {
  const name = entity.name ?? '';
  const meta = entity.meta;

  const metaValue = meta?.[key as keyof ReportEntityMeta];
  if (metaValue != null && metaValue !== '') {
    return String(metaValue);
  }

  if (key === getPrimaryLabelKey(variant)) {
    return name;
  }

  if (variant === 'billingErrors' && key === 'type') {
    const kind = (entity as BaseEntity & { link?: ReportEntityLink }).link?.kind;
    if (kind === 'refund') return 'refund';
    if (kind === 'credit') return 'credit';
    if (kind === 'invoice') return 'void';
  }

  return '—';
}

const DEFAULT_PAGE_SIZE = 10;

export function ReportsEntitiesTable({ entities, variant, onEntityClick }: ReportsEntitiesTableProps) {
  const columns = TABLE_CONFIG[variant];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const total = entities.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const effectivePage = Math.min(page, pageCount);

  useEffect(() => {
    if (page > pageCount && pageCount > 0) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const paginatedEntities = useMemo(() => {
    const start = (effectivePage - 1) * pageSize;
    return entities.slice(start, start + pageSize);
  }, [entities, effectivePage, pageSize]);

  if (!entities.length) return null;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.header}</TableHead>
              ))}
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedEntities.map((entity) => {
              const isClickable =
                !!onEntityClick && (!!(entity as BaseEntity & { link?: ReportEntityLink }).link || entity.id);
              return (
                <TableRow key={entity.id}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className="max-w-xs truncate">
                      {getCellValue(entity, variant, column.key)}
                    </TableCell>
                  ))}
                  <TableCell>
                    {isClickable ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => onEntityClick?.(entity)}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {total > 0 && (
        <TablePagination
          page={effectivePage}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        />
      )}
    </div>
  );
}

