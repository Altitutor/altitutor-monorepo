import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Stack } from "expo-router/stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withHaptic } from "@/lib/haptics";
import { Meter, useColors } from "./ui";
type Props = {
  previous: () => void;
  next: () => void;
  previousDisabled?: boolean;
  hidePrevious?: boolean;
  hideNext?: boolean;
  reviewNext?: boolean;
  nextDisabled?: boolean;
  progress?: number;
  completed?: boolean;
  onNavigator?: () => void;
  onProgress?: () => void;
  previousLabel?: string;
  nextLabel?: string;
};
export function BottomToolbar({
  previous,
  next,
  previousDisabled,
  hidePrevious,
  hideNext,
  reviewNext,
  nextDisabled,
  progress,
  completed,
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
        {!hidePrevious && (
          <Stack.Toolbar.Button
            icon="chevron.left"
            accessibilityLabel={previousLabel}
            disabled={previousDisabled || hidePrevious}
            onPress={withHaptic(previous)}
          >
            {previousLabel}
          </Stack.Toolbar.Button>
        )}
        <Stack.Toolbar.Spacer />
        {onNavigator ? (
          <Stack.Toolbar.Button
            icon="square.grid.2x2"
            accessibilityLabel="Question navigator"
            onPress={withHaptic(onNavigator)}
          >
            Question navigator
          </Stack.Toolbar.Button>
        ) : (
          <Stack.Toolbar.View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                completed
                  ? "Lesson navigator, current part completed"
                  : "Lesson navigator"
              }
              onPress={withHaptic(onProgress)}
              style={{
                width: 184,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <View style={{ flex: 1 }}>
                <Meter value={progress ?? 0} />
              </View>
              {completed && <CompletionIcon color={c.good} />}
            </Pressable>
          </Stack.Toolbar.View>
        )}
        <Stack.Toolbar.Spacer />
        {!hideNext && (
          <Stack.Toolbar.Button
            icon={reviewNext ? "checklist" : "chevron.right"}
            accessibilityLabel={nextLabel}
            disabled={nextDisabled || hideNext}
            onPress={withHaptic(next)}
          >
            {nextLabel}
          </Stack.Toolbar.Button>
        )}
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
        disabled={previousDisabled || hidePrevious}
        onPress={withHaptic(previous)}
        style={{
          padding: 12,
          opacity: hidePrevious ? 0 : previousDisabled ? 0.3 : 1,
        }}
      >
        <Text style={{ color: c.accent, fontSize: 26 }}>←</Text>
      </Pressable>
      {onNavigator ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Question navigator"
          onPress={withHaptic(onNavigator)}
          style={{ padding: 16 }}
        >
          <Text style={{ color: c.accent, fontSize: 24 }}>▦</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            completed
              ? "Lesson navigator, current part completed"
              : "Lesson navigator"
          }
          onPress={withHaptic(onProgress)}
          style={{
            width: 184,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <View style={{ flex: 1 }}>
            <Meter value={progress ?? 0} />
          </View>
          {completed && <CompletionIcon color={c.good} />}
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
        disabled={nextDisabled || hideNext}
        onPress={withHaptic(next)}
        style={{ padding: 12, opacity: hideNext ? 0 : nextDisabled ? 0.3 : 1 }}
      >
        <Text style={{ color: c.accent, fontSize: 26 }}>
          {reviewNext ? "☷" : "→"}
        </Text>
      </Pressable>
    </View>
  );
}

function CompletionIcon({ color }: { color: string }) {
  return (
    <Image
      source={
        process.env.EXPO_OS === "ios"
          ? "sf:checkmark.circle.fill"
          : {
              uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${color}"/><path d="m6 12 4 4 8-8" fill="none" stroke="#171717" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`)}`,
            }
      }
      tintColor={process.env.EXPO_OS === "ios" ? color : undefined}
      style={{ width: 20, height: 20 }}
    />
  );
}
