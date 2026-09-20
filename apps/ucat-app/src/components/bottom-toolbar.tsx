import { Pressable, Text, View } from "react-native";
import { Stack } from "expo-router/stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Meter, useColors } from "./ui";
type Props = {
  previous: () => void;
  next: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  progress?: number;
  onNavigator?: () => void;
  onProgress?: () => void;
  previousLabel?: string;
  nextLabel?: string;
};
export function BottomToolbar({
  previous,
  next,
  previousDisabled,
  nextDisabled,
  progress,
  onNavigator,
  onProgress,
  previousLabel = "Previous question",
  nextLabel = "Next question",
}: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  if (process.env.EXPO_OS === "ios")
    return (
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.Button
          icon="chevron.left"
          accessibilityLabel={previousLabel}
          disabled={previousDisabled}
          onPress={previous}
        >
          {previousLabel}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Spacer />
        {onNavigator ? (
          <Stack.Toolbar.Button
            icon="square.grid.2x2"
            accessibilityLabel="Question navigator"
            onPress={onNavigator}
          >
            Question navigator
          </Stack.Toolbar.Button>
        ) : (
          <Stack.Toolbar.View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lesson navigator"
              onPress={onProgress}
              style={{ width: 160, padding: 12 }}
            >
              <Meter value={progress ?? 0} />
            </Pressable>
          </Stack.Toolbar.View>
        )}
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button
          icon="chevron.right"
          accessibilityLabel={nextLabel}
          disabled={nextDisabled}
          onPress={next}
        >
          {nextLabel}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    );
  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: Math.max(insets.bottom, 12),
        paddingTop: 8,
        paddingHorizontal: 20,
        backgroundColor: c.card,
        borderTopWidth: 0.5,
        borderColor: c.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={previousLabel}
        disabled={previousDisabled}
        onPress={previous}
        style={{ padding: 12, opacity: previousDisabled ? 0.3 : 1 }}
      >
        <Text style={{ color: c.accent, fontSize: 26 }}>←</Text>
      </Pressable>
      {onNavigator ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Question navigator"
          onPress={onNavigator}
          style={{ padding: 16 }}
        >
          <Text style={{ color: c.accent, fontSize: 24 }}>▦</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lesson navigator"
          onPress={onProgress}
          style={{ width: 160, paddingVertical: 16 }}
        >
          <Meter value={progress ?? 0} />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
        disabled={nextDisabled}
        onPress={next}
        style={{ padding: 12, opacity: nextDisabled ? 0.3 : 1 }}
      >
        <Text style={{ color: c.accent, fontSize: 26 }}>→</Text>
      </Pressable>
    </View>
  );
}
