import { useState } from "react";
import { View } from "react-native";
import { useColors } from "./ui";

export function PageDots({
  count,
  index,
  onIndex,
}: {
  count: number;
  index: number;
  onIndex: (index: number) => void;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const dark = c.background === "#171717";
  function seek(x: number) {
    if (!count || !width) return;
    onIndex(Math.max(0, Math.min(count - 1, Math.floor((x / width) * count))));
  }
  const size = 8;
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Question"
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
      accessibilityHint="Swipe or drag across the dots to move between questions"
      accessibilityActions={[
        { name: "increment", label: "Next question" },
        { name: "decrement", label: "Previous question" },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment")
          onIndex(Math.min(count - 1, index + 1));
        if (event.nativeEvent.actionName === "decrement")
          onIndex(Math.max(0, index - 1));
      }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => seek(event.nativeEvent.locationX)}
      onResponderMove={(event) => seek(event.nativeEvent.locationX)}
      style={{
        alignSelf: "center",
        minHeight: 28,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: dark
          ? "rgba(255,255,255,0.18)"
          : "rgba(0,0,0,0.28)",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 7,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            width: i === index ? size + 2 : size,
            height: i === index ? size + 2 : size,
            borderRadius: (i === index ? size + 2 : size) / 2,
            backgroundColor:
              i === index ? "#FFFFFF" : "rgba(255,255,255,0.42)",
          }}
        />
      ))}
    </View>
  );
}
