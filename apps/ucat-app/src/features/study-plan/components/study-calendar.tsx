import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Copy, Group, useColors } from "@/components/ui";
import { withHaptic } from "@/lib/haptics";
import type { StudyPlanTask } from "../model/types";

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function monthAt(month: Date, offset: number) {
  return new Date(month.getFullYear(), month.getMonth() + offset, 1, 12);
}

export function StudyCalendar({
  today,
  tasks,
  selected,
  onSelect,
}: {
  today: string;
  tasks: StudyPlanTask[];
  selected: string;
  onSelect: (date: string) => void;
}) {
  const c = useColors();
  const [month, setMonth] = useState(() =>
    monthAt(new Date(`${selected}T12:00:00`), 0),
  );
  const [width, setWidth] = useState(0);
  const pager = useRef<ScrollView>(null);
  useEffect(() => {
    pager.current?.scrollTo({ x: width, animated: false });
  }, [month, width]);
  const taskDates = new Set(tasks.map((task) => task.scheduledDate));
  return (
    <Group>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={withHaptic(() => setMonth(monthAt(month, -1)))}
          style={{ padding: 10 }}
        >
          <Text style={{ color: c.accent, fontSize: 28 }}>‹</Text>
        </Pressable>
        <Copy>
          {month.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </Copy>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={withHaptic(() => setMonth(monthAt(month, 1)))}
          style={{ padding: 10 }}
        >
          <Text style={{ color: c.accent, fontSize: 28 }}>›</Text>
        </Pressable>
      </View>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onMomentumScrollEnd={(event) => {
          if (!width) return;
          const page = Math.round(event.nativeEvent.contentOffset.x / width);
          if (page !== 1) setMonth(monthAt(month, page - 1));
        }}
      >
        {[-1, 0, 1].map((offset) => {
          const visibleMonth = monthAt(month, offset);
          const firstWeekday = visibleMonth.getDay();
          const days = new Date(
            visibleMonth.getFullYear(),
            visibleMonth.getMonth() + 1,
            0,
          ).getDate();
          return (
            <View
              key={offset}
              style={{ width, gap: 6 }}
              accessibilityElementsHidden={offset !== 0}
              importantForAccessibility={
                offset !== 0 ? "no-hide-descendants" : "auto"
              }
            >
              <View style={{ flexDirection: "row" }}>
                {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                  <Text
                    key={i}
                    style={{
                      width: "14.2857%",
                      textAlign: "center",
                      color: c.secondary,
                      fontSize: 12,
                    }}
                  >
                    {day}
                  </Text>
                ))}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {Array.from({ length: 42 }, (_, index) => {
                  const day = index - firstWeekday + 1;
                  if (day < 1 || day > days)
                    return (
                      <View
                        key={index}
                        style={{ width: "14.2857%", height: 46 }}
                      />
                    );
                  const date = dateKey(
                    new Date(
                      visibleMonth.getFullYear(),
                      visibleMonth.getMonth(),
                      day,
                      12,
                    ),
                  );
                  const active = selected === date;
                  return (
                    <Pressable
                      key={index}
                      accessibilityRole="button"
                      accessibilityLabel={`${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${taskDates.has(date) ? ", study activities" : ""}`}
                      accessibilityState={{ selected: active }}
                      onPress={withHaptic(() => onSelect(date))}
                      style={{
                        width: "14.2857%",
                        height: 46,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 3,
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: active ? c.accent : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: date === today && !active ? 1 : 0,
                          borderColor: c.accent,
                        }}
                      >
                        <Text
                          style={{
                            color: active ? c.card : c.text,
                            fontVariant: ["tabular-nums"],
                            fontWeight:
                              active || date === today ? "700" : "400",
                          }}
                        >
                          {day}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: taskDates.has(date)
                            ? c.accent
                            : "transparent",
                        }}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        onPress={withHaptic(() => {
          onSelect(today);
          setMonth(monthAt(new Date(`${today}T12:00:00`), 0));
        })}
        style={{ alignSelf: "center", padding: 8 }}
      >
        <Text style={{ color: c.accent, fontWeight: "600" }}>Today</Text>
      </Pressable>
    </Group>
  );
}
