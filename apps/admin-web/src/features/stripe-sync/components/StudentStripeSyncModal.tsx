'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Loader2, Search, CreditCard, X, Check, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@altitutor/ui';
import { type StripeCustomer } from '../api/stripe-sync';
import { useStripeSyncData } from '../hooks/useStripeSyncData';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';

interface StudentStripeSyncModalProps {
  isOpen: boolean;
  onClose: (shouldRefresh?: boolean) => void;
  studentId: string;
  allStudents?: Array<{
    student_id: string;
    student_name: string;
    stripe_customer_id: string | null;
  }>;
}

export function StudentStripeSyncModal({
  isOpen,
  onClose,
  studentId,
  allStudents = [],
}: StudentStripeSyncModalProps) {
  // Use hook for all Stripe sync data and operations
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  const {
    student,
    linkedCustomerId,
    linkedCustomer,
    exactMatches,
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
  } = useStripeSyncData({
    isOpen,
    studentId,
    allStudents,
  });

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

  // Wrap handleSync to call onClose with refresh flag after successful sync
  const handleSyncWithClose = async (customerId: string) => {
    try {
      await handleSync(customerId);
      onClose(true);
    } catch {
      // Error handling is done in the hook
    }
  };

  // Wrap handleUnlink to call onClose with refresh flag after successful unlink
  const handleUnlinkWithClose = async () => {
    try {
      await handleUnlink();
      onClose(true);
    } catch {
      // Error handling is done in the hook
    }
  };

  const formatCardDisplay = (pm: StripeCustomer['payment_methods'][0]) => {
    if (!pm.card) return 'Unknown';
    return `${pm.card.brand.toUpperCase()} •••• ${pm.card.last4} (${pm.card.exp_month}/${pm.card.exp_year})`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose(false);
      }
    }}>
      <DialogContent
        className={cn(
          'w-full md:max-w-4xl h-[90vh] flex flex-col p-0',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle>
                {student ? `Sync Stripe Customer: ${student.name}` : 'Sync Stripe Customer'}
              </DialogTitle>
              <DialogDescription>
                {student?.email && `Student email: ${student.email}`}
              </DialogDescription>
            </div>
            <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0 flex">
          {/* Left Column - Comparison Table */}
          <div className="w-1/2 border-r p-6 overflow-y-auto">
            {isLoadingLinked ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : linkedCustomer ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Comparison</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSyncToStripe}
                      disabled={isSyncingToStripe}
                    >
                      {isSyncingToStripe ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Sync
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUnlinkWithClose}
                      disabled={isUnlinking}
                    >
                      {isUnlinking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Unlinking...
                        </>
                      ) : (
                        <>
                          <X className="mr-2 h-4 w-4" />
                          Unlink
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Customer ID:</span>{' '}
                    <code className="text-xs bg-background px-2 py-1 rounded">
                      {linkedCustomer.id}
                    </code>
                  </div>
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Field</TableHead>
                        <TableHead>Database</TableHead>
                        <TableHead>Stripe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Name Row */}
                      <TableRow>
                        <TableCell className="font-medium">Name</TableCell>
                        <TableCell className={linkedMatches?.name ? 'bg-green-50 dark:bg-green-950/20' : linkedMatches && !linkedMatches.name ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          {student?.name || '-'}
                        </TableCell>
                        <TableCell className={linkedMatches?.name ? 'bg-green-50 dark:bg-green-950/20' : linkedMatches && !linkedMatches.name ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          {linkedCustomer.name || '-'}
                        </TableCell>
                      </TableRow>
                      
                      {/* Email Row */}
                      <TableRow>
                        <TableCell className="font-medium">Email</TableCell>
                        <TableCell className={linkedMatches?.email ? 'bg-green-50 dark:bg-green-950/20' : linkedMatches && !linkedMatches.email ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          {student?.email || '-'}
                        </TableCell>
                        <TableCell className={linkedMatches?.email ? 'bg-green-50 dark:bg-green-950/20' : linkedMatches && !linkedMatches.email ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          {linkedCustomer.email || '-'}
                        </TableCell>
                      </TableRow>
                      
                      {/* Payment Methods Row */}
                      <TableRow>
                        <TableCell className="font-medium">Payment Methods</TableCell>
                        <TableCell className={linkedMatches?.paymentMethods ? 'bg-green-50 dark:bg-green-950/20' : linkedMatches && !linkedMatches.paymentMethods ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          {dbPaymentMethods.length === 0 ? (
                            <span className="text-muted-foreground text-sm">None</span>
                          ) : (
                            <div className="space-y-1">
                              {dbPaymentMethods.map((pm) => (
                                <div key={pm.id} className="text-sm">
                                  •••• {pm.card_last4}
                                  {pm.is_default && (
                                    <Badge variant="default" className="ml-2 text-xs">Default</Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={linkedMatches?.paymentMethods ? 'bg-green-50 dark:bg-green-950/20' : linkedMatches && !linkedMatches.paymentMethods ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          {linkedCustomer.payment_methods.length === 0 ? (
                            <span className="text-muted-foreground text-sm">None</span>
                          ) : (
                            <div className="space-y-1">
                              {linkedCustomer.payment_methods.map((pm) => (
                                <div key={pm.id} className="text-sm">
                                  •••• {pm.card?.last4 || 'N/A'}
                                  {pm.is_default && (
                                    <Badge variant="default" className="ml-2 text-xs">Default</Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No customer linked
              </div>
            )}
          </div>

          {/* Right Column - Stripe Customers */}
          <div className="w-1/2 p-6 overflow-y-auto flex flex-col">
            <div className="space-y-4 flex-1 min-h-0 flex flex-col">
              <div className="flex-shrink-0">
                <h3 className="font-semibold mb-4">
                  {linkedCustomer ? 'Other Stripe Customers' : 'Stripe Customers'}
                </h3>
                
                {/* Search bar and button on new line */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearch();
                        }
                      }}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    onClick={handleSearch}
                    disabled={isSearching}
                    variant="default"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Search
                      </>
                    )}
                  </Button>
                </div>

                {/* Show loading state for exact matches */}
                {isLoadingExactMatches && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Finding exact matches...</span>
                  </div>
                )}

                {/* Show exact matches info */}
                {!isLoadingExactMatches && exactMatches.length > 0 && (
                  <div className="text-sm text-muted-foreground py-2">
                    Found {exactMatches.length} exact match(es) by email or name
                  </div>
                )}
              </div>

              <div className="border rounded-lg flex-1 overflow-y-auto min-h-0">
                {filteredCustomers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {searchTerm ? 'No customers found. Try searching.' : 'No customers found. Use search to find customers.'}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredCustomers.map((customer) => {
                      const isLinked = customer.id === linkedCustomerId;
                      const matches = customerMatches.get(customer.id);
                      const hasMatch = matches?.nameMatch || matches?.emailMatch;
                      
                      return (
                        <div
                          key={customer.id}
                          className={`p-4 hover:bg-muted/50 ${
                            isLinked ? 'bg-muted/30' : ''
                          } ${
                            hasMatch ? 'bg-green-50 dark:bg-green-950/20 border-l-4 border-l-green-500' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-background px-2 py-1 rounded">
                                  {customer.id}
                                </code>
                                {isLinked && (
                                  <Badge variant="default">
                                    <Check className="mr-1 h-3 w-3" />
                                    Linked
                                  </Badge>
                                )}
                                {hasMatch && !isLinked && (
                                  <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    Match
                                  </Badge>
                                )}
                              </div>
                              {customer.name && (
                                <div className={`font-medium ${matches?.nameMatch ? 'text-green-600 dark:text-green-400' : ''}`}>
                                  {customer.name}
                                </div>
                              )}
                              {customer.email && (
                                <div className={`text-sm ${matches?.emailMatch ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground'}`}>
                                  {customer.email}
                                </div>
                              )}
                              <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                                  <span>{customer.payment_methods.length} payment method(s)</span>
                                </div>
                              </div>
                              {customer.payment_methods.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {customer.payment_methods.map((pm) => (
                                    <div
                                      key={pm.id}
                                      className="text-xs text-muted-foreground pl-4"
                                    >
                                      • {formatCardDisplay(pm)}
                                      {pm.is_default && (
                                        <Badge variant="outline" className="ml-2 text-xs">Default</Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              {!isLinked && (() => {
                                const linkedToStudent = customerToStudentMap.get(customer.id);
                                
                                return (
                                  <Button
                                    size="sm"
                                    onClick={() => handleSyncWithClose(customer.id)}
                                    disabled={isSyncing}
                                    variant={linkedToStudent ? 'outline' : 'default'}
                                    className={linkedToStudent ? 'opacity-50 cursor-not-allowed' : ''}
                                  >
                                    {isSyncing ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Syncing...
                                      </>
                                    ) : (
                                      'Link'
                                    )}
                                  </Button>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
