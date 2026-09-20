import { useAppTheme } from "@/features/settings/theme";
import {
  Children,
  isValidElement,
  Fragment,
  type PropsWithChildren,
  type Ref,
} from "react";
import { AppIcon, type IconName } from "./app-icon";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  type ScrollViewProps,
  type TextInputProps,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();
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
          Math.max(insets.bottom, 24) +
          24 +
          (Platform.OS !== "ios" ? (bottomToolbar ? 72 : 80) : 0),
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
export function Loading() {
  return (
    <View style={{ padding: 32 }}>
      <ActivityIndicator accessibilityLabel="Loading" />
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
