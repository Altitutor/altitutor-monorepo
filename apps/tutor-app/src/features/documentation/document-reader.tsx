import { Linking } from 'react-native';
import { WebView } from 'react-native-webview';

import { documentLink } from './document-content';

export function DocumentReader({ html, background }: { html: string; background: string }) {
  return (
    <WebView
      source={{ html }}
      javaScriptEnabled={false}
      domStorageEnabled={false}
      cacheEnabled={false}
      setSupportMultipleWindows={false}
      originWhitelist={['*']}
      style={{ backgroundColor: background }}
      onShouldStartLoadWithRequest={(request) => {
        if (request.url === 'about:blank') return true;
        const target = documentLink(request.url);
        if (target) void Linking.openURL(target).catch(() => undefined);
        return false;
      }}
    />
  );
}
