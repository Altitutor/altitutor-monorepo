'use client';

import { useState } from 'react';
import { Button, useToast, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@altitutor/ui';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { Loader2, Play, Calendar } from 'lucide-react';

export function TestBillingRunner() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState('');
  const [result, setResult] = useState<any>(null);

  const handleTestRun = async () => {
    setLoading(true);
    setResult(null);
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/billing-runner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          testMode: true,
          date: date || undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to run billing test');
      }

      setResult(data);
      toast({
        title: 'Success',
        description: data.message || `Test billing completed successfully`,
      });
    } catch (error) {
      console.error('Failed to run billing test:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to run billing test',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Test Billing Runner
        </CardTitle>
        <CardDescription>
          Run billing in test mode to verify end-to-end payment processing.
          <strong className="text-destructive"> WARNING: Test mode will charge Stripe.</strong> Remove test mode Stripe charging before production.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="test-date">Date (optional)</Label>
          <Input
            id="test-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="Leave empty to process today's sessions"
          />
          <p className="text-sm text-muted-foreground">
            {date 
              ? `Will process sessions for ${new Date(date).toLocaleDateString()}`
              : 'Will process today\'s sessions by default'}
          </p>
        </div>
        
        <Button 
          onClick={handleTestRun} 
          disabled={loading}
          variant="outline"
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running Test...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Test Billing
            </>
          )}
        </Button>

        {result && (
          <div className="mt-4 p-4 bg-muted rounded-md space-y-2">
            <div className="font-semibold">Test Results:</div>
            <div className="text-sm space-y-1">
              <div><strong>Status:</strong> {result.ok ? 'Success' : 'Failed'}</div>
              <div><strong>Payments Created:</strong> {result.created || 0}</div>
              <div><strong>Test Mode:</strong> {result.testMode ? 'Yes' : 'No'}</div>
              {result.dateRange && (
                <div>
                  <strong>Date Range:</strong>{' '}
                  {new Date(result.dateRange.start).toLocaleString()} - {new Date(result.dateRange.end).toLocaleString()}
                </div>
              )}
              {result.message && (
                <div className="mt-2 p-2 bg-background rounded text-xs">
                  {result.message}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

