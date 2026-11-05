import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'react-native';

import { NativeAction } from '@/components/native-action';
import { StudentScreen } from '@/components/student-ui';
import { useTheme } from '@/hooks/use-theme';

export default function FreeStudyInfoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { topicName } = useLocalSearchParams<{ topicName?: string }>();
  const name = topicName?.trim() || 'this topic';

  return (
      <StudentScreen title="Free study" largeTitle={false} contentPaddingBottom={32}>
        <Text selectable style={{ color: theme.text, fontSize: 17, lineHeight: 24 }}>
          {`This is free study, so every flashcard from ${name} is shown. Answers here do not change which cards are due.`}
        </Text>
        <NativeAction
          label="Study due cards"
          block
          onPress={() => {
            router.dismiss();
            router.push('/(tabs)/flashcards');
          }}
        />
      </StudentScreen>
  );
}
