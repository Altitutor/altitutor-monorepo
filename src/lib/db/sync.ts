import { db } from './db';
import { SyncQueueItem } from './types';
import { api } from '../api';
import { useAuthStore } from '../auth/store';
import { initSyncClient } from '../api/syncClient';

// Map of entity types to API endpoints
const ENTITY_ENDPOINTS = {
  students: '/students',
  staff: '/staff',
  classes: '/classes',
  classEnrollments: '/class-enrollments',
  classAssignments: '/class-assignments',
  absences: '/absences',
  meetings: '/meetings',
  draftingSessions: '/drafting-sessions',
  shiftSwaps: '/shift-swaps',
  messages: '/messages',
  files: '/files',
  studentAuditLogs: '/audit/students',
  staffAuditLogs: '/audit/staff',
  classAuditLogs: '/audit/classes',
};

// Default sync config
const DEFAULT_SYNC_INTERVAL = 5000; // 5 seconds (for more real-time syncing)
const MAX_BATCH_SIZE = 20;
const MAX_RETRIES = 3;
const BACKOFF_FACTOR = 1.5;

let syncIntervalId: NodeJS.Timeout | null = null;
let realTimeSyncEnabled = false;
let syncClient: ReturnType<typeof initSyncClient> | null = null;

/**
 * Initialize sync client
 */
export function initializeSync() {
  const token = useAuthStore.getState().token;
  if (!token) {
    console.log('Not authenticated, cannot initialize sync');
    return;
  }
  
  syncClient = initSyncClient(token);
  
  // Connect to WebSocket for real-time updates
  syncClient?.connect()
    .then(() => {
      console.log('Connected to sync server');
      
      // Add event listeners
      if (syncClient) {
        syncClient.addEventListener('sync-notification', (event) => {
          console.log('Received sync notification:', event);
          
          // Process a sync when we get a notification from another device
          if (event.deviceId !== localStorage.getItem('alti-device-id')) {
            processSyncQueue();
          }
        });
        
        syncClient.addEventListener('entity-changed', (event) => {
          console.log('Entity changed:', event);
          // You could trigger a refresh of this entity in the UI
        });
        
        syncClient.addEventListener('connection-status', (event) => {
          console.log('Connection status changed:', event);
          // Update UI to show connection status
        });
      }
    })
    .catch(error => {
      console.error('Failed to connect to sync server:', error);
    });
}

/**
 * Start background sync process
 */
export function startSync(interval = DEFAULT_SYNC_INTERVAL) {
  // Initialize sync client if not already initialized
  if (!syncClient) {
    initializeSync();
  }
  
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }
  
  // Initial sync
  processSyncQueue();
  
  // Set up interval
  syncIntervalId = setInterval(processSyncQueue, interval);
  
  return () => {
    if (syncIntervalId) {
      clearInterval(syncIntervalId);
      syncIntervalId = null;
    }
  };
}

/**
 * Stop background sync process
 */
export function stopSync() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  
  // Disconnect WebSocket
  if (syncClient) {
    syncClient.disconnect();
    syncClient = null;
  }
}

/**
 * Enable or disable real-time sync
 */
export function setRealTimeSync(enabled: boolean) {
  realTimeSyncEnabled = enabled;
  
  // If enabling, update the sync interval to be more frequent
  if (enabled && syncIntervalId) {
    stopSync();
    startSync(1000); // 1 second for real-time sync
  } else if (!enabled && syncIntervalId) {
    stopSync();
    startSync(DEFAULT_SYNC_INTERVAL);
  }
}

/**
 * Process the sync queue
 */
