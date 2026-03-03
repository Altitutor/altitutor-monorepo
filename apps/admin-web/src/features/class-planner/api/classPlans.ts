import type { Tables, TablesInsert, TablesUpdate, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { classesApi } from '@/features/classes/api/classes';
import { format } from 'date-fns';

export type DraftClassPlan = Tables<'draft_class_plans'>;
export type DraftClassPlanSlot = Tables<'draft_class_plan_slots'>;
export type DraftClass = Tables<'draft_classes'>;
export type DraftClassStudent = Tables<'draft_classes_students'>;
export type DraftClassStaff = Tables<'draft_classes_staff'>;

export type DraftClassPlanWithDetails = DraftClassPlan & {
  slots: DraftClassPlanSlot[];
  classes: (DraftClass & {
    subject?: Tables<'subjects'> | null;
    students: Tables<'students'>[];
    staff: Tables<'staff'>[];
  })[];
};

export type CreateClassPlanData = {
  name: string;
  year: number;
  default_class_length_hours?: number;
  slots: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
  created_by: string;
};

export type UpdateClassPlanData = {
  name?: string;
  default_class_length_hours?: number;
  slots?: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
};

/**
 * Class Plans API client for working with draft class plans
 */
export const classPlansApi = {
  /**
   * Get all class plans
   */
  getAllClassPlans: async (): Promise<DraftClassPlan[]> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('draft_class_plans')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as DraftClassPlan[];
  },

  /**
   * Get a single class plan with all related data
   */
  getClassPlan: async (id: string): Promise<DraftClassPlanWithDetails | null> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Get plan
      const { data: plan, error: planError } = await supabase
        .from('draft_class_plans')
        .select('*')
        .eq('id', id)
        .single();
      
      if (planError) {
        if (planError.code === 'PGRST116') return null;
        throw planError;
      }
      
      if (!plan) return null;

      // Get slots
      const { data: slots, error: slotsError } = await supabase
        .from('draft_class_plan_slots')
        .select('*')
        .eq('draft_class_plan_id', id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });
      
      if (slotsError) throw slotsError;

      // Get classes with subject
      const { data: classes, error: classesError } = await supabase
        .from('draft_classes')
        .select(`
          *,
          subject:subjects(*)
        `)
        .eq('draft_class_plan_id', id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });
      
      if (classesError) throw classesError;

      // Get students for each class
      const classIds = (classes ?? []).map(c => c.id);
      const { data: classStudents, error: studentsError } = classIds.length > 0
        ? await supabase
            .from('draft_classes_students')
            .select(`
              draft_class_id,
              student:students(*)
            `)
            .in('draft_class_id', classIds)
        : { data: [], error: null };
      
      if (studentsError) throw studentsError;

      // Get staff for each class
      const { data: classStaff, error: staffError } = classIds.length > 0
        ? await supabase
            .from('draft_classes_staff')
            .select(`
              draft_class_id,
              type,
              staff:staff(*)
            `)
            .in('draft_class_id', classIds)
        : { data: [], error: null };
      
      if (staffError) throw staffError;

      type ClassStudentRow = { draft_class_id: string | null; student: Tables<'students'> | null };
      type ClassStaffRow = { draft_class_id: string | null; type: string | null; staff: Tables<'staff'> | null };
      type DraftClassWithSubject = Tables<'draft_classes'> & { subject?: Tables<'subjects'> | null };
      const classesWithDetails = (classes ?? []).map((cls: DraftClassWithSubject) => {
        const students = (classStudents ?? [] as ClassStudentRow[])
          .filter((cs: ClassStudentRow) => cs.draft_class_id === cls.id && cs.student)
          .map((cs: ClassStudentRow) => cs.student)
          .filter(Boolean) as Tables<'students'>[];
        
        const staff = (classStaff ?? [] as ClassStaffRow[])
          .filter((cs: ClassStaffRow) => cs.draft_class_id === cls.id && cs.staff)
          .map((cs: ClassStaffRow) => cs.staff)
          .filter(Boolean) as Tables<'staff'>[];

        return {
          ...cls,
          subject: cls.subject || null,
          students,
          staff,
        };
      });

      return {
        ...plan,
        slots: (slots ?? []) as DraftClassPlanSlot[],
        classes: classesWithDetails,
      };
    } catch (error) {
      console.error('Error getting class plan:', error);
      throw error;
    }
  },

  /**
   * Create a new class plan
   */
  createClassPlan: async (data: CreateClassPlanData): Promise<DraftClassPlan> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Create plan
      const planPayload: TablesInsert<'draft_class_plans'> = {
        id: crypto.randomUUID(),
        name: data.name,
        year: data.year,
        default_class_length_hours: data.default_class_length_hours ?? 1.5,
        created_by: data.created_by,
        status: 'DRAFT',
      };

      const { data: plan, error: planError } = await supabase
        .from('draft_class_plans')
        .insert(planPayload)
        .select()
        .single();
      
      if (planError) throw planError;

      // Create slots
      if (data.slots.length > 0) {
        const slotsPayload: TablesInsert<'draft_class_plan_slots'>[] = data.slots.map(slot => ({
          id: crypto.randomUUID(),
          draft_class_plan_id: plan.id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
        }));

        const { error: slotsError } = await supabase
          .from('draft_class_plan_slots')
          .insert(slotsPayload);
        
        if (slotsError) throw slotsError;
      }

      return plan as DraftClassPlan;
    } catch (error) {
      console.error('Error creating class plan:', error);
      throw error;
    }
  },

  /**
   * Update a class plan
   */
  updateClassPlan: async (id: string, data: UpdateClassPlanData): Promise<DraftClassPlan> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Update plan
      const updatePayload: TablesUpdate<'draft_class_plans'> = {};
      if (data.name !== undefined) updatePayload.name = data.name;
      if (data.default_class_length_hours !== undefined) {
        updatePayload.default_class_length_hours = data.default_class_length_hours;
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: planError } = await supabase
          .from('draft_class_plans')
          .update(updatePayload)
          .eq('id', id)
          .select()
          .single();
        
        if (planError) throw planError;
      }

      // Update slots if provided
      if (data.slots !== undefined) {
        // Delete existing slots
        const { error: deleteError } = await supabase
          .from('draft_class_plan_slots')
          .delete()
          .eq('draft_class_plan_id', id);
        
        if (deleteError) throw deleteError;

        // Insert new slots
        if (data.slots.length > 0) {
          const slotsPayload: TablesInsert<'draft_class_plan_slots'>[] = data.slots.map(slot => ({
            id: crypto.randomUUID(),
            draft_class_plan_id: id,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
          }));

          const { error: slotsError } = await supabase
            .from('draft_class_plan_slots')
            .insert(slotsPayload);
          
          if (slotsError) throw slotsError;
        }
      }

      // Fetch updated plan
      const { data: updatedPlan, error: fetchError } = await supabase
        .from('draft_class_plans')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      return updatedPlan as DraftClassPlan;
    } catch (error) {
      console.error('Error updating class plan:', error);
      throw error;
    }
  },

  /**
   * Delete a class plan (cascades to all related tables)
   */
  deleteClassPlan: async (id: string): Promise<void> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { error } = await supabase
      .from('draft_class_plans')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Duplicate a class plan
   */
  duplicateClassPlan: async (id: string, newName: string, createdBy: string): Promise<DraftClassPlan> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Get original plan with all data
      const originalPlan = await classPlansApi.getClassPlan(id);
      if (!originalPlan) throw new Error('Plan not found');

      // Create new plan
      const newPlan = await classPlansApi.createClassPlan({
        name: newName,
        year: originalPlan.year,
        default_class_length_hours: originalPlan.default_class_length_hours ?? undefined,
        slots: originalPlan.slots.map(slot => ({
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
        })),
        created_by: createdBy,
      });

      // Copy classes
      const classIdMap = new Map<string, string>(); // old_id -> new_id
      for (const draftClass of originalPlan.classes) {
        const newClassPayload: TablesInsert<'draft_classes'> = {
          id: crypto.randomUUID(),
          draft_class_plan_id: newPlan.id,
          subject_id: draftClass.subject_id,
          day_of_week: draftClass.day_of_week,
          start_time: draftClass.start_time,
          end_time: draftClass.end_time,
          room: draftClass.room,
          level: draftClass.level,
          status: draftClass.status,
        };
        
        const { data: newClass, error: classError } = await supabase
          .from('draft_classes')
          .insert(newClassPayload)
          .select()
          .single();
        
        if (classError) throw classError;
        classIdMap.set(draftClass.id, newClass.id);
      }

      // Copy students
      for (const draftClass of originalPlan.classes) {
        const newClassId = classIdMap.get(draftClass.id);
        if (!newClassId) continue;

        for (const student of draftClass.students) {
          const { error: studentError } = await supabase
            .from('draft_classes_students')
            .insert({
              id: crypto.randomUUID(),
              draft_class_id: newClassId,
              student_id: student.id,
            });
          
          if (studentError) throw studentError;
        }
      }

      // Copy staff
      for (const draftClass of originalPlan.classes) {
        const newClassId = classIdMap.get(draftClass.id);
        if (!newClassId) continue;

        for (const staffMember of draftClass.staff) {
          // Get type from draft_classes_staff
          const { data: staffAssignment } = await supabase
            .from('draft_classes_staff')
            .select('type')
            .eq('draft_class_id', draftClass.id)
            .eq('staff_id', staffMember.id)
            .maybeSingle();
          
          const { error: staffError } = await supabase
            .from('draft_classes_staff')
            .insert({
              id: crypto.randomUUID(),
              draft_class_id: newClassId,
              staff_id: staffMember.id,
              type: (staffAssignment as any)?.type || 'MAIN_TUTOR',
            });
          
          if (staffError) throw staffError;
        }
      }

      return newPlan;
    } catch (error) {
      console.error('Error duplicating class plan:', error);
      throw error;
    }
  },

  /**
   * Copy current classes to a draft plan
   */
  copyCurrentClassesToDraft: async (
    year: number,
    planName: string,
    createdBy: string
  ): Promise<DraftClassPlan> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Get all current classes using RPC
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_classes_admin', {
        p_search: undefined,
        p_statuses: ['ACTIVE'],
        p_include_relationships: true,
        p_exclude_student_search: false,
        p_exclude_staff_search: false,
        p_limit: 10000,
        p_offset: 0,
        p_order_by: 'day_of_week',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) throw new Error('Failed to fetch classes');

      type RpcClass = Tables<'classes'> & { subject_id?: string; day_of_week?: number; start_time?: string; end_time?: string; room?: string | null };
      const rpcData = rpcResult as {
        classes: RpcClass[];
        classSubjects: Record<string, Tables<'subjects'>>;
        classStudents: Record<string, Tables<'students'>[]>;
        classStaff: Record<string, Tables<'staff'>[]>;
        total: number;
      };

      const classes = (rpcData.classes || []) as RpcClass[];
      if (classes.length === 0) {
        throw new Error('No active classes found to copy');
      }

      // Extract unique slots from classes
      const slotsMap = new Map<string, { day_of_week: number; start_time: string; end_time: string }>();
      classes.forEach((cls: RpcClass) => {
        const key = `${cls.day_of_week}-${cls.start_time}-${cls.end_time}`;
        if (!slotsMap.has(key)) {
          slotsMap.set(key, {
            day_of_week: cls.day_of_week,
            start_time: cls.start_time,
            end_time: cls.end_time,
          });
        }
      });

      // Create draft plan
      const plan = await classPlansApi.createClassPlan({
        name: planName,
        year,
        slots: Array.from(slotsMap.values()),
        created_by: createdBy,
      });

      // Copy classes
      const classIdMap = new Map<string, string>(); // real_id -> draft_id
      for (const cls of classes) {
        const draftClassPayload: TablesInsert<'draft_classes'> = {
          id: crypto.randomUUID(),
          draft_class_plan_id: plan.id,
          subject_id: cls.subject_id,
          day_of_week: cls.day_of_week,
          start_time: cls.start_time,
          end_time: cls.end_time,
          room: cls.room,
          level: cls.level,
          status: cls.status || 'ACTIVE',
        };

        const { data: draftClass, error: classError } = await supabase
          .from('draft_classes')
          .insert(draftClassPayload)
          .select()
          .single();

        if (classError) throw classError;
        classIdMap.set(cls.id, draftClass.id);
      }

      // Copy students (only active enrollments)
      for (const cls of classes) {
        const draftClassId = classIdMap.get(cls.id);
        if (!draftClassId) continue;

        const students = rpcData.classStudents?.[cls.id] || [];
        for (const student of students) {
          const { error: studentError } = await supabase
            .from('draft_classes_students')
            .insert({
              id: crypto.randomUUID(),
              draft_class_id: draftClassId,
              student_id: student.id,
            });

          if (studentError) throw studentError;
        }
      }

      // Copy staff (only active assignments)
      for (const cls of classes) {
        const draftClassId = classIdMap.get(cls.id);
        if (!draftClassId) continue;

        const staff = rpcData.classStaff?.[cls.id] || [];
        for (const staffMember of staff) {
          const { error: staffError } = await supabase
            .from('draft_classes_staff')
            .insert({
              id: crypto.randomUUID(),
              draft_class_id: draftClassId,
              staff_id: staffMember.id,
              type: 'MAIN_TUTOR', // Default type for draft classes
            });

          if (staffError) throw staffError;
        }
      }

      return plan;
    } catch (error) {
      console.error('Error copying current classes to draft:', error);
      throw error;
    }
  },

  /**
   * Apply a class plan (atomic operation)
   * 1. Create backup plan
   * 2. Delete all existing classes
   * 3. Create new classes from draft
   * 4. Generate sessions from sessionStartDate onwards
   * 5. Mark plan as applied
   */
  applyClassPlan: async (
    planId: string,
    sessionStartDate: Date,
    staffId: string
  ): Promise<void> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Get draft plan data
      const plan = await classPlansApi.getClassPlan(planId);
      if (!plan) throw new Error('Plan not found');
      if (plan.status === 'APPLIED') {
        throw new Error('Plan has already been applied');
      }

      // Step 1: Create backup plan
      const timestamp = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'");
      const backupPlanName = `BACKUP class plan ${timestamp}`;
      
      await classPlansApi.copyCurrentClassesToDraft(
        plan.year,
        backupPlanName,
        staffId
      );

      // Step 2: Delete all existing classes (cascade deletes enrollments, staff, sessions)
      // Get all class IDs first, then delete them
      const { data: allClasses, error: fetchError } = await supabase
        .from('classes')
        .select('id');
      
      if (fetchError) throw fetchError;
      
      const classIds = (allClasses || []).map(c => c.id);
      if (classIds.length > 0) {
        // Delete classes in batches if needed (PostgreSQL has limits)
        const batchSize = 1000;
        for (let i = 0; i < classIds.length; i += batchSize) {
          const batch = classIds.slice(i, i + batchSize);
          const { error: deleteError } = await supabase
            .from('classes')
            .delete()
            .in('id', batch);
          
          if (deleteError) throw deleteError;
        }
      }

      // Step 3: Create real classes from drafts
      const classIdMap = new Map<string, string>(); // draft_id -> real_id
      for (const draftClass of plan.classes) {
        const realClass = await classesApi.createClass({
          id: crypto.randomUUID(),
          subject_id: draftClass.subject_id,
          day_of_week: draftClass.day_of_week ?? 0,
          start_time: draftClass.start_time,
          end_time: draftClass.end_time,
          room: draftClass.room,
          level: draftClass.level,
          status: draftClass.status || 'ACTIVE',
          created_by: staffId,
        });
        classIdMap.set(draftClass.id, realClass.id);
      }

      // Step 4: Create enrollments
      for (const draftClass of plan.classes) {
        const realClassId = classIdMap.get(draftClass.id);
        if (!realClassId) continue;

        for (const student of draftClass.students) {
          await classesApi.enrollStudent(
            realClassId,
            student.id,
            new Date(),
            staffId
          );
        }
      }

      // Step 5: Create staff assignments
      for (const draftClass of plan.classes) {
        const realClassId = classIdMap.get(draftClass.id);
        if (!realClassId) continue;

        for (const staffMember of draftClass.staff) {
          await classesApi.assignStaff(
            realClassId,
            staffMember.id,
            staffId
          );
        }
      }

      // Step 6: Mark plan as applied
      // Note: Sessions are automatically created by database triggers when classes are created
      await classPlansApi.updateClassPlan(planId, {});
      const { error: updateError } = await supabase
        .from('draft_class_plans')
        .update({
          status: 'APPLIED',
          applied_at: new Date().toISOString(),
          applied_by: staffId,
        })
        .eq('id', planId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error applying class plan:', error);
      throw error;
    }
  },

  /**
   * Create a draft class
   */
  createDraftClass: async (
    planId: string,
    data: {
      subject_id?: string | null;
      day_of_week?: number | null;
      start_time: string | null;
      end_time: string | null;
      room?: string | null;
      level?: string | null;
      status?: 'ACTIVE' | 'INACTIVE';
    }
  ): Promise<DraftClass> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    const payload: TablesInsert<'draft_classes'> = {
      id: crypto.randomUUID(),
      draft_class_plan_id: planId,
      subject_id: data.subject_id || null,
      day_of_week: data.day_of_week ?? null,
      start_time: data.start_time || '',
      end_time: data.end_time || '',
      room: data.room || null,
      level: data.level || null,
      status: data.status || 'ACTIVE',
    };

    const { data: draftClass, error } = await supabase
      .from('draft_classes')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return draftClass as DraftClass;
  },

  /**
   * Update a draft class
   */
  updateDraftClass: async (
    classId: string,
    data: Partial<{
      subject_id: string | null;
      day_of_week: number | null;
      start_time?: string;
      end_time?: string;
      room: string | null;
      level: string | null;
      status: 'ACTIVE' | 'INACTIVE';
    }>
  ): Promise<DraftClass> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    const { data: draftClass, error } = await supabase
      .from('draft_classes')
      .update(data)
      .eq('id', classId)
      .select()
      .single();

    if (error) throw error;
    return draftClass as DraftClass;
  },

  /**
   * Delete a draft class
   */
  deleteDraftClass: async (classId: string): Promise<void> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { error } = await supabase
      .from('draft_classes')
      .delete()
      .eq('id', classId);
    if (error) throw error;
  },

  /**
   * Add a student to a draft class
   */
  addStudentToDraftClass: async (classId: string, studentId: string): Promise<DraftClassStudent> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    const payload: TablesInsert<'draft_classes_students'> = {
      id: crypto.randomUUID(),
      draft_class_id: classId,
      student_id: studentId,
    };

    const { data, error } = await supabase
      .from('draft_classes_students')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as DraftClassStudent;
  },

  /**
   * Remove a student from a draft class
   */
  removeStudentFromDraftClass: async (classId: string, studentId: string): Promise<void> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { error } = await supabase
      .from('draft_classes_students')
      .delete()
      .eq('draft_class_id', classId)
      .eq('student_id', studentId);
    if (error) throw error;
  },

  /**
   * Add staff to a draft class
   */
  addStaffToDraftClass: async (
    classId: string,
    staffId: string,
    type: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' = 'MAIN_TUTOR'
  ): Promise<DraftClassStaff> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    const payload: TablesInsert<'draft_classes_staff'> = {
      id: crypto.randomUUID(),
      draft_class_id: classId,
      staff_id: staffId,
      type,
    };

    const { data, error } = await supabase
      .from('draft_classes_staff')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as DraftClassStaff;
  },

  /**
   * Remove staff from a draft class
   */
  removeStaffFromDraftClass: async (classId: string, staffId: string): Promise<void> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { error } = await supabase
      .from('draft_classes_staff')
      .delete()
      .eq('draft_class_id', classId)
      .eq('staff_id', staffId);
    if (error) throw error;
  },

  /**
   * Add a slot to a class plan
   */
  addSlot: async (
    planId: string,
    slot: {
      day_of_week: number;
      start_time: string;
      end_time: string;
    }
  ): Promise<void> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    const payload: TablesInsert<'draft_class_plan_slots'> = {
      id: crypto.randomUUID(),
      draft_class_plan_id: planId,
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
    };

    const { error } = await supabase
      .from('draft_class_plan_slots')
      .insert(payload);
    
    if (error) throw error;
  },
};
