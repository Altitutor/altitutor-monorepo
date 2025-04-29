'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDb } from '@/lib/supabase/db/context';
import { CheckCircle } from 'lucide-react';

export function DbStatusPanel() {
  const { isReady, error } = useDb();
  
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
          Supabase database connection status
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded text-destructive text-sm">
            {error}
          </div>
        )}
        
        {isReady && (
          <div className="flex items-center justify-center p-4 text-green-600 gap-2">
            <CheckCircle className="h-5 w-5" />
            <span>Connected to Supabase</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 