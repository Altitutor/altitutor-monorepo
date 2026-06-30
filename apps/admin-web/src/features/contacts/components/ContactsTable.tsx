'use client';

import { SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';
import type { ContactWithRelations } from '../api/contacts';

interface ContactsTableProps {
  contacts: ContactWithRelations[];
  onExport?: () => void;
  isExporting?: boolean;
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

export function ContactsTable({ contacts }: ContactsTableProps) {
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

  const columns: SettingsDataTableColumn<ContactWithRelations>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (contact) => <span className="font-medium">{getContactDisplayName(contact)}</span>,
      sortValue: getContactDisplayName,
      searchValue: getContactDisplayName,
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (contact) => contact.phone_e164,
      sortValue: (contact) => contact.phone_e164,
      searchValue: (contact) => contact.phone_e164,
    },
    {
      key: 'email',
      label: 'Email',
      render: (contact) => getContactEmail(contact) || '-',
      sortValue: (contact) => getContactEmail(contact) || '',
      searchValue: (contact) => getContactEmail(contact) || '',
    },
    {
      key: 'type',
      label: 'Type',
      render: (contact) => (
        <span className={`px-2 py-1 rounded text-xs ${getContactTypeBadge(contact.contact_type)}`}>
          {contact.contact_type}
        </span>
      ),
      sortValue: (contact) => contact.contact_type,
      filterValue: (contact) => contact.contact_type,
      searchValue: (contact) => contact.contact_type,
    },
  ];

  return (
    <SettingsDataTable
      data={contacts}
      columns={columns}
      getRowId={(contact) => contact.id}
      emptyMessage="No contacts found."
      searchPlaceholder="Search contacts..."
      filterKeys={['type']}
      filterDefinitions={[
        {
          key: 'type',
          label: 'Type',
          options: ['STUDENT', 'PARENT', 'STAFF', 'LEAD', 'OTHER'].map((value) => ({ label: value, value })),
        },
      ]}
      defaultSort={{ field: 'name', direction: 'asc' }}
    />
  );
}
