import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { runOnJS, useAnimatedReaction, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { NativeAction } from '@/components/native-action';
import { useTheme } from '@/hooks/use-theme';
import { withHaptic } from '@/lib/haptics';
import { useThemePreference } from '@/providers/theme-preference-provider';
import type { StudentNotification } from '@/lib/student-api';

import { swipePastDismissThreshold } from './inbox';

type Closeable = { close: () => void };
type SwipeableHandle = Closeable & {
  openLeft: () => void;
  openRight: () => void;
  reset: () => void;
};

const ios = process.env.EXPO_OS === 'ios';
const cardRadius = ios ? 20 : 16;

export function NotificationRow({
  notification,
  onOpen,
  onToggleRead,
  onClear,
  onSwipeOpen,
}: {
  notification: StudentNotification;
  onOpen: () => void;
  onToggleRead: () => void;
  onClear: () => void;
  onSwipeOpen: (row: Closeable) => void;
}) {
  const theme = useTheme();
  const { resolvedScheme } = useThemePreference();
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
        borderRadius: cardRadius,
        borderCurve: 'continuous',
        boxShadow: resolvedScheme === 'dark' ? '0 1px 4px rgba(0, 0, 0, 0.45)' : '0 1px 4px rgba(0, 0, 0, 0.12)',
      }}
    >
      <ReanimatedSwipeable
        ref={ref}
        friction={1}
        rightThreshold={40}
        overshootFriction={1}
        enableTrackpadTwoFingerGesture
        containerStyle={{ overflow: 'visible', backgroundColor: 'transparent' }}
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
          accessibilityHint="Opens the notification. Swipe left to read or clear, or swipe all the way to clear"
          accessibilityLabel={`${unread ? 'Unread. ' : ''}${notification.title ?? 'Notification'}${notification.body ? `. ${notification.body}` : ''}`}
          onPress={withHaptic(onOpen)}
          style={{
            minHeight: 64,
            backgroundColor: theme.backgroundElement,
            paddingVertical: 14,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            borderRadius: cardRadius,
            borderCurve: 'continuous',
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: ios ? 8 : 18,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: unread ? theme.backgroundSelected : theme.border,
            }}
          >
            <BellIcon color={theme.primary} filled={unread} />
          </View>
          <View style={{ flex: 1, gap: 2, paddingTop: ios ? 1 : 2 }}>
            <Text
              selectable
              style={{
                color: theme.text,
                fontSize: ios ? 15 : 16,
                lineHeight: ios ? 20 : 22,
                fontWeight: unread ? '600' : '500',
              }}
            >
              {notification.title ?? 'Notification'}
            </Text>
            {notification.body ? (
              <Text selectable style={{ color: theme.textSecondary, fontSize: ios ? 15 : 14, lineHeight: 20 }}>
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
    <View style={{ width: 92, height: '100%', justifyContent: 'center', alignItems: 'stretch', gap: 8, paddingLeft: 8 }}>
      <SwipeDismissSensor translation={translation} rowWidth={rowWidth} onDismiss={onDismiss} />
      <NativeAction label={unread ? 'Read' : 'Unread'} compact onPress={onToggleRead} />
      <NativeAction label="Clear" compact onPress={onClear} />
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
        source={filled ? 'sf:bell.fill' : 'sf:bell'}
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
          `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${filled ? color : 'none'}" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>`,
        )}`,
      }}
      style={{ width: 18, height: 18 }}
    />
  );
}
