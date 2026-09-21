import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  extractSkillTrainerPlainText,
  findFindWordClickableTokens,
  type FindWordItemContent,
} from "@altitutor/shared";
import { useColors } from "@/components/ui";
import { haptic } from "@/lib/haptics";

type Point = { x: number; y: number };
type Rect = Point & { width: number; height: number };
function contains(rect: Rect, point: Point) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}
function measure(view: View): Promise<Rect> {
  return new Promise((resolve) =>
    view.measureInWindow((x, y, width, height) =>
      resolve({ x, y, width, height }),
    ),
  );
}

function KeywordChip({
  id,
  text,
  placed,
  selected,
  disabled,
  onSelect,
  onDrag,
  onDrop,
  onCancel,
}: {
  id: string;
  text: string;
  placed: boolean;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDrag: (id: string, point: Point) => void;
  onDrop: (id: string, point: Point) => void;
  onCancel: () => void;
}) {
  const c = useColors();
  const handlers = useRef({
    disabled,
    placed,
    onSelect,
    onDrag,
    onDrop,
    onCancel,
  });
  useLayoutEffect(() => {
    handlers.current = { disabled, placed, onSelect, onDrag, onDrop, onCancel };
  }, [disabled, placed, onSelect, onDrag, onDrop, onCancel]);
  const pan = useMemo(
    () =>
      // PanResponder stores these callbacks; refs are read only during gestures.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !handlers.current.disabled &&
          !handlers.current.placed &&
          Math.hypot(gesture.dx, gesture.dy) > 6,
        onPanResponderGrant: (_event, gesture) => {
          haptic("light");
          handlers.current.onDrag(id, { x: gesture.moveX, y: gesture.moveY });
        },
        onPanResponderMove: (_event, gesture) =>
          handlers.current.onDrag(id, { x: gesture.moveX, y: gesture.moveY }),
        onPanResponderRelease: (_event, gesture) =>
          handlers.current.onDrop(id, { x: gesture.moveX, y: gesture.moveY }),
        onPanResponderTerminate: () => handlers.current.onCancel(),
        onPanResponderTerminationRequest: () => false,
      }),
    [id],
  );
  return (
    <View {...pan.panHandlers}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${text}${placed ? ", found" : ""}`}
        accessibilityHint="Select then tap the matching word in the passage, or drag this word onto it"
        accessibilityState={{ selected, disabled: disabled || placed }}
        disabled={disabled || placed}
        onPress={() => {
          haptic("light");
          onSelect();
        }}
        style={{
          minHeight: 44,
          paddingHorizontal: 14,
          paddingVertical: 11,
          borderRadius: 14,
          backgroundColor: selected ? c.accent : c.tint,
          borderWidth: 1,
          borderColor: selected ? c.accent : c.border,
          opacity: placed ? 0.45 : 1,
        }}
      >
        <Text
          style={{
            color: selected ? c.card : c.text,
            fontSize: 16,
            fontWeight: "600",
          }}
        >
          {placed ? "✓ " : ""}
          {text}
        </Text>
      </Pressable>
    </View>
  );
}

/** Owns its passage scroll view and fixed keyword tray; mount in a flex workspace. */
export function FindWord({
  content,
  placedIds,
  disabled = false,
  onPlace,
}: {
  content: FindWordItemContent;
  placedIds: string[];
  disabled?: boolean;
  onPlace: (keywordId: string, characterIndex: number) => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    point: Point;
    origin: Point;
    hover: number | null;
  } | null>(null);
  const [prompt, setPrompt] = useState(false);
  const root = useRef<View>(null);
  const viewport = useRef<View>(null);
  const rootOrigin = useRef<Point>({ x: 0, y: 0 });
  const targets = useRef(new Map<number, View>());
  const dragIdentity = useRef<string | null>(null);
  const dragRegions = useRef<{ index: number; rect: Rect }[]>([]);
  const dragViewport = useRef<Rect | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const latest = useRef({ disabled, placedIds, onPlace });
  useLayoutEffect(() => {
    latest.current = { disabled, placedIds, onPlace };
  }, [disabled, placedIds, onPlace]);
  const plain = extractSkillTrainerPlainText(content.passage, {
    blockSeparator: "\n",
  });
  const paragraphs = useMemo(() => {
    const lines = plain.split("\n");
    return lines.map((text, index) => {
      const start = lines
        .slice(0, index)
        .reduce((offset, line) => offset + line.length + 1, 0);
      return { text, start, tokens: findFindWordClickableTokens(text) };
    });
  }, [plain]);
  const active = selected && !placedIds.includes(selected) ? selected : null;
  function place(id: string, index: number) {
    if (
      !alive.current ||
      latest.current.disabled ||
      latest.current.placedIds.includes(id)
    )
      return;
    setSelected(null);
    setPrompt(false);
    haptic("medium");
    latest.current.onPlace(id, index);
  }
  async function drop(id: string, point: Point) {
    setDrag(null);
    dragIdentity.current = null;
    if (!viewport.current) return;
    const visible = await measure(viewport.current);
    if (!contains(visible, point)) return;
    // Measure after the gesture, in window coordinates, so passage scrolling and
    // native header/sheet offsets cannot leave stale target hit regions.
    const regions = await Promise.all(
      [...targets.current].map(async ([index, view]) => ({
        index,
        rect: await measure(view),
      })),
    );
    const hit = regions.find(
      ({ rect }) => rect.width > 0 && rect.height > 0 && contains(rect, point),
    );
    place(id, hit?.index ?? -1);
  }
  return (
    <View
      ref={root}
      style={{ flex: 1 }}
      onLayout={() =>
        root.current?.measureInWindow((x, y) => {
          rootOrigin.current = { x, y };
        })
      }
    >
      <View ref={viewport} style={{ flex: 1 }} collapsable={false}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          removeClippedSubviews={false}
          scrollEnabled={!drag}
          contentContainerStyle={{ padding: 20, gap: 16 }}
        >
          {paragraphs.map((paragraph) => {
            let cursor = 0;
            return (
              <View
                key={paragraph.start}
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  minHeight: 28,
                }}
              >
                {paragraph.tokens.map((token) => {
                  const leading = paragraph.text.slice(cursor, token.start);
                  cursor = token.end;
                  const index = paragraph.start + token.start;
                  return (
                    <View
                      key={index}
                      style={{ flexDirection: "row", alignItems: "baseline" }}
                    >
                      {leading ? (
                        <Text
                          style={{
                            color: c.text,
                            fontSize: 17,
                            lineHeight: 30,
                          }}
                        >
                          {leading}
                        </Text>
                      ) : null}
                      <View
                        collapsable={false}
                        ref={(node) => {
                          if (node) targets.current.set(index, node);
                          else targets.current.delete(index);
                        }}
                      >
                        <Pressable
                          disabled={disabled}
                          accessibilityRole="button"
                          accessibilityLabel={token.text}
                          accessibilityHint={
                            active
                              ? "Place selected keyword here"
                              : "Select a keyword first"
                          }
                          onPress={() => {
                            if (active) {
                              place(active, index);
                              return;
                            }
                            haptic("warning");
                            setPrompt(true);
                          }}
                          style={{
                            borderRadius: 4,
                            backgroundColor:
                              drag?.hover === index ? c.tint : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              color: c.text,
                              fontSize: 17,
                              lineHeight: 30,
                            }}
                          >
                            {token.text}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
                {cursor < paragraph.text.length ? (
                  <Text style={{ color: c.text, fontSize: 17, lineHeight: 30 }}>
                    {paragraph.text.slice(cursor)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </View>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 12),
          gap: 10,
          backgroundColor: c.card,
          borderTopWidth: 1,
          borderTopColor: c.border,
        }}
      >
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: prompt ? c.danger : c.secondary, fontSize: 13 }}
        >
          {prompt
            ? "Select a keyword, then tap it in the passage."
            : active
              ? `Find “${content.keywords.find((word) => word.id === active)?.text ?? ""}” in the passage`
              : "Drag a keyword to the passage, or tap to select"}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {content.keywords.map((keyword) => (
            <KeywordChip
              key={keyword.id}
              id={keyword.id}
              text={keyword.text}
              placed={placedIds.includes(keyword.id)}
              selected={active === keyword.id}
              disabled={disabled}
              onSelect={() => {
                setSelected(active === keyword.id ? null : keyword.id);
                setPrompt(false);
              }}
              onDrag={(id, point) => {
                if (dragIdentity.current !== id) {
                  dragIdentity.current = id;
                  dragRegions.current = [];
                  dragViewport.current = null;
                  root.current?.measureInWindow((x, y) => {
                    rootOrigin.current = { x, y };
                  });
                  if (viewport.current)
                    void measure(viewport.current).then((rect) => {
                      if (dragIdentity.current === id)
                        dragViewport.current = rect;
                    });
                  void Promise.all(
                    [...targets.current].map(async ([index, view]) => ({
                      index,
                      rect: await measure(view),
                    })),
                  ).then((regions) => {
                    if (dragIdentity.current === id)
                      dragRegions.current = regions;
                  });
                }
                const hover =
                  dragViewport.current && contains(dragViewport.current, point)
                    ? (dragRegions.current.find(({ rect }) =>
                        contains(rect, point),
                      )?.index ?? null)
                    : null;
                setSelected(id);
                setDrag({ id, point, origin: rootOrigin.current, hover });
              }}
              onDrop={(id, point) => void drop(id, point)}
              onCancel={() => {
                dragIdentity.current = null;
                setDrag(null);
              }}
            />
          ))}
        </View>
      </View>
      {drag ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: drag.point.x - drag.origin.x - 40,
            top: drag.point.y - drag.origin.y - 52,
            backgroundColor: c.accent,
            padding: 12,
            borderRadius: 14,
            boxShadow: "0 4px 14px #0003",
          }}
        >
          <Text style={{ color: c.card, fontWeight: "700" }}>
            {content.keywords.find((word) => word.id === drag.id)?.text}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
