import { useState, useCallback, useEffect } from 'react';
import { BaseEntity } from '../types';
import { Repository } from '../repository';

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
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [repository]);
  
  // Fetch by ID
  const fetchById = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const item = await repository.getById(id);
      return item;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching item:', err);
      return undefined;
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
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error creating item:', err);
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
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error updating item:', err);
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
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error deleting item:', err);
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
    fetchById,
    create,
    update,
    remove,
  };
} 