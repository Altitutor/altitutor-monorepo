import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/components/ui";
import { Calculator } from "@/features/skill-trainer/components/calculator";
export default function CalculatorSheet() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        padding: 12,
        paddingBottom: Math.max(12, insets.bottom),
      }}
    >
      <Calculator />
    </ScrollView>
  );
}
