import { useAppTheme } from "@/features/settings/theme";
import {
  Children,
  isValidElement,
  Fragment,
  useEffect,
  type PropsWithChildren,
  type Ref,
} from "react";
import { AppIcon, type IconName } from "./app-icon";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  type DimensionValue,
  type ScrollViewProps,
  type TextInputProps,
  TextInput,
  Platform,
} from "react-native";
import { useRouter, type Href } from "expo-router";

export function useColors() {
  return useAppTheme().scheme === "dark"
    ? {
        background: "#171717",
        card: "#1F1F1F",
        text: "#FFFFFF",
        secondary: "#B3B3B3",
        accent: "#93B6C3",
        border: "#303030",
        tint: "#292929",
        good: "#6ED8AE",
        danger: "#FF958C",
      }
    : {
        background: "#E8EAED",
        card: "#FFFFFF",
        text: "#1A1A1A",
        secondary: "#666666",
        accent: "#052242",
        border: "#E3E5E8",
        tint: "#DAE8ED",
        good: "#167754",
        danger: "#B7332C",
      };
}
export function Screen({
  children,
  refreshing,
  onRefresh,
  scrollRef,
  bottomToolbar = false,
  ...props
}: PropsWithChildren<
  ScrollViewProps & {
    refreshing?: boolean;
    onRefresh?: () => void;
    scrollRef?: Ref<ScrollView>;
    bottomToolbar?: boolean;
  }
>) {
  const c = useColors();
  return (
    <ScrollView
      ref={scrollRef}
      {...props}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        padding: 20,
        paddingBottom:
          20 + (Platform.OS !== "ios" ? (bottomToolbar ? 72 : 80) : 0),
        gap: 20,
        width: "100%",
        maxWidth: 850,
        alignSelf: "center",
      }}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={c.accent}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}
