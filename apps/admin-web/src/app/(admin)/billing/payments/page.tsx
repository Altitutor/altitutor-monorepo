'use client';

import { useState, useEffect } from 'react';
import { billingApi, type InvoiceRow, type InvoiceItemRow, ViewInvoiceModal, useInvoicesList } from '@/features/billing';
import { TestBillingRunner } from '@/features/billing/components/TestBillingRunner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Input, Button, Badge, Popover, PopoverContent, PopoverTrigger, Checkbox, ScrollArea } from '@altitutor/ui';
import { Filter, X } from 'lucide-react';
import { addDays } from 'date-fns';
import { cn } from '@/shared/utils';
import { useStudents } from '@/features/students';
import { TablePagination } from '@/shared/components/TablePagination';

export const dynamic = 'force-dynamic';

type InvoiceWithStudent = InvoiceRow & { 
  student?: { id: string; first_name: string; last_name: string } | null;
  items?: InvoiceItemRow[];
};

const INVOICE_STATUSES: InvoiceRow['status'][] = ['draft', 'open', 'paid', 'void', 'uncollectible', 'disputed'];

export default function PaymentsPage() {
  const [statusFilters, setStatusFilters] = useState<InvoiceRow['status'][]>([]);
  const [studentFilters, setStudentFilters] = useState<string[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [invoiceItemsMap, setInvoiceItemsMap] = useState<Record<string, InvoiceItemRow[]>>({});

  // Fetch all students for the filter
  const { data: allStudents = [] } = useStudents();

  // Fetch invoices with pagination
  const { 
    data, 
    isLoading, 
    isFetching,
    error 
  } = useInvoicesList({
    statuses: statusFilters,
    studentIds: studentFilters,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize,
  });

  const invoices = data?.invoices || [];
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

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilters, studentFilters, from, to]);

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

  // Filter toggle handlers
  const toggleStatusFilter = (status: InvoiceRow['status']) => {
    setStatusFilters(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const toggleStudentFilter = (studentId: string) => {
    setStudentFilters(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const clearAllFilters = () => {
    setStatusFilters([]);
    setStudentFilters([]);
    setFrom('');
    setTo('');
    setStudentSearchQuery('');
  };

  // Count active filters
  const activeFiltersCount = 
    (statusFilters.length > 0 ? 1 : 0) +
    (studentFilters.length > 0 ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0);

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
        <div className="flex items-center gap-2">
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

          {/* Date Filters */}
          <Input 
            type="date" 
            value={from} 
            onChange={e => setFrom(e.target.value)}
            placeholder="From date"
            className="w-[160px]"
          />
          <Input 
            type="date" 
            value={to} 
            onChange={e => setTo(e.target.value)}
            placeholder="To date"
            className="w-[160px]"
          />
        </div>
      </div>

      <TestBillingRunner />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session Date</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Invoice Items</TableHead>
              <TableHead>Amount Due</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  Loading invoices...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-destructive">
                  Error loading invoices. Please try again.
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => {
                const invoiceDate = invoice.invoice_date ? new Date(invoice.invoice_date) : null;
                const sessionDate = invoiceDate ? addDays(invoiceDate, 1) : null;
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
                            <div key={item.id} className="text-xs">
                              <span className={cn(item.is_subsidy && "text-muted-foreground line-through")}>
                                {item.description || 'Invoice item'}
                              </span>
                              {item.is_subsidy && (
                                <Badge variant="outline" className="text-xs ml-1">Subsidy</Badge>
                              )}
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
        onPageChange={(newPage) => setPage(newPage)}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
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


