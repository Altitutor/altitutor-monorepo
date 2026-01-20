'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { DateRangePicker } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { fetchTutorLogsForExport } from '../api/quickbooks-export';
import { processTutorLogsForExport } from '../utils/quickbooks-export.processor';
import { generateCsv, downloadCsv } from '../utils/quickbooks-export.utils';
import { getDefaultDateRange } from '../config/quickbooks-export.config';
import { useToast } from '@altitutor/ui';

type QuickBooksExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function QuickBooksExportModal({
  isOpen,
  onClose,
}: QuickBooksExportModalProps) {
  const { toast } = useToast();
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [startDate, setStartDate] = useState<string>(defaultRange.startDate);
  const [endDate, setEndDate] = useState<string>(defaultRange.endDate);
  
  // Fetch tutor logs for export
  const { data: tutorLogsData, isLoading, error } = useQuery({
    queryKey: ['tutor-logs-export', startDate, endDate],
    queryFn: () => fetchTutorLogsForExport({ startDate, endDate }),
    enabled: isOpen && !!startDate && !!endDate,
  });
  
  // Process tutor logs into QuickBooks entries
  const quickBooksEntries = useMemo(() => {
    if (!tutorLogsData) return [];
    return processTutorLogsForExport(tutorLogsData);
  }, [tutorLogsData]);
  
  // Generate CSV preview
  const csvPreview = useMemo(() => {
    if (quickBooksEntries.length === 0) return '';
    return generateCsv(quickBooksEntries);
  }, [quickBooksEntries]);
  
  // Generate filename
  const filename = useMemo(() => {
    const formatDate = (dateStr: string) => dateStr.replace(/-/g, '');
    return `quickbooks-timesheet-${formatDate(startDate)}-${formatDate(endDate)}.csv`;
  }, [startDate, endDate]);
  
  // Handle export
  const handleExport = () => {
    if (csvPreview) {
      downloadCsv(csvPreview, filename);
      toast({
        title: 'Export successful',
        description: `Downloaded ${quickBooksEntries.length} timesheet entries`,
      });
      onClose();
    }
  };
  
  // Reset dates when modal opens
  useEffect(() => {
    if (isOpen) {
      const range = getDefaultDateRange();
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  }, [isOpen]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Export to QuickBooks</DialogTitle>
          <DialogDescription>
            Export tutor logs as a QuickBooks-compatible timesheet CSV file
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Date Range Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Date Range</label>
            <DateRangePicker
              from={startDate}
              to={endDate}
              onFromChange={setStartDate}
              onToChange={setEndDate}
            />
          </div>
          
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading tutor logs...
              </span>
            </div>
          )}
          
          {/* Error State */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              Error loading tutor logs: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          )}
          
          {/* CSV Preview */}
          {!isLoading && !error && (
            <div className="flex-1 flex flex-col gap-2 min-h-0">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Preview ({quickBooksEntries.length} entries)
                </label>
                <span className="text-xs text-muted-foreground">
                  {filename}
                </span>
              </div>
              <ScrollArea className="flex-1 border rounded-md">
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
                  {csvPreview || 'No data to export'}
                </pre>
              </ScrollArea>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isLoading || !!error || quickBooksEntries.length === 0}
          >
            Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
