import { useEffect, useState } from "react";
import type { LessonNavigation } from "@/features/learning/lesson-navigation";
import { useRouter } from "expo-router";
import { Screen, Group, Row, Copy } from "@/components/ui";
import { useLessonNavigation } from "@/features/learning/lesson-navigation";
export default function LessonNavigator() {
  const navigationRef = useLessonNavigation();
  const router = useRouter();
  const [nav, setNav] = useState<LessonNavigation | null>(null);
  useEffect(() => {
    setNav(navigationRef.current);
  }, [navigationRef]);
  return (
    <Screen>
      {nav ? (
        <Group>
          {nav.parts.map((part, index) => (
            <Row
              key={part.id}
              title={`${part.title}${index === nav.index ? " · Current" : ""}${part.complete ? " ✓" : ""}`}
              icon="book"
              onPress={() => {
                nav.jump(index);
                router.back();
              }}
            />
          ))}
        </Group>
      ) : (
        <Copy>Open a lesson to navigate its parts.</Copy>
      )}
    </Screen>
  );
}
