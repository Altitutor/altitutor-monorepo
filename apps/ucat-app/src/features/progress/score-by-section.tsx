import { useMockSeries, weightedMockScore } from "./mock-progress";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { SectionProgress } from "@altitutor/shared";
import { Group, useColors } from "@/components/ui";
import type { SectionScoreProjection } from "./projection-types";
export function ScoreBySection({
  sections,
  projections,
  targets,
}: {
  sections: SectionProgress[];
  projections: SectionScoreProjection[];
  targets?: Record<string, number>;
}) {
  const c = useColors();
  const mocks = useMockSeries();
  const mockScore = weightedMockScore(mocks.data?.points ?? []);
  const router = useRouter();
  const position = (score: number) =>
    Math.max(0, Math.min(100, ((score - 300) / 600) * 100));
  return (
    <Group title="Score by section" dividers>
      {sections.map((section) => {
        const score = projections.find(
          (p) => p.sectionId === section.sectionId,
        )?.currentEstimate;
        const target = targets?.[section.sectionId];
        return (
          <Pressable
            key={section.sectionId}
            accessibilityRole="button"
            accessibilityLabel={`View ${section.sectionName} progress`}
            onPress={() =>
              router.push({
                pathname: "/section-progress/[number]",
                params: { number: section.sectionNumber },
              })
            }
            style={{ gap: 10, paddingVertical: 8 }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Text
                style={{
                  color: c.text,
                  fontSize: 16,
                  fontWeight: "600",
                  flex: 1,
                }}
              >
                {section.sectionName}
              </Text>
              <Text style={{ color: c.secondary, fontSize: 20 }}>›</Text>
            </View>
            <View
              style={{ height: 8, borderRadius: 4, backgroundColor: c.border }}
            >
              {score != null && (
                <View
                  style={{
                    width: `${position(score)}%`,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: c.accent,
                  }}
                />
              )}
              {target != null && (
                <View
                  style={{
                    position: "absolute",
                    left: `${position(target)}%`,
                    width: 2,
                    height: 16,
                    top: -4,
                    backgroundColor: c.good,
                  }}
                />
              )}
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text style={{ color: c.secondary, fontSize: 13 }}>
                {score == null
                  ? "Estimate pending"
                  : `Estimate ${Math.round(score)}`}
              </Text>
              <Text style={{ color: c.secondary, fontSize: 13 }}>
                {target == null ? "300–900" : `Target ${target}`}
              </Text>
            </View>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View mock progress"
        onPress={() => router.push("/mock-progress")}
        style={{ gap: 8, paddingVertical: 8 }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
            Mocks
          </Text>
          <Text style={{ color: c.secondary, fontSize: 20 }}>›</Text>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: c.border }}>
          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: c.accent,
              width: `${mockScore == null ? 0 : Math.max(0, Math.min(100, ((mockScore - 900) / 1800) * 100))}%`,
            }}
          />
        </View>
        <Text style={{ color: c.secondary, fontSize: 13 }}>
          {mockScore == null
            ? "Weighted average pending"
            : `Weighted average ${mockScore}`}
        </Text>
      </Pressable>
    </Group>
  );
}
