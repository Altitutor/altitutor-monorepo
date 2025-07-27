'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { User } from '@supabase/auth-helpers-nextjs';
import { useSupabaseClient } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { Database } from '@/shared/lib/supabase/database/types';

// Create context
type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
  supabase: ReturnType<typeof useSupabaseClient>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = useSupabaseClient();
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
      }
      
      setSession(session);
      setUser(session?.user || null);
      setIsLoading(false);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log('Auth state changed:', { event: _event, hasSession: !!session });
        setSession(session);
        setUser(session?.user || null);
        setIsLoading(false);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth, setUser, setLoading]);

  return (
    <AuthContext.Provider value={{ session, isLoading, supabase }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook for using the context
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
} 