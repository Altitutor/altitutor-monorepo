import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Card, EmptyBlock, StudentScreen, TappableRow } from '@/components/student-ui';
import { useFileNavigation, type FileNavigation } from '@/features/resources/resource-navigation';

export default function FileNavigatorScreen() {
  const navigationRef = useFileNavigation();
  const router = useRouter();
  const [nav, setNav] = useState<FileNavigation | null>(null);

  useEffect(() => {
    setNav(navigationRef.current);
  }, [navigationRef]);

  return (
    <StudentScreen title="Files" largeTitle={false}>
      {nav?.files.length ? nav.files.map((file) => (
        <Card key={file.id}>
          <TappableRow
            title={file.title}
            detail={file.id === nav.currentId ? 'Current' : file.detail}
            onPress={() => {
              const jump = navigationRef.current?.jump;
              if (!jump) return;
              jump(file.id);
              router.back();
            }}
          />
        </Card>
      )) : (
        <EmptyBlock>Open a file to browse this topic.</EmptyBlock>
      )}
    </StudentScreen>
  );
}
