import { BaseEntity } from './types';
import { supabaseServer, getSupabaseClient } from '../client';

/**
 * Utility function to convert camelCase to snake_case
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Utility function to convert snake_case to camelCase
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

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
    // Transform snake_case DB fields to camelCase for TypeScript
    return data?.map(item => this.transformToCamelCase(item)) as T[] || [];
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
    // Transform snake_case DB fields to camelCase for TypeScript
    return data ? this.transformToCamelCase(data) as T : undefined;
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
      .from(this.tableName)
      .select('*')
      .eq(field, value);
    
    if (error) throw error;
    // Transform snake_case DB fields to camelCase for TypeScript
    return data?.map(item => this.transformToCamelCase(item)) as T[] || [];
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
    const dbData = this.convertToDbFormat(data);
    
    const { data: newEntity, error } = await this.getClient()
      .from(this.tableName)
      .insert([{
        ...dbData,
        id: crypto.randomUUID() // Generate UUID on client side
      }])
      .select()
      .single();
    
    if (error) throw error;
    // Transform snake_case DB fields to camelCase for TypeScript
    return this.transformToCamelCase(newEntity) as T;
  }

  /**
   * Update an existing entity
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    // Convert data to database format (snake_case) for database operations
    const dbData = this.convertToDbFormat(data);
    
    const { data: updatedEntity, error } = await this.getClient()
      .from(this.tableName)
      .update(dbData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    // Transform snake_case DB fields to camelCase for TypeScript
    return this.transformToCamelCase(updatedEntity) as T;
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
    
    // Transform snake_case DB fields to camelCase for TypeScript
    return data ? this.transformToCamelCase(data) as T : null;
  }

  /**
   * Convert TypeScript object with camelCase properties to database format with snake_case columns
   */
  private convertToDbFormat(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const key in data) {
      // Skip properties that start with underscore or are undefined
      if (key.startsWith('_') || data[key] === undefined) continue;
      
      // Skip relation properties (usually objects or arrays)
      if (typeof data[key] === 'object' && data[key] !== null && !Array.isArray(data[key]) && !(data[key] instanceof Date)) {
        continue;
      }
      
      // Convert camelCase to snake_case
      const dbKey = toSnakeCase(key);
      result[dbKey] = data[key];
    }
    
    return result;
  }

  /**
   * Transform database record with snake_case fields to camelCase for TypeScript
   */
  private transformToCamelCase(data: Record<string, any>): Record<string, any> {
    if (!data) return data;
    
    const result: Record<string, any> = {};
    
    // Special case handling for staff fields
    if (this.tableName === 'staff') {
      // Map snake_case field names to camelCase for staff
      result.id = data.id;
      result.firstName = data.first_name;
      result.lastName = data.last_name;
      result.email = data.email;
      result.phoneNumber = data.phone_number;
      result.role = data.role;
      result.status = data.status;
      result.notes = data.notes;
      result.userId = data.user_id;
      result.officeKeyNumber = data.office_key_number;
      result.hasParkingRemote = data.has_parking_remote;
      result.created_at = data.created_at;
      result.updated_at = data.updated_at;
      
      // Add availability fields - fix to use proper camelCase property names
      result.availabilityMonday = data.availability_monday;
      result.availabilityTuesday = data.availability_tuesday;
      result.availabilityWednesday = data.availability_wednesday;
      result.availabilityThursday = data.availability_thursday;
      result.availabilityFriday = data.availability_friday;
      result.availabilitySaturdayAm = data.availability_saturday_am;
      result.availabilitySaturdayPm = data.availability_saturday_pm;
      result.availabilitySundayAm = data.availability_sunday_am;
      result.availabilitySundayPm = data.availability_sunday_pm;
      
      return result;
    }
    
    // For other tables, use general transformation
    for (const key in data) {
      if (key.includes('_')) {
        // Convert snake_case to camelCase
        const camelKey = toCamelCase(key);
        result[camelKey] = data[key];
      } else {
        // Keep as is if not snake_case
        result[key] = data[key];
      }
    }
    
    return result;
  }
} 