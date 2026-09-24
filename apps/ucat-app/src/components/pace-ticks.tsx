import { Text, View } from "react-native";
import { useColors } from "./ui";
export function PaceTicks() {
  const c = useColors();
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        marginHorizontal: 12,
        marginTop: -4,
      }}
    >
      {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((value) => (
        <View key={value} style={{ alignItems: "center", width: 1 }}>
          <View
            style={{
              height: value === 1 ? 8 : 5,
              width: 1,
              backgroundColor: c.secondary,
            }}
          />
          <Text
            style={{
              width: 40,
              textAlign: "center",
              color: c.secondary,
              fontSize: 10,
              marginTop: 4,
            }}
          >
            {[0.25, 1, 2].includes(value) ? `${value}×` : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}
