import { useRouter } from "expo-router";
import { Copy, Group, Row, Screen } from "@/components/ui";
import { useTrainerTools } from "@/features/skill-trainer/components/trainer-tools";
export default function TrainerMenu() {
  const router = useRouter();
  const tools = useTrainerTools();
  return (
    <Screen>
      <Group>
        <Row
          title="Return to trainer"
          icon="brain"
          onPress={() => router.back()}
        />
        <Row
          title="Exit trainer"
          icon="flag"
          onPress={() => {
            router.back();
            tools.current?.exit();
          }}
        />
      </Group>
      <Copy muted>The timer continues while this menu is open.</Copy>
    </Screen>
  );
}
