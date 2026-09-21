import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { Text, View, type TextStyle, type ViewStyle } from "react-native";
import type { UcatSkillTrainerKey } from "@altitutor/shared";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Group, useColors } from "@/components/ui";
import { CalcKeySequence } from "@/features/skill-trainer/components/calculator";
import {
  DEMO_STEPS,
  latestDemoKeys,
  type DemoStep,
} from "@/features/skill-trainer/lib/demo-script";

type Measurable = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

const DemoMeasure = createContext<{
  setTarget: (name: string, node: Measurable | null) => void;
} | null>(null);

const CURSOR = 22;

function bindTarget(
  name: string,
  setTarget: (name: string, node: Measurable | null) => void,
) {
  return (node: Measurable | null) => {
    setTarget(name, node);
    return () => setTarget(name, null);
  };
}

function Hit({
  name,
  children,
  style,
}: PropsWithChildren<{ name: string; style?: ViewStyle }>) {
  const ctx = use(DemoMeasure);
  if (!ctx) throw new Error("Hit requires DemoMeasure");
  return (
    <View
      collapsable={false}
      ref={bindTarget(name, ctx.setTarget)}
      style={style}
    >
      {children}
    </View>
  );
}

function HitText({
  name,
  children,
  style,
}: PropsWithChildren<{ name: string; style?: TextStyle }>) {
  const ctx = use(DemoMeasure);
  if (!ctx) throw new Error("HitText requires DemoMeasure");
  return (
    <Text ref={bindTarget(name, ctx.setTarget)} style={style}>
      {children}
    </Text>
  );
}

function Chip({
  children,
  active,
  target,
}: {
  children: ReactNode;
  active?: boolean;
  target?: string;
}) {
  const c = useColors();
  const body = (
    <View
      style={{
        minHeight: 40,
        paddingHorizontal: 14,
        paddingVertical: 8,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: active ? c.tint : c.card,
      }}
    >
      <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>
        {children}
      </Text>
    </View>
  );
  return target ? <Hit name={target}>{body}</Hit> : body;
}

function SyllogismTile({
  choice,
  target,
  faded,
}: {
  choice: "yes" | "no";
  target?: string;
  faded?: boolean;
}) {
  const c = useColors();
  const body = (
    <View
      style={{
        height: 36,
        width: 80,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        opacity: faded ? 0.4 : 1,
      }}
    >
      <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>
        {choice === "yes" ? "Yes" : "No"}
      </Text>
    </View>
  );
  return target ? <Hit name={target}>{body}</Hit> : body;
}

function demoKeyName(prefix: string, key: string) {
  if (key === "+") return `${prefix}plus`;
  if (key === "=") return `${prefix}submit`;
  return `${prefix}${key}`;
}

function DemoCalcPad({
  activeKey,
  prefix,
}: {
  activeKey?: string;
  prefix: string;
}) {
  const button = (key: string, grow = 1) => {
    const number = /^[0-9.]$/.test(key);
    const active = key === activeKey;
    return (
      <Hit
        key={key}
        name={demoKeyName(prefix, key)}
        style={{
          flex: grow,
          minHeight: 32,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active
            ? number
              ? "#D0D0D0"
              : "#9A1520"
            : number
              ? "#F5F5F5"
              : "#DE1F2A",
          borderWidth: 1,
          borderColor: "#414042",
          borderRadius: 5,
        }}
      >
        <Text
          style={{
            color: number ? "#000000" : "#FFFFFF",
            fontSize: key.length > 2 ? 11 : 14,
            fontWeight: "600",
          }}
        >
          {key === "sqrt" ? "√" : key}
        </Text>
      </Hit>
    );
  };
  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#414042",
        backgroundColor: "#507ABD",
        padding: 8,
        gap: 4,
      }}
    >
      {[
        ["+/-", "sqrt", "%", "÷"],
        ["MRC", "M-", "M+", "×"],
        ["7", "8", "9", "-"],
        ["4", "5", "6", "+"],
      ].map((row) => (
        <View key={row.join()} style={{ flexDirection: "row", gap: 4 }}>
          {row.map((key) => button(key))}
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 4 }}>
        <View style={{ flexGrow: 3, flexBasis: 10, gap: 4 }}>
          {[
            ["1", "2", "3"],
            ["ON/C", "0", "."],
          ].map((row) => (
            <View key={row.join()} style={{ flexDirection: "row", gap: 4 }}>
              {row.map((key) => button(key))}
            </View>
          ))}
        </View>
        {button("=", 1)}
      </View>
    </View>
  );
}