export function Copy({
  children,
  muted = false,
  large = false,
}: PropsWithChildren<{ muted?: boolean; large?: boolean }>) {
  const c = useColors();
  return (
    <Text
      selectable
      style={{
        color: muted ? c.secondary : c.text,
        fontSize: large ? 25 : 16,
        lineHeight: large ? 32 : 24,
        fontWeight: large ? "700" : "400",
      }}
    >
      {children}
    </Text>
  );
}
export function Group({
  children,
  title,
  dividers = false,
  compact = false,
}: PropsWithChildren<{
  title?: string;
  dividers?: boolean;
  compact?: boolean;
}>) {
  const c = useColors();
  const rowsOnly =
    compact ||
    Children.toArray(children).every(
      (child) => isValidElement(child) && child.type === Row,
    );
  return (
    <View style={{ gap: 9 }}>
      {title && (
        <Text
          accessibilityRole="header"
          style={{
            color: c.secondary,
            fontSize: 13,
            fontWeight: "600",
            paddingHorizontal: 4,
            textTransform: "uppercase",
            letterSpacing: 0.7,
          }}
        >
          {title}
        </Text>
      )}
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: 18,
          borderCurve: "continuous",
          paddingHorizontal: 18,
          paddingVertical: rowsOnly ? 2 : 18,
          gap: rowsOnly ? 0 : 16,
        }}
      >
        {Children.toArray(children).map((child, index, all) => (
          <Fragment key={isValidElement(child) ? (child.key ?? index) : index}>
            {index > 0 &&
              isValidElement(child) &&
              (dividers || child.type === Row) &&
              isValidElement(all[index - 1]) && (
                <View style={{ height: 0.5, backgroundColor: c.border }} />
              )}
            {child}
          </Fragment>
        ))}
      </View>
    </View>
  );
}
export function Action({
  title,
  onPress,
  disabled,
  secondary,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        padding: 14,
        borderRadius: 14,
        borderCurve: "continuous",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: secondary ? c.tint : c.accent,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          color: secondary ? c.accent : buttonText(c.accent),
          fontWeight: "600",
          fontSize: 16,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
function buttonText(accent: string) {
  return accent === "#93B6C3" ? "#171717" : "#FFFFFF";
}
export function Row({
  title,
  detail: _detail,
  icon,
  href,
  onPress,
}: {
  title: string;
  detail?: string;
  icon?: IconName;
  href?: Href;
  onPress?: () => void;
}) {
  const c = useColors();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={href ? () => router.navigate(href) : onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        opacity: pressed ? 0.5 : 1,
      })}
    >
      {icon && <AppIcon name={icon} color={c.accent} />}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: c.text, fontSize: 17, fontWeight: "500" }}>
          {title}
        </Text>
      </View>
      <Text style={{ fontSize: 24, color: c.secondary }}>›</Text>
    </Pressable>
  );
}
export function Field(props: TextInputProps) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.secondary}
      {...props}
      style={[
        {
          minHeight: 50,
          padding: 13,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 12,
          color: c.text,
          backgroundColor: c.card,
          fontSize: 17,
        },
        props.style,
      ]}
    />
  );
}
export function Skeleton({
  height,
  width = "100%",
  radius = 8,
}: {
  height: number;
  width?: DimensionValue;
  radius?: number;
}) {
  const c = useColors();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 0.7 : 0.45);
  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 0.7;
      return;
    }
    opacity.value = 0.45;
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [opacity, reducedMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessible={false}
      style={[
        {
          height,
          width,
          borderRadius: radius,
          borderCurve: "continuous",
          backgroundColor: c.border,
        },
        style,
      ]}
    />
  );
}
function RowCardSkeleton() {
  return (
    <Group compact>
      <View
        style={{
          minHeight: 48,
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
        }}
      >
        <Skeleton height={22} width={22} radius={6} />
        <View style={{ flex: 1 }}>
          <Skeleton height={17} width="72%" radius={6} />
        </View>
      </View>
    </Group>
  );
}
function ListSkeleton({ count }: { count: number }) {
  const leading = Math.max(1, Math.ceil(count / 2));
  const trailing = Math.max(0, count - leading);
  const groups = trailing > 0 ? [leading, trailing] : [leading];
  return (
    <View style={{ gap: 20 }}>
      {groups.map((rows, index) => (
        <View key={index} style={{ gap: 10 }}>
          <Skeleton height={13} width={index ? "34%" : "42%"} radius={4} />
          {Array.from({ length: rows }, (_, row) => (
            <RowCardSkeleton key={row} />
          ))}
        </View>
      ))}
    </View>
  );
}
function CardSkeleton() {
  return (
    <Group>
      <Skeleton height={12} width="36%" radius={4} />
      <Skeleton height={28} width="58%" radius={8} />
      <Skeleton height={16} width="92%" radius={6} />
      <Skeleton height={16} width="74%" radius={6} />
      <Skeleton height={48} radius={14} />
    </Group>
  );
}
function CardsSkeleton({ count }: { count: number }) {
  if (count <= 1) return <CardSkeleton />;
  return (
    <View style={{ gap: 20 }}>
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </View>
  );
}
function RowsSkeleton({ count }: { count: number }) {
  const widths = ["80%", "64%", "72%", "54%"] as const;
  return (
    <View style={{ gap: 14, paddingVertical: 8 }}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          height={16}
          width={widths[index % widths.length]}
          radius={6}
        />
      ))}
    </View>
  );
}
function DetailSkeleton() {
  return (
    <View style={{ gap: 20 }}>
      <Group>
        <Skeleton height={25} width="68%" radius={8} />
        <Skeleton height={16} width="100%" radius={6} />
        <Skeleton height={16} width="88%" radius={6} />
        <Skeleton height={16} width="40%" radius={6} />
      </Group>
      <Group>
        <Skeleton height={13} width="32%" radius={4} />
        <Skeleton height={16} width="94%" radius={6} />
        <Skeleton height={16} width="86%" radius={6} />
        <Skeleton height={16} width="70%" radius={6} />
      </Group>
      <Skeleton height={48} radius={14} />
    </View>
  );
}
function QuestionSkeleton() {
  return (
    <View style={{ gap: 20 }}>
      <Group>
        <Skeleton height={17} width="38%" radius={6} />
        <Skeleton height={16} width="100%" radius={6} />
        <Skeleton height={16} width="96%" radius={6} />
        <Skeleton height={16} width="78%" radius={6} />
        <Skeleton height={72} radius={10} />
      </Group>
      <Group>
        <Skeleton height={13} width="28%" radius={4} />
        <Skeleton height={16} width="100%" radius={6} />
        <Skeleton height={16} width="62%" radius={6} />
      </Group>
      <Group>
        <Skeleton height={13} width="30%" radius={4} />
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} height={48} radius={12} />
        ))}
      </Group>
    </View>
  );
}
function ChartSkeleton() {
  return (
    <Group>
      <Skeleton height={13} width="40%" radius={4} />
      <Skeleton height={32} width="30%" radius={8} />
      <Skeleton height={16} width="62%" radius={6} />
      <Skeleton height={180} radius={12} />
    </Group>
  );
}
export function Loading({
  variant = "list",
  count,
}: {
  variant?: "list" | "card" | "rows" | "detail" | "question" | "chart";
  count?: number;
}) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      {variant === "card" ? (
        <CardsSkeleton count={count ?? 1} />
      ) : variant === "rows" ? (
        <RowsSkeleton count={count ?? 3} />
      ) : variant === "detail" ? (
        <DetailSkeleton />
      ) : variant === "question" ? (
        <QuestionSkeleton />
      ) : variant === "chart" ? (
        <ChartSkeleton />
      ) : (
        <ListSkeleton count={count ?? 5} />
      )}
    </View>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <Group>
      <Copy>
        {error instanceof Error ? error.message : "Something went wrong."}
      </Copy>
      {retry && <Action title="Try again" onPress={retry} />}
    </Group>
  );
}
export function Meter({ value }: { value: number }) {
  const c = useColors();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }}
      style={{
        height: 7,
        backgroundColor: c.border,
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: 7,
          width: `${Math.max(0, Math.min(100, value))}%`,
          backgroundColor: c.accent,
        }}
      />
    </View>
  );
}
