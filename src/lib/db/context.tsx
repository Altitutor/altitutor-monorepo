'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuthStore } from '../auth/store';

// Only import Dexie-related modules if not using Supabase
const isDexieMode = process.env.NEXT_PUBLIC_AUTH_MODE !== 'supabase';

// Dynamically import Dexie modules only if needed
let db: any;
let isDatabaseHealthy: any;
let startSync: any;
let stopSync: any;
let getSyncStatus: any;

if (isDexieMode) {
  const dbModule = require('./db');
  const syncModule = require('./sync');
  db = dbModule.db;
  isDatabaseHealthy = dbModule.isDatabaseHealthy;
  startSync = syncModule.startSync;
  stopSync = syncModule.stopSync;
  getSyncStatus = syncModule.getSyncStatus;
}

// Updated sync status type to match the new format
interface SyncStatusType {
  local: {
    pendingCount: number;
    failedCount: number;
    processingCount: number;
    completedCount: number;
    totalCount: number;
    lastSync: string | null;
    isRealTimeEnabled: boolean;
  };
  server: any | null;
  isConnected: boolean;
}

interface DbContextType {
  isReady: boolean;
  error: string | null;
  syncStatus: SyncStatusType | null;
  forceSyncNow: () => Promise<void>;
  resetDatabase: () => Promise<void>;
}

const DbContext = createContext<DbContextType | undefined>(undefined);

interface DbProviderProps {
  children: ReactNode;
}

export function DbProvider({ children }: DbProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusType | null>(null);
  const { isAuthenticated } = useAuthStore();

  // Initialize database
  useEffect(() => {
    // If using Supabase, just mark as ready
    if (!isDexieMode) {
      setIsReady(true);
      return;
    }

    // Otherwise initialize Dexie
    async function initDb() {
      try {
        await db.open();
        const isHealthy = await isDatabaseHealthy();
        
        if (isHealthy) {
          setIsReady(true);
        } else {
          setError('Database initialization failed');
        }
      } catch (err) {
        console.error('Database initialization error:', err);
        setError(err instanceof Error ? err.message : 'Unknown database error');
      }
    }
    
    initDb();
    
    return () => {
      if (isDexieMode) {
        db.close();
      }
    };
  }, []);
  
  // Fetch sync status safely
  const fetchSyncStatus = async () => {
    if (!isDexieMode) return null;

    try {
      const result = await getSyncStatus();
      
      // Check if it's an error result
      if ('error' in result) {
        console.error('Error getting sync status:', result.error);
        return null;
      }
      
      // Make sure we have the required fields
      if (!result.local || typeof result.isConnected !== 'boolean') {
        console.error('Invalid sync status format:', result);
        return null;
      }
      
      return result as SyncStatusType;
    } catch (err) {
      console.error('Error getting sync status:', err);
      return null;
    }
  };
  
  // Start/stop sync based on auth state
  useEffect(() => {
    if (!isDexieMode) return;

    if (isAuthenticated && isReady) {
      const stopSyncFn = startSync();
      
      // Update sync status periodically
      const statusInterval = setInterval(async () => {
        const status = await fetchSyncStatus();
        if (status) {
          setSyncStatus(status);
        }
      }, 5000);
      
      return () => {
        stopSyncFn();
        stopSync();
        clearInterval(statusInterval);
      };
    }
  }, [isAuthenticated, isReady]);
  
  // Force sync now
  const forceSyncNow = async () => {
    if (!isDexieMode) return;

    if (isAuthenticated && isReady) {
      try {
        await import('./sync').then(sync => sync.forceSyncNow());
        const status = await fetchSyncStatus();
        if (status) {
          setSyncStatus(status);
        }
      } catch (err) {
        console.error('Error forcing sync:', err);
      }
    }
  };
  
  // Reset database (for testing)
  const resetDatabase = async () => {
    if (!isDexieMode) return;

    if (confirm('Are you sure you want to reset the local database? All local data will be lost.')) {
      stopSync();
      await db.delete();
      window.location.reload();
    }
  };
  
  const value: DbContextType = {
    isReady,
    error,
    syncStatus,
    forceSyncNow,
    resetDatabase,
  };
  
  return (
    <DbContext.Provider value={value}>
      {children}
    </DbContext.Provider>
  );
}

export function useDb() {
  const context = useContext(DbContext);
  
  if (context === undefined) {
    throw new Error('useDb must be used within a DbProvider');
  }
  
  return context;
} 