import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { migrateToSupabase } from '@/lib/supabase/migrate';

enum MigrationStatus {
  IDLE = 'idle',
  MIGRATING = 'migrating',
  SUCCESS = 'success',
  ERROR = 'error'
}

export default function MigrationTool() {
  const [status, setStatus] = useState<MigrationStatus>(MigrationStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  
  const handleMigration = async () => {
    try {
      setStatus(MigrationStatus.MIGRATING);
      setError(null);
      
      const result = await migrateToSupabase();
      
      if (result.success) {
        setStatus(MigrationStatus.SUCCESS);
      } else {
        setStatus(MigrationStatus.ERROR);
        setError(result.error?.message || 'Unknown error occurred');
      }
    } catch (err: any) {
      setStatus(MigrationStatus.ERROR);
      setError(err.message || 'An unexpected error occurred');
    }
  };
  
  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Database Migration Tool</CardTitle>
        <CardDescription>
          Migrate your local data to Supabase cloud database
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-md">
            <h3 className="font-semibold mb-2">Before you begin:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Make sure you have set up your Supabase project</li>
              <li>Verify your environment variables are correctly configured</li>
              <li>Ensure you have a stable internet connection</li>
              <li>This process may take several minutes depending on data size</li>
            </ul>
          </div>
          
          {status === MigrationStatus.SUCCESS && (
            <Alert className="bg-green-50 border-green-300">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>Migration Successful</AlertTitle>
              <AlertDescription>
                Your data has been successfully migrated to Supabase.
              </AlertDescription>
            </Alert>
          )}
          
          {status === MigrationStatus.ERROR && (
            <Alert className="bg-red-50 border-red-300">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertTitle>Migration Failed</AlertTitle>
              <AlertDescription>
                {error || 'An error occurred during migration. Please try again.'}
              </AlertDescription>
            </Alert>
          )}
          
          {status === MigrationStatus.MIGRATING && (
            <Alert className="bg-blue-50 border-blue-300">
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
              <AlertTitle>Migration in Progress</AlertTitle>
              <AlertDescription>
                Please do not close this window. The migration is in progress...
              </AlertDescription>
            </Alert>
          )}
          
          {status === MigrationStatus.IDLE && (
            <Alert className="bg-yellow-50 border-yellow-300">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertTitle>Ready to Migrate</AlertTitle>
              <AlertDescription>
                Click the button below to start the migration process.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-sm text-slate-500">
          {status === MigrationStatus.MIGRATING ? 'Migration in progress...' : 'This will not delete your local data.'}
        </div>
        <Button 
          onClick={handleMigration} 
          disabled={status === MigrationStatus.MIGRATING}
          variant={status === MigrationStatus.SUCCESS ? "outline" : "default"}
        >
          {status === MigrationStatus.MIGRATING && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {status === MigrationStatus.SUCCESS ? 'Migration Complete' : 
           status === MigrationStatus.MIGRATING ? 'Migrating...' : 
           status === MigrationStatus.ERROR ? 'Try Again' : 'Start Migration'}
        </Button>
      </CardFooter>
    </Card>
  );
} 