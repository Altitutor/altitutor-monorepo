import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { BaseEntity } from './types';

/**
 * Generic repository class for Supabase database entities
 */
export class Repository<T extends BaseEntity> {
  private tableName: string;
  private supabase = createClientComponentClient();

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Get all entities
   */
  async getAll(): Promise<T[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*');
    
    if (error) throw error;
    return data as T[];
  }

  /**
   * Get an entity by ID
   */
  async getById(id: string): Promise<T | undefined> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as T;
  }

  /**
   * Get entities by a specific field value
   */
  async getBy(field: keyof T, value: any): Promise<T[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq(field as string, value);
    
    if (error) throw error;
    return data as T[];
  }

  /**
   * Create a new entity
   */
  async create(data: Partial<T>): Promise<T> {
    const { data: newEntity, error } = await this.supabase
      .from(this.tableName)
      .insert([{
        ...data,
        id: crypto.randomUUID() // Generate UUID on client side
      }])
      .select()
      .single();
    
    if (error) throw error;
    return newEntity as T;
  }

  /**
   * Update an existing entity
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    const { data: updatedEntity, error } = await this.supabase
      .from(this.tableName)
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return updatedEntity as T;
  }

  /**
   * Delete an entity
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
} 