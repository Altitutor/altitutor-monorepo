import { supabase } from './client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Base repository for Supabase table operations
 */
export class SupabaseRepository<T extends { id: string }> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Get all records from the table
   */
  async getAll(): Promise<T[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*');

    if (error) {
      console.error(`Error getting all ${this.tableName}:`, error);
      throw error;
    }

    return data as T[];
  }

  /**
   * Get a record by ID
   */
  async getById(id: string): Promise<T | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      console.error(`Error getting ${this.tableName} by id:`, error);
      throw error;
    }

    return data as T;
  }

  /**
   * Create a new record
   */
  async create(item: Omit<T, 'id'>): Promise<T> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const newItem = {
      id,
      ...item,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from(this.tableName)
      .insert(newItem)
      .select()
      .single();

    if (error) {
      console.error(`Error creating ${this.tableName}:`, error);
      throw error;
    }

    return data as T;
  }

  /**
   * Update an existing record
   */
  async update(id: string, changes: Partial<Omit<T, 'id'>>): Promise<T> {
    const now = new Date().toISOString();

    const updates = {
      ...changes,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating ${this.tableName}:`, error);
      throw error;
    }

    return data as T;
  }

  /**
   * Upsert a record (create if not exists, update if exists)
   */
  async upsert(item: T): Promise<T> {
    const now = new Date().toISOString();

    const upsertItem = {
      ...item,
      updated_at: now,
      created_at: item.created_at || now,
    };

    const { data, error } = await supabase
      .from(this.tableName)
      .upsert(upsertItem)
      .select()
      .single();

    if (error) {
      console.error(`Error upserting ${this.tableName}:`, error);
      throw error;
    }

    return data as T;
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Get records by a field value
   */
  async getByField<K extends keyof T>(field: K, value: T[K]): Promise<T[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq(field as string, value);

    if (error) {
      console.error(`Error getting ${this.tableName} by field:`, error);
      throw error;
    }

    return data as T[];
  }

  /**
   * Count records in table
   */
  async count(): Promise<number> {
    const { count, error } = await supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error(`Error counting ${this.tableName}:`, error);
      throw error;
    }

    return count || 0;
  }
}

// Export specific repositories
export class StudentsRepository extends SupabaseRepository<any> {
  constructor() {
    super('students');
  }
  
  // Add custom methods here
  async getActiveStudents() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('status', 'CURRENT');
      
    if (error) {
      console.error('Error getting active students:', error);
      throw error;
    }
    
    return data;
  }
}

export class StaffRepository extends SupabaseRepository<any> {
  constructor() {
    super('staff');
  }
  
  // Add custom methods here
  async getTutors() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('role', 'TUTOR');
      
    if (error) {
      console.error('Error getting tutors:', error);
      throw error;
    }
    
    return data;
  }
}

export class ClassesRepository extends SupabaseRepository<any> {
  constructor() {
    super('classes');
  }
  
  // Add custom methods here
  async getActiveClasses() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('status', 'ACTIVE');
      
    if (error) {
      console.error('Error getting active classes:', error);
      throw error;
    }
    
    return data;
  }
}

// Export repository instances
export const studentsRepository = new StudentsRepository();
export const staffRepository = new StaffRepository(); 
export const classesRepository = new ClassesRepository(); 