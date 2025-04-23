/**
 * Sync Client
 * 
 * This module provides a client-side interface to the sync API.
 * It handles batch sync operations, conflict resolution, and real-time updates.
 */

import { v4 as uuidv4 } from 'uuid';
import { SyncQueueItem } from '../db/types';

// Default config
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000';

// Generate a unique device ID if not already present
const getDeviceId = (): string => {
  if (typeof window === 'undefined') return 'server';
  
  let deviceId = localStorage.getItem('alti-device-id');
  
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem('alti-device-id', deviceId);
  }
  
  return deviceId;
};

// Store for WebSocket connection
let wsConnection: WebSocket | null = null;
let wsReconnectTimer: NodeJS.Timeout | null = null;
let lastSyncTimestamp: string | null = null;

// Event callbacks
type SyncEventListener = (event: any) => void;
const eventListeners: Record<string, SyncEventListener[]> = {
  'sync-notification': [],
  'entity-changed': [],
  'connection-status': [],
};

/**
 * Initialize the sync client
 */
export const initSyncClient = (token: string) => {
  return {
    // Connect to the sync API with authentication
    connect: () => connectToSyncServer(token),
    
    // Disconnect from the sync API
    disconnect: () => disconnectFromSyncServer(),
    
    // Process a batch of sync operations
    processBatch: (operations: SyncQueueItem[]) => processBatch(operations, token),
    
    // Get the current sync status
    getSyncStatus: () => getSyncStatus(token),
    
    // Perform a full sync
    fullSync: () => fullSync(token),
    
    // Resolve a conflict
    resolveConflict: (
      entityType: string, 
      entityId: string, 
      resolution: 'CLIENT_WINS' | 'SERVER_WINS' | 'MERGE', 
      data?: any
    ) => resolveConflict(entityType, entityId, resolution, data, token),
    
    // Add an event listener
    addEventListener: (event: string, callback: SyncEventListener) => {
      if (!eventListeners[event]) {
        eventListeners[event] = [];
      }
      eventListeners[event].push(callback);
    },
    
    // Remove an event listener
    removeEventListener: (event: string, callback: SyncEventListener) => {
      if (!eventListeners[event]) return;
      
      const index = eventListeners[event].indexOf(callback);
      if (index !== -1) {
        eventListeners[event].splice(index, 1);
      }
    },
    
    // Get connection status
    getConnectionStatus: () => !!wsConnection && wsConnection.readyState === WebSocket.OPEN,
  };
};

/**
 * Connect to the sync server via WebSocket
 */
const connectToSyncServer = (token: string) => {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    return Promise.resolve('Already connected');
  }
  
  // Clear any existing reconnect timer
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
  
  return new Promise<string>((resolve, reject) => {
    try {
      const deviceId = getDeviceId();
      const wsUrl = `${WS_BASE_URL}?token=${token}&deviceId=${deviceId}`;
      
      wsConnection = new WebSocket(wsUrl);
      
      wsConnection.onopen = () => {
        triggerEvent('connection-status', { connected: true });
        resolve('Connected');
      };
      
      wsConnection.onclose = () => {
        triggerEvent('connection-status', { connected: false });
        
        // Attempt to reconnect after delay
        if (!wsReconnectTimer) {
          wsReconnectTimer = setTimeout(() => {
            connectToSyncServer(token);
          }, 5000); // Try to reconnect after 5 seconds
        }
      };
      
      wsConnection.onerror = (event) => {
        console.error('WebSocket error:', event);
        reject('WebSocket connection error');
      };
      
      wsConnection.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'SYNC_NOTIFICATION':
              triggerEvent('sync-notification', message);
              break;
              
            case 'ENTITY_CHANGED':
              triggerEvent('entity-changed', message);
              break;
              
            case 'PONG':
              // Keep-alive response, no action needed
              break;
              
            default:
              console.log('Received message:', message);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };
      
      // Set up ping interval to keep connection alive
      const pingInterval = setInterval(() => {
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
          wsConnection.send(JSON.stringify({ type: 'PING' }));
        } else {
          clearInterval(pingInterval);
        }
      }, 30000); // Send ping every 30 seconds
      
    } catch (error) {
      reject(`Failed to connect: ${error}`);
    }
  });
};

/**
 * Disconnect from the sync server
 */
const disconnectFromSyncServer = () => {
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
  
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
};

/**
 * Process a batch of sync operations
 */
const processBatch = async (operations: SyncQueueItem[], token: string) => {
  const deviceId = getDeviceId();
  
  const response = await fetch(`${API_BASE_URL}/sync/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      operations: operations.map(op => ({
        entityType: op.entityType,
        entityId: op.entityId,
        operation: op.operation,
        data: op.data,
        timestamp: op.timestamp || op.createdAt, // Fall back to createdAt if timestamp not available
        clientId: op.clientId || deviceId
      })),
      deviceId,
      lastSyncTimestamp
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Sync failed: ${errorData.error || response.statusText}`);
  }
  
  const result = await response.json();
  
  // Update last sync timestamp
  lastSyncTimestamp = result.timestamp;
  
  // If WebSocket is connected, send sync completed notification
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    const changedEntityTypes = [...new Set(operations.map(op => op.entityType))];
    
    wsConnection.send(JSON.stringify({
      type: 'SYNC_COMPLETED',
      changedEntityTypes
    }));
  }
  
  return result;
};

/**
 * Get the current sync status
 */
const getSyncStatus = async (token: string) => {
  const deviceId = getDeviceId();
  
  const response = await fetch(`${API_BASE_URL}/sync/status?deviceId=${deviceId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to get sync status: ${errorData.error || response.statusText}`);
  }
  
  const result = await response.json();
  
  // Update last sync timestamp
  lastSyncTimestamp = result.serverTimestamp;
  
  return result;
};

/**
 * Perform a full sync (get all data)
 */
const fullSync = async (token: string) => {
  const deviceId = getDeviceId();
  
  const response = await fetch(`${API_BASE_URL}/sync/full?deviceId=${deviceId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Full sync failed: ${errorData.error || response.statusText}`);
  }
  
  const result = await response.json();
  
  // Update last sync timestamp
  lastSyncTimestamp = result.timestamp;
  
  return result;
};

/**
 * Resolve a conflict
 */
const resolveConflict = async (
  entityType: string,
  entityId: string,
  resolution: 'CLIENT_WINS' | 'SERVER_WINS' | 'MERGE',
  data: any,
  token: string
) => {
  const response = await fetch(`${API_BASE_URL}/sync/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      entityType,
      entityId,
      resolution,
      data
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to resolve conflict: ${errorData.error || response.statusText}`);
  }
  
  return await response.json();
};

/**
 * Trigger an event to all registered listeners
 */
const triggerEvent = (event: string, data: any) => {
  if (!eventListeners[event]) return;
  
  for (const listener of eventListeners[event]) {
    try {
      listener(data);
    } catch (error) {
      console.error(`Error in event listener for ${event}:`, error);
    }
  }
}; 