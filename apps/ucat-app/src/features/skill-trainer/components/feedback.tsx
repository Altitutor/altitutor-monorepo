import { useEffect, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useColors } from "@/components/ui";

export type TrainerFeedbackValue = {
  id: number;
  correct: boolean;
  scoreDelta: number;
};
export function TrainerFeedback({
  feedback,
}: {
  feedback: TrainerFeedbackValue | null;
}) {
  const c = useColors();
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(0));
  const feedbackId = feedback?.id;
  useEffect(() => {
    if (feedbackId == null) {
      opacity.setValue(0);
      return;
    }
    opacity.setValue(1);
    scale.setValue(reducedMotion ? 1 : 0.8);
    const animation = Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(opacity, {
          toValue: 0,
          duration: reducedMotion ? 0 : 220,
          useNativeDriver: true,
        }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [feedbackId, opacity, reducedMotion, scale]);
  return (
    <View
      pointerEvents="none"
      style={{ minHeight: 35, alignItems: "center", justifyContent: "center" }}
    >
      {feedback ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          style={{
            opacity,
            transform: [{ scale }],
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 6,
            backgroundColor: feedback.correct ? c.good : c.danger,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text style={{ color: c.card, fontWeight: "700" }}>
            {feedback.correct ? "✓ Correct!" : "✕ Not quite"}
          </Text>
          {feedback.scoreDelta !== 0 ? (
            <Text
              style={{
                color: c.card,
                fontWeight: "800",
                fontVariant: ["tabular-nums"],
              }}
            >
              {feedback.scoreDelta > 0 ? "+" : ""}
              {feedback.scoreDelta}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

export function TrainerScoreBar({
  score,
  remaining,
  streak,
  streakEnabled = true,
  feedback,
}: {
  score: number;
  remaining: number;
  streak: number;
  streakEnabled?: boolean;
  feedback: TrainerFeedbackValue | null;
}) {
  const c = useColors();
  const reducedMotion = useReducedMotion();
  const [bounce] = useState(() => new Animated.Value(1));
  useEffect(() => {
    bounce.setValue(1);
    if (reducedMotion || streak < 2) return;
    const animation = Animated.sequence([
      Animated.timing(bounce, {
        toValue: streak >= 10 ? 1.18 : 1.1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(bounce, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [bounce, reducedMotion, streak]);
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 5 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <View
          accessibilityLabel={`${Math.max(0, Math.ceil(remaining))} seconds remaining`}
          style={{
            borderRadius: 18,
            backgroundColor: c.card,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text
            style={{
              color: remaining <= 10 ? c.danger : c.text,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
            }}
          >
            {Math.max(0, Math.ceil(remaining))}s
          </Text>
        </View>
        <View
          style={{
            borderRadius: 18,
            backgroundColor: c.card,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text
            style={{
              color: c.text,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
            }}
          >
            Score {score}
          </Text>
        </View>
        {streakEnabled && streak >= 2 ? (
          <Animated.View
            style={{
              transform: [{ scale: bounce }],
              borderRadius: 18,
              backgroundColor: streak >= 10 ? "#FBBF24" : c.tint,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text
              accessibilityLabel={`${streak} correct in a row`}
              style={{
                color: streak >= 10 ? "#451A03" : c.text,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              🔥 {streak}
            </Text>
          </Animated.View>
        ) : (
          <View />
        )}
      </View>
      <TrainerFeedback feedback={feedback} />
    </View>
  );
}