export async function processSyncQueue() {
  try {
    // Check if online - a basic check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('Device is offline, skipping sync');
      return;
    }
    
    // Check if authenticated
    const token = useAuthStore.getState().token;
    if (!token) {
      console.log('Not authenticated, skipping sync');
      return;
    }
    
    // Get pending items
    const pendingItems = await db.syncQueue
      .where('status')
      .equals('PENDING')
      .limit(MAX_BATCH_SIZE)
      .toArray();
    
    if (pendingItems.length === 0) {
      // Try to fix failed items that have been retried less than MAX_RETRIES
      const failedItems = await db.syncQueue
        .where('status')
        .equals('FAILED')
        .and(item => item.attempts < MAX_RETRIES)
        .toArray();
      
      if (failedItems.length > 0) {
        // Reset failed items to pending to retry
        await db.syncQueue
          .where('id')
          .anyOf(failedItems.map(item => item.id))
          .modify({ status: 'PENDING' });
        
        console.log(`Reset ${failedItems.length} failed items to pending for retry`);
      } else {
        console.log('No pending items to sync');
      }
      return;
    }
    
    console.log(`Processing ${pendingItems.length} items from sync queue`);
    
    // Mark items as processing
    await Promise.all(
      pendingItems.map(item => 
        db.syncQueue.update(item.id, { 
          status: 'PROCESSING',
          lastAttempt: new Date().toISOString(), 
          attempts: item.attempts + 1
        })
      )
    );
    
    try {
      // Use the backend sync API if available
      if (syncClient) {
        // Add timestamp to items that don't have it
        const itemsWithTimestamp = pendingItems.map(item => ({
          ...item,
          timestamp: item.timestamp || item.createdAt
        }));
        
        const result = await syncClient.processBatch(itemsWithTimestamp);
        
        // Handle conflicts
        if (result.hasConflicts) {
          console.warn('Sync conflicts detected:', result.conflicts);
          // Could show a UI to resolve conflicts
          
          // For now, just use server version (SERVER_WINS)
          for (const conflict of result.conflicts) {
            await syncClient.resolveConflict(
              conflict.entityType,
              conflict.entityId,
              'SERVER_WINS'
            );
          }
        }
        
        // Update local items based on results
        for (const itemResult of result.results) {
          const matchingItem = pendingItems.find(
            item => item.entityId === itemResult.entityId && 
                   item.entityType === itemResult.entityType &&
                   item.operation === itemResult.operation
          );
          
          if (matchingItem) {
            if (itemResult.success) {
              // Mark as completed
              await db.syncQueue.update(matchingItem.id, { 
                status: 'COMPLETED',
                error: null
              });
            } else {
              // Mark as failed
              await db.syncQueue.update(matchingItem.id, { 
                status: 'FAILED',
                error: itemResult.error
              });
            }
          }
        }
      } else {
        // Fall back to mock sync
        await mockApiSync(pendingItems, token);
      }
    } catch (error) {
      console.error('Error during sync process:', error);
      
      // Mark all items as failed
      await Promise.all(
        pendingItems.map(item => 
          db.syncQueue.update(item.id, { 
            status: 'FAILED',
            error: error instanceof Error ? error.message : 'Unknown error during sync'
          })
        )
      );
    }
  } catch (error) {
    console.error('Error processing sync queue:', error);
  }
}

/**
 * Mock API function for testing without a backend
 * This simulates successful API responses without actually hitting a server
 */
async function mockApiSync(items: SyncQueueItem[], token: string) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Process each item and mark as completed
  for (const item of items) {
    // Mark as completed
    await db.syncQueue.update(item.id, { 
      status: 'COMPLETED',
      error: null
    });
  }
  
  return { success: true };
}

/**
 * Force an immediate sync
 */
export async function forceSyncNow() {
  await processSyncQueue();
  return { success: true };
}

/**
 * Reset failed sync items to try again
 */
export async function resetFailedItems() {
  try {
    const count = await db.syncQueue
      .where('status')
      .equals('FAILED')
      .modify({ status: 'PENDING', attempts: 0 });
    
    return { success: true, resetCount: count };
  } catch (error) {
    console.error('Error resetting failed items:', error);
    return { success: false, error };
  }
}

/**
 * Get current sync status information
 */
export async function getSyncStatus() {
  try {
    const pendingCount = await db.syncQueue.where('status').equals('PENDING').count();
    const failedCount = await db.syncQueue.where('status').equals('FAILED').count();
    const processingCount = await db.syncQueue.where('status').equals('PROCESSING').count();
    const completedCount = await db.syncQueue.where('status').equals('COMPLETED').count();
    
    let serverStatus = null;
    
    // Get server status if connected
    if (syncClient) {
      try {
        serverStatus = await syncClient.getSyncStatus();
      } catch (error) {
        console.error('Error getting server sync status:', error);
      }
    }
    
    return {
      local: {
        pendingCount,
        failedCount,
        processingCount,
        completedCount,
        totalCount: pendingCount + failedCount + processingCount + completedCount,
        lastSync: localStorage.getItem('last-sync-timestamp') || null,
        isRealTimeEnabled: realTimeSyncEnabled,
      },
      server: serverStatus,
      isConnected: syncClient ? syncClient.getConnectionStatus() : false
    };
  } catch (error) {
    console.error('Error getting sync status:', error);
    return { error };
  }
} 