function Scene({
  trainerKey,
  step,
  stepIndex,
}: {
  trainerKey: UcatSkillTrainerKey;
  step: DemoStep;
  stepIndex: number;
}) {
  const c = useColors();
  const highlight = {
    backgroundColor: c.tint,
    borderRadius: 4,
  } as const;
  if (trainerKey === "find_word")
    return (
      <View style={{ gap: 16 }}>
        <Text style={{ color: c.text, fontSize: 16, lineHeight: 26 }}>
          The library remained open throughout the summer so students could
          continue their research. The quiet{" "}
          <HitText
            name="passage-word"
            style={stepIndex >= 3 ? highlight : undefined}
          >
            library
          </HitText>{" "}
          overlooked the garden.
        </Text>
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.secondary, fontSize: 13, fontWeight: "600" }}>
            Keywords
          </Text>
          <Chip target="keyword" active={stepIndex >= 1}>
            library
          </Chip>
        </View>
      </View>
    );
  if (trainerKey === "find_concept")
    return (
      <View style={{ gap: 16 }}>
        <Text style={{ color: c.text, fontSize: 16, lineHeight: 26 }}>
          The council chose to{" "}
          <HitText
            name="concept-one"
            style={stepIndex >= 2 ? highlight : undefined}
          >
            reduce waste
          </HitText>{" "}
          at public events. Its new bins should{" "}
          <HitText
            name="concept-two"
            style={stepIndex >= 4 ? highlight : undefined}
          >
            reduce waste
          </HitText>{" "}
          across the city.
        </Text>
        <Hit name="concept" style={{ gap: 6 }}>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>
            Find: reduce waste
          </Text>
          <Text style={{ color: c.secondary, fontSize: 13 }}>
            Found {stepIndex >= 4 ? 2 : stepIndex >= 2 ? 1 : 0} of 2
          </Text>
        </Hit>
      </View>
    );
  if (trainerKey === "quick_syllogism")
    return (
      <View style={{ gap: 20, alignItems: "center" }}>
        <Hit name="syllogism" style={{ gap: 8, alignItems: "center" }}>
          <Text style={{ color: c.text, fontSize: 16, textAlign: "center" }}>
            All surgeons are doctors.
          </Text>
          <Text style={{ color: c.text, fontSize: 16, textAlign: "center" }}>
            All doctors have medical training.
          </Text>
          <Text
            style={{
              color: c.text,
              fontSize: 17,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            Conclusion: All surgeons have medical training.
          </Text>
        </Hit>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <Hit
            name="drop-box"
            style={{
              height: 56,
              width: 112,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              borderCurve: "continuous",
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor:
                (step.draggingChoice || step.droppedChoice) &&
                step.target === "drop-box"
                  ? c.accent
                  : c.secondary,
              backgroundColor:
                (step.draggingChoice || step.droppedChoice) &&
                step.target === "drop-box"
                  ? c.tint
                  : c.background,
            }}
          >
            {step.droppedChoice && !step.draggingChoice ? (
              <SyllogismTile choice={step.droppedChoice} />
            ) : (
              <Text style={{ color: c.secondary, fontSize: 12 }}>
                Drop answer
              </Text>
            )}
          </Hit>
          <View
            style={{
              width: 96,
              padding: 8,
              gap: 8,
              alignItems: "center",
              borderRadius: 10,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.tint,
            }}
          >
            <SyllogismTile
              choice="yes"
              target="yes-answer"
              faded={Boolean(
                step.draggingChoice === "yes" || step.droppedChoice === "yes",
              )}
            />
            <SyllogismTile choice="no" />
          </View>
        </View>
      </View>
    );
  if (trainerKey === "mental_maths")
    return (
      <View style={{ gap: 16, alignItems: "center" }}>
        <Hit name="mental-question">
          <Text style={{ color: c.text, fontSize: 28, fontWeight: "600" }}>
            18 × 7 = ?
          </Text>
        </Hit>
        <View style={{ flexDirection: "row", alignItems: "stretch", gap: 8 }}>
          <Hit
            name="mental-answer"
            style={{
              flex: 1,
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: 12,
              borderRadius: 10,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.background,
            }}
          >
            <Text style={{ color: c.text, fontSize: 18 }}>
              {step.typed ?? (stepIndex > 4 ? "126" : "")}
            </Text>
          </Hit>
          <Chip
            target="mental-submit"
            active={step.target === "mental-submit" && step.pressed}
          >
            Submit
          </Chip>
        </View>
      </View>
    );
  if (trainerKey === "calculator_maths")
    return (
      <View style={{ gap: 16, alignItems: "center" }}>
        <Hit name="calculator-question">
          <Text
            style={{
              color: c.text,
              fontSize: 17,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            A £24 item increases by £12. What is its new price?
          </Text>
        </Hit>
        <View style={{ flexDirection: "row", alignItems: "stretch", gap: 8 }}>
          <Hit
            name="calculator-answer"
            style={{
              flex: 1,
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: 12,
              borderRadius: 10,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.background,
            }}
          >
            <Text style={{ color: c.text, fontSize: 18 }}>
              {step.typed ?? (stepIndex > 3 ? "36" : "")}
            </Text>
          </Hit>
          <Chip
            target="calculator-submit"
            active={step.target === "calculator-submit" && step.pressed}
          >
            Submit
          </Chip>
        </View>
      </View>
    );
  const entered = latestDemoKeys(DEMO_STEPS.numpad_speed, stepIndex);
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 10, alignItems: "center" }}>
        <Text style={{ color: c.secondary, fontSize: 13, fontWeight: "600" }}>
          Target sequence
        </Text>
        <Hit name="numpad-target">
          <CalcKeySequence labels={["2", "3", "+", "4"]} />
        </Hit>
        <Text style={{ color: c.secondary, fontSize: 13, fontWeight: "600" }}>
          Your sequence
        </Text>
        {entered.length ? (
          <CalcKeySequence labels={entered} />
        ) : (
          <Text style={{ color: c.secondary, fontSize: 15 }}>
            Press keys on the calculator…
          </Text>
        )}
      </View>
      <DemoCalcPad prefix="numpad-" activeKey={step.activeKey} />
    </View>
  );
}

