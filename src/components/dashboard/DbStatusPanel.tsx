'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, Wifi } from 'lucide-react';
import { useDb } from '@/lib/db/context';
import { setRealTimeSync, resetFailedItems } from '@/lib/db/sync';

export function DbStatusPanel() {
  const { isReady, error, syncStatus, forceSyncNow, resetDatabase } = useDb();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRealTimeSync, setIsRealTimeSync] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  
  // Handle real-time sync setting
  const handleRealTimeSyncChange = (checked: boolean) => {
    setIsRealTimeSync(checked);
    setRealTimeSync(checked);
  };
  
  // Update real-time status from sync status
  useEffect(() => {
    if (syncStatus?.local?.isRealTimeEnabled !== undefined) {
      setIsRealTimeSync(syncStatus.local.isRealTimeEnabled);
    }
  }, [syncStatus?.local?.isRealTimeEnabled]);
  
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await forceSyncNow();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };
  
  const handleRepairFailed = async () => {
    setIsRepairing(true);
    try {
      await resetFailedItems();
      await forceSyncNow();
    } catch (error) {
      console.error('Repair error:', error);
    } finally {
      setIsRepairing(false);
    }
  };
  
  // Helper to safely access syncStatus properties
  const failedCount = syncStatus?.local?.failedCount || 0;
  const isActive = !!syncStatus?.local?.processingCount || (syncStatus?.local?.isRealTimeEnabled && syncStatus?.isConnected);
  const lastSyncDate = syncStatus?.local?.lastSync ? new Date(syncStatus.local.lastSync) : null;
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Database Status
          <Badge variant={isReady ? 'success' : error ? 'destructive' : 'outline'}>
            {isReady ? 'Connected' : error ? 'Error' : 'Connecting...'}
          </Badge>
        </CardTitle>
        <CardDescription>
          Local data storage and synchronization
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded text-destructive text-sm">
            {error}
          </div>
        )}
        
        {isReady && syncStatus && (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <span>Sync Status:</span>
                <Badge variant={isActive ? 'outline' : 'secondary'}>
                  {isActive ? 'Active' : 'Inactive'}
                </Badge>
                
                <Badge 
                  variant={syncStatus.isConnected ? 'success' : 'destructive'} 
                  className="flex items-center gap-1"
                >
                  <Wifi className="h-3 w-3" />
                  {syncStatus.isConnected ? 'Online' : 'Offline'}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="real-time" 
                  checked={isRealTimeSync} 
                  onCheckedChange={handleRealTimeSyncChange}
                />
                <Label htmlFor="real-time" className="text-xs">Real-time</Label>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>Pending:</span>
                <Badge variant="outline">{syncStatus.local.pendingCount}</Badge>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>Processing:</span>
                <Badge variant="outline">{syncStatus.local.processingCount}</Badge>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>Completed:</span>
                <Badge variant="outline">{syncStatus.local.completedCount}</Badge>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>Failed:</span>
                <Badge variant={failedCount > 0 ? 'destructive' : 'outline'}>
                  {failedCount}
                </Badge>
              </div>
            </div>
            
            {lastSyncDate && (
              <div className="text-xs text-muted-foreground mt-1">
                Last sync: {lastSyncDate.toLocaleString()}
              </div>
            )}
            
            {failedCount > 0 && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 rounded-md text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>There are {failedCount} failed sync operations that need attention.</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex gap-2 flex-wrap">
        <Button 
          variant="outline" 
          onClick={handleSync}
          disabled={!isReady || isSyncing}
          className="flex-1"
        >
          {isSyncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Now
            </>
          )}
        </Button>
        
        {failedCount > 0 && (
          <Button
            variant="outline"
            onClick={handleRepairFailed}
            disabled={isRepairing}
            className="flex-1"
          >
            {isRepairing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Repairing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Fix Failed
              </>
            )}
          </Button>
        )}
        
        <Button 
          variant="destructive" 
          onClick={resetDatabase}
          disabled={!isReady}
          className="flex-1"
        >
          Reset Database
        </Button>
      </CardFooter>
    </Card>
  );
} 