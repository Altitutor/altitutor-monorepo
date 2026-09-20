import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  applyPlacementTransition,
  getAnswerSchemePresentation,
  type ResponseSnapshotV1,
} from "@altitutor/ucat-response-contract";
import { Group, useColors, Copy } from "@/components/ui";
import { RichContent } from "@/components/rich-content";
import type { QuestionItem } from "@/features/question-engine/model/types";
import {
  snapshotQuestionResponse,
  restoreQuestionResponse,
  evaluatePersistedQuestionResponse,
} from "@/features/question-engine/lib/response-state";
export function Question({
  question: q,
  answer,
  onAnswer,
  review = false,
}: {
  question: QuestionItem;
  answer?: ResponseSnapshotV1;
  onAnswer: (snapshot: ResponseSnapshotV1) => void;
  review?: boolean;
}) {
  const c = useColors();
  const [collapsedStem, setCollapsedStem] = useState<string | null>(null);
  const collapsed = collapsedStem === q.id;
  const restored = restoreQuestionResponse(q, answer);
  const presentation = getAnswerSchemePresentation(
    q.answerScheme,
    q.options.map((o) => o.id),
  );
  const evaluation = review
    ? evaluatePersistedQuestionResponse(q, answer)
    : null;
  return (
    <>
      <Group>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            collapsed ? "Expand question stem" : "Collapse question stem"
          }
          accessibilityState={{ expanded: !collapsed }}
          onPress={() => setCollapsedStem(collapsed ? null : q.id)}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            minHeight: 32,
            alignItems: "center",
          }}
        >
          <Text style={{ color: c.text, fontWeight: "600", fontSize: 17 }}>
            Question stem
          </Text>
          <Text style={{ color: c.accent }}>{collapsed ? "⌄" : "⌃"}</Text>
        </Pressable>
        {!collapsed && <RichContent json={q.stemJson} text={q.stemText} />}
      </Group>
      <Group title="Question">
        <RichContent json={q.questionJson} text={q.questionText} />
      </Group>
      <Group title="Your answer">
        {q.options.map((option) => (
          <View key={option.id} style={{ gap: 10 }}>
            <Pressable
              disabled={review || presentation.kind === "placement"}
              accessibilityRole="radio"
              accessibilityState={{
                checked: restored.selectedOptionId === option.id,
                disabled: review,
              }}
              onPress={() => onAnswer(snapshotQuestionResponse(q, option.id))}
              style={{
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor:
                  restored.selectedOptionId === option.id ? c.accent : c.border,
                backgroundColor:
                  restored.selectedOptionId === option.id ? c.tint : c.card,
              }}
            >
              <RichContent json={option.textJson} text={option.text} />
            </Pressable>
            {presentation.kind === "placement" && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {presentation.tokens.map((token) => (
                  <Pressable
                    key={token.value}
                    disabled={review}
                    accessibilityRole="radio"
                    accessibilityLabel={`${option.text}: ${token.label}`}
                    accessibilityState={{
                      checked:
                        restored.placementSnapshot?.[option.id] === token.value,
                      disabled: review,
                    }}
                    onPress={() =>
                      onAnswer(
                        snapshotQuestionResponse(q, undefined, {
                          ...applyPlacementTransition({
                            presentation,
                            placements: restored.placementSnapshot ?? {},
                            targetId: option.id,
                            token: token.value,
                          }),
                        }),
                      )
                    }
                    style={{
                      padding: 12,
                      minHeight: 44,
                      borderRadius: 10,
                      backgroundColor:
                        restored.placementSnapshot?.[option.id] === token.value
                          ? c.accent
                          : c.tint,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          restored.placementSnapshot?.[option.id] ===
                          token.value
                            ? c.background
                            : c.accent,
                      }}
                    >
                      {token.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {review && option.answerKeyValue && (
              <Copy muted>
                {option.answerKeyValue === "correct"
                  ? "Correct answer"
                  : `Answer: ${option.answerKeyValue}`}
              </Copy>
            )}
            {review && option.answerExplanation && (
              <RichContent
                json={option.answerExplanationJson}
                text={option.answerExplanation}
              />
            )}
          </View>
        ))}
      </Group>
      {evaluation && (
        <Group title="Explanation">
          <Copy large>
            {evaluation.score.awarded} / {evaluation.score.maximum} points
          </Copy>
          <RichContent
            json={q.answerExplanationJson}
            text={
              q.answerExplanation ??
              "No explanation is available for this question."
            }
          />
        </Group>
      )}
    </>
  );
}
