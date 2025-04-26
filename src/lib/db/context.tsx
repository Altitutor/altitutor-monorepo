'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DbContextType {
  isReady: boolean;
  error: string | null;
}

const DbContext = createContext<DbContextType | undefined>(undefined);

interface DbProviderProps {
  children: ReactNode;
}

export function DbProvider({ children }: DbProviderProps) {
  // Since we're using only Supabase, we can simplify this component
  const [isReady] = useState(true);
  const [error] = useState<string | null>(null);
  
  const value: DbContextType = {
    isReady,
    error,
  };
  
  return (
    <DbContext.Provider value={value}>
      {children}
    </DbContext.Provider>
  );
}

export function useDb() {
  const context = useContext(DbContext);
  
  if (context === undefined) {
    throw new Error('useDb must be used within a DbProvider');
  }
  
  return context;
} 