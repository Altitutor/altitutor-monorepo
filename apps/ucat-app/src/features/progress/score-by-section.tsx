import { useRef, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import Animated, { ZoomIn, useReducedMotion } from "react-native-reanimated";
import type { SectionProgress } from "@altitutor/shared";
import { NativeButton } from "@/components/native-button";
import { Group, buttonText, useColors } from "@/components/ui";
import { useAppTheme } from "@/features/settings/theme";
import { haptic } from "@/lib/haptics";
import { useMockSeries, weightedMockScore } from "./mock-progress";
import type { SectionScoreProjection } from "./projection-types";
import {
  gapDetail,
  hitRect,
  scalePercent,
  scorePillsOverlap,
} from "./score-scale";

type ScaleTooltip = {
  id: string;
  title: string;
  body: string;
  detail: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
};

function ScaleTooltipCard({ tooltip }: { tooltip: ScaleTooltip }) {
  const c = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const [size, setSize] = useState({ width: 220, height: 88 });
  const left = Math.min(
    Math.max(8, tooltip.x + tooltip.width / 2 - size.width / 2),
    screenWidth - size.width - 8,
  );
  const gap = 12;
  const above = tooltip.y - size.height - gap >= 8;
  const top = above
    ? tooltip.y - size.height - gap
    : tooltip.y + tooltip.height + gap;
  const caretLeft = Math.min(
    Math.max(12, tooltip.x + tooltip.width / 2 - left - 6),
    size.width - 24,
  );
  return (
    <View
      pointerEvents="none"
      accessibilityViewIsModal
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        if (next.width !== size.width || next.height !== size.height)
          setSize({ width: next.width, height: next.height });
      }}
      style={{
        position: "absolute",
        left,
        top,
        minWidth: 196,
        maxWidth: 260,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 4,
        backgroundColor: c.card,
        borderRadius: 12,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: c.border,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.16)",
      }}
    >
      <Text
        selectable
        style={{ color: c.text, fontSize: 15, fontWeight: "600" }}
      >
        {tooltip.title}
      </Text>
      <Text selectable style={{ color: c.secondary, fontSize: 13 }}>
        {tooltip.body}
      </Text>
      {tooltip.detail ? (
        <Text
          selectable
          style={{
            color: c.text,
            fontSize: 13,
            fontWeight: "600",
            fontVariant: ["tabular-nums"],
          }}
        >
          {tooltip.detail}
        </Text>
      ) : null}
      <View
        accessible={false}
        style={{
          position: "absolute",
          left: caretLeft,
          ...(above ? { bottom: -6 } : { top: -6 }),
          width: 12,
          height: 12,
          backgroundColor: c.card,
          borderRightWidth: above ? 1 : 0,
          borderBottomWidth: above ? 1 : 0,
          borderLeftWidth: above ? 0 : 1,
          borderTopWidth: above ? 0 : 1,
          borderColor: c.border,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

function ScalePill({
  id,
  value,
  leftPercent,
  tone,
  overlap,
  accessibilityLabel,
  tooltipTitle,
  tooltipBody,
  tooltipDetail,
  onOpen,
  onRegister,
}: {
  id: string;
  value: number;
  leftPercent: number;
  tone: "estimate" | "target";
  overlap: "none" | "above" | "below";
  accessibilityLabel: string;
  tooltipTitle: string;
  tooltipBody: string;
  tooltipDetail: string | null;
  onOpen: (tooltip: ScaleTooltip) => void;
  onRegister: (tooltip: ScaleTooltip) => void;
}) {
  const c = useColors();
  const { scheme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const ref = useRef<View>(null);
  const [pillWidth, setPillWidth] = useState(32);
  const estimate = tone === "estimate";
  const backgroundColor = estimate
    ? c.accent
    : scheme === "dark"
      ? "#FCD34D"
      : "#FBBF24";
  const color = estimate ? buttonText(c.accent) : "#451A03";
  const left = Math.max(3, Math.min(97, leftPercent));

  const measure = (open: boolean) => {
    ref.current?.measureInWindow((x, y, width, height) => {
      const tooltip = {
        id,
        title: tooltipTitle,
        body: tooltipBody,
        detail: tooltipDetail,
        x,
        y,
        width,
        height,
      };
      onRegister(tooltip);
      if (open) onOpen(tooltip);
    });
  };

  return (
    <View
      ref={ref}
      collapsable={false}
      pointerEvents="box-none"
      onLayout={() => measure(false)}
      style={{
        position: "absolute",
        left: `${left}%`,
        marginLeft: -pillWidth / 2,
        zIndex: 2,
        ...(overlap === "above"
          ? { top: 0 }
          : overlap === "below"
            ? { bottom: 0 }
            : { top: "50%", marginTop: -11 }),
      }}
    >
      <Animated.View
        entering={
          reduceMotion
            ? undefined
            : ZoomIn.springify().damping(16).stiffness(320)
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Shows score details"
          onPress={() => {
            haptic();
            measure(true);
          }}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            if (width !== pillWidth) setPillWidth(width);
          }}
          style={{
            minWidth: 32,
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor,
            borderWidth: 1,
            borderColor: estimate ? `${c.accent}55` : "rgba(69, 26, 3, 0.12)",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.16)",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color,
              fontSize: 10,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
            }}
          >
            {Math.round(value)}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function ScoreScale({
  id,
  score,
  target,
  scoreLabel,
  minimum = 300,
  maximum = 900,
  estimateTooltip,
  targetTooltip,
  onOpen,
  onRegister,
}: {
  id: string;
  score: number | null;
  target: number | null;
  scoreLabel: string;
  minimum?: number;
  maximum?: number;
  estimateTooltip: { title: string; body: string };
  targetTooltip: { title: string; body: string };
  onOpen: (tooltip: ScaleTooltip) => void;
  onRegister: (tooltip: ScaleTooltip) => void;
}) {
  const c = useColors();
  const scorePosition =
    score == null ? null : scalePercent(score, minimum, maximum);
  const targetPosition =
    target == null ? null : scalePercent(target, minimum, maximum);
  const overlap = scorePillsOverlap(scorePosition, targetPosition);
  const detail = score == null ? null : gapDetail(score, target);
  const pendingLabel = `${scoreLabel} pending${target == null ? "" : " · target set"}`;
  const examplePosition =
    targetPosition == null ? 58 : Math.max(18, targetPosition - 22);

  if (score == null)
    return (
      <View
        accessibilityLabel={pendingLabel}
        style={{ height: 32, justifyContent: "center" }}
      >
        <View
          style={{
            height: 4,
            borderRadius: 999,
            backgroundColor: c.border,
            opacity: 0.45,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: `${examplePosition}%`,
            marginLeft: -12,
            top: "50%",
            marginTop: -11,
            minWidth: 24,
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: c.accent,
            opacity: 0.35,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: buttonText(c.accent),
              fontSize: 10,
              fontWeight: "700",
            }}
          >
            —
          </Text>
        </View>
        {target != null && targetPosition != null ? (
          <ScalePill
            id={`${id}-target`}
            value={target}
            leftPercent={targetPosition}
            tone="target"
            overlap="none"
            accessibilityLabel={`Target ${target}. Show details.`}
            tooltipTitle={targetTooltip.title}
            tooltipBody={targetTooltip.body}
            tooltipDetail={null}
            onOpen={onOpen}
            onRegister={onRegister}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <Text
            selectable
            style={{
              color: c.secondary,
              fontSize: 10,
              fontWeight: "600",
              backgroundColor: c.card,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            {pendingLabel}
          </Text>
        </View>
      </View>
    );

  const gapLeft =
    scorePosition != null && targetPosition != null
      ? Math.min(scorePosition, targetPosition)
      : 0;
  const gapWidth =
    scorePosition != null && targetPosition != null
      ? Math.abs(targetPosition - scorePosition)
      : 0;

  return (
    <View
      accessibilityLabel={`${scoreLabel} ${Math.round(score)}${target == null ? "" : `, target ${target}`}`}
      style={{ height: overlap ? 48 : 32, justifyContent: "center" }}
    >
      <View
        style={{
          height: 4,
          borderRadius: 999,
          backgroundColor: c.border,
        }}
      />
      {scorePosition != null && targetPosition != null ? (
        <View
          style={{
            position: "absolute",
            left: `${gapLeft}%`,
            width: `${gapWidth}%`,
            top: "50%",
            marginTop: -2,
            height: 4,
            borderRadius: 999,
            backgroundColor: `${c.accent}59`,
          }}
        />
      ) : null}
      <ScalePill
        id={`${id}-estimate`}
        value={score}
        leftPercent={scorePosition ?? 0}
        tone="estimate"
        overlap={overlap ? "below" : "none"}
        accessibilityLabel={`${scoreLabel} ${Math.round(score)}. Show details.`}
        tooltipTitle={estimateTooltip.title}
        tooltipBody={estimateTooltip.body}
        tooltipDetail={detail}
        onOpen={onOpen}
        onRegister={onRegister}
      />
      {target != null && targetPosition != null ? (
        <ScalePill
          id={`${id}-target`}
          value={target}
          leftPercent={targetPosition}
          tone="target"
          overlap={overlap ? "above" : "none"}
          accessibilityLabel={`Target ${target}. Show details.`}
          tooltipTitle={targetTooltip.title}
          tooltipBody={targetTooltip.body}
          tooltipDetail={detail}
          onOpen={onOpen}
          onRegister={onRegister}
        />
      ) : null}
    </View>
  );
}

function ScoreRow({
  title,
  viewLabel,
  onView,
  children,
}: {
  title: string;
  viewLabel: string;
  onView: () => void;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <Text
          selectable
          style={{ color: c.text, fontSize: 16, fontWeight: "600" }}
        >
          {title}
        </Text>
        {children}
      </View>
      <View style={{ flexShrink: 0 }}>
        <NativeButton
          title="View"
          secondary
          compact
          accessibilityLabel={viewLabel}
          onPress={onView}
        />
      </View>
    </View>
  );
}

export function ScoreBySection({
  sections,
  projections,
  targets,
  mockTarget,
}: {
  sections: SectionProgress[];
  projections: SectionScoreProjection[];
  targets?: Record<string, number>;
  mockTarget?: number | null;
}) {
  const mocks = useMockSeries();
  const mockScore = weightedMockScore(mocks.data?.points ?? []);
  const router = useRouter();
  const [tooltip, setTooltip] = useState<ScaleTooltip | null>(null);
  const pills = useRef(new Map<string, ScaleTooltip>());

  const register = (next: ScaleTooltip) => {
    pills.current.set(next.id, next);
  };

  return (
    <>
      <Group title="Score by section" dividers compact>
        {sections.map((section) => {
          const score =
            projections.find((p) => p.sectionId === section.sectionId)
              ?.currentEstimate ?? null;
          const target =
            section.sectionNumber <= 3
              ? (targets?.[section.sectionId] ?? null)
              : null;
          return (
            <ScoreRow
              key={section.sectionId}
              title={section.sectionName}
              viewLabel={`View ${section.sectionName} progress`}
              onView={() =>
                router.push({
                  pathname: "/section-progress/[number]",
                  params: { number: section.sectionNumber },
                })
              }
            >
              <ScoreScale
                id={section.sectionId}
                score={score}
                target={target}
                scoreLabel="Estimate"
                estimateTooltip={{
                  title:
                    score == null
                      ? "Estimate pending"
                      : `Estimate ${Math.round(score)}`,
                  body: "Your current section estimate from recent timed practice.",
                }}
                targetTooltip={{
                  title: target == null ? "Target" : `Target ${target}`,
                  body: "The section score your study plan is aiming for.",
                }}
                onOpen={setTooltip}
                onRegister={register}
              />
            </ScoreRow>
          );
        })}
        <ScoreRow
          title="Mocks"
          viewLabel="View mock progress"
          onView={() => router.push("/mock-progress")}
        >
          <ScoreScale
            id="mocks"
            score={mockScore}
            target={mockTarget ?? null}
            scoreLabel="Weighted average"
            minimum={900}
            maximum={2700}
            estimateTooltip={{
              title:
                mockScore == null
                  ? "Weighted average pending"
                  : `Weighted average ${Math.round(mockScore)}`,
              body: "A recency-weighted average of your completed mock totals.",
            }}
            targetTooltip={{
              title: mockTarget == null ? "Target" : `Target ${mockTarget}`,
              body: "Your overall UCAT goal used as the mock score target.",
            }}
            onOpen={setTooltip}
            onRegister={register}
          />
        </ScoreRow>
      </Group>
      {tooltip ? (
        <Modal
          transparent
          visible
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setTooltip(null)}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss score details"
              onPress={(event) => {
                const hit = hitRect(
                  [...pills.current.values()],
                  event.nativeEvent.pageX,
                  event.nativeEvent.pageY,
                );
                if (!hit || hit.id === tooltip.id) {
                  setTooltip(null);
                  return;
                }
                haptic();
                setTooltip(hit);
              }}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              }}
            />
            <ScaleTooltipCard tooltip={tooltip} />
          </View>
        </Modal>
      ) : null}
    </>
  );
}
