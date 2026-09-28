import { getImageOcclusionGroupDescription, type FlashcardReviewCard } from '@altitutor/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useTheme } from '@/hooks/use-theme';

import { flashcardApi } from './flashcard-api';
import { clozeHtml } from './flashcard-html';
import { refreshFlashcardHtmlImages } from './flashcard-image-urls';

function HtmlCard({ html }: { html: string }) {
  const theme = useTheme();
  const [rendered, setRendered] = useState({ source: html, value: html });
  const [height, setHeight] = useState(140);
  const renderedHtml = rendered.source === html ? rendered.value : html;

  useEffect(() => {
    let active = true;
    void refreshFlashcardHtmlImages(html).then((next) => {
      if (active) setRendered({ source: html, value: next });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [html]);

  const document = useMemo(() => `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>
    :root{color-scheme:${theme.background === '#171717' ? 'dark' : 'light'}}
    html,body{margin:0;padding:0;background:transparent;color:${theme.text};font:20px/1.65 -apple-system,BlinkMacSystemFont,Roboto,sans-serif;overflow:hidden}
    body{overflow-wrap:anywhere}p{margin:.3em 0 1em}img{max-width:100%;height:auto}a{color:${theme.primary}}
    .cloze{display:inline-block;border-radius:6px;padding:0 7px;font-weight:700}.question{background:${theme.backgroundSelected};color:${theme.textSecondary}}
    .answer{background:${theme.accent};color:#0A2941}.extra{font-size:15px;line-height:1.55;border-top:1px solid ${theme.border};padding-top:14px;margin-top:18px}
  </style></head><body>${renderedHtml}<script>
    function report(){window.ReactNativeWebView.postMessage(String(Math.ceil(document.documentElement.scrollHeight)))}
    new ResizeObserver(report).observe(document.body);window.addEventListener('load',report);setTimeout(report,100);
  </script></body></html>`, [renderedHtml, theme]);

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html: document }}
      style={{ height, backgroundColor: 'transparent' }}
      scrollEnabled={false}
      onMessage={(event) => {
        const next = Number(event.nativeEvent.data);
        if (Number.isFinite(next)) setHeight(Math.max(100, Math.min(10000, next)));
      }}
      onShouldStartLoadWithRequest={(request) => {
        if (request.url === 'about:blank' || request.url.startsWith('data:')) return true;
        if (/^https?:\/\//i.test(request.url)) void Linking.openURL(request.url);
        return false;
      }}
    />
  );
}

function OcclusionCard({ card, showAnswer, onReadyChange }: {
  card: FlashcardReviewCard;
  showAnswer: boolean;
  onReadyChange?: (ready: boolean) => void;
}) {
  const theme = useTheme();
  const [url, setUrl] = useState(card.image_url ?? null);
  const [error, setError] = useState(false);
  const data = card.occlusion_data;

  useEffect(() => {
    setUrl(card.image_url ?? null);
    setError(false);
    onReadyChange?.(false);
  }, [card.id, card.image_url, onReadyChange]);

  async function retry() {
    if (!card.image_storage_path) return;
    setError(false);
    onReadyChange?.(false);
    try {
      const response = await flashcardApi.signedImageUrls([card.image_storage_path]);
      setUrl(response.signedUrls[0] ?? null);
    } catch {
      setError(true);
    }
  }

  if (!data || !url) {
    return <Text selectable style={{ color: theme.danger }}>This flashcard image is unavailable.</Text>;
  }
  const description = showAnswer ? getImageOcclusionGroupDescription(data, card.cloze_index) : null;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ width: '100%', aspectRatio: data.naturalWidth / data.naturalHeight, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.backgroundSelected }}>
        <Image
          source={{ uri: url }}
          contentFit="contain"
          style={{ width: '100%', height: '100%' }}
          accessible
          accessibilityLabel={card.image_alt_text ?? 'Image occlusion flashcard'}
          onLoad={() => onReadyChange?.(true)}
          onError={() => { setError(true); onReadyChange?.(false); }}
        />
        {!error ? data.masks.map((mask) => {
          const active = mask.clozeIndex === card.cloze_index;
          return <View key={mask.id} pointerEvents="none" style={{
            position: 'absolute', left: `${mask.x * 100}%`, top: `${mask.y * 100}%`,
            width: `${mask.width * 100}%`, height: `${mask.height * 100}%`,
            borderWidth: active ? 2 : 1, borderColor: active ? '#F59E0B' : '#334155',
            backgroundColor: active && showAnswer ? 'transparent' : active ? '#F59E0B' : '#64748B',
          }} />;
        }) : null}
      </View>
      {error ? <Pressable onPress={() => void retry()}><Text style={{ color: theme.danger }}>Image failed to load. Tap to retry.</Text></Pressable> : null}
      {description ? <Text selectable style={{ color: theme.text }}>{description}</Text> : null}
      {showAnswer && card.extra ? <HtmlCard html={`<div class="extra">${card.extra}</div>`} /> : null}
    </View>
  );
}

export function FlashcardContent({ card, showAnswer, onReadyChange }: {
  card: FlashcardReviewCard;
  showAnswer: boolean;
  onReadyChange?: (ready: boolean) => void;
}) {
  const router = useRouter();
  const theme = useTheme();
  const content = card.card_type === 'image_occlusion'
    ? <OcclusionCard card={card} showAnswer={showAnswer} onReadyChange={onReadyChange} />
    : <HtmlCard html={`${clozeHtml(card.cloze_text ?? '', card.cloze_index, showAnswer)}${showAnswer && card.extra ? `<div class="extra">${card.extra}</div>` : ''}`} />;

  return (
    <View style={{ gap: 20 }}>
      {content}
      {showAnswer && card.note_links?.length ? (
        <View style={{ gap: 8 }}>
          <Text selectable style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>Notes and solutions</Text>
          <Text selectable style={{ color: theme.textSecondary, fontSize: 12 }}>Review the source material for this subtopic.</Text>
          {card.note_links.map((link) => (
            <Pressable
              key={link.id}
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/resource-file/[fileId]', params: { fileId: link.id, topicId: card.topic_id, singleFile: '1' } })}
              style={{ alignSelf: 'flex-start', borderWidth: 1, borderColor: theme.border, borderRadius: 10, borderCurve: 'continuous', paddingHorizontal: 12, paddingVertical: 9 }}>
              <Text selectable style={{ color: theme.primary }}>{link.is_solution ? 'Solution: ' : ''}{link.label} ›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
