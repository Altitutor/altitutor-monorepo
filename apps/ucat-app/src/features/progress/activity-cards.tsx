import { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from "react-native";
import { Image } from "expo-image";
import { Copy, Group, useColors } from "@/components/ui";
import { useAppTheme } from "@/features/settings/theme";
import { haptic } from "@/lib/haptics";
import type { Activity } from "./api";
import { CELL_GAP, hitDay, type CalendarGrid } from "./calendar-hit";
import { buildPracticeStreak } from "./practice-streak";
import {
  ACTIVITY_INTENSITY_ALPHA,
  activityCalendarStartKey,
  buildActivityCalendarMonths,
  monthActivityMaxima,
  relativeActivityIntensityLevel,
  type CalendarDay,
  type CalendarMonth,
} from "./month-calendar";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FLAME_URI = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2c2 5 7 7 7 13a7 7 0 0 1-14 0c0-3 2-6 4-8 0 4 1 5 2 5 2-3 2-6 1-10Z" fill="#FBBF24" stroke="#F59E0B" stroke-width="1.5"/></svg>')}`;

function accentFill(accent: string, alpha: number) {
  const hex = accent.replace("#", "");
  const value = Number.parseInt(hex, 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

function Flame({ size }: { size: number }) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={{ uri: FLAME_URI }}
      style={{ width: size, height: size }}
    />
  );
}

type DayTooltipAnchor = {
  dateKey: string;
  label: string;
  questions: number;
  sets: number;
  inStreak: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

type DayTooltipState = {
  anchor: DayTooltipAnchor;
  grid: CalendarGrid;
};

function tooltipPlacement(
  anchor: DayTooltipAnchor,
  size: { width: number; height: number },
  screenWidth: number,
) {
  const left = Math.min(
    Math.max(8, anchor.x + anchor.width / 2 - size.width / 2),
    screenWidth - size.width - 8,
  );
  const gap = 12;
  const above = anchor.y - size.height - gap >= 8;
  const top = above
    ? anchor.y - size.height - gap
    : anchor.y + anchor.height + gap;
  return {
    left,
    top,
    above,
    caretLeft: Math.min(
      Math.max(12, anchor.x + anchor.width / 2 - left - 6),
      size.width - 24,
    ),
  };
}

function dayLabel(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function anchorAtIndex(
  grid: CalendarGrid,
  index: number,
  details: Pick<DayTooltipAnchor, "questions" | "sets" | "inStreak">,
): DayTooltipAnchor | null {
  const day = grid.days[index];
  if (!day) return null;
  const stride = grid.cell + CELL_GAP;
  const col = index % 7;
  const row = Math.floor(index / 7);
  return {
    dateKey: day.dateKey,
    label: dayLabel(day.dateKey),
    ...details,
    x: grid.x + col * stride,
    y: grid.y + row * stride,
    width: grid.cell,
    height: grid.cell,
  };
}

function DayTooltipCard({ anchor }: { anchor: DayTooltipAnchor }) {
  const c = useColors();
  const { scheme } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [size, setSize] = useState({ width: 220, height: 96 });
  const { left, top, above, caretLeft } = tooltipPlacement(
    anchor,
    size,
    screenWidth,
  );
  return (
    <View
      pointerEvents="none"
      accessibilityViewIsModal
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        if (next.width !== size.width || next.height !== size.height)
          setSize({ width: next.width, height: next.height });
      }}
      style={{
        position: "absolute",
        left,
        top,
        minWidth: 196,
        maxWidth: 280,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 4,
        backgroundColor: c.card,
        borderRadius: 12,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: c.border,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.16)",
      }}
    >
      <Text
        selectable
        style={{ color: c.text, fontSize: 15, fontWeight: "600" }}
      >
        {anchor.label}
      </Text>
      <Text selectable style={{ color: c.secondary, fontSize: 13 }}>
        {anchor.questions} question attempt
        {anchor.questions === 1 ? "" : "s"}
      </Text>
      <Text selectable style={{ color: c.secondary, fontSize: 13 }}>
        {anchor.sets} set attempt{anchor.sets === 1 ? "" : "s"}
      </Text>
      {anchor.inStreak ? (
        <Text
          selectable
          style={{
            color: scheme === "dark" ? "#FCD34D" : "#B45309",
            fontSize: 13,
          }}
        >
          Current streak
        </Text>
      ) : null}
      <View
        accessible={false}
        style={{
          position: "absolute",
          left: caretLeft,
          ...(above ? { bottom: -6 } : { top: -6 }),
          width: 12,
          height: 12,
          backgroundColor: c.card,
          borderRightWidth: above ? 1 : 0,
          borderBottomWidth: above ? 1 : 0,
          borderLeftWidth: above ? 0 : 1,
          borderTopWidth: above ? 0 : 1,
          borderColor: c.border,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

function DayTooltip({
  tooltip,
  today,
  resolve,
  onChange,
  onDismiss,
}: {
  tooltip: DayTooltipState;
  today: string;
  resolve: (
    day: CalendarDay,
  ) => Pick<DayTooltipAnchor, "questions" | "sets" | "inStreak">;
  onChange: (next: DayTooltipState) => void;
  onDismiss: () => void;
}) {
  const { grid } = tooltip;
  function showHit(event: GestureResponderEvent) {
    const hit = hitDay(
      grid,
      event.nativeEvent.pageX,
      event.nativeEvent.pageY,
      today,
    );
    if (!hit) {
      onDismiss();
      return;
    }
    const next = anchorAtIndex(grid, hit.index, resolve(hit.day));
    if (!next) {
      onDismiss();
      return;
    }
    if (next.dateKey !== tooltip.anchor.dateKey) haptic();
    onChange({ ...tooltip, anchor: next });
  }
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss day details"
          onPress={showHit}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          }}
        />
        <DayTooltipCard anchor={tooltip.anchor} />
      </View>
    </Modal>
  );
}

function DayCell({
  day,
  cell,
  fill,
  isToday,
  isFuture,
  inStreak,
  questions,
  sets,
  measureGrid,
  onShow,
}: {
  day: CalendarDay;
  cell: number;
  fill: string;
  isToday: boolean;
  isFuture: boolean;
  inStreak: boolean;
  questions: number;
  sets: number;
  measureGrid: (done: (grid: CalendarGrid) => void) => void;
  onShow: (tooltip: DayTooltipState) => void;
}) {
  const c = useColors();
  const ref = useRef<View>(null);
  const label = dayLabel(day.dateKey);
  const accessibilityLabel = isFuture
    ? `${label} (upcoming)`
    : `${label}: ${questions} question attempt${questions === 1 ? "" : "s"}, ${sets} set attempt${sets === 1 ? "" : "s"}${inStreak ? ", part of current streak" : ""}`;
  const appearance = {
    width: cell,
    height: cell,
    borderRadius: cell * 0.22,
    borderCurve: "continuous" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: isFuture ? c.border : fill,
    borderWidth: isToday && !inStreak ? 1.5 : 0,
    borderColor: c.accent,
  };
  const flame = inStreak ? (
    <Flame size={Math.min(14, Math.round(cell * 0.45))} />
  ) : null;
  if (isFuture)
    return (
      <View
        accessible
        accessibilityLabel={accessibilityLabel}
        style={[appearance, { opacity: 0.45 }]}
      >
        {flame}
      </View>
    );
  return (
    <Pressable
      ref={ref}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Shows practice for this day"
      onPress={() => {
        haptic();
        ref.current?.measureInWindow((x, y, width, height) => {
          measureGrid((grid) => {
            onShow({
              grid,
              anchor: {
                dateKey: day.dateKey,
                label,
                questions,
                sets,
                inStreak,
                x,
                y,
                width,
                height,
              },
            });
          });
        });
      }}
      style={({ pressed }) => [appearance, { opacity: pressed ? 0.7 : 1 }]}
    >
      {flame}
    </Pressable>
  );
}

function IntensityLegend({ accent }: { accent: string }) {
  const c = useColors();
  return (
    <View
      accessible
      accessibilityLabel="Less practice to more practice"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <Text style={{ color: c.secondary, fontSize: 11 }}>Less practice</Text>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <View
            key={level}
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              borderCurve: "continuous",
              backgroundColor: accentFill(
                accent,
                ACTIVITY_INTENSITY_ALPHA[level],
              ),
            }}
          />
        ))}
      </View>
      <Text style={{ color: c.secondary, fontSize: 11 }}>More practice</Text>
    </View>
  );
}

