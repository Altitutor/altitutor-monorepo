import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { adelaideDateKey } from '@/features/dashboard/timetable';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

import {
  addAdelaideDays,
  adelaideMinutes,
  adelaideWeek,
  layoutDayEvents,
  visibleCalendarDays,
  type CalendarSpan,
} from './calendar-model';

export type CalendarItem = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  color: string | null;
  cancelled: boolean;
  classId: string | null;
};

const HOUR_HEIGHT = 56;
const DAY_START_FALLBACK = 8;
const DAY_END_FALLBACK = 18;

function dayKey(date: Date) {
  return adelaideDateKey(date);
}

function eventsOn(items: CalendarItem[], date: Date) {
  const key = dayKey(date);
  return items.filter((item) => adelaideDateKey(new Date(item.start)) === key);
}

export function WeekStrip({ anchor, onSelect }: { anchor: Date; onSelect: (date: Date) => void }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const pageWidth = width;
  const scroller = useRef<ScrollView>(null);
  const weeks = [addAdelaideDays(anchor, -7), anchor, addAdelaideDays(anchor, 7)].map((date) => adelaideWeek(date));
  const selected = dayKey(anchor);
  const today = dayKey(new Date());
  const paging = useRef(false);

  useEffect(() => {
    paging.current = true;
    scroller.current?.scrollTo({ x: pageWidth, animated: false });
    const frame = requestAnimationFrame(() => {
      paging.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [selected, pageWidth]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={(event) => {
        if (paging.current) return;
        const page = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
        if (page === 1) return;
        onSelect(addAdelaideDays(anchor, page === 0 ? -7 : 7));
      }}>
      {weeks.map((week) => (
        <View key={dayKey(week[0])} style={{ width: pageWidth, flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 8 }}>
          {week.map((date) => {
            const key = dayKey(date);
            const active = key === selected;
            const isToday = key === today;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPressIn={() => haptic()}
                onPress={() => onSelect(date)}
                style={{ flex: 1, alignItems: 'center', gap: 6, minHeight: 58 }}>
                <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>
                  {date.toLocaleDateString('en-AU', { weekday: 'narrow', timeZone: 'Australia/Adelaide' })}
                </Text>
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? theme.primary : 'transparent',
                }}>
                  <Text style={{ color: active ? '#FFFFFF' : isToday ? theme.danger : theme.text, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                    {Number(key.slice(8))}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

export function DayBoard({
  anchor,
  span,
  items,
  onOpen,
  onShift,
}: {
  anchor: Date;
  span: CalendarSpan;
  items: CalendarItem[];
  onOpen: (id: string) => void;
  onShift: (days: number) => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const columnWidth = (width - 52) / span;
  const hours = useMemo(() => {
    const minutes = items.flatMap((item) => {
      const start = adelaideMinutes(new Date(item.start));
      const end = item.end ? adelaideMinutes(new Date(item.end)) : start + 60;
      return [start, end];
    });
    const startHour = Math.max(0, Math.min(DAY_START_FALLBACK, minutes.length ? Math.floor(Math.min(...minutes) / 60) : DAY_START_FALLBACK));
    const endHour = Math.min(24, Math.max(DAY_END_FALLBACK, minutes.length ? Math.ceil(Math.max(...minutes) / 60) : DAY_END_FALLBACK));
    return { startHour, endHour };
  }, [items]);
  const height = (hours.endHour - hours.startHour) * HOUR_HEIGHT;
  const scroller = useRef<ScrollView>(null);
  const shifting = useRef(false);

  useEffect(() => {
    shifting.current = true;
    scroller.current?.scrollTo({ x: width, animated: false });
    const frame = requestAnimationFrame(() => {
      shifting.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, span, width]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={(event) => {
        if (shifting.current) return;
        const page = Math.round(event.nativeEvent.contentOffset.x / width);
        if (page === 0) onShift(-span);
        if (page === 2) onShift(span);
      }}
      contentOffset={{ x: width, y: 0 }}>
      {[-span, 0, span].map((offset) => (
        <ScrollView key={offset} style={{ width }} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ flexDirection: 'row', minHeight: height }}>
            <View style={{ width: 52 }}>
              {Array.from({ length: hours.endHour - hours.startHour }, (_, index) => (
                <Text key={index} style={{ height: HOUR_HEIGHT, color: theme.textSecondary, fontSize: 11, textAlign: 'right', paddingRight: 6 }}>
                  {formatHour(hours.startHour + index)}
                </Text>
              ))}
            </View>
            {visibleCalendarDays(addAdelaideDays(anchor, offset), span).map((date) => (
              <DayColumn
                key={dayKey(date)}
                date={date}
                width={columnWidth}
                items={eventsOn(items, date)}
                startHour={hours.startHour}
                height={height}
                showHeader={span > 1}
                onOpen={onOpen}
              />
            ))}
          </View>
        </ScrollView>
      ))}
    </ScrollView>
  );
}

function DayColumn({
  date,
  width,
  items,
  startHour,
  height,
  showHeader,
  onOpen,
}: {
  date: Date;
  width: number;
  items: CalendarItem[];
  startHour: number;
  height: number;
  showHeader: boolean;
  onOpen: (id: string) => void;
}) {
  const theme = useTheme();
  const layout = layoutDayEvents(items.map((item) => {
    const startMin = adelaideMinutes(new Date(item.start));
    const endMin = item.end ? Math.max(adelaideMinutes(new Date(item.end)), startMin + 30) : startMin + 60;
    return { id: item.id, startMin, endMin };
  }));
  const byId = new Map(layout.map((item) => [item.id, item]));
  return (
    <View style={{ width, borderLeftWidth: 0.5, borderLeftColor: theme.border }}>
      {showHeader ? (
        <Text style={{ color: theme.text, textAlign: 'center', fontWeight: '600', paddingVertical: 6, fontVariant: ['tabular-nums'] }}>
          {Number(dayKey(date).slice(8))}
        </Text>
      ) : null}
      <View style={{ height }}>
        {items.map((item) => {
          const place = byId.get(item.id);
          if (!place) return null;
          const startMin = adelaideMinutes(new Date(item.start));
          const endMin = item.end ? Math.max(adelaideMinutes(new Date(item.end)), startMin + 30) : startMin + 60;
          const top = ((startMin - startHour * 60) / 60) * HOUR_HEIGHT;
          const eventHeight = Math.max(28, ((endMin - startMin) / 60) * HOUR_HEIGHT - 2);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPressIn={() => haptic()}
              onPress={() => onOpen(item.id)}
              style={{
                position: 'absolute',
                top,
                height: eventHeight,
                left: 2 + (place.column * (width - 4)) / place.columns,
                width: (width - 4) / place.columns - 2,
                borderRadius: 8,
                borderCurve: 'continuous',
                backgroundColor: item.color ?? theme.accent,
                opacity: item.cancelled ? 0.38 : 1,
                paddingHorizontal: 6,
                paddingVertical: 4,
                overflow: 'hidden',
              }}>
              <Text numberOfLines={2} style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', textDecorationLine: item.cancelled ? 'line-through' : 'none' }}>
                {item.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SessionList({ items, onOpen }: { items: CalendarItem[]; onOpen: (id: string) => void }) {
  const theme = useTheme();
  const scroller = useRef<ScrollView>(null);
  const today = dayKey(new Date());
  const groups = useMemo(() => {
    const sorted = [...items].sort((left, right) => left.start.localeCompare(right.start));
    const buckets = new Map<string, CalendarItem[]>();
    for (const item of sorted) {
      const key = adelaideDateKey(new Date(item.start));
      buckets.set(key, [...(buckets.get(key) ?? []), item]);
    }
    return [...buckets.entries()];
  }, [items]);
  const offsets = useRef(new Map<string, number>());

  useEffect(() => {
    const offset = offsets.current.get(today) ?? offsets.current.get(groups.find(([key]) => key >= today)?.[0] ?? '');
    if (offset != null) scroller.current?.scrollTo({ y: offset, animated: false });
  }, [groups, today]);

  return (
    <ScrollView ref={scroller} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16, gap: 16 }}>
      {groups.map(([key, dayItems]) => (
        <View key={key} onLayout={(event) => offsets.current.set(key, event.nativeEvent.layout.y)}>
          <Text style={{ color: key === today ? theme.primary : theme.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
            {new Date(`${key}T12:00:00+09:30`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Australia/Adelaide' })}
          </Text>
          {dayItems.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" onPressIn={() => haptic()} onPress={() => onOpen(item.id)} style={{ flexDirection: 'row', gap: 10, minHeight: 52, alignItems: 'center', opacity: item.cancelled ? 0.45 : 1 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color ?? theme.accent }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', textDecorationLine: item.cancelled ? 'line-through' : 'none' }}>{item.title}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{new Date(item.start).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Adelaide' })}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function formatHour(hour: number) {
  const normalized = hour % 24;
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const clock = normalized % 12 || 12;
  return `${clock} ${suffix}`;
}
