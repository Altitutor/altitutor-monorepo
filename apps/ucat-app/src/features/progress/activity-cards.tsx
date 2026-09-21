import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { Copy, Group, useColors } from "@/components/ui";
import type { Activity } from "./api";
import { buildPracticeStreak } from "./practice-streak";
import {
  ACTIVITY_INTENSITY_ALPHA,
  activityCalendarStartKey,
  buildActivityCalendarMonths,
  monthActivityMaxima,
  relativeActivityIntensityLevel,
  type CalendarDay,
} from "./month-calendar";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CELL_GAP = 4;
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

function DayCell({
  day,
  cell,
  fill,
  isToday,
  isFuture,
  inStreak,
  questions,
  sets,
}: {
  day: CalendarDay;
  cell: number;
  fill: string;
  isToday: boolean;
  isFuture: boolean;
  inStreak: boolean;
  questions: number;
  sets: number;
}) {
  const c = useColors();
  const label = new Date(`${day.dateKey}T12:00:00`).toLocaleDateString(
    "en-AU",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );
  return (
    <View
      accessible
      accessibilityLabel={
        isFuture
          ? `${label} (upcoming)`
          : `${label}: ${questions} question attempt${questions === 1 ? "" : "s"}, ${sets} set attempt${sets === 1 ? "" : "s"}${inStreak ? ", part of current streak" : ""}`
      }
      style={{
        width: cell,
        height: cell,
        borderRadius: cell * 0.22,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isFuture ? c.border : fill,
        opacity: isFuture ? 0.45 : 1,
        borderWidth: isToday && !inStreak ? 1.5 : 0,
        borderColor: c.accent,
      }}
    >
      {inStreak ? <Flame size={Math.min(14, Math.round(cell * 0.45))} /> : null}
    </View>
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
  const scrollRef = useRef<ScrollView>(null);
  const initialized = useRef(false);
  const cell = width > 0 ? (width - CELL_GAP * 6) / 7 : 0;

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
                <View
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
                          c.accent,
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
                      />
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
      <IntensityLegend accent={c.accent} />
    </Group>
  );
}
