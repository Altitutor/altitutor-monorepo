import { useRef, useState } from "react";
import {
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Copy, Group, useColors } from "@/components/ui";
import { PageDots } from "@/components/page-dots";
import { RichContent } from "@/components/rich-content";
import { CalcKeySequence } from "@/features/skill-trainer/components/calculator";
import { reviewAnswerLabels } from "@/features/skill-trainer/lib/review-answers";

export type TrainerReviewItem = {
  id: string;
  content: Record<string, unknown>;
  answer: unknown;
  correct: boolean;
  score_delta: number;
  elapsed_seconds: number | null;
};
export type TrainerReviewData = { items: TrainerReviewItem[] };

function Mark({ correct }: { correct: boolean }) {
  const c = useColors();
  const color = correct ? c.good : c.danger;
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={
        process.env.EXPO_OS === "ios"
          ? correct
            ? "sf:checkmark.circle.fill"
            : "sf:xmark.circle.fill"
          : {
              uri: `data:image/svg+xml;utf8,${encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${color}"/><path d="${correct ? "m6 12 4 4 8-8" : "m8 8 8 8M16 8l-8 8"}" fill="none" stroke="#171717" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
              )}`,
            }
      }
      tintColor={process.env.EXPO_OS === "ios" ? color : undefined}
      style={{ width: 22, height: 22 }}
    />
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View
      style={{
        borderRadius: 18,
        borderCurve: "continuous",
        backgroundColor: c.background,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexShrink: 1,
      }}
    >
      <Text>
        <Text style={{ color: c.secondary, fontSize: 15 }}>{label} </Text>
        <Text
          selectable
          style={{ color: c.text, fontSize: 15, fontWeight: "600" }}
        >
          {value}
        </Text>
      </Text>
    </View>
  );
}

function ReviewCard({
  item,
  index,
  trainerKey,
}: {
  item: TrainerReviewItem;
  index: number;
  trainerKey: string;
}) {
  const c = useColors();
  const content = item.content;
  const word = trainerKey === "find_word";
  const concept = trainerKey === "find_concept";
  const answers = reviewAnswerLabels(trainerKey, item);
  return (
    <Group>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Mark correct={item.correct} />
        <Text
          accessibilityRole="header"
          style={{ color: c.text, fontSize: 17, fontWeight: "600" }}
        >
          Question {index + 1}
        </Text>
      </View>
      {Array.isArray(content.premises) &&
        content.premises.map((premise, i) => (
          <Copy key={i}>{String(premise)}</Copy>
        ))}
      {content.conclusion || content.statement ? (
        <Copy>{String(content.conclusion ?? content.statement)}</Copy>
      ) : null}
      {concept && (
        <Copy>Find every occurrence of “{String(content.concept ?? "")}”.</Copy>
      )}
      <RichContent
        json={word || concept ? content.passage : content.question}
        text={
          typeof content.expression === "string"
            ? content.expression
            : undefined
        }
      />
      {trainerKey === "numpad_speed" && (
        <Copy>
          {typeof content.label === "string"
            ? content.label
            : "Reproduce the target key sequence"}
        </Copy>
      )}
      {trainerKey === "numpad_speed" ? (
        <>
          <Copy muted>Your sequence</Copy>
          {Array.isArray(item.answer) && item.answer.length ? (
            <CalcKeySequence
              labels={item.answer.filter(
                (value): value is string => typeof value === "string",
              )}
            />
          ) : (
            <Copy muted>Not recorded</Copy>
          )}
          <Copy muted>Correct</Copy>
          <CalcKeySequence
            labels={
              Array.isArray(content.button_sequence)
                ? content.button_sequence.map(String)
                : []
            }
          />
        </>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pill label="Your answer" value={answers.yours} />
          <Pill label="Correct" value={answers.correct} />
        </View>
      )}
      <Copy muted>
        {item.score_delta} points
        {item.elapsed_seconds !== null
          ? ` · ${Math.round(item.elapsed_seconds)}s`
          : ""}
      </Copy>
    </Group>
  );
}

function ReviewPager({
  items,
  trainerKey,
}: {
  items: TrainerReviewItem[];
  trainerKey: string;
}) {
  const { width } = useWindowDimensions();
  const pager = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const insets = useSafeAreaInsets();
  function goTo(next: number) {
    if (next === indexRef.current) return;
    indexRef.current = next;
    setIndex(next);
    pager.current?.scrollTo({ x: next * width, animated: false });
  }
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        directionalLockEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={(event) => {
          const next = Math.round(
            event.nativeEvent.contentOffset.x / Math.max(width, 1),
          );
          if (next === indexRef.current) return;
          indexRef.current = next;
          setIndex(next);
        }}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {items.map((item, i) => (
          <ScrollView
            key={item.id}
            style={{ width }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 12,
              gap: 16,
            }}
          >
            <ReviewCard item={item} index={i} trainerKey={trainerKey} />
          </ScrollView>
        ))}
      </ScrollView>
      <View
        style={{
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 12),
          alignItems: "center",
        }}
      >
        <PageDots count={items.length} index={index} onIndex={goTo} />
      </View>
    </View>
  );
}

export function TrainerReview({
  items,
  trainerKey,
}: {
  items: TrainerReviewItem[];
  trainerKey: string;
}) {
  if (!items.length)
    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <Group title="Question review">
          <Copy muted>No questions were completed in this session.</Copy>
        </Group>
      </View>
    );
  return <ReviewPager items={items} trainerKey={trainerKey} />;
}
