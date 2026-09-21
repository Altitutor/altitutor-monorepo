import { Image } from "expo-image";
import { Text, View } from "react-native";
import { Copy, Group, useColors } from "@/components/ui";
import type { SectionProgressResponse } from "./section-types";
import type { PropsWithChildren } from "react";

function ProgressRing({ value }: { value: number }) {
  const c = useColors();
  const percent = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 21;
  return (
    <View
      accessibilityLabel={`${Math.round(percent)}%`}
      style={{ width: 52, height: 52 }}
    >
      <Image
        style={{ width: 52, height: 52 }}
        source={{
          uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52"><circle cx="26" cy="26" r="21" fill="none" stroke="${c.border}" stroke-width="4"/><circle cx="26" cy="26" r="21" fill="none" stroke="${c.accent}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - percent / 100)}" transform="rotate(-90 26 26)"/></svg>`)}`,
        }}
      />
      <View
        style={{
          position: "absolute",
          inset: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{ color: c.text, fontSize: 10, fontVariant: ["tabular-nums"] }}
        >
          {Math.round(percent)}%
        </Text>
      </View>
    </View>
  );
}
function StatCard({
  title,
  numerator,
  denominator,
  breakdown,
  children,
}: PropsWithChildren<{
  title: string;
  numerator: number;
  denominator?: number;
  breakdown: string;
}>) {
  const c = useColors();
  return (
    <Group>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Copy muted>{title}</Copy>
          <Text
            selectable
            style={{
              color: c.text,
              fontSize: 25,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
            }}
          >
            {numerator}
            {denominator == null ? "" : ` / ${denominator}`}
          </Text>
        </View>
        <ProgressRing
          value={
            denominator
              ? (numerator / denominator) * 100
              : numerator > 0
                ? 100
                : 0
          }
        />
      </View>
      <View
        style={{
          borderTopWidth: 1,
          borderColor: c.border,
          paddingTop: 12,
          gap: 10,
        }}
      >
        <Copy muted>{breakdown}</Copy>
        {children}
      </View>
    </Group>
  );
}
function BreakdownRow({
  title,
  value,
  badge,
}: {
  title: string;
  value: string;
  badge?: "Best" | "Worst";
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View
        style={{ flex: 1, gap: 6, flexDirection: "row", alignItems: "center" }}
      >
        {badge && (
          <Text
            style={{
              color: badge === "Best" ? c.good : c.danger,
              backgroundColor: c.tint,
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 9,
              overflow: "hidden",
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            {badge}
          </Text>
        )}
        <Text
          selectable
          style={{ color: c.secondary, fontSize: 14, lineHeight: 20, flex: 1 }}
        >
          {title}
        </Text>
      </View>
      <Text
        selectable
        style={{ color: c.text, fontSize: 14, fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </View>
  );
}
export function SectionStats({ data }: { data: SectionProgressResponse }) {
  const { section, categoryProgress: categories } = data;
  const attempted = categories
    .filter((c) => c.maxScore > 0)
    .sort((a, b) => b.percentage - a.percentage);
  const best = attempted[0];
  const worst = attempted.length > 1 ? attempted.at(-1) : undefined;
  return (
    <>
      <StatCard
        title="Questions correct"
        numerator={section.correctScore}
        denominator={section.maxScore}
        breakdown="Category breakdown"
      >
        {categories.map((c) => (
          <BreakdownRow
            key={c.categoryId}
            title={c.categoryName}
            value={c.maxScore ? `${c.correctScore} / ${c.maxScore}` : "—"}
            badge={c === best ? "Best" : c === worst ? "Worst" : undefined}
          />
        ))}
        {!categories.length && (
          <Copy muted>Complete questions to see your category breakdown.</Copy>
        )}
      </StatCard>
      <StatCard
        title="Total questions completed"
        numerator={section.maxScore}
        denominator={section.totalPublicQuestions}
        breakdown="Category breakdown"
      >
        {categories.map((c) => (
          <BreakdownRow
            key={c.categoryId}
            title={c.categoryName}
            value={
              c.totalPublicQuestions == null
                ? `${c.maxScore}`
                : `${c.maxScore} / ${c.totalPublicQuestions}`
            }
          />
        ))}
        {!categories.length && <Copy muted>No categories yet.</Copy>}
      </StatCard>
      <StatCard
        title="Total sets completed"
        numerator={data.setsCompleted}
        denominator={data.totalPublicSets}
        breakdown="Breakdown"
      >
        <BreakdownRow
          title="Untimed sets completed"
          value={`${data.untimedSetsCompleted} / ${data.totalPublicUntimedSets}`}
        />
        <BreakdownRow
          title="Timed sets completed"
          value={`${data.timedSetsCompleted} / ${data.totalPublicTimedSets}`}
        />
      </StatCard>
    </>
  );
}
