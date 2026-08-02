'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
} from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { useOnlineStudentsMinimal } from '../hooks/useStudentsQuery';
import { useDebounce } from '@/shared/hooks/useDebounce';

const productLabels = {
  UCAT_WEB: 'UCATWeb',
  STUDENT_WEB: 'StudentWeb',
} as const;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function OnlineStudentsTable() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [entitlement, setEntitlement] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const debouncedSearch = useDebounce(search, 250);
  const { data, isLoading, isFetching, error } = useOnlineStudentsMinimal({
    search: debouncedSearch,
    products: product ? [product] : [],
    entitlements: entitlement ? [entitlement] : [],
    page,
    pageSize,
  });

  const students = data?.students ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="flex-1 space-y-1 text-sm font-medium">
          Search
          <Input
            aria-label="Search online students"
            placeholder="Search name, email, or phone"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Product
          <select
            aria-label="Product"
            className="flex h-10 min-w-44 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={product}
            onChange={(event) => {
              setProduct(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All products</option>
            <option value="UCAT_WEB">UCATWeb</option>
            <option value="STUDENT_WEB">StudentWeb</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          Entitlement
          <select
            aria-label="Entitlement"
            className="flex h-10 min-w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={entitlement}
            onChange={(event) => {
              setEntitlement(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Free and paid</option>
            <option value="FREE">Free</option>
            <option value="PAID">Paid</option>
          </select>
        </label>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load online students.
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-md border">
          {isFetching && !isLoading ? (
            <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Entitlement</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>In person</TableHead>
                <TableHead>Online since</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                    Loading online students…
                  </TableCell>
                </TableRow>
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                    No online students match these filters.
                  </TableCell>
                </TableRow>
              ) : students.map((student) => {
                const name = `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim();
                return (
                  <TableRow key={student.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="text-left font-medium hover:underline"
                        onClick={() => router.push(`/students/${student.id}?from=online-students`)}
                      >
                        {name || 'Unnamed Student'}
                      </button>
                      <div className="text-xs text-muted-foreground">{student.email ?? 'No email'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {student.products.map((relationship) => (
                          <Badge key={relationship.product} variant="outline">
                            {productLabels[relationship.product]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.entitlement === 'PAID' ? 'default' : 'secondary'}>
                        {student.entitlement === 'PAID' ? 'Paid' : 'Free'}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">
                      {student.subscription_status?.replaceAll('_', ' ') ?? 'None'}
                    </TableCell>
                    <TableCell>
                      {student.in_person_status ? (
                        <Badge variant="outline">{student.in_person_status}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Online only</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(student.online_since)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/students/${student.id}?from=online-students`)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
      />
    </div>
  );
}
