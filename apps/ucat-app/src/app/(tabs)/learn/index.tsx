import { HeaderActions } from "@/components/header-actions";
import { Group, Row, Screen } from "@/components/ui";
import { learningSections } from "@/features/learning/library";
export default function Learn() {
  return (
    <Screen>
      <HeaderActions />
      {learningSections.map((s) => (
        <Group key={s.number}>
          <Row
            title={s.title}
            icon={s.icon}
            href={{ pathname: "/learn/section", params: { number: s.number } }}
          />
        </Group>
      ))}
    </Screen>
  );
}