function MonthDays({
  month,
  cell,
  today,
  accent,
  activityByDate,
  streakDays,
  maxima,
  onShow,
}: {
  month: CalendarMonth;
  cell: number;
  today: string;
  accent: string;
  activityByDate: Map<
    string,
    { questionAttempts: number; setAttempts: number }
  >;
  streakDays: Set<string>;
  maxima: Map<string, number>;
  onShow: (tooltip: DayTooltipState) => void;
}) {
  const gridRef = useRef<View>(null);
  return (
    <View
      ref={gridRef}
      collapsable={false}
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: CELL_GAP,
      }}
    >
      {month.days.map((day, index) => {
        if (!day)
          return (
            <View
              key={`${month.key}-blank-${index}`}
              style={{ width: cell, height: cell }}
            />
          );
        const recorded = activityByDate.get(day.dateKey);
        const questions = recorded?.questionAttempts ?? 0;
        const sets = recorded?.setAttempts ?? 0;
        return (
          <DayCell
            key={day.dateKey}
            day={day}
            cell={cell}
            fill={accentFill(
              accent,
              ACTIVITY_INTENSITY_ALPHA[
                relativeActivityIntensityLevel(
                  questions + sets,
                  maxima.get(day.dateKey.slice(0, 7)) ?? 0,
                )
              ],
            )}
            isToday={day.dateKey === today}
            isFuture={day.dateKey > today}
            inStreak={streakDays.has(day.dateKey)}
            questions={questions}
            sets={sets}
            measureGrid={(done) => {
              if (!gridRef.current) {
                done({ x: 0, y: 0, cell, days: month.days });
                return;
              }
              gridRef.current.measureInWindow((x, y) => {
                done({ x, y, cell, days: month.days });
              });
            }}
            onShow={onShow}
          />
        );
      })}
    </View>
  );
}

