import { HeaderActions } from "@/components/header-actions";
import { Group, Row, Screen } from "@/components/ui";
export default function Practice() {
  return (
    <Screen>
      <HeaderActions />
      <Group>
        <Row title="Skill trainers" icon="brain" href="/trainers" />
      </Group>
      <Group>
        <Row
          title="Practice questions"
          icon="pencil"
          href="/practice/questions"
        />
      </Group>
      <Group>
        <Row
          title="Question sets"
          icon="stack"
          href={{ pathname: "/catalogue", params: { kind: "set" } }}
        />
      </Group>
      <Group>
        <Row
          title="Mock exams"
          icon="timer"
          href={{ pathname: "/catalogue", params: { kind: "mock" } }}
        />
      </Group>
    </Screen>
  );
}
