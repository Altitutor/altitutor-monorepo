import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Find or create a contact by phone number or email
 * @param supabase Supabase client
 * @param phone Phone number in E.164 format (optional)
 * @param email Email address (optional)
 * @returns Contact ID
 */
export async function findOrCreateContact(
  supabase: SupabaseClient,
  phone?: string,
  email?: string
): Promise<string> {
  if (!phone && !email) {
    throw new Error('Either phone or email must be provided');
  }

  // Try to find existing contact by phone
  if (phone) {
    const { data: contactByPhone, error: phoneError } = await supabase
      .from('contacts')
      .select('id, email')
      .eq('phone_e164', phone)
      .maybeSingle();
    
    if (phoneError) throw phoneError;
    if (contactByPhone?.id) {
      // Update email if provided and contact doesn't have one
      if (email && !contactByPhone.email) {
        await supabase
          .from('contacts')
          .update({ email })
          .eq('id', contactByPhone.id);
      }
      return contactByPhone.id;
    }
  }

  // Resolve profile matches and existing Apple ID threads atomically.
  if (email) {
    const { data, error } = await supabase.rpc('resolve_messaging_email_contact', { p_email: email });
    if (error) throw error;
    return data as string;
  }

  // Create new contact
  const { data: inserted, error: insErr } = await supabase
    .from('contacts')
    .insert({
      contact_type: 'LEAD',
      phone_e164: phone || null,
      email: email || null,
    })
    .select('id')
    .single();
  
  if (insErr) throw insErr;
  return inserted.id as string;
}

/**
 * Find a contact by identifier (phone or email)
 * @param supabase Supabase client
 * @param identifier Phone number or email address
 * @returns Contact ID or null if not found
 */
export async function findContactByIdentifier(
  supabase: SupabaseClient,
  identifier: string
): Promise<string | null> {
  // Try phone first
  const { data: contactByPhone, error: phoneError } = await supabase
    .from('contacts')
    .select('id')
    .eq('phone_e164', identifier)
    .maybeSingle();
  
  if (phoneError) throw phoneError;
  if (contactByPhone?.id) {
    return contactByPhone.id;
  }

  // Read-only lookup for participant removal; do not create or assign a contact.
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, student_id, parent_id, staff_id')
    .ilike('email', identifier.trim().replace(/[\\%_]/g, '\\$&'));
  if (error) throw error;
  const linked = (contacts ?? []).filter((contact) => contact.student_id || contact.parent_id || contact.staff_id);
  if (linked.length === 1) return linked[0].id;
  if (linked.length > 1) return null;
  return contacts?.length === 1 ? contacts[0].id : null;
}
