/**
 * VCF Export Utilities
 * 
 * Functions for generating VCF (vCard) files from contacts
 */

import type { ContactWithRelations } from '../api/contacts';

/**
 * Escape special characters for VCF format
 */
function escapeVcfValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')  // Escape backslashes
    .replace(/;/g, '\\;')    // Escape semicolons
    .replace(/,/g, '\\,')    // Escape commas
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '');     // Remove carriage returns
}

/**
 * Get display name for a contact
 */
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

/**
 * Get email for a contact
 */
function getContactEmail(contact: ContactWithRelations): string | null {
  if (contact.students?.email) return contact.students.email;
  if (contact.parents?.email) return contact.parents.email;
  if (contact.staff?.email) return contact.staff.email;
  return null;
}

/**
 * Generate a single vCard entry
 */
function generateVCard(contact: ContactWithRelations): string {
  const lines: string[] = [];
  
  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');
  
  // Full name (FN)
  const displayName = getContactDisplayName(contact);
  lines.push(`FN:${escapeVcfValue(displayName)}`);
  
  // Structured name (N) - last name;first name;middle name;prefix;suffix
  let lastName = '';
  let firstName = '';
  
  if (contact.students) {
    firstName = contact.students.first_name || '';
    lastName = contact.students.last_name || '';
  } else if (contact.parents) {
    firstName = contact.parents.first_name || '';
    lastName = contact.parents.last_name || '';
  } else if (contact.staff) {
    firstName = contact.staff.first_name || '';
    lastName = contact.staff.last_name || '';
  }
  
  // Always include N field (required by vCard spec)
  lines.push(`N:${escapeVcfValue(lastName)};${escapeVcfValue(firstName)};;;`);
  
  // Phone number (TEL)
  if (contact.phone_e164) {
    lines.push(`TEL;TYPE=CELL:${contact.phone_e164}`);
  }
  
  // Email (EMAIL)
  const email = getContactEmail(contact);
  if (email) {
    lines.push(`EMAIL;TYPE=INTERNET:${escapeVcfValue(email)}`);
  }
  
  // Note with contact type
  const note = `Contact Type: ${contact.contact_type}`;
  lines.push(`NOTE:${escapeVcfValue(note)}`);
  
  lines.push('END:VCARD');
  
  return lines.join('\n');
}

/**
 * Generate VCF file content from contacts
 */
export function generateVcf(contacts: ContactWithRelations[]): string {
  const vcards = contacts.map(generateVCard);
  return vcards.join('\n\n');
}

/**
 * Download VCF file
 */
export function downloadVcf(vcfContent: string, filename: string = 'contacts.vcf'): void {
  const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
