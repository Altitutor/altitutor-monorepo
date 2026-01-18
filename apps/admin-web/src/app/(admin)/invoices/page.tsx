'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useSearchParams, useRouter } from 'next/navigation';
import { billingApi, type InvoiceRow, type InvoiceItemRow, ViewInvoiceModal, useInvoicesList } from '@/features/billing';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Input, Button, Badge, Popover, PopoverContent, PopoverTrigger, Checkbox, ScrollArea } from '@altitutor/ui';
import { Filter, X } from 'lucide-react';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { cn } from '@/shared/utils';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import type { Tables } from '@altitutor/shared';
import { TablePagination } from '@/shared/components/TablePagination';
import { DateRangePicker } from '@altitutor/ui';

export const dynamic = 'force-dynamic';

// Get today's date in local timezone (YYYY-MM-DD format)
const getTodayLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Validate date string format (YYYY-MM-DD)
const isValidDateString = (dateString: string | null): boolean => {
  if (!dateString) return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  try {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
};

const INVOICE_STATUSES: InvoiceRow['status'][] = ['draft', 'open', 'paid', 'void', 'uncollectible', 'disputed'];

export default function InvoicesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Initialize from URL params
  const getArrayFromUrl = (key: string): string[] => {
    const param = searchParams.get(key);
    return param ? param.split(',').filter(Boolean) : [];
  };
  
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`/invoices?${params.toString()}`);
  };
  
  const [statusFilters, setStatusFilters] = useState<InvoiceRow['status'][]>(getArrayFromUrl('status') as InvoiceRow['status'][]);
  const [studentFilters, setStudentFilters] = useState<string[]>(getArrayFromUrl('student'));
  // Default both dates to today if not provided or invalid
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const initialFrom = (fromParam && isValidDateString(fromParam)) ? fromParam : getTodayLocalDate();
  const initialTo = (toParam && isValidDateString(toParam)) ? toParam : getTodayLocalDate();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('pageSize')) || 50);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [invoiceItemsMap, setInvoiceItemsMap] = useState<Record<string, InvoiceItemRow[]>>({});
  
  // Debounce date values to prevent query from running on every keystroke
  const debouncedFrom = useDebounce(from, 500);
  const debouncedTo = useDebounce(to, 500);
  
  // Only include complete dates (YYYY-MM-DD format) to prevent API errors with partial dates
  const isCompleteFrom = /^\d{4}-\d{2}-\d{2}$/.test(debouncedFrom);
  const isCompleteTo = /^\d{4}-\d{2}-\d{2}$/.test(debouncedTo);
  
  // Sync from URL params
  useEffect(() => {
    setStatusFilters(getArrayFromUrl('status') as InvoiceRow['status'][]);
    setStudentFilters(getArrayFromUrl('student'));
    
    // Only sync valid dates from URL, default to today if missing or invalid
    // Note: searchParams.get() returns null if param doesn't exist, empty string if param exists but is empty
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    
    if (fromParam && fromParam !== '' && isValidDateString(fromParam)) {
      setFrom(fromParam);
    } else {
      setFrom(getTodayLocalDate());
    }
    
    if (toParam && toParam !== '' && isValidDateString(toParam)) {
      setTo(toParam);
    } else {
      setTo(getTodayLocalDate());
    }
    
    const pageParam = Number(searchParams.get('page'));
    if (pageParam) setPage(pageParam);
    const pageSizeParam = Number(searchParams.get('pageSize'));
    if (pageSizeParam) setPageSize(pageSizeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Fetch students for the filter using server-side search
  const { data: searchResults } = useQuery({
    queryKey: ['students', 'search', studentSearchQuery.trim()],
    queryFn: async () => {
      const trimmed = studentSearchQuery.trim();
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      // Use server-side search function to avoid pagination limits
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_students_admin', {
        p_search: trimmed.length > 0 ? trimmed : undefined,
        p_statuses: ['ACTIVE', 'TRIAL'], // Include both ACTIVE and TRIAL students
        p_include_relationships: false,
        p_exclude_class_search: false,
        p_limit: 100, // Limit to 100 results for filter dropdown
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return { students: [], total: 0 };

      const rpcData = rpcResult as { students: any[]; total: number };
      const students = (rpcData.students || []).map((s: any) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        status: s.status,
        curriculum: s.curriculum || null,
        year_level: s.year_level || null,
        school: s.school || null,
        email: s.email || null,
        phone: s.phone || null,
        created_at: s.created_at || null,
        updated_at: s.updated_at || null,
      })) as Tables<'students'>[];
      
      return { students, total: rpcData.total || 0 };
    },
    staleTime: 1000 * 30, // 30 seconds stale time
  });

  const allStudents = searchResults?.students || [];

  // Fetch invoices with pagination
  // Use debounced and validated dates to prevent API calls with partial/invalid dates
  const { 
    data, 
    isLoading, 
    isFetching,
    error 
  } = useInvoicesList({
    statuses: statusFilters,
    studentIds: studentFilters,
    from: (debouncedFrom && isCompleteFrom) ? debouncedFrom : undefined,
    to: (debouncedTo && isCompleteTo) ? debouncedTo : undefined,
    page,
    pageSize,
  });

  // Use useMemo to stabilize the invoices array reference to prevent infinite loops
  const invoices = useMemo(() => data?.invoices || [], [data?.invoices]);
  const total = data?.total || 0;

  // Fetch invoice items for displayed invoices
  useEffect(() => {
    if (invoices.length === 0) {
      setInvoiceItemsMap({});
      return;
    }

    const fetchItems = async () => {
      const itemsPromises = invoices.map(async (invoice) => {
        const items = await billingApi.getInvoiceItemsByInvoice(invoice.id);
        return { invoiceId: invoice.id, items };
      });
      
      const itemsResults = await Promise.all(itemsPromises);
      const newMap: Record<string, InvoiceItemRow[]> = {};
      itemsResults.forEach(({ invoiceId, items }) => {
        newMap[invoiceId] = items;
      });
      setInvoiceItemsMap(newMap);
    };

    fetchItems();
  }, [invoices]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateString;
    }
  };

  // Filter toggle handlers - reset page when filters change
  const toggleStatusFilter = (status: InvoiceRow['status']) => {
    const newFilters = statusFilters.includes(status) 
      ? statusFilters.filter(s => s !== status)
      : [...statusFilters, status];
    setStatusFilters(newFilters);
    setPage(1);
    updateUrlParams({ 
      status: newFilters.length > 0 ? newFilters.join(',') : null,
      page: null 
    });
  };

  const toggleStudentFilter = (studentId: string) => {
    const newFilters = studentFilters.includes(studentId) 
      ? studentFilters.filter(id => id !== studentId)
      : [...studentFilters, studentId];
    setStudentFilters(newFilters);
    setPage(1);
    updateUrlParams({ 
      student: newFilters.length > 0 ? newFilters.join(',') : null,
      page: null 
    });
  };

  const clearAllFilters = () => {
    setStatusFilters([]);
    setStudentFilters([]);
    const today = getTodayLocalDate();
    setFrom(today);
    setTo(today);
    setStudentSearchQuery('');
    setPage(1);
    updateUrlParams({ 
      status: null,
      student: null,
      from: today,
      to: today,
      page: null 
    });
  };

  // Count active filters (dates always have values now, so only count if they differ from today)
  const today = getTodayLocalDate();
  const activeFiltersCount = 
    (statusFilters.length > 0 ? 1 : 0) +
    (studentFilters.length > 0 ? 1 : 0) +
    (from && from !== today ? 1 : 0) +
    (to && to !== today ? 1 : 0);

  // Filter students based on search query
  const filteredStudents = allStudents.filter((student) => {
    if (!studentSearchQuery) return true;
    const query = studentSearchQuery.toLowerCase();
    const firstName = (student.first_name || '').toLowerCase();
    const lastName = (student.last_name || '').toLowerCase();
    const school = (student.school || '').toLowerCase();
    const email = (student.email || '').toLowerCase();

    return (
      firstName.includes(query) ||
      lastName.includes(query) ||
      school.includes(query) ||
      email.includes(query) ||
      `${firstName} ${lastName}`.includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
    let label = status;

    switch (status) {
      case 'paid':
        variant = 'default';
        label = 'Paid';
        break;
      case 'draft':
        variant = 'outline';
        label = 'Draft';
        break;
      case 'open':
        variant = 'secondary';
        label = 'Open';
        break;
      case 'void':
      case 'uncollectible':
      case 'disputed':
        variant = 'destructive';
        label = status.charAt(0).toUpperCase() + status.slice(1);
        break;
      default:
        variant = 'outline';
    }

    return <Badge variant={variant} className="text-xs">{label}</Badge>;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-end">
          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllFilters}
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}

        {/* Status Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant={statusFilters.length > 0 ? "secondary" : "outline"} 
              size="sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              Status {statusFilters.length > 0 && `(${statusFilters.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="end">
            <div className="space-y-2">
              <div className="font-medium text-sm mb-2">Invoice Status</div>
              {INVOICE_STATUSES.map((status) => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={statusFilters.includes(status)}
                    onCheckedChange={() => toggleStatusFilter(status)}
                  />
                  <span className="text-sm capitalize">{status}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Student Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant={studentFilters.length > 0 ? "secondary" : "outline"} 
              size="sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              Student {studentFilters.length > 0 && `(${studentFilters.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[400px]" align="end">
            <div className="p-3">
              <Input
                placeholder="Search students..."
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                className="mb-3"
              />
              <ScrollArea className="h-[300px]">
                <div className="space-y-1 pr-4">
                  {filteredStudents.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      {studentSearchQuery
                        ? 'No students match your search'
                        : 'No students found'}
                    </div>
                  ) : (
                    filteredStudents.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-center gap-2 cursor-pointer p-2 hover:bg-muted rounded"
                      >
                        <Checkbox
                          checked={studentFilters.includes(student.id)}
                          onCheckedChange={() => toggleStudentFilter(student.id)}
                        />
                        <div className="flex flex-col items-start flex-1">
                          <div className="font-medium text-sm">
                            {student.first_name} {student.last_name}
                          </div>
                          {student.school && (
                            <div className="text-xs text-muted-foreground">
                              {student.school}
                            </div>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>

          {/* Date Range Filters */}
          <DateRangePicker
            from={from}
            to={to}
            onFromChange={(newFrom) => {
              setFrom(newFrom);
              setPage(1);
              updateUrlParams({ 
                from: newFrom,
                page: null 
              });
            }}
            onToChange={(newTo) => {
              setTo(newTo);
              setPage(1);
              updateUrlParams({ 
                to: newTo,
                page: null 
              });
            }}
          />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session Date</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Invoice Items</TableHead>
              <TableHead>Amount Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  Loading invoices...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-destructive">
                  Error loading invoices. Please try again.
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => {
                // invoice_date already represents the date of the sessions being invoiced
                // No need to add 1 day - that was a bug
                const sessionDate = invoice.invoice_date ? new Date(invoice.invoice_date) : null;
                const items = invoiceItemsMap[invoice.id] || [];
                
                return (
                  <TableRow 
                    key={invoice.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setActiveInvoiceId(invoice.id)}
                  >
                    <TableCell>
                      <span>{sessionDate ? formatDate(sessionDate.toISOString()) : '-'}</span>
                    </TableCell>
                    <TableCell>
                      {invoice.student ? (
                        <span className="text-sm">
                          {invoice.student.first_name} {invoice.student.last_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {items.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {items.slice(0, 2).map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1">
                                <span className={cn(item.is_subsidy && "text-muted-foreground line-through")}>
                                  {item.description || 'Invoice item'}
                                </span>
                                {item.is_subsidy && (
                                  <Badge variant="outline" className="text-xs">Subsidy</Badge>
                                )}
                              </div>
                              <span className="text-xs font-medium ml-2">
                                ${((item.amount_cents || 0) / 100).toFixed(2)}
                              </span>
                            </div>
                          ))}
                          {items.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{items.length - 2} more
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>{`$${((invoice.amount_due_cents || 0)/100).toFixed(2)}`}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ActionsMenu
                        type="invoice"
                        onOpenInPage={() => {
                          router.push(`/invoices/${invoice.id}`);
                        }}
                        onViewOnStripe={invoice.hosted_invoice_url ? () => {
                          window.open(invoice.hosted_invoice_url!, '_blank', 'noopener,noreferrer');
                        } : undefined}
                        onDownloadPdf={invoice.invoice_pdf ? () => {
                          window.open(invoice.invoice_pdf!, '_blank', 'noopener,noreferrer');
                        } : undefined}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={(newPage) => {
          setPage(newPage);
          updateUrlParams({ page: newPage === 1 ? null : String(newPage) });
        }}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
          updateUrlParams({ 
            pageSize: newSize === 50 ? null : String(newSize),
            page: null 
          });
        }}
      />

      <ViewInvoiceModal
        isOpen={!!activeInvoiceId}
        invoiceId={activeInvoiceId}
        onClose={() => setActiveInvoiceId(null)}
      />
    </div>
  );
}
