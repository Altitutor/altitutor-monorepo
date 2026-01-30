// @ts-nocheck
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
    const { data: contactByPhone } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone_e164', phone)
      .maybeSingle();
    
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

  // Try to find existing contact by email
  if (email) {
    const { data: contactByEmail } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    
    if (contactByEmail?.id) {
      // Update phone if provided and contact doesn't have one
      if (phone && !contactByEmail.phone_e164) {
        await supabase
          .from('contacts')
          .update({ phone_e164: phone })
          .eq('id', contactByEmail.id);
      }
      return contactByEmail.id;
    }
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
  const { data: contactByPhone } = await supabase
    .from('contacts')
    .select('id')
    .eq('phone_e164', identifier)
    .maybeSingle();
  
  if (contactByPhone?.id) {
    return contactByPhone.id;
  }

  // Try email
  const { data: contactByEmail } = await supabase
    .from('contacts')
    .select('id')
    .eq('email', identifier)
    .maybeSingle();
  
  return contactByEmail?.id || null;
}
