import { BaseEntity } from './types';
import { supabaseServer, getSupabaseClient } from '../client';

/**
 * Generic repository class for Supabase database entities
 */
export class Repository<T extends BaseEntity> {
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Get client based on environment
   * In browser, use the client that has access to cookies/auth
   * In server, use the server client
   */
  private getClient() {
    return getSupabaseClient();
  }

  /**
   * Get all entities
   */
  async getAll(): Promise<T[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*');
    
    if (error) throw error;
    return data as T[];
  }

  /**
   * Get an entity by ID
   */
  async getById(id: string): Promise<T | undefined> {
    const { data, error } = await this.getClient()
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
  async getBy(field: keyof T, value: unknown): Promise<T[]> {
    const { data, error } = await this.getClient()
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
    const { data: newEntity, error } = await this.getClient()
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
    const { data: updatedEntity, error } = await this.getClient()
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
    const { error } = await this.getClient()
      .from(this.tableName)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  /**
   * Find by another field (e.g., 'user_id')
   */
  async findByField(field: string, value: string | number | boolean): Promise<T | null> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq(field, value)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }
    
    return data as T;
  }
} 