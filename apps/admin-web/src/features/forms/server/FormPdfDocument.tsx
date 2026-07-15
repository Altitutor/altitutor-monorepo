import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { FormBlock, FormRichTextJson } from '@altitutor/shared';
import { FORM_MODEL_OPTION_SOURCE_OPTIONS } from '@altitutor/shared';

const styles = StyleSheet.create({
  page: { paddingHorizontal: 42, paddingVertical: 38, fontFamily: 'Helvetica', fontSize: 10, color: '#111827' },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 6 },
  meta: { color: '#4b5563', marginBottom: 20 },
  identity: { flexDirection: 'row', gap: 18, marginBottom: 22 },
  identityField: { flexGrow: 1 },
  identityLabel: { color: '#4b5563', marginBottom: 12 },
  line: { borderBottomWidth: 0.7, borderBottomColor: '#9ca3af', height: 17 },
  block: { marginBottom: 18, breakInside: 'avoid' },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginBottom: 5 },
  body: { color: '#374151', lineHeight: 1.45 },
  question: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  required: { color: '#b91c1c' },
  description: { color: '#4b5563', marginBottom: 7 },
  option: { flexDirection: 'row', gap: 7, marginBottom: 6 },
  optionMark: { fontFamily: 'Helvetica', width: 12 },
  paperHint: { color: '#4b5563', marginBottom: 5 },
  footer: { position: 'absolute', bottom: 18, left: 42, right: 42, color: '#6b7280', fontSize: 8, textAlign: 'center' },
});

function richTextToPlainText(value: FormRichTextJson): string {
  const visit = (node: unknown): string => {
    if (!node || typeof node !== 'object') return '';
    const record = node as Record<string, unknown>;
    if (typeof record.text === 'string') return record.text;
    if (Array.isArray(record.content)) return record.content.map(visit).filter(Boolean).join(' ');
    return '';
  };
  return visit(value).replace(/\s+/g, ' ').trim();
}

function Lines({ count }: { count: number }) {
  return <View>{Array.from({ length: count }, (_, index) => <View key={index} style={styles.line} />)}</View>;
}

function PrintableBlock({ block, index }: { block: FormBlock; index: number }) {
  if (block.type === 'content') {
    const body = richTextToPlainText(block.body);
    return (
      <View style={styles.block} wrap={false}>
        {block.title ? <Text style={styles.sectionTitle}>{block.title}</Text> : null}
        {body ? <Text style={styles.body}>{body}</Text> : null}
      </View>
    );
  }

  const modelSource =
    (block.type === 'single_choice' || block.type === 'multi_select') && block.optionSource?.kind === 'model'
      ? block.optionSource.source
      : null;
  const isModelChoice = modelSource !== null;
  const modelLabel = modelSource
    ? FORM_MODEL_OPTION_SOURCE_OPTIONS.find((source) => source.value === modelSource)?.label
    : null;

  return (
    <View style={styles.block} wrap={false}>
      <Text style={styles.question}>
        {index}. {block.title} {block.required ? <Text style={styles.required}>*</Text> : null}
      </Text>
      {block.description ? <Text style={styles.description}>{block.description}</Text> : null}
      {isModelChoice ? (
        <>
          <Text style={styles.paperHint}>
            {block.type === 'multi_select' ? 'Write one or more' : 'Write one'} ({modelLabel?.toLowerCase() ?? 'available option'}):
          </Text>
          <Lines count={block.type === 'multi_select' ? 3 : 2} />
        </>
      ) : block.type === 'single_choice' || block.type === 'multi_select' ? (
        <View>
          {block.options.map((option) => (
            <View key={option.id} style={styles.option}>
              <Text style={styles.optionMark}>{block.type === 'multi_select' ? '[ ]' : '( )'}</Text>
              <Text>{option.label}</Text>
            </View>
          ))}
        </View>
      ) : block.type === 'long_text' ? (
        <Lines count={6} />
      ) : (
        <Lines count={2} />
      )}
    </View>
  );
}

export function FormPdfDocument({
  formName,
  versionNumber,
  blocks,
}: {
  formName: string;
  versionNumber: number;
  blocks: FormBlock[];
}) {
  let questionNumber = 0;
  return (
    <Document title={formName} author="Altitutor">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{formName}</Text>
        <Text style={styles.meta}>Printable form · Version {versionNumber}</Text>
        <View style={styles.identity}>
          <View style={styles.identityField}><Text style={styles.identityLabel}>Student / parent name</Text><View style={styles.line} /></View>
          <View style={styles.identityField}><Text style={styles.identityLabel}>Date</Text><View style={styles.line} /></View>
        </View>
        {blocks.map((block) => {
          if (block.type !== 'content') questionNumber += 1;
          return <PrintableBlock key={block.id} block={block} index={questionNumber} />;
        })}
        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `${formName} · Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}
