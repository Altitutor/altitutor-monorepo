import type { ResourceFile } from '@altitutor/shared';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useTheme } from '@/hooks/use-theme';

import { classifyResourceMedia, embedPlayerDocument, embedRequestAllowed } from './resource-media';

export function ResourcePlayer({ file, url }: { file: ResourceFile; url: string | null }) {
  const theme = useTheme();
  const media = classifyResourceMedia(file, url);

  if (media.kind === 'missing') {
    return <Text style={{ color: theme.textSecondary, padding: 20 }}>This resource has no file.</Text>;
  }
  if (media.kind === 'image') {
    return <Image source={{ uri: media.url }} contentFit="contain" style={{ flex: 1 }} accessibilityLabel={file.filename} />;
  }
  if (media.kind === 'video') return <NativeVideo url={media.url} />;
  if (media.kind === 'embed') {
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
  return <WebView source={{ uri: media.url }} style={{ flex: 1, backgroundColor: theme.background }} startInLoadingState />;
}

function NativeVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={{ flex: 1, backgroundColor: '#000' }}
      nativeControls
      contentFit="contain"
    />
  );
}
