'use client';

import { useState } from 'react';
import { ContactsTable } from '@/features/contacts/components';
import { contactsApi } from '@/features/contacts/api';
import { generateVcf, downloadVcf } from '@/features/contacts/utils';
import { Loader2, Download } from 'lucide-react';
import { AdminLoadingSkeleton, AdminPageActionButton, SettingsPageHeader } from '@/shared/components';
import { useToast } from '@altitutor/ui';
import { useQuery } from '@tanstack/react-query';

export default function ContactsPage() {
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
    return <AdminLoadingSkeleton variant="table" />;
  }

  if (error) {
    return (
      <div className="p-6">
        <SettingsPageHeader title="Contacts" />
        <div className="text-destructive">
          Failed to load contacts: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <SettingsPageHeader
        title="Contacts"
        actions={(
          <AdminPageActionButton
            icon={isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            label="Export VCF"
            onClick={handleExport}
            disabled={isExporting || !contacts || contacts.length === 0}
          />
        )}
      />

      <ContactsTable
        contacts={contacts || []}
        onExport={handleExport}
        isExporting={isExporting}
      />
    </div>
  );
}
