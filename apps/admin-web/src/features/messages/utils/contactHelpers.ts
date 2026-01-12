import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database, TablesInsert } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureConversationForRelated } from '../api/queries';

/**
 * Ensure contact exists for a student (create if missing)
 * Returns contact ID or null if student has no phone
 */
export async function ensureContactForStudent(studentId: string): Promise<string | null> {
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
  
  // Get student phone
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('phone')
    .eq('id', studentId)
    .single();
  
  if (studentError || !student?.phone) {
    return null; // No phone number available
  }
  
  // Create contact
  const contactData: TablesInsert<'contacts'> = {
    contact_type: 'STUDENT',
    student_id: studentId,
    phone_e164: student.phone,
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
export async function ensureContactForParent(parentId: string): Promise<string | null> {
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
  
  // Get parent phone
  const { data: parent, error: parentError } = await supabase
    .from('parents')
    .select('phone')
    .eq('id', parentId)
    .single();
  
  if (parentError || !parent?.phone) {
    return null; // No phone number available
  }
  
  // Create contact
  const contactData: TablesInsert<'contacts'> = {
    contact_type: 'PARENT',
    parent_id: parentId,
    phone_e164: parent.phone,
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
export async function ensureContactForStaff(staffId: string): Promise<string | null> {
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
  
  // Get staff phone
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('phone_number')
    .eq('id', staffId)
    .single();
  
  if (staffError || !staff?.phone_number) {
    return null; // No phone number available
  }
  
  // Create contact
  const contactData: TablesInsert<'contacts'> = {
    contact_type: 'STAFF',
    staff_id: staffId,
    phone_e164: staff.phone_number,
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
    const uniqueParentIds = Array.from(
      new Set(
        (parentStudents || [])
          .map((ps: any) => ps.parent_id)
          .filter(Boolean)
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








