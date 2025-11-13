'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { useSupabaseClient } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/shared/lib/supabase/auth';

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
    // Get initial session (already validated by middleware)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
        setSession(null);
        setUser(null);
      } else if (session) {
        setSession(session);
        setUser(session.user);
      } else {
        setSession(null);
        setUser(null);
      }
      setIsLoading(false);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('Auth state changed:', { event: _event, hasSession: !!session });
        }
        
        // For SIGNED_OUT events, set user to null immediately
        if (_event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setIsLoading(false);
          setLoading(false);
          return;
        }
        
        // For events with a session, use session user directly
        // Only validate if session user is missing (shouldn't happen, but safety check)
        if (session) {
          setSession(session);
          // Use session.user directly - it's already validated by Supabase
          // Only call getUser() if session.user is missing (edge case)
          if (session.user) {
            setUser(session.user);
          } else {
            // Fallback: only validate if session.user is missing
            supabase.auth.getUser().then(({ data: { user }, error }) => {
              if (error || !user) {
                console.error('User validation failed in auth change:', error);
                setSession(null);
                setUser(null);
              } else {
                setUser(user);
              }
            });
          }
          setIsLoading(false);
          setLoading(false);
        } else {
          setSession(null);
          setUser(null);
          setIsLoading(false);
          setLoading(false);
        }
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