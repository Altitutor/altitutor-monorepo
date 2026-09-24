import { useReducedMotion } from "react-native-reanimated";
import { useState } from "react";
import { Pressable, Text, View, LayoutAnimation } from "react-native";
import {
  applyPlacementTransition,
  getAnswerSchemePresentation,
  type ResponseSnapshotV1,
} from "@altitutor/ucat-response-contract";
import { Group, useColors, Copy } from "@/components/ui";
import { withHaptic } from "@/lib/haptics";
import {
  answerOptionReview,
  hasReviewedAnswer,
} from "@/features/question-engine/lib/answer-review";
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
  const reducedMotion = useReducedMotion();
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
          onPress={withHaptic(() => {
            if (!reducedMotion)
              LayoutAnimation.configureNext(
                LayoutAnimation.Presets.easeInEaseOut,
              );
            setCollapsedStem(collapsed ? null : q.id);
          })}
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
      <Group title={review ? "Answers" : "Your answer"}>
        {evaluation && !evaluation.complete && (
          <Text
            selectable
            style={{ color: c.secondary, fontWeight: "600", fontSize: 16 }}
          >
            {hasReviewedAnswer(evaluation.review)
              ? "Partially answered"
              : "Not answered"}
          </Text>
        )}
        {q.options.map((option) => {
          const result = evaluation
            ? answerOptionReview(evaluation.review, option.id)
            : null;
          const tone = result?.tone;
          const selected = restored.selectedOptionId === option.id;
          const border =
            tone === "correct"
              ? c.good
              : tone === "incorrect"
                ? c.danger
                : selected && !review
                  ? c.accent
                  : c.border;
          const background =
            tone === "correct"
              ? `${c.good}16`
              : tone === "incorrect"
                ? `${c.danger}16`
                : selected && !review
                  ? c.tint
                  : c.card;
          return (
            <View key={option.id} style={{ gap: 10 }}>
              <View
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: border,
                  backgroundColor: background,
                  overflow: "hidden",
                }}
              >
                <Pressable
                  disabled={review || presentation.kind === "placement"}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: restored.selectedOptionId === option.id,
                    disabled: review,
                  }}
                  onPress={withHaptic(() =>
                    onAnswer(snapshotQuestionResponse(q, option.id)),
                  )}
                  style={{ padding: 14, gap: 10 }}
                >
                  <RichContent json={option.textJson} text={option.text} />
                  {result && result.badges.length > 0 && (
                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                    >
                      {result.badges.map((badge) => {
                        const color =
                          badge.tone === "correct"
                            ? c.good
                            : badge.tone === "incorrect"
                              ? c.danger
                              : c.secondary;
                        return (
                          <Text
                            key={badge.label}
                            selectable
                            style={{
                              color,
                              backgroundColor: `${color}18`,
                              borderRadius: 8,
                              paddingHorizontal: 8,
                              paddingVertical: 5,
                              fontSize: 13,
                              fontWeight: "600",
                            }}
                          >
                            {badge.label}
                          </Text>
                        );
                      })}
                    </View>
                  )}
                </Pressable>
                {presentation.kind === "placement" && !review && (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 10,
                      paddingHorizontal: 14,
                      paddingBottom: 14,
                    }}
                  >
                    {presentation.tokens.map((token) => (
                      <Pressable
                        key={token.value}
                        disabled={review}
                        accessibilityRole="radio"
                        accessibilityLabel={`${option.text}: ${token.label}`}
                        accessibilityState={{
                          checked:
                            restored.placementSnapshot?.[option.id] ===
                            token.value,
                          disabled: review,
                        }}
                        onPress={withHaptic(() =>
                          onAnswer(
                            snapshotQuestionResponse(q, undefined, {
                              ...applyPlacementTransition({
                                presentation,
                                placements: restored.placementSnapshot ?? {},
                                targetId: option.id,
                                token: token.value,
                              }),
                            }),
                          ),
                        )}
                        style={{
                          padding: 12,
                          minHeight: 44,
                          borderRadius: 10,
                          backgroundColor:
                            restored.placementSnapshot?.[option.id] ===
                            token.value
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
              </View>
              {review && option.answerExplanation && (
                <RichContent
                  json={option.answerExplanationJson}
                  text={option.answerExplanation}
                />
              )}
            </View>
          );
        })}
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
