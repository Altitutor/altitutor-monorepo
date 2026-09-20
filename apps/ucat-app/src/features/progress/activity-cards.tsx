import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Copy, Group, useColors } from "@/components/ui";
import type { Activity } from "./api";
import { buildPracticeStreak, practiceStreakWeekday } from "./practice-streak";
import { practiceWeeks, displayChartDate } from "./chart-dates";
export function ActivityCards({ activity }: { activity: Activity }) {
  const c = useColors();
  const streak = buildPracticeStreak(activity.days, activity.timezone);
  const today = streak.recentDays.at(-1)?.dateKey ?? "";
  const weeks = practiceWeeks(activity.days, today);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const initialized = useRef(false);
  return (
    <Group title="Practice streak">
      <Copy large>
        {streak.current} day{streak.current === 1 ? "" : "s"}
      </Copy>
      <Copy muted>
        {streak.practicedToday
          ? "You’ve practised today. Keep it going tomorrow."
          : "Answer a question today to keep building your streak."}
      </Copy>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onContentSizeChange={() => {
              if (!initialized.current) {
                scrollRef.current?.scrollToEnd({ animated: false });
                initialized.current = true;
              }
            }}
          >
            {weeks.map((week) => (
              <View key={week[0].key} style={{ width, gap: 12 }}>
                <Text style={{ color: c.secondary, textAlign: "center" }}>
                  {displayChartDate(week[0].key)} –{" "}
                  {displayChartDate(week[6].key)}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-around",
                  }}
                >
                  {week.map((day) => (
                    <View
                      key={day.key}
                      accessibilityLabel={`${day.key}: ${day.count} questions`}
                      style={{
                        alignItems: "center",
                        gap: 7,
                        opacity: day.future ? 0.35 : 1,
                      }}
                    >
                      <Text style={{ color: c.secondary }}>
                        {practiceStreakWeekday(day.key)}
                      </Text>
                      <View
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          borderWidth: day.today ? 2 : 1,
                          borderColor: day.today ? c.accent : c.border,
                          backgroundColor: day.count ? c.accent : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: day.count ? c.card : c.text,
                            fontSize: 12,
                          }}
                        >
                          {day.count ? "✓" : Number(day.key.slice(-2))}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Group>
  );
}
