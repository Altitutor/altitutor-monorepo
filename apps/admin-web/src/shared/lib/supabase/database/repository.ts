import { BaseEntity } from './types';
import { supabaseServer, getSupabaseClient } from '../client';
import { toSnakeCase, toCamelCase, transformToCamelCase, convertToDbFormat } from './utils';

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
      .from(this.tableName as any)
      .select('*');
    
    if (error) {
      console.error(`Repository error for ${this.tableName}:`, error);
      throw error;
    }
    
    // Transform snake_case DB fields to camelCase for TypeScript
    return data?.map(item => transformToCamelCase(item)) as T[] || [];
  }

  /**
   * Get an entity by ID
   */
  async getById(id: string): Promise<T | undefined> {
    const { data, error } = await this.getClient()
      .from(this.tableName as any)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return undefined; // No rows found
      }
      console.error(`Repository error getting ${this.tableName} by ID ${id}:`, error);
      throw error;
    }
    
    return data ? transformToCamelCase(data) as T : undefined;
  }

  /**
   * Get entities by a specific field value
   * 
   * IMPORTANT: Due to TypeScript/DB field naming mismatch, you need to be careful with this method.
   * The field parameter should be a valid database column name (usually snake_case),
   * not a TypeScript property name (usually camelCase).
   * 
   * For TypeScript property names, use findByModelField instead.
   */
  async getBy(field: string, value: unknown): Promise<T[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName as any)
      .select('*')
      .eq(field, value);
    
    if (error) throw error;
    // Transform snake_case DB fields to camelCase for TypeScript
    return data?.map(item => transformToCamelCase(item)) as T[] || [];
  }

  /**
   * Get entities by a TypeScript model field (automatically converts camelCase to snake_case)
   */
  async findByModelField(field: keyof T, value: unknown): Promise<T[]> {
    // Convert camelCase field name to snake_case for database query
    const dbField = toSnakeCase(field as string);
    return this.getBy(dbField, value);
  }

  /**
   * Create a new entity
   */
  async create(data: Partial<T>): Promise<T> {
    // Convert data to database format (snake_case) for database operations
    const dbData = convertToDbFormat(data);
    
    const { data: newEntity, error } = await this.getClient()
      .from(this.tableName as any)
      .insert([{
        ...dbData,
        id: crypto.randomUUID() // Generate UUID on client side
      }])
      .select()
      .single();
    
    if (error) throw error;
    // Transform snake_case DB fields to camelCase for TypeScript
    return transformToCamelCase(newEntity) as T;
  }

  /**
   * Update an existing entity
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    // Convert data to database format (snake_case) for database operations
    const dbData = convertToDbFormat(data);
    
    const { data: updatedEntity, error } = await this.getClient()
      .from(this.tableName as any)
      .update(dbData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    // Transform snake_case DB fields to camelCase for TypeScript
    return transformToCamelCase(updatedEntity) as T;
  }

  /**
   * Delete an entity
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.getClient()
      .from(this.tableName as any)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  /**
   * Find by another field (e.g., 'user_id')
   */
  async findByField(field: string, value: string | number | boolean): Promise<T | null> {
    const { data, error } = await this.getClient()
      .from(this.tableName as any)
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
    
    // Transform snake_case DB fields to camelCase for TypeScript
    return data ? transformToCamelCase(data) as T : null;
  }
} 