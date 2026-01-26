'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
} from '@altitutor/ui';
import { Download, Loader2 } from 'lucide-react';
import { contactsApi, type ContactWithRelations } from '../api/contacts';
import { generateVcf, downloadVcf } from '../utils/vcf-export';
import { useToast } from '@altitutor/ui';

interface ContactsTableProps {
  contacts: ContactWithRelations[];
  onExport: () => void;
  isExporting: boolean;
}

function getContactDisplayName(contact: ContactWithRelations): string {
  switch (contact.contact_type) {
    case 'STUDENT': {
      if (contact.students) {
        return `${contact.students.first_name} ${contact.students.last_name}`.trim();
      }
      return contact.phone_e164;
    }
    case 'PARENT': {
      if (contact.parents) {
        return `${contact.parents.first_name} ${contact.parents.last_name}`.trim();
      }
      return contact.phone_e164;
    }
    case 'STAFF': {
      if (contact.staff) {
        return `${contact.staff.first_name} ${contact.staff.last_name}`.trim();
      }
      return contact.phone_e164;
    }
    default:
      return contact.phone_e164;
  }
}

function getContactEmail(contact: ContactWithRelations): string | null {
  if (contact.students?.email) return contact.students.email;
  if (contact.parents?.email) return contact.parents.email;
  if (contact.staff?.email) return contact.staff.email;
  return null;
}

export function ContactsTable({ contacts, onExport, isExporting }: ContactsTableProps) {
  const getContactTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      STUDENT: 'bg-blue-100 text-blue-800',
      PARENT: 'bg-green-100 text-green-800',
      STAFF: 'bg-purple-100 text-purple-800',
      LEAD: 'bg-yellow-100 text-yellow-800',
      OTHER: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || colors.OTHER;
  };

  return (
    <>
      {contacts.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          No contacts found.
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">
                    {getContactDisplayName(contact)}
                  </TableCell>
                  <TableCell>{contact.phone_e164}</TableCell>
                  <TableCell>{getContactEmail(contact) || '-'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${getContactTypeBadge(contact.contact_type)}`}>
                      {contact.contact_type}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
