import { Stack } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

export function StudentScreen({
  title,
  subtitle,
  children,
  refreshing,
  onRefresh,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}>) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <Stack.Screen options={{ title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined}>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement, shadowColor: theme.shadow }]}>{children}</View>;
}

export function SectionTitle({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <Text style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>;
}

export function Label({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <Text style={[styles.label, { color: theme.textSecondary }]}>{children}</Text>;
}

export function Value({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <Text style={[styles.value, { color: theme.text }]}>{children}</Text>;
}

export function TappableRow({ title, detail, onPress, accent }: { title: string; detail?: string; onPress?: () => void; accent?: string | null }) {
  const theme = useTheme();
  const content = (
    <View style={styles.row}>
      {accent ? <View style={[styles.dot, { backgroundColor: accent }]} /> : null}
      <View style={styles.grow}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        {detail ? <Text style={[styles.label, { color: theme.textSecondary }]}>{detail}</Text> : null}
      </View>
      {onPress ? <Text style={{ color: theme.textSecondary }}>›</Text> : null}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

export function LoadingBlock({ label = 'Loading...' }: { label?: string }) {
  const theme = useTheme();
  return (
    <Card>
      <View style={styles.loading}>
        <ActivityIndicator color={theme.primary} />
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      </View>
    </Card>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <Card>
      <Text style={[styles.value, { color: theme.danger }]}>{message}</Text>
    </Card>
  );
}

export function EmptyBlock({ children }: { children: ReactNode }) {
  return (
    <Card>
      <Label>{children}</Label>
    </Card>
  );
}

export function FullScreenLoading({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.fullScreen, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

export function formatDateTime(value: string | null) {
  if (!value) return 'Time to be confirmed';
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatMoney(cents: number | null, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format((cents ?? 0) / 100);
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 100, gap: 14 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  card: {
    padding: 16,
    borderRadius: 20,
    gap: 12,
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  label: { fontSize: 14, lineHeight: 20 },
  value: { fontSize: 16, lineHeight: 23, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowTitle: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  grow: { flex: 1, gap: 3 },
  loading: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  fullScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
});