export function ActivityCards({ activity }: { activity: Activity }) {
  const c = useColors();
  const streak = buildPracticeStreak(activity.days, activity.timezone);
  const today = streak.recentDays.at(-1)?.dateKey ?? "";
  const months = buildActivityCalendarMonths(
    activityCalendarStartKey(
      activity.days.map((day) => day.dateKey),
      activity.startedAt,
      today,
    ),
    today,
  );
  const maxima = monthActivityMaxima(activity.days);
  const activityByDate = new Map(
    activity.days.map((day) => [day.dateKey, day] as const),
  );
  const streakDays = new Set(streak.streakDateKeys);
  const [width, setWidth] = useState(0);
  const [tooltip, setTooltip] = useState<DayTooltipState | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const initialized = useRef(false);
  const cell = width > 0 ? (width - CELL_GAP * 6) / 7 : 0;
  const resolveDay = (day: CalendarDay) => {
    const recorded = activityByDate.get(day.dateKey);
    return {
      questions: recorded?.questionAttempts ?? 0,
      sets: recorded?.setAttempts ?? 0,
      inStreak: streakDays.has(day.dateKey),
    };
  };

  return (
    <Group title="Practice streak">
      <Copy large>
        {streak.current} day{streak.current === 1 ? "" : "s"}
      </Copy>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessibilityLabel="Practice calendar"
      >
        {width > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            directionalLockEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onContentSizeChange={() => {
              if (initialized.current || months.length < 2) return;
              scrollRef.current?.scrollTo({
                x: width * (months.length - 1),
                animated: false,
              });
              initialized.current = true;
            }}
          >
            {months.map((month) => (
              <View key={month.key} style={{ width, gap: 10 }}>
                <Text
                  style={{
                    color: c.text,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {month.label}
                </Text>
                <View style={{ flexDirection: "row", gap: CELL_GAP }}>
                  {WEEKDAYS.map((weekday) => (
                    <Text
                      key={`${month.key}-${weekday}`}
                      style={{
                        width: cell,
                        color: c.secondary,
                        fontSize: 10,
                        fontWeight: "600",
                        textAlign: "center",
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                      }}
                    >
                      {weekday}
                    </Text>
                  ))}
                </View>
                <MonthDays
                  month={month}
                  cell={cell}
                  today={today}
                  accent={c.accent}
                  activityByDate={activityByDate}
                  streakDays={streakDays}
                  maxima={maxima}
                  onShow={setTooltip}
                />
              </View>
            ))}
          </ScrollView>
        )}
      </View>
      <IntensityLegend accent={c.accent} />
      {tooltip ? (
        <DayTooltip
          tooltip={tooltip}
          today={today}
          resolve={resolveDay}
          onChange={setTooltip}
          onDismiss={() => setTooltip(null)}
        />
      ) : null}
    </Group>
  );
}
