import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Appearance, useColorScheme } from 'react-native';

export type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedScheme = 'light' | 'dark';

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  resolvedScheme: ResolvedScheme;
  setPreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = 'student-app-theme';
const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
        Appearance.setColorScheme(stored === 'system' ? 'unspecified' : stored);
      }
    }).catch(() => undefined);
  }, []);

  function setPreference(nextPreference: ThemePreference) {
    setPreferenceState(nextPreference);
    Appearance.setColorScheme(nextPreference === 'system' ? 'unspecified' : nextPreference);
    AsyncStorage.setItem(STORAGE_KEY, nextPreference).catch(() => undefined);
  }

  const resolvedScheme: ResolvedScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo(
    () => ({ preference, resolvedScheme, setPreference }),
    [preference, resolvedScheme],
  );

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  const value = useContext(ThemePreferenceContext);
  if (!value) throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  return value;
}
