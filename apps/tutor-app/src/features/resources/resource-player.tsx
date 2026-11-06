import {
  classifyResourceMedia,
  embedPlayerDocument,
  embedRequestAllowed,
  isPdfResource,
  type TutorResourceFile,
} from '@altitutor/shared';
import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { EmptyBlock, ErrorBlock, TutorScreen } from '@/components/tutor-ui';
import { useTheme } from '@/hooks/use-theme';

function openableUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function ResourcePlayer({ file, url }: { file: TutorResourceFile; url: string | null }) {
  const theme = useTheme();
  const source = url ?? file.externalUrl;
  if (!source || !openableUrl(source)) {
    return <TutorScreen title={file.filename} largeTitle={false}><EmptyBlock>This resource has no viewable file.</EmptyBlock></TutorScreen>;
  }

  const media = classifyResourceMedia(file, url);

  if (media.kind === 'image') {
    return <Image source={{ uri: media.url }} contentFit="contain" cachePolicy="memory" style={{ flex: 1 }} accessibilityLabel={file.filename} />;
  }

  if (media.kind === 'video') return <ResourceVideo url={media.url} />;

  if (media.kind === 'embed' && process.env.EXPO_OS !== 'web') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
        <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}>
          <WebView
            source={{ html: embedPlayerDocument(media.embedUrl), baseUrl: media.baseUrl }}
            style={{ flex: 1, backgroundColor: '#000' }}
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            setSupportMultipleWindows={false}
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={(request) => embedRequestAllowed(request.url)}
          />
        </View>
      </View>
    );
  }

  const pdf = Boolean(url && isPdfResource(file));
  if (pdf && url && process.env.EXPO_OS === 'ios') {
    return (
      <WebView
        source={{ uri: url }}
        style={{ flex: 1, backgroundColor: theme.background }}
        startInLoadingState
        cacheEnabled={false}
        javaScriptEnabled={false}
        domStorageEnabled={false}
        setSupportMultipleWindows={false}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(request) => request.url === url || request.url === 'about:blank'}
        renderError={() => <ErrorBlock message="Could not load this PDF." />}
      />
    );
  }

  return (
    <OpenResource
      key={source}
      file={file}
      url={source}
      downloadPdf={pdf && process.env.EXPO_OS === 'android'}
    />
  );
}

function ResourceVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url);
  return <VideoView player={player} style={{ flex: 1, backgroundColor: '#000' }} nativeControls contentFit="contain" />;
}

function removeCachedFile(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {
    // The OS can purge temporary files independently.
  }
}

function OpenResource({ file, url, downloadPdf }: { file: TutorResourceFile; url: string; downloadPdf: boolean }) {
  const theme = useTheme();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string>();
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => active.current?.abort(), []);

  async function open() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setError(undefined);
    setOpening(true);
    let localPdf: File | undefined;
    try {
      if (!downloadPdf) {
        await Linking.openURL(url);
        return;
      }

      localPdf = new File(Paths.cache, `tutor-resource-${file.id}-${Date.now()}.pdf`);
      await File.downloadFileAsync(url, localPdf, { signal: controller.signal });
      if (controller.signal.aborted) return;

      const { startActivityAsync } = await import('expo-intent-launcher');
      if (controller.signal.aborted) return;
      await startActivityAsync('android.intent.action.VIEW', {
        data: localPdf.contentUri,
        type: 'application/pdf',
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      });
    } catch {
      if (!controller.signal.aborted) {
        setError(downloadPdf ? 'Could not open this PDF. Make sure a PDF reader is installed.' : 'Could not open this file. Try again.');
      }
    } finally {
      if (localPdf) removeCachedFile(localPdf);
      active.current = null;
      if (!controller.signal.aborted) setOpening(false);
    }
  }

  return (
    <TutorScreen title={file.filename} largeTitle={false}>
      <Text selectable style={{ color: theme.textSecondary, fontSize: 16 }}>
        {downloadPdf ? 'Open this PDF with another app on your device.' : 'Open this resource outside the app.'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: opening, busy: opening }}
        disabled={opening}
        onPress={() => void open()}
        style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.65 : 1 })}
      >
        <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '600' }}>
          {opening ? 'Opening…' : downloadPdf ? 'Open PDF' : 'Open resource'}
        </Text>
      </Pressable>
      {error ? <ErrorBlock message={error} /> : null}
    </TutorScreen>
  );
}
