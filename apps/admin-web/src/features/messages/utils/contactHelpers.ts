import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database, TablesInsert } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureConversationForRelated } from '../api/queries';

type EnsureContactOptions = {
  /** Create an email-only contact when the person has an Apple ID and no phone. */
  allowEmail?: boolean;
};

/**
 * Ensure contact exists for a student (create if missing)
 * Returns contact ID or null if student has no phone
 */
export async function ensureContactForStudent(
  studentId: string,
  options?: EnsureContactOptions,
): Promise<string | null> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  // Check if contact already exists
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('student_id', studentId)
    .maybeSingle();
  
  if (existingContact?.id) {
    return existingContact.id;
  }
  
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('phone, email')
    .eq('id', studentId)
    .single();

  const phone = student?.phone?.trim() || null;
  const email = student?.email?.trim() || null;
  if (studentError || (!phone && !(options?.allowEmail && email))) {
    return null;
  }
  
  // Create contact
  const contactData: TablesInsert<'contacts'> = {
    contact_type: 'STUDENT',
    student_id: studentId,
    phone_e164: phone,
    email: options?.allowEmail ? email : null,
    is_opted_out: false,
  };
  
  const { data: newContact, error: createError } = await supabase
    .from('contacts')
    .insert(contactData)
    .select('id')
    .single();
  
  if (createError) {
    // Check if it was a duplicate key error (race condition)
    if (createError.code === '23505') {
      const { data: retryContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('student_id', studentId)
        .maybeSingle();
      return retryContact?.id || null;
    }
    console.error('Error creating contact for student:', createError);
    return null;
  }
  
  return newContact.id;
}

/**
 * Ensure contact exists for a parent (create if missing)
 * Returns contact ID or null if parent has no phone
 */
export async function ensureContactForParent(
  parentId: string,
  options?: EnsureContactOptions,
): Promise<string | null> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  // Check if contact already exists
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('parent_id', parentId)
    .maybeSingle();
  
  if (existingContact?.id) {
    return existingContact.id;
  }
  
  const { data: parent, error: parentError } = await supabase
    .from('parents')
    .select('phone, email')
    .eq('id', parentId)
    .single();

  const phone = parent?.phone?.trim() || null;
  const email = parent?.email?.trim() || null;
  if (parentError || (!phone && !(options?.allowEmail && email))) {
    return null;
  }
  
  // Create contact
  const contactData: TablesInsert<'contacts'> = {
    contact_type: 'PARENT',
    parent_id: parentId,
    phone_e164: phone,
    email: options?.allowEmail ? email : null,
    is_opted_out: false,
  };
  
  const { data: newContact, error: createError } = await supabase
    .from('contacts')
    .insert(contactData)
    .select('id')
    .single();
  
  if (createError) {
    // Check if it was a duplicate key error (race condition)
    if (createError.code === '23505') {
      const { data: retryContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('parent_id', parentId)
        .maybeSingle();
      return retryContact?.id || null;
    }
    console.error('Error creating contact for parent:', createError);
    return null;
  }
  
  return newContact.id;
}

/**
 * Ensure contact exists for a staff member (create if missing)
 * Returns contact ID or null if staff has no phone
 */
export async function ensureContactForStaff(
  staffId: string,
  options?: EnsureContactOptions,
): Promise<string | null> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  // Check if contact already exists
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('staff_id', staffId)
    .maybeSingle();
  
  if (existingContact?.id) {
    return existingContact.id;
  }
  
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('phone_number, email')
    .eq('id', staffId)
    .single();

  const phone = staff?.phone_number?.trim() || null;
  const email = staff?.email?.trim() || null;
  if (staffError || (!phone && !(options?.allowEmail && email))) {
    return null;
  }
  
  // Create contact
  const contactData: TablesInsert<'contacts'> = {
    contact_type: 'STAFF',
    staff_id: staffId,
    phone_e164: phone,
    email: options?.allowEmail ? email : null,
    is_opted_out: false,
  };
  
  const { data: newContact, error: createError } = await supabase
    .from('contacts')
    .insert(contactData)
    .select('id')
    .single();
  
  if (createError) {
    // Check if it was a duplicate key error (race condition)
    if (createError.code === '23505') {
      const { data: retryContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('staff_id', staffId)
        .maybeSingle();
      return retryContact?.id || null;
    }
    console.error('Error creating contact for staff:', createError);
    return null;
  }
  
  return newContact.id;
}

/**
 * Batch create/ensure contacts and conversations for students and parents
 * Returns mapping of student/parent IDs to conversation IDs, plus lists of missing phones
 */
