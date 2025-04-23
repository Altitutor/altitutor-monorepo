import { db } from './db';
import { Table } from 'dexie';
import { BaseEntity, SyncQueueItem, SyncState } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generic repository class for database entities
 */
export class Repository<T extends BaseEntity> {
  private table: Table<T>;
  private entityName: string;

  constructor(tableName: keyof typeof db & string) {
    this.table = db[tableName] as unknown as Table<T>;
    this.entityName = tableName;
  }

  /**
   * Get all entities
   */
  async getAll(): Promise<T[]> {
    return await this.table.toArray();
  }

  /**
   * Get an entity by ID
   */
  async getById(id: string): Promise<T | undefined> {
    return await this.table.get(id);
  }

  /**
   * Get entities by a specific field value
   */
  async getBy(field: keyof T, value: any): Promise<T[]> {
    return await this.table.where(field as string).equals(value).toArray();
  }

  /**
   * Create a new entity
   */
  async create(data: Partial<T>): Promise<T> {
    const now = new Date().toISOString();
    
    const entity = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      ...data,
    } as T;
    
    await this.table.add(entity);
    
    // Add to sync queue
    await this.addToSyncQueue(entity.id, 'CREATE', entity);
    
    return entity;
  }

  /**
   * Update an existing entity
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    const existing = await this.getById(id);
    
    if (!existing) {
      throw new Error(`Entity with ID ${id} not found`);
    }
    
    const updatedEntity = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    } as T;
    
    // Use proper update method with changes object
    await this.table.update(id, data as any);
    
    // Add to sync queue
    await this.addToSyncQueue(id, 'UPDATE', updatedEntity);
    
    return updatedEntity;
  }

  /**
   * Delete an entity
   */
  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    
    if (!existing) {
      throw new Error(`Entity with ID ${id} not found`);
    }
    
    await this.table.delete(id);
    
    // Add to sync queue
    await this.addToSyncQueue(id, 'DELETE');
  }

  /**
   * Add operation to sync queue
   */
  private async addToSyncQueue(
    entityId: string, 
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    data?: any
  ): Promise<void> {
    const queueItem: SyncQueueItem = {
      id: uuidv4(),
      entityType: this.entityName,
      entityId,
      operation,
      data: operation !== 'DELETE' ? data : undefined,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'PENDING',
    };
    
    await db.syncQueue.add(queueItem);
    
    // Update sync state
    const syncState: SyncState = {
      id: entityId,
      entityType: this.entityName,
      lastSynced: operation === 'DELETE' ? new Date().toISOString() : '',
      isDirty: operation !== 'DELETE',
      serverVersion: null
    };
    
    await db.syncState.put(syncState);
  }
} 