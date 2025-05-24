'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/supabase/auth';
import { useAuth } from '@/lib/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SessionTest() {
  const [mounted, setMounted] = useState(false);
  const zustandAuth = useAuthStore();
  const contextAuth = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div>Loading session test...</div>;
  }

  const handleRefreshSession = () => {
    zustandAuth.refreshSession();
  };

  const handleInitializeAuth = () => {
    zustandAuth.initializeAuth();
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>🔐 Session Persistence Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">Zustand Store</h3>
            <div className="text-sm space-y-1">
              <p><strong>Authenticated:</strong> {zustandAuth.isAuthenticated ? '✅' : '❌'}</p>
              <p><strong>Loading:</strong> {zustandAuth.loading ? '⏳' : '✅'}</p>
              <p><strong>User Email:</strong> {zustandAuth.user?.email || 'None'}</p>
              <p><strong>Has Token:</strong> {zustandAuth.token ? '✅' : '❌'}</p>
              <p><strong>Error:</strong> {zustandAuth.error || 'None'}</p>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Context Provider</h3>
            <div className="text-sm space-y-1">
              <p><strong>Has Session:</strong> {contextAuth.session ? '✅' : '❌'}</p>
              <p><strong>Loading:</strong> {contextAuth.isLoading ? '⏳' : '✅'}</p>
              <p><strong>Session Email:</strong> {contextAuth.session?.user?.email || 'None'}</p>
              <p><strong>Access Token:</strong> {contextAuth.session?.access_token ? '✅' : '❌'}</p>
            </div>
          </div>
        </div>
        
        <div className="border-t pt-4">
          <h3 className="font-semibold mb-2">localStorage Check</h3>
          <div className="text-sm">
            <p><strong>Auth Storage:</strong> {typeof window !== 'undefined' && localStorage.getItem('auth-storage') ? '✅ Found' : '❌ Not found'}</p>
            <p><strong>Supabase Session:</strong> {typeof window !== 'undefined' && localStorage.getItem('sb-ysfslbdcacpbemodkwtl-auth-token') ? '✅ Found' : '❌ Not found'}</p>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button onClick={handleRefreshSession} variant="outline" size="sm">
            Refresh Session
          </Button>
          <Button onClick={handleInitializeAuth} variant="outline" size="sm">
            Initialize Auth
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 