export async function getOrCreateContactsAndConversations(
  studentIds: string[],
  includeParents: boolean = false
): Promise<{
  studentConversations: Record<string, string>; // studentId -> conversationId
  parentConversations: Record<string, string>; // parentId -> conversationId
  studentsWithoutPhone: string[];
  parentsWithoutPhone: string[];
}> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  const studentConversations: Record<string, string> = {};
  const parentConversations: Record<string, string> = {};
  const studentsWithoutPhone: string[] = [];
  const parentsWithoutPhone: string[] = [];
  
  // Process students
  for (const studentId of studentIds) {
    try {
      const contactId = await ensureContactForStudent(studentId);
      if (!contactId) {
        studentsWithoutPhone.push(studentId);
        continue;
      }
      
      const conversationId = await ensureConversationForRelated(studentId, 'student');
      if (conversationId) {
        studentConversations[studentId] = conversationId;
      }
    } catch (error) {
      console.error(`Error processing student ${studentId}:`, error);
      studentsWithoutPhone.push(studentId);
    }
  }
  
  // Process parents if requested
  if (includeParents) {
    // Get all parents for these students
    const { data: parentStudents, error: psError } = await supabase
      .from('parents_students')
      .select(`
        parent_id,
        parents (
          id,
          phone
        )
      `)
      .in('student_id', studentIds);
    
    if (psError) {
      console.error('Error fetching parents:', psError);
      return { studentConversations, parentConversations, studentsWithoutPhone, parentsWithoutPhone };
    }
    
    // Get unique parents
    type ParentStudentRow = { parent_id: string };
    const uniqueParentIds = Array.from(
      new Set(
        (parentStudents || []).map((ps: ParentStudentRow) => ps.parent_id).filter(Boolean)
      )
    );
    
    // Process each parent
    for (const parentId of uniqueParentIds) {
      try {
        const contactId = await ensureContactForParent(parentId);
        if (!contactId) {
          parentsWithoutPhone.push(parentId);
          continue;
        }
        
        const conversationId = await ensureConversationForRelated(parentId, 'parent');
        if (conversationId) {
          parentConversations[parentId] = conversationId;
        }
      } catch (error) {
        console.error(`Error processing parent ${parentId}:`, error);
        parentsWithoutPhone.push(parentId);
      }
    }
  }
  
  return {
    studentConversations,
    parentConversations,
    studentsWithoutPhone,
    parentsWithoutPhone,
  };
}

/**
 * Ensure contact exists for a phone number (create if missing)
 * Creates a contact with type 'OTHER' if it doesn't exist
 * Returns contact ID or null if phone is invalid
 */
export async function ensureContactForPhoneNumber(phoneE164: string): Promise<string | null> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  // Check if contact already exists for this phone number
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('phone_e164', phoneE164)
    .maybeSingle();
  
  if (existingContact?.id) {
    return existingContact.id;
  }
  
  // Create contact with type 'OTHER' (no linked student/parent/staff)
  const contactData: TablesInsert<'contacts'> = {
    contact_type: 'OTHER',
    phone_e164: phoneE164,
    student_id: null,
    parent_id: null,
    staff_id: null,
    is_opted_out: false,
  };
  
  const { data: newContact, error: createError } = await supabase
    .from('contacts')
    .insert(contactData)
    .select('id')
    .single();
  
  if (createError) {
    // Check if it was a duplicate key error (race condition)
    if (createError.code === '23505') {
      const { data: retryContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone_e164', phoneE164)
        .maybeSingle();
      return retryContact?.id || null;
    }
    console.error('Error creating contact for phone number:', createError);
    return null;
  }
  
  return newContact.id;
}

export async function ensureContactForEmail(email: string): Promise<string | null> {
  const handle = email.trim();
  if (!handle) return null;
  const supabase = getSupabaseClient() as SupabaseClient<Database>;

  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('email', handle)
    .maybeSingle();
  if (existingContact?.id) return existingContact.id;

  const contactData: TablesInsert<'contacts'> = {
    contact_type: 'LEAD',
    phone_e164: null,
    email: handle,
    student_id: null,
    parent_id: null,
    staff_id: null,
    is_opted_out: false,
  };

  const { data: newContact, error: createError } = await supabase
    .from('contacts')
    .insert(contactData)
    .select('id')
    .single();

  if (createError) {
    if (createError.code === '23505') {
      const { data: retryContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('email', handle)
        .maybeSingle();
      return retryContact?.id || null;
    }
    console.error('Error creating contact for email:', createError);
    return null;
  }

  return newContact.id;
}








