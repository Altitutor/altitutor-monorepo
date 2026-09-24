import { useRouter } from "expo-router";
import { Copy, Group, Row, Screen } from "@/components/ui";
import { useExamTools } from "@/features/question-engine/components/exam-tools";
export default function ExamMenu() {
  const router = useRouter();
  const tools = useExamTools();
  return (
    <Screen>
      <Group>
        <Row title="Return to questions" onPress={() => router.back()} />
        <Row
          title="Exit attempt"
          detail="Save for later or discard this attempt"
          onPress={() => tools.current?.exit()}
        />
      </Group>
      <Copy muted>Timed attempts keep running while this menu is open.</Copy>
    </Screen>
  );
}
