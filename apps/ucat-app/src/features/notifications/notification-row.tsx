import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { NativeButton } from "@/components/native-button";
import { useAppTheme } from "@/features/settings/theme";
import { withHaptic } from "@/lib/haptics";
import { useColors } from "@/components/ui";
import { swipePastDismissThreshold } from "./inbox";
import type { UcatNotification } from "./types";

type Closeable = { close: () => void };
type SwipeableHandle = Closeable & {
  openLeft: () => void;
  openRight: () => void;
  reset: () => void;
};

const ios = process.env.EXPO_OS === "ios";
const CARD_RADIUS = ios ? 20 : 16;

export function NotificationRow({
  notification,
  onToggleRead,
  onClear,
  onSwipeOpen,
}: {
  notification: UcatNotification;
  onToggleRead: () => void;
  onClear: () => void;
  onSwipeOpen: (row: Closeable) => void;
}) {
  const c = useColors();
  const { scheme } = useAppTheme();
  const ref = useRef<SwipeableHandle>(null);
  const dismissed = useRef(false);
  const [rowWidth, setRowWidth] = useState(0);
  const unread = !notification.read_at;
  const clear = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    onClear();
  };
  return (
    <View
      onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
      style={{
        borderRadius: CARD_RADIUS,
        borderCurve: "continuous",
        boxShadow:
          scheme === "dark"
            ? "0 1px 4px rgba(0, 0, 0, 0.45)"
            : ios
              ? "0 1px 4px rgba(0, 0, 0, 0.12)"
              : "0 1px 3px rgba(0, 0, 0, 0.16)",
      }}
    >
      <ReanimatedSwipeable
        ref={ref}
        friction={1}
        rightThreshold={40}
        overshootFriction={1}
        enableTrackpadTwoFingerGesture
        containerStyle={{ overflow: "visible", backgroundColor: "transparent" }}
        onSwipeableOpenStartDrag={() => {
          if (ref.current) onSwipeOpen(ref.current);
        }}
        renderRightActions={(_progress, translation, methods) => (
          <RightActions
            unread={unread}
            translation={translation}
            rowWidth={rowWidth}
            onDismiss={clear}
            onToggleRead={() => {
              methods.close();
              onToggleRead();
            }}
            onClear={() => {
              methods.close();
              clear();
            }}
          />
        )}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Marks as read. Swipe left to unread or clear, or swipe all the way to clear"
          accessibilityLabel={`${unread ? "Unread. " : ""}${notification.title}${notification.body ? `. ${notification.body}` : ""}`}
          onPress={withHaptic(() => {
            if (unread) onToggleRead();
          })}
          style={{
            minHeight: 64,
            backgroundColor: c.card,
            paddingVertical: 14,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 12,
            borderRadius: CARD_RADIUS,
            borderCurve: "continuous",
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: ios ? 8 : 18,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: unread ? c.tint : c.border,
            }}
          >
            <BellIcon color={c.accent} filled={unread} />
          </View>
          <View style={{ flex: 1, gap: 2, paddingTop: ios ? 1 : 2 }}>
            <Text
              selectable
              style={{
                color: c.text,
                fontSize: ios ? 15 : 16,
                lineHeight: ios ? 20 : 22,
                fontWeight: unread ? "600" : "500",
              }}
            >
              {notification.title}
            </Text>
            {notification.body ? (
              <Text
                selectable
                style={{
                  color: c.secondary,
                  fontSize: ios ? 15 : 14,
                  lineHeight: 20,
                }}
              >
                {notification.body}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </ReanimatedSwipeable>
    </View>
  );
}

function RightActions({
  unread,
  translation,
  rowWidth,
  onDismiss,
  onToggleRead,
  onClear,
}: {
  unread: boolean;
  translation: SharedValue<number>;
  rowWidth: number;
  onDismiss: () => void;
  onToggleRead: () => void;
  onClear: () => void;
}) {
  return (
    <View
      style={{
        width: 92,
        height: "100%",
        justifyContent: "center",
        alignItems: "stretch",
        gap: 8,
        paddingLeft: 8,
      }}
    >
      <SwipeDismissSensor
        translation={translation}
        rowWidth={rowWidth}
        onDismiss={onDismiss}
      />
      <NativeButton
        title={unread ? "Read" : "Unread"}
        onPress={onToggleRead}
      />
      <NativeButton title="Clear" onPress={onClear} />
    </View>
  );
}

function SwipeDismissSensor({
  translation,
  rowWidth,
  onDismiss,
}: {
  translation: SharedValue<number>;
  rowWidth: number;
  onDismiss: () => void;
}) {
  const width = useSharedValue(rowWidth);
  const armed = useSharedValue(true);
  width.value = rowWidth;
  useAnimatedReaction(
    () => swipePastDismissThreshold(translation.value, width.value),
    (shouldDismiss, wasDismissing) => {
      if (shouldDismiss && !wasDismissing && armed.value) {
        armed.value = false;
        runOnJS(onDismiss)();
      }
    },
  );
  return null;
}

function BellIcon({ color, filled }: { color: string; filled: boolean }) {
  if (ios) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={filled ? "sf:bell.fill" : "sf:bell"}
        tintColor={color}
        style={{ width: 18, height: 18 }}
      />
    );
  }
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={{
        uri: `data:image/svg+xml;utf8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${filled ? color : "none"}" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>`,
        )}`,
      }}
      style={{ width: 18, height: 18 }}
    />
  );
}
