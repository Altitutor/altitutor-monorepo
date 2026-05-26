import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serverStorage = {
  async getItem() {
    return null;
  },
  async setItem() {},
  async removeItem() {},
};
const browserStorage = {
  async getItem(key: string) {
    return typeof window.localStorage === 'undefined' ? null : window.localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    window.localStorage?.setItem(key, value);
  },
  async removeItem(key: string) {
    window.localStorage?.removeItem(key);
  },
};

if (!url || !key) {
  console.warn('Student app Supabase environment variables are not configured.');
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  url ?? 'https://placeholder.supabase.co',
  key ?? 'placeholder-anon-key',
  {
    auth: {
      storage: typeof window === 'undefined' ? serverStorage : Platform.OS === 'web' ? browserStorage : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