function Cursor({
  pressed,
  draggingChoice,
}: {
  pressed?: boolean;
  draggingChoice?: "yes" | "no";
}) {
  const c = useColors();
  return (
    <>
      {draggingChoice ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: CURSOR / 2 - 40,
            top: -46,
          }}
        >
          <SyllogismTile choice={draggingChoice} />
        </View>
      ) : null}
      <View
        style={{
          width: CURSOR,
          height: CURSOR,
          borderRadius: CURSOR / 2,
          backgroundColor: c.card,
          borderWidth: 2,
          borderColor: c.text,
          opacity: pressed && !draggingChoice ? 0.85 : 1,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.25)",
        }}
      />
    </>
  );
}

export function TrainerDemo({ trainerKey }: { trainerKey: UcatSkillTrainerKey }) {
  const c = useColors();
  const reducedMotion = useReducedMotion();
  const container = useRef<View>(null);
  const targets = useRef(new Map<string, Measurable>());
  const targetName = useRef<string | undefined>(undefined);
  const lastTarget = useRef<string | undefined>(undefined);
  const movedAt = useRef(0);
  const [stepIndex, setStepIndex] = useState(0);
  const steps = DEMO_STEPS[trainerKey];
  const step = steps[stepIndex] ?? steps[0];
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const setTarget = useCallback((name: string, node: Measurable | null) => {
    if (node) targets.current.set(name, node);
    else targets.current.delete(name);
  }, []);
  const followRef = useRef<(mode: "step" | "layout") => void>(() => {});
  useLayoutEffect(() => {
    followRef.current = (mode) => {
      const name = targetName.current;
      const stage = container.current;
      const node = name ? targets.current.get(name) : undefined;
      if (!stage || !node || !name) {
        opacity.value = withTiming(0, { duration: 150 });
        return;
      }
      node.measureInWindow((tx, ty, width, height) => {
        stage.measureInWindow((cx, cy) => {
          const nextX = tx - cx + width / 2 - CURSOR / 2;
          const nextY = ty - cy + height / 2 - CURSOR / 2;
          const now = Date.now();
          if (mode === "layout" && now - movedAt.current < 900) return;
          const targetChanged = lastTarget.current !== name;
          if (
            reducedMotion ||
            !targetChanged ||
            lastTarget.current === undefined
          ) {
            x.value = nextX;
            y.value = nextY;
          } else {
            const duration = step.draggingChoice ? 850 : 280;
            movedAt.current = now;
            x.value = withTiming(nextX, {
              duration,
              easing: Easing.inOut(Easing.quad),
            });
            y.value = withTiming(nextY, {
              duration,
              easing: Easing.inOut(Easing.quad),
            });
          }
          lastTarget.current = name;
          opacity.value = withTiming(1, { duration: reducedMotion ? 0 : 150 });
        });
      });
    };
  });
  useEffect(() => {
    setStepIndex(0);
    lastTarget.current = undefined;
  }, [trainerKey]);
  useEffect(() => {
    targetName.current = step.target;
    const frame = requestAnimationFrame(() => followRef.current("step"));
    return () => cancelAnimationFrame(frame);
  }, [step.pressed, step.target]);
  useEffect(() => {
    const timeout = setTimeout(
      () => setStepIndex((current) => (current + 1) % steps.length),
      step.durationMs ?? 1100,
    );
    return () => clearTimeout(timeout);
  }, [step.durationMs, stepIndex, steps.length]);
  useEffect(() => {
    scale.value = withTiming(
      step.pressed && !step.draggingChoice ? 0.72 : 1,
      { duration: reducedMotion ? 0 : 180 },
    );
  }, [reducedMotion, scale, step.draggingChoice, step.pressed]);
  const cursorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));
  return (
    <DemoMeasure value={{ setTarget }}>
      <Animated.View entering={FadeIn.duration(250)}>
        <Group>
          <View
            accessible
            accessibilityLabel={`How to play. ${step.caption}`}
            accessibilityLiveRegion="polite"
          >
            <Text
              style={{
                color: c.secondary,
                fontSize: 13,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.7,
              }}
            >
              How to play
            </Text>
            <Text
              key={step.caption}
              style={{ color: c.text, fontSize: 16, lineHeight: 24, marginTop: 6 }}
            >
              {step.caption}
            </Text>
          </View>
          <View
            ref={container}
            collapsable={false}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onLayout={() => followRef.current("layout")}
            style={{ overflow: "hidden" }}
          >
            <Scene
              trainerKey={trainerKey}
              step={step}
              stepIndex={stepIndex}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                { position: "absolute", left: 0, top: 0, zIndex: 20 },
                cursorStyle,
              ]}
            >
              <Cursor
                pressed={step.pressed}
                draggingChoice={step.draggingChoice}
              />
            </Animated.View>
          </View>
        </Group>
      </Animated.View>
    </DemoMeasure>
  );
}
