import { useState, useCallback, useEffect } from 'react';
import { BaseEntity } from '@/shared/lib/supabase/db/types';
import { Repository } from '@/shared/lib/supabase/db/repository';

export function useRepository<T extends BaseEntity>(repository: Repository<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch all items
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repository.getAll();
      setItems(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Repository fetch error:', err);
      console.error('Error details:', { 
        name: err instanceof Error ? err.name : 'Unknown',
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined
      });
    } finally {
      setLoading(false);
    }
  }, [repository]);
  
  // Fetch by ID
  const findById = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      return await repository.getById(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Repository fetch error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [repository]);
  
  // Fetch by field
  const findByField = useCallback(async (field: string, value: string | number | boolean) => {
    setLoading(true);
    setError(null);
    try {
      return await repository.findByField(field, value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Repository fetch error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [repository]);
  
  // Create an item
  const create = useCallback(async (data: Partial<T>) => {
    setLoading(true);
    setError(null);
    try {
      const newItem = await repository.create(data);
      setItems(prev => [...prev, newItem]);
      return newItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Repository create error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [repository]);
  
  // Update an item
  const update = useCallback(async (id: string, data: Partial<T>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedItem = await repository.update(id, data);
      setItems(prev => prev.map(item => item.id === id ? updatedItem : item));
      return updatedItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Repository update error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [repository]);
  
  // Delete an item
  const remove = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await repository.delete(id);
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Repository delete error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [repository]);
  
  // Load data initially
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  
  return {
    items,
    loading,
    error,
    fetchAll,
    findById,
    findByField,
    create,
    update,
    remove,
  };
} 