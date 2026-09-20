import { useRef, useState } from "react";
import { displayChartDate, indexNearestToday } from "./chart-dates";
import { ScrollView, Text, View } from "react-native";
import { Copy, Group, useColors } from "@/components/ui";
type Point = { date: string; value: number; forecast?: boolean };
export function ScoreChart({
  points,
  estimate,
  title = "Score progress",
  target,
}: {
  points: Point[];
  estimate: number | null;
  title?: string;
  target?: number | null;
}) {
  const c = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const viewport = useRef(0);
  const contentWidth = useRef(0);
  const initialized = useRef(false);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const values = [
    ...new Map(
      points
        .filter((p) => Number.isFinite(p.value))
        .map((point) => [point.date, point]),
    ).values(),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const min =
    Math.floor(
      (Math.min(...values.map((p) => p.value), target ?? Infinity) - 30) / 50,
    ) * 50;
  const max =
    Math.ceil(
      (Math.max(...values.map((p) => p.value), target ?? -Infinity) + 30) / 50,
    ) * 50;
  const y = (value: number) =>
    170 - ((value - min) / Math.max(1, max - min)) * 140;
  const width = Math.max(280, (values.length - 1) * 66 + 60);
  const step = (width - 60) / Math.max(1, values.length - 1);
  function showToday() {
    if (initialized.current || !viewport.current || !contentWidth.current)
      return;
    scrollRef.current?.scrollTo({
      x: Math.max(
        0,
        30 +
          indexNearestToday(
            values.map((p) => p.date),
            today,
          ) *
            step -
          viewport.current * 0.65,
      ),
      animated: false,
    });
    initialized.current = true;
  }
  return (
    <Group title={title}>
      <Copy large>
        {estimate == null
          ? "Building your estimate"
          : Math.round(estimate).toLocaleString()}
      </Copy>
      <Copy muted>
        {target ? `Target ${target} · ` : ""}Based on your timed practice
      </Copy>
      {values.length ? (
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: 42, height: 230 }}>
            {[min, (min + max) / 2, max].map((value) => (
              <Text
                key={value}
                style={{
                  position: "absolute",
                  top: y(value) - 7,
                  color: c.secondary,
                  fontSize: 10,
                }}
              >
                {Math.round(value)}
              </Text>
            ))}
          </View>
          <ScrollView
            ref={scrollRef}
            onLayout={(e) => {
              viewport.current = e.nativeEvent.layout.width;
              showToday();
            }}
            onContentSizeChange={(width) => {
              contentWidth.current = width;
              showToday();
            }}
            horizontal
            contentInsetAdjustmentBehavior="automatic"
            showsHorizontalScrollIndicator
          >
            <View style={{ width, height: 230 }}>
              {[min, (min + max) / 2, max].map((value) => (
                <View
                  key={value}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: y(value),
                    width,
                    borderTopWidth: 1,
                    borderColor: c.border,
                  }}
                ></View>
              ))}
              {target != null && (
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    top: y(target),
                    width,
                    borderTopWidth: 1,
                    borderStyle: "dashed",
                    borderColor: c.good,
                  }}
                />
              )}
              {values.map((point, index) => {
                const x = 30 + index * step;
                const next = values[index + 1];
                const dy = next ? y(next.value) - y(point.value) : 0;
                const length = Math.hypot(step, dy);
                return (
                  <View key={`${point.date}-${index}`}>
                    {next && (
                      <View
                        style={{
                          position: "absolute",
                          left: x + (step - length) / 2,
                          top: y(point.value) + dy / 2,
                          width: length,
                          height: 2,
                          backgroundColor: next.forecast
                            ? c.secondary
                            : c.accent,
                          opacity: next.forecast ? 0.5 : 1,
                          transform: [{ rotate: `${Math.atan2(dy, step)}rad` }],
                        }}
                      />
                    )}
                    <View
                      accessible
                      accessibilityLabel={`${point.forecast ? "Projected" : "Estimated"} score ${Math.round(point.value)} on ${point.date}`}
                      style={{
                        position: "absolute",
                        left: x - 4,
                        top: y(point.value) - 4,
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: point.forecast
                          ? c.secondary
                          : c.accent,
                      }}
                    />
                    <Text
                      style={{
                        position: "absolute",
                        left: x - 27,
                        top: 192,
                        width: 58,
                        textAlign: "center",
                        color: c.secondary,
                        fontSize: 10,
                      }}
                    >
                      {displayChartDate(point.date)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ) : (
        <Copy muted>
          Complete timed practice in each section to see your score history.
        </Copy>
      )}
      <Copy muted>Recent estimates · grey line shows projection</Copy>
    </Group>
  );
}
