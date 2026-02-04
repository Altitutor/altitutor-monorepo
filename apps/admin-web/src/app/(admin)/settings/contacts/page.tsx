'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ContactsTable } from '@/features/contacts/components';
import { contactsApi } from '@/features/contacts/api';
import { generateVcf, downloadVcf } from '@/features/contacts/utils';
import { Loader2, ArrowLeft, Download } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { useToast } from '@altitutor/ui';
import { useQuery } from '@tanstack/react-query';

export default function ContactsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const { data: contacts, isLoading, error } = useQuery({
    queryKey: ['contacts', 'all'],
    queryFn: () => contactsApi.getAllContacts(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleExport = async () => {
    if (!contacts || contacts.length === 0) {
      toast({
        title: 'No contacts to export',
        description: 'There are no contacts available to export.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    try {
      const vcfContent = generateVcf(contacts);
      const filename = `contacts-${new Date().toISOString().split('T')[0]}.vcf`;
      downloadVcf(vcfContent, filename);
      
      toast({
        title: 'Export successful',
        description: `Exported ${contacts.length} contacts to VCF file`,
      });
    } catch (error) {
      console.error('Failed to export contacts:', error);
      toast({
        title: 'Export failed',
        description: (error as Error).message || 'Failed to export contacts',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/settings')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Contacts</h1>
          </div>
        </div>
        <div className="text-destructive">
          Failed to load contacts: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/settings')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
            <p className="text-muted-foreground">
              View and export all contacts in the system. Export as VCF for iPhone import.
            </p>
          </div>
          <Button onClick={handleExport} disabled={isExporting || !contacts || contacts.length === 0}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export VCF
              </>
            )}
          </Button>
        </div>
      </div>

      <ContactsTable
        contacts={contacts || []}
        onExport={handleExport}
        isExporting={isExporting}
      />
    </div>
  );
}
