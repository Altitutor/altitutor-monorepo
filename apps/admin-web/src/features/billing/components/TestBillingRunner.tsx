'use client';

import { useState } from 'react';
import { Button, useToast, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@altitutor/ui';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { Loader2, Play } from 'lucide-react';

export function TestBillingRunner() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState('');
  const [result, setResult] = useState<any>(null);

  const handleTestRun = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api/billing/runner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          date: date || undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to run billing');
      }

      setResult(data);
      toast({
        title: 'Success',
        description: data.message || `Billing completed successfully`,
      });
    } catch (error) {
      console.error('Failed to run billing:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to run billing',
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
          Billing Runner
        </CardTitle>
        <CardDescription>
          Manually trigger billing runner to verify end-to-end payment processing.
          Uses Stripe test keys in dev environment. Specify a date to process sessions for that date, or leave empty to process tomorrow's sessions.
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
              : 'Will process tomorrow\'s sessions by default'}
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
              Run Billing
            </>
          )}
        </Button>

        {result && (
          <div className="mt-4 p-4 bg-muted rounded-md space-y-2">
            <div className="font-semibold">Results:</div>
            <div className="text-sm space-y-1">
              <div><strong>Status:</strong> {result.ok ? 'Success' : 'Failed'}</div>
              <div><strong>Invoices Created:</strong> {result.invoicesCreated || 0}</div>
              <div><strong>Stripe Key Type:</strong> {result.stripeKeyType || 'unknown'}</div>
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

