import { useState } from "react";
import {
  tableColumnWidths,
  columnSpan,
} from "@/features/learning/table-layout";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { Linking, ScrollView, Text, View } from "react-native";
import { Copy, useColors } from "@/components/ui";
import { api } from "@/lib/api";
type Node = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: Node[];
};
export function RichContent({
  json,
  text = "",
}: {
  json?: unknown;
  text?: string;
}) {
  if (!json || typeof json !== "object") return <Copy>{text}</Copy>;
  return <RichNode node={json as Node} />;
}
function RichImage({ attrs }: { attrs: Record<string, unknown> }) {
  const src = typeof attrs.src === "string" ? attrs.src : "";
  const path =
    typeof attrs.storagePath === "string"
      ? attrs.storagePath
      : src.split("/ucat-images/")[1]?.split("?")[0];
  const fileId = typeof attrs.fileId === "string" ? attrs.fileId : undefined;
  const q = useQuery({
    queryKey: ["image", path, fileId],
    queryFn: () =>
      api<{ signedUrls: string[] }>("/images/signed-urls", {
        method: "POST",
        body: {
          paths: path ? [decodeURIComponent(path)] : [],
          fileIds: !path && fileId ? [fileId] : [],
        },
      }),
    enabled: Boolean(path || fileId),
    staleTime: 3600000,
  });
  const url = q.data?.signedUrls[0] ?? src;
  const width = Number(attrs.width) || 600,
    height = Number(attrs.height) || 350;
  return url ? (
    <Image
      source={{ uri: url }}
      accessibilityLabel={
        typeof attrs.alt === "string" ? attrs.alt : "Question illustration"
      }
      contentFit="contain"
      style={{ width: "100%", aspectRatio: width / height, minHeight: 120 }}
    />
  ) : (
    <Copy muted>Loading illustration…</Copy>
  );
}
function RichNode({ node }: { node: Node }) {
  const c = useColors();
  if (node.type === "image") return <RichImage attrs={node.attrs ?? {}} />;
  if (node.type === "hardBreak") return <Text>{"\n"}</Text>;
  if (node.text != null) {
    const link = node.marks?.find((m) => m.type === "link")?.attrs?.href;
    return (
      <Text
        selectable
        onPress={
          typeof link === "string" && /^https?:\/\//.test(link)
            ? () => {
                void Linking.openURL(link);
              }
            : undefined
        }
        style={{
          color: link ? c.accent : c.text,
          fontWeight: node.marks?.some((m) => m.type === "bold")
            ? "700"
            : undefined,
          fontStyle: node.marks?.some((m) => m.type === "italic")
            ? "italic"
            : "normal",
          textDecorationLine: node.marks?.some((m) => m.type === "underline")
            ? "underline"
            : "none",
        }}
      >
        {node.text}
      </Text>
    );
  }
  const children = node.content?.map((n, i) => <RichNode key={i} node={n} />);
  // Images are native views and must sit outside Text, including inline
  // images authored inside a TipTap paragraph.
  if (
    (node.type === "paragraph" || node.type === "heading") &&
    node.content?.some((n) => n.type === "image")
  ) {
    const runs: Node[] = [];
    for (const child of node.content) {
      if (child.type === "image") runs.push(child);
      else {
        let run = runs[runs.length - 1];
        if (!run || run.type === "image") {
          run = { type: node.type, content: [] };
          runs.push(run);
        }
        run.content?.push(child);
      }
    }
    return (
      <View style={{ gap: 10 }}>
        {runs.map((run, i) => (
          <RichNode key={i} node={run} />
        ))}
      </View>
    );
  }
  if (node.type === "paragraph" || node.type === "heading")
    return (
      <Text
        selectable
        style={{
          color: c.text,
          fontSize: node.type === "heading" ? 22 : 17,
          fontWeight: node.type === "heading" ? "700" : "400",
          lineHeight: 27,
        }}
      >
        {children}
      </Text>
    );
  if (node.type === "table") return <RichTable node={node} />;
  return (
    <View
      style={{
        gap: node.type === "tableRow" ? 0 : 10,
        flexDirection: node.type === "tableRow" ? "row" : "column",
        ...(node.type === "tableCell" || node.type === "tableHeader"
          ? {
              minWidth: 100,
              flex: 1,
              borderWidth: 1,
              borderColor: c.border,
              padding: 10,
            }
          : {}),
        ...(node.type === "listItem" || node.type === "blockquote"
          ? { paddingLeft: 16, borderLeftWidth: 2, borderColor: c.border }
          : {}),
      }}
    >
      {children}
    </View>
  );
}

function RichTable({ node }: { node: Node }) {
  const c = useColors();
  const [available, setAvailable] = useState(300);
  const widths = tableColumnWidths(node.content ?? [], available);
  const width = widths.reduce((sum, value) => sum + value, 0);
  return (
    <View onLayout={(event) => setAvailable(event.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentInsetAdjustmentBehavior="automatic"
      >
        <View
          style={{
            width,
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderColor: c.border,
          }}
        >
          {node.content?.map((row, i) => {
            let column = 0;
            return (
              <View key={i} style={{ flexDirection: "row" }}>
                {row.content?.map((cell, j) => {
                  const span = columnSpan(cell);
                  const cellWidth = widths
                    .slice(column, column + span)
                    .reduce((sum, value) => sum + value, 0);
                  column += span;
                  return (
                    <View
                      key={j}
                      style={{
                        width: cellWidth,
                        flexShrink: 0,
                        padding: 12,
                        gap: 8,
                        borderRightWidth: 1,
                        borderBottomWidth: 1,
                        borderColor: c.border,
                        backgroundColor:
                          cell.type === "tableHeader" ? c.tint : c.card,
                      }}
                    >
                      {cell.content?.map((child, k) => (
                        <RichNode key={k} node={child} />
                      ))}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
      {width > available + 1 && (
        <Text style={{ color: c.secondary, fontSize: 12, marginTop: 6 }}>
          Swipe sideways to view the table
        </Text>
      )}
    </View>
  );
